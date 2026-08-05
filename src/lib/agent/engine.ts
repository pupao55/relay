// Deterministic agent engine.
//
// This module is pure: it takes a snapshot of an application (plus `now`) and
// returns recommendations, derived momentum, risk, and blocker state. It never
// touches the database and never uses randomness or wall-clock time directly,
// which makes it fully testable and auditable.
//
// The interface is deliberately shaped like a future LLM call site: to connect
// the Anthropic API, `recommendForApplication` becomes the fallback/skeleton
// and a model proposes `Recommendation` objects that are validated against the
// same schema before entering the approval pipeline. See ARCHITECTURE.md.

import type { Prisma } from "@prisma/client";
import type {
  ActionType,
  BlockerType,
  Momentum,
  RiskLevel,
} from "../types";
import { ALWAYS_APPROVAL_ACTION_TYPES } from "../types";

export type AppSnapshot = Prisma.ApplicationGetPayload<{
  include: {
    candidate: true;
    role: { include: { recruiter: true; hiringManager: true } };
    stage: true;
    source: true;
    interviews: {
      include: {
        feedback: { include: { interviewer: true } };
        panelists: { include: { user: true } };
      };
    };
    communications: true;
    actions: true;
  };
}>;

export interface Recommendation {
  ruleKey: string;
  type: ActionType;
  title: string;
  proposedContent: string;
  rationale: string;
  supportingFacts: string[];
  ownerId: string;
  recipientId: string | null;
  risk: RiskLevel;
  dueAt: Date;
  /** True when this action may never auto-execute regardless of rule mode. */
  requiresApproval: boolean;
}

export interface DerivedState {
  momentum: Momentum;
  risk: RiskLevel;
  blockerType: BlockerType;
  blockerDescription: string | null;
}

export interface EngineResult {
  derived: DerivedState;
  recommendations: Recommendation[];
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function hoursBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / HOUR);
}

export function businessDaysBetween(a: Date, b: Date): number {
  let count = 0;
  const d = new Date(a);
  d.setHours(0, 0, 0, 0);
  const end = new Date(b);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

const OPEN_ACTION_STATUSES = ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"];

function openActionsOfType(app: AppSnapshot, type: ActionType) {
  return app.actions.filter(
    (a) => a.type === type && OPEN_ACTION_STATUSES.includes(a.status)
  );
}

function firstName(full: string): string {
  return full.split(" ")[0];
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Derived state: momentum / risk / blocker
// ---------------------------------------------------------------------------

export function deriveState(app: AppSnapshot, now: Date): DerivedState {
  if (app.status !== "ACTIVE") {
    return { momentum: "MOVING", risk: "LOW", blockerType: "NONE", blockerDescription: null };
  }

  const hoursInStage = hoursBetween(app.stageEnteredAt, now);
  const sla = app.stage.slaHours;
  const cand = app.candidate;

  let blockerType: BlockerType = "NONE";
  let blockerDescription: string | null = null;

  // Overdue feedback blocks harder than generic stage idling.
  const overdueFeedback = app.interviews.flatMap((iv) =>
    iv.feedback.filter((f) => f.status === "PENDING" && f.dueAt < now)
  );
  const unscheduled = app.interviews.filter(
    (iv) => iv.status === "NEEDS_SCHEDULING"
  );

  if (overdueFeedback.length > 0) {
    blockerType = "FEEDBACK";
    const names = overdueFeedback.map((f) => f.interviewer.name).join(", ");
    blockerDescription = `Scorecard${overdueFeedback.length > 1 ? "s" : ""} overdue from ${names}`;
  } else if (unscheduled.length > 0 && hoursBetween(app.lastActivityAt, now) > 24) {
    blockerType = "SCHEDULING";
    blockerDescription = `${unscheduled[0].name} has not been scheduled`;
  } else if (hoursInStage > sla) {
    switch (app.stage.name) {
      case "Recruiter Review":
        blockerType = "RECRUITER";
        blockerDescription = `Application unreviewed by ${app.role.recruiter.name} for ${Math.floor(hoursInStage / 24)}d`;
        break;
      case "Hiring Manager Review":
        blockerType = "HIRING_MANAGER";
        blockerDescription = `${app.role.hiringManager.name} has not reviewed the profile`;
        break;
      case "Offer Approval":
        blockerType = "OFFER_APPROVAL";
        blockerDescription = `Offer approval pending for ${Math.floor(hoursInStage / 24 * 10) / 10 >= 1 ? Math.floor(hoursInStage / 24) + "d" : hoursInStage + "h"}`;
        break;
      default:
        blockerType = "NONE";
    }
  }

  const competingSoon =
    cand.competingDeadline !== null &&
    cand.competingDeadline.getTime() - now.getTime() < 3 * DAY &&
    cand.competingDeadline.getTime() > now.getTime() - DAY;

  let momentum: Momentum;
  if (competingSoon && (blockerType !== "NONE" || hoursInStage > sla)) {
    momentum = "AT_RISK";
  } else if (blockerType !== "NONE" || hoursInStage > 2 * sla) {
    momentum = "BLOCKED";
  } else if (hoursInStage > sla) {
    momentum = "SLOWING";
  } else {
    momentum = "MOVING";
  }
  if (competingSoon && momentum === "MOVING") momentum = "SLOWING";

  let risk: RiskLevel = "LOW";
  if (momentum === "SLOWING") risk = "MEDIUM";
  if (momentum === "BLOCKED") risk = "HIGH";
  if (momentum === "AT_RISK") risk = "HIGH";
  if (
    momentum === "AT_RISK" &&
    cand.competingDeadline !== null &&
    cand.competingDeadline.getTime() - now.getTime() < 2 * DAY
  ) {
    risk = "CRITICAL";
  }
  if (app.actions.length > 0 && openActionsOfType(app as AppSnapshot, "DATA_INTEGRITY").length > 0) {
    risk = "CRITICAL";
  }

  return { momentum, risk, blockerType, blockerDescription };
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export interface RuleContext {
  now: Date;
  /** ruleKey -> automation mode, from the ActionRule table. */
  ruleModes: Record<string, string>;
  /** Other open roles in the org, for redirection matching. */
  openRoles: {
    id: string;
    title: string;
    requiredCriteria: string;
    recruiterId: string;
    hiringManagerId: string;
  }[];
  /** Candidate ids that already have an ACTIVE application somewhere. */
  activeCandidateIds: Set<string>;
}

export function recommendForApplication(
  app: AppSnapshot,
  ctx: RuleContext
): EngineResult {
  const { now } = ctx;
  const derived = deriveState(app, now);
  const recs: Recommendation[] = [];

  const cand = app.candidate;
  const role = app.role;
  const recruiter = role.recruiter;
  const hm = role.hiringManager;
  const hoursInStage = hoursBetween(app.stageEnteredAt, now);
  const competing =
    cand.competingProcess && cand.competingDeadline
      ? `${cand.name} has ${cand.competingProcess.toLowerCase().startsWith("final") || cand.competingProcess.toLowerCase().startsWith("offer") ? "a " : ""}${cand.competingProcess} on ${fmtDate(cand.competingDeadline)}`
      : null;

  const push = (r: Omit<Recommendation, "requiresApproval">) => {
    if (ctx.ruleModes[r.ruleKey] === "DISABLED") return;
    recs.push({
      ...r,
      requiresApproval:
        ALWAYS_APPROVAL_ACTION_TYPES.includes(r.type) ||
        r.risk === "HIGH" ||
        r.risk === "CRITICAL" ||
        ctx.ruleModes[r.ruleKey] !== "AUTO_INTERNAL",
    });
  };

  if (app.status === "ACTIVE") {
    // Rule 1 — recruiter review due within 24h
    if (
      app.stage.name === "Recruiter Review" &&
      hoursInStage > 24 &&
      openActionsOfType(app, "REMINDER").length === 0
    ) {
      push({
        ruleKey: "recruiter-review-24h",
        type: "REMINDER",
        title: `Remind ${recruiter.name} to review ${cand.name}`,
        proposedContent: `${firstName(recruiter.name)} — ${cand.name} (${role.title}, via ${app.source.name}) has been waiting in recruiter review for ${Math.floor(hoursInStage / 24)} day(s). Please review today so we stay inside the 24h SLA.`,
        rationale: `Recruiter review SLA is 24h; this application has been unreviewed for ${hoursInStage}h.`,
        supportingFacts: [
          `Entered Recruiter Review ${Math.floor(hoursInStage / 24)}d ${hoursInStage % 24}h ago`,
          `Recruiter review SLA: 24h`,
          `Source: ${app.source.name}`,
        ],
        ownerId: recruiter.id,
        recipientId: recruiter.id,
        risk: "LOW",
        dueAt: new Date(now.getTime() + 8 * HOUR),
      });
    }

    // Rules 2 & escalation — hiring manager review 48h / 72h
    if (app.stage.name === "Hiring Manager Review" && hoursInStage > 48) {
      const escalate = hoursInStage > 72;
      const already = openActionsOfType(app, escalate ? "ESCALATION" : "REMINDER");
      if (already.length === 0) {
        if (escalate) {
          push({
            ruleKey: "hm-review-48h",
            type: "ESCALATION",
            title: `Escalate ${cand.name}'s review — ${hm.name} unresponsive for ${Math.floor(hoursInStage / 24)}d`,
            proposedContent: `Escalation to ${recruiter.name}: ${hm.name} has not reviewed ${cand.name} (${role.title}) after ${Math.floor(hoursInStage / 24)} days and one reminder.${competing ? ` ${competing} — we risk losing the candidate.` : ""} Recommend a direct ping plus offering to pre-screen on their behalf.`,
            rationale: `Hiring-manager review has exceeded the 72h escalation threshold (${hoursInStage}h).`,
            supportingFacts: [
              `In Hiring Manager Review for ${Math.floor(hoursInStage / 24)}d`,
              `HM review SLA: 48h, escalation at 72h`,
              ...(competing ? [competing] : []),
              `${hm.name}'s median response time: ${hm.avgResponseHours}h`,
            ],
            ownerId: recruiter.id,
            recipientId: hm.id,
            risk: competing ? "CRITICAL" : "HIGH",
            dueAt: new Date(now.getTime() + 4 * HOUR),
          });
        } else {
          push({
            ruleKey: "hm-review-48h",
            type: "REMINDER",
            title: `Ask ${hm.name} to review ${cand.name} today`,
            proposedContent: `${firstName(hm.name)} — ${cand.name} is waiting on your review for ${role.title} (${Math.floor(hoursInStage / 24)} days in queue).${competing ? ` Heads up: ${competing.toLowerCase()}. A same-day review keeps us competitive.` : " A quick yes/no keeps the pipeline moving."}${competing ? ` I'll send ${firstName(cand.name)} a brief status update once you've looked.` : ""}`,
            rationale: `Hiring-manager review has exceeded the 48h SLA (${hoursInStage}h in stage).${competing ? " Candidate has a competing process, so delay is costly." : ""}`,
            supportingFacts: [
              `In Hiring Manager Review for ${Math.floor(hoursInStage / 24)}d ${hoursInStage % 24}h`,
              `HM review SLA: 48h`,
              ...(competing ? [competing] : []),
            ],
            ownerId: recruiter.id,
            recipientId: hm.id,
            risk: competing ? "HIGH" : "MEDIUM",
            dueAt: new Date(now.getTime() + 6 * HOUR),
          });
        }
      }
    }

    // Rule 3 — interview feedback due within 12h of interview completion
    for (const iv of app.interviews) {
      if (iv.status !== "COMPLETED") continue;
      const overdue = iv.feedback.filter(
        (f) => f.status === "PENDING" && f.dueAt < now
      );
      if (overdue.length === 0) continue;
      if (openActionsOfType(app, "FEEDBACK_REQUEST").length > 0) continue;
      const names = overdue.map((f) => f.interviewer.name);
      push({
        ruleKey: "feedback-12h",
        type: "FEEDBACK_REQUEST",
        title: `Chase ${names.length > 1 ? `${names.length} scorecards` : `${names[0]}'s scorecard`} for ${cand.name}`,
        proposedContent: `Reminder to ${names.join(" and ")}: your scorecard for ${cand.name}'s ${iv.name} is overdue. The debrief cannot proceed without it — please submit within the next few hours.`,
        rationale: `Feedback SLA is 12h post-interview; ${names.length} scorecard(s) are overdue.`,
        supportingFacts: [
          `${iv.name} completed ${iv.scheduledAt ? fmtDate(iv.scheduledAt) : "recently"}`,
          `Feedback SLA: 12h`,
          `Outstanding: ${names.join(", ")}`,
        ],
        ownerId: recruiter.id,
        recipientId: overdue[0].interviewerId,
        risk: "LOW",
        dueAt: new Date(now.getTime() + 4 * HOUR),
      });
    }

    // Scheduling — interviews sitting in NEEDS_SCHEDULING
    for (const iv of app.interviews) {
      if (iv.status !== "NEEDS_SCHEDULING") continue;
      if (openActionsOfType(app, "SCHEDULING").length > 0) continue;
      push({
        ruleKey: "scheduling-24h",
        type: "SCHEDULING",
        title: `Schedule ${cand.name}'s ${iv.name}`,
        proposedContent: `Propose interview slots to ${cand.name} for the ${iv.name} (${iv.durationMins} min).${competing ? ` ${competing} — offer the earliest available panel.` : " Aim for the next 2 business days."}`,
        rationale: `An approved interview has no scheduled time${competing ? " and the candidate has a competing deadline" : ""}.`,
        supportingFacts: [
          `${iv.name} approved but unscheduled`,
          ...(competing ? [competing] : []),
        ],
        ownerId: recruiter.id,
        recipientId: null,
        risk: competing ? "HIGH" : "MEDIUM",
        dueAt: new Date(now.getTime() + 24 * HOUR),
      });
    }

    // Rule 4 — candidate update every 3 business days
    const bdSinceUpdate = businessDaysBetween(app.lastCandidateUpdateAt, now);
    if (
      bdSinceUpdate >= 3 &&
      openActionsOfType(app, "CANDIDATE_UPDATE").length === 0
    ) {
      push({
        ruleKey: "candidate-update-3bd",
        type: "CANDIDATE_UPDATE",
        title: `Send ${cand.name} a status update`,
        proposedContent: `Hi ${firstName(cand.name)},\n\nThanks for your patience — a quick update on your ${role.title} process. You're currently in ${app.stage.name.toLowerCase()} and we expect next steps within the next 1–2 business days. We'll come back to you the moment we have them.\n\nBest,\n${recruiter.name}`,
        rationale: `No candidate-facing update in ${bdSinceUpdate} business days; policy is every 3.`,
        supportingFacts: [
          `Last candidate-facing update: ${fmtDate(app.lastCandidateUpdateAt)}`,
          `Policy: update every 3 business days`,
          ...(competing ? [competing] : []),
        ],
        ownerId: recruiter.id,
        recipientId: null,
        risk: "MEDIUM",
        dueAt: new Date(now.getTime() + 12 * HOUR),
      });
    }

    // Rule 5 — offer approval escalated after 24h
    if (app.stage.name === "Offer Approval" && hoursInStage > 24) {
      if (openActionsOfType(app, "OFFER_APPROVAL").length === 0) {
        push({
          ruleKey: "offer-approval-24h",
          type: "OFFER_APPROVAL",
          title: `Escalate offer approval for ${cand.name}`,
          proposedContent: `Offer approval for ${cand.name} (${role.title}) has been pending for ${hoursInStage}h. Escalate to the approval chain and confirm compensation sign-off today.${competing ? ` ${competing}.` : ""}`,
          rationale: `Offer approvals should clear within 24h; this one has waited ${hoursInStage}h.`,
          supportingFacts: [
            `Entered Offer Approval ${hoursInStage}h ago`,
            `Offer approval SLA: 24h`,
            ...(competing ? [competing] : []),
          ],
          ownerId: recruiter.id,
          recipientId: hm.id,
          risk: competing ? "CRITICAL" : "HIGH",
          dueAt: new Date(now.getTime() + 4 * HOUR),
        });
      }
    }

    // Rule 6 — idle 7 days: full process review
    const idleHours = hoursBetween(app.lastActivityAt, now);
    if (idleHours > 7 * 24 && openActionsOfType(app, "TASK").length === 0) {
      push({
        ruleKey: "idle-7d",
        type: "TASK",
        title: `Review ${cand.name}'s stalled process`,
        proposedContent: `${cand.name} (${role.title}) has had no meaningful activity for ${Math.floor(idleHours / 24)} days. Review the process end-to-end: confirm the candidate is still engaged, identify the blocker, and either restart the process or close it out cleanly.`,
        rationale: `No activity for ${Math.floor(idleHours / 24)} days; the 7-idle-day policy requires a process review.`,
        supportingFacts: [
          `Last activity: ${fmtDate(app.lastActivityAt)}`,
          `Idle-day policy: 7 days`,
        ],
        ownerId: recruiter.id,
        recipientId: null,
        risk: "HIGH",
        dueAt: new Date(now.getTime() + 24 * HOUR),
      });
    }

    // Integrity — an active application must always have a next action.
    const openActions = app.actions.filter((a) =>
      OPEN_ACTION_STATUSES.includes(a.status)
    );
    if (openActions.length === 0 && recs.length === 0) {
      push({
        ruleKey: "no-next-action",
        type: "DATA_INTEGRITY",
        title: `No next action defined for ${cand.name}`,
        proposedContent: `${cand.name} (${role.title}) is active in ${app.stage.name} but has no owner or next action. This is an error state: assign an owner and define the next step immediately.`,
        rationale: `Every active application must have a next action, an owner, and a due date. This one has none.`,
        supportingFacts: [
          `Status: ACTIVE, stage: ${app.stage.name}`,
          `Open actions: 0`,
        ],
        ownerId: recruiter.id,
        recipientId: null,
        risk: "CRITICAL",
        dueAt: new Date(now.getTime() + 2 * HOUR),
      });
    }
  }

  // Redirection — rejected for role-specific reasons, matches another open role.
  if (
    app.status === "REJECTED" &&
    app.resolutionReason &&
    !ctx.activeCandidateIds.has(app.candidateId) &&
    openActionsOfType(app, "REDIRECTION").length === 0 &&
    app.actions.every((a) => a.type !== "REDIRECTION")
  ) {
    const strengths: string[] = JSON.parse(cand.strengths);
    const strengthText = strengths.join(" ").toLowerCase();
    let best: { roleId: string; title: string; overlap: string[] } | null = null;
    for (const r of ctx.openRoles) {
      if (r.id === app.roleId) continue;
      const criteria: string[] = JSON.parse(r.requiredCriteria);
      const overlap = criteria.filter((c) =>
        c
          .toLowerCase()
          .split(/[^a-z+]+/)
          .some((w) => w.length > 3 && strengthText.includes(w))
      );
      if (overlap.length > 0 && (!best || overlap.length > best.overlap.length)) {
        best = { roleId: r.id, title: r.title, overlap };
      }
    }
    if (best) {
      push({
        ruleKey: "redirection",
        type: "REDIRECTION",
        title: `Consider ${cand.name} for ${best.title}`,
        proposedContent: `${cand.name} was closed out on ${role.title} (${app.resolutionReason}) but their profile matches ${best.title} on: ${best.overlap.join("; ")}. Propose redirecting them into that pipeline with a warm note rather than a cold rejection.`,
        rationale: `Rejection was role-specific, not a signal on the candidate. Their strengths overlap ${best.overlap.length} required criteria on ${best.title}.`,
        supportingFacts: [
          `Rejected from ${role.title}: ${app.resolutionReason}`,
          `Matching criteria on ${best.title}: ${best.overlap.join("; ")}`,
        ],
        ownerId: recruiter.id,
        recipientId: null,
        risk: "MEDIUM",
        dueAt: new Date(ctx.now.getTime() + 48 * HOUR),
      });
    }
  }

  return { derived, recommendations: recs };
}
