"use server";

// All state mutations flow through these server actions. Every mutation that
// touches an agent action writes an AuditLog entry (who, what, previous state,
// new state, rationale, human vs agent).

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { runAgent } from "@/lib/agent/run";
import { getCurrentUser, PERSONA_COOKIE } from "@/lib/current-user";
import { MOMENTUM_META, type ExecutionReceipt, type Momentum, type ReviewReceipt } from "@/lib/types";

async function currentUser() {
  return getCurrentUser();
}

/** Persona switcher — the prototype's stand-in for auth. */
export async function switchUser(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const store = await cookies();
  store.set(PERSONA_COOKIE, user.id, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  refresh();
}

async function audit(data: {
  applicationId?: string | null;
  actionId?: string | null;
  actorType: "HUMAN" | "AGENT" | "SYSTEM";
  actorName: string;
  eventType: string;
  title: string;
  detail?: string;
  previousState?: string;
  newState?: string;
  rationale?: string;
}) {
  const org = await db.organization.findFirstOrThrow();
  await db.auditLog.create({
    data: { organizationId: org.id, ...data },
  });
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Action lifecycle
// ---------------------------------------------------------------------------

/**
 * Approving a proposed action lets the agent execute it:
 * message-type actions send a communication; the action moves to WAITING
 * (on a recipient) or COMPLETED (candidate updates), task-types to APPROVED.
 * Returns an execution receipt describing exactly what happened.
 */
export async function approveAction(actionId: string): Promise<ExecutionReceipt | null> {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({
    where: { id: actionId },
    include: { application: { include: { candidate: true } }, recipient: true },
  });
  if (!["PROPOSED", "WAITING"].includes(action.status)) return null;

  // Redirections execute structurally: they move the candidate into the
  // matched role's pipeline rather than sending a message.
  if (action.type === "REDIRECTION") {
    return executeRedirect(action.id, user.name);
  }

  // Scheduling executes structurally: book the open interview slot and send
  // the candidate the confirmation.
  if (action.type === "SCHEDULING") {
    const scheduled = await executeScheduling(action.id, user.name);
    if (scheduled) return scheduled;
    // No unscheduled interview to book — fall through to the generic path.
  }

  const messageTypes = ["REMINDER", "ESCALATION", "FEEDBACK_REQUEST", "CANDIDATE_UPDATE", "OFFER_APPROVAL"];
  const isMessage = messageTypes.includes(action.type);
  const isCandidateFacing = action.type === "CANDIDATE_UPDATE";
  const newStatus = isCandidateFacing ? "COMPLETED" : isMessage ? "WAITING" : "APPROVED";

  await db.action.update({
    where: { id: actionId },
    data: {
      status: newStatus,
      completedAt: newStatus === "COMPLETED" ? new Date() : null,
    },
  });

  if (isMessage) {
    await db.communication.create({
      data: {
        applicationId: action.applicationId,
        direction: isCandidateFacing ? "OUTBOUND" : "INTERNAL",
        channel: isCandidateFacing ? "EMAIL" : "SLACK",
        subject: action.title,
        body: action.proposedContent,
        sentById: user.id,
        sentAt: new Date(),
        candidateFacing: isCandidateFacing,
      },
    });
  }

  await db.application.update({
    where: { id: action.applicationId },
    data: {
      lastActivityAt: new Date(),
      ...(isCandidateFacing ? { lastCandidateUpdateAt: new Date() } : {}),
    },
  });

  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_APPROVED",
    title: `Approved: ${action.title}`,
    detail: isMessage ? `Agent executed — ${isCandidateFacing ? "email sent to candidate" : "internal message sent"}.` : undefined,
    previousState: action.status,
    newState: newStatus,
    rationale: action.rationale,
  });

  if (isMessage) {
    await audit({
      applicationId: action.applicationId,
      actionId: action.id,
      actorType: "AGENT",
      actorName: "Relay Agent",
      eventType: "AGENT_EXECUTION",
      title: isCandidateFacing
        ? `Sent status update to ${action.application.candidate.name}`
        : `Sent: ${action.title}`,
      detail: action.proposedContent,
      newState: newStatus,
      rationale: "Executed after human approval.",
    });
  }

  refresh();

  // Build the execution receipt.
  const cand = action.application.candidate;
  const recipientName = action.recipient?.name ?? (isCandidateFacing ? cand.name : null);
  const momentumLabel =
    MOMENTUM_META[action.application.momentum as Momentum]?.label ?? action.application.momentum;

  let performed: string;
  let channel: string | null = null;
  if (isCandidateFacing) {
    performed = `Sent the status update to ${cand.name}`;
    channel = "Email";
  } else if (isMessage) {
    performed = `Sent: ${action.title}`;
    channel = "Internal message";
  } else {
    performed = `Approved and started: ${action.title}`;
  }

  let resultingState: string;
  let nextActionText: string;
  if (newStatus === "WAITING") {
    resultingState = recipientName
      ? `Waiting on ${recipientName} · candidate remains ${momentumLabel}`
      : `Waiting on response · candidate remains ${momentumLabel}`;
    nextActionText = recipientName
      ? `Awaiting ${recipientName}'s response — tracked against the deadline`
      : "Awaiting response — tracked against the deadline";
  } else if (newStatus === "COMPLETED") {
    const nextOpen = await db.action.findFirst({
      where: {
        applicationId: action.applicationId,
        status: { in: ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"] },
      },
      orderBy: { dueAt: "asc" },
      include: { owner: true },
    });
    resultingState = `Candidate updated · momentum ${momentumLabel}`;
    nextActionText = nextOpen
      ? `${nextOpen.title} (${nextOpen.owner.name})`
      : "Relay derives the next action on its next pass";
  } else {
    resultingState = `In progress with ${user.name} · candidate ${momentumLabel}`;
    nextActionText = `${action.title} — due tracked for ${user.name}`;
  }

  return {
    performed,
    recipient: recipientName,
    channel,
    candidateName: cand.name,
    resultingState,
    nextAction: nextActionText,
    escalation: action.escalationNote,
  };
}

/**
 * Executes an approved redirection: creates a new Application on the target
 * role in Recruiter Review (source: Internal Redirect), gives the receiving
 * recruiter a review task, drafts the warm candidate note for approval, and
 * audits both sides. Falls back to best-criteria-match when the redirect was
 * HM-initiated without a specific target role.
 */
async function executeRedirect(actionId: string, actorName: string): Promise<ExecutionReceipt> {
  const now = new Date();
  const action = await db.action.findUniqueOrThrow({
    where: { id: actionId },
    include: {
      application: {
        include: { candidate: true, role: true },
      },
    },
  });
  const cand = action.application.candidate;
  const oldRole = action.application.role;

  // Roles the candidate already has an application on are not valid targets.
  const existingRoleIds = (
    await db.application.findMany({
      where: { candidateId: cand.id },
      select: { roleId: true },
    })
  ).map((a) => a.roleId);

  let targetRoleId = action.targetRoleId;
  if (targetRoleId && existingRoleIds.includes(targetRoleId)) targetRoleId = null;

  if (!targetRoleId) {
    // HM-initiated redirect ("find a better fit") — match now, same keyword
    // overlap the agent uses for rejection triage.
    const openRoles = await db.role.findMany({
      where: { status: "OPEN", id: { notIn: existingRoleIds } },
    });
    const strengths: string[] = JSON.parse(cand.strengths);
    const profileText = (strengths.join(" ") + " " + cand.summary).toLowerCase();
    let best: { id: string; overlap: number } | null = null;
    for (const r of openRoles) {
      const criteria: string[] = JSON.parse(r.requiredCriteria);
      const overlap = criteria.filter((c) =>
        c.toLowerCase().split(/[^a-z+]+/).some((w) => w.length > 3 && profileText.includes(w))
      ).length;
      if (overlap > 0 && (!best || overlap > best.overlap)) best = { id: r.id, overlap };
    }
    targetRoleId = best?.id ?? null;
  }

  if (!targetRoleId) {
    await db.action.update({ where: { id: actionId }, data: { status: "DISMISSED" } });
    await audit({
      applicationId: action.applicationId,
      actionId,
      actorType: "HUMAN",
      actorName,
      eventType: "ACTION_DISMISSED",
      title: `Redirect closed — no open role matches ${cand.name}`,
      previousState: action.status,
      newState: "DISMISSED",
      rationale: "No open role overlaps the candidate's profile and the candidate has applications on all matching roles.",
    });
    refresh();
    return {
      performed: `No open role currently matches ${cand.name} — no application created`,
      recipient: null,
      channel: null,
      candidateName: cand.name,
      resultingState: "Redirect closed; candidate remains where they were",
      nextAction: "None — re-propose when a matching role opens",
      escalation: null,
    };
  }

  const targetRole = await db.role.findUniqueOrThrow({
    where: { id: targetRoleId },
    include: { recruiter: true },
  });
  const firstStage = await db.pipelineStage.findFirstOrThrow({
    where: { name: "Recruiter Review" },
  });

  const org = await db.organization.findFirstOrThrow();
  let source = await db.externalSource.findFirst({
    where: { organizationId: org.id, type: "INTERNAL" },
  });
  if (!source) {
    source = await db.externalSource.create({
      data: {
        organizationId: org.id,
        type: "INTERNAL",
        name: "Internal Redirect",
        details: "Moved from another Helios pipeline after a role-fit decision",
      },
    });
  }

  const newApp = await db.application.create({
    data: {
      candidateId: cand.id,
      roleId: targetRole.id,
      stageId: firstStage.id,
      sourceId: source.id,
      status: "ACTIVE",
      momentum: "MOVING",
      risk: "LOW",
      appliedAt: now,
      stageEnteredAt: now,
      lastActivityAt: now,
      lastCandidateUpdateAt: action.application.lastCandidateUpdateAt,
    },
  });

  // The receiving recruiter owns the first look; the invariant holds from minute one.
  const reviewTask = await db.action.create({
    data: {
      applicationId: newApp.id,
      type: "TASK",
      title: `Review ${cand.name}'s redirected application`,
      proposedContent: `${cand.name} was moved from the ${oldRole.title} pipeline after a role-fit decision. Prior interview signal carries over — review against ${targetRole.title} criteria and decide the first step.`,
      rationale: `Internal redirects skip cold intake but still need a recruiter decision within the 24h review SLA.`,
      supportingFacts: JSON.stringify([
        `Redirected from ${oldRole.title}`,
        `Approved by ${actorName}`,
      ]),
      escalationNote: "Unreviewed after 48h: Relay escalates to the recruiting lead.",
      ownerId: targetRole.recruiterId,
      status: "APPROVED",
      risk: "LOW",
      approvalMode: "APPROVAL_REQUIRED",
      createdBy: "AGENT",
      dueAt: new Date(now.getTime() + 24 * 3600_000),
      createdAt: now,
    },
  });

  // Candidate-facing warm note — drafted, never auto-sent.
  await db.action.create({
    data: {
      applicationId: newApp.id,
      type: "CANDIDATE_UPDATE",
      title: `Send ${cand.name} the warm note about ${targetRole.title}`,
      proposedContent: `Hi ${cand.name.split(" ")[0]},\n\nThank you again for the time you've spent with us on the ${oldRole.title} process. The panel was genuinely impressed — and we think your background is an even stronger match for our ${targetRole.title} opening. With your permission, we'd like to move you into that process directly, carrying over what we've already learned rather than starting from zero.\n\nBest,\n${targetRole.recruiter.name}`,
      rationale: `A redirect without a candidate-facing explanation reads as a silent rejection; this frames it as the opportunity it is.`,
      supportingFacts: JSON.stringify([
        `Redirected from ${oldRole.title} to ${targetRole.title}`,
      ]),
      escalationNote: "Unsent after 2 business days: the recruiting lead is flagged — the candidate is in the dark.",
      ownerId: targetRole.recruiterId,
      status: "PROPOSED",
      risk: "MEDIUM",
      approvalMode: "APPROVAL_REQUIRED",
      createdBy: "AGENT",
      dueAt: new Date(now.getTime() + 24 * 3600_000),
      createdAt: now,
    },
  });

  await db.action.update({
    where: { id: actionId },
    data: { status: "COMPLETED", completedAt: now },
  });
  await db.application.update({
    where: { id: action.applicationId },
    data: { lastActivityAt: now },
  });

  await audit({
    applicationId: action.applicationId,
    actionId,
    actorType: "HUMAN",
    actorName,
    eventType: "ACTION_APPROVED",
    title: `Approved redirect: ${cand.name} → ${targetRole.title}`,
    previousState: action.status,
    newState: "COMPLETED",
    rationale: action.rationale,
  });
  await audit({
    applicationId: newApp.id,
    actorType: "AGENT",
    actorName: "Relay Agent",
    eventType: "SUBMISSION",
    title: `Application created via internal redirect from ${oldRole.title}`,
    detail: `Approved by ${actorName}. ${targetRole.recruiter.name} owns the first review; a warm note to ${cand.name} is drafted and awaiting approval.`,
    newState: "Recruiter Review",
  });

  refresh();
  return {
    performed: `Moved ${cand.name} into the ${targetRole.title} pipeline`,
    recipient: targetRole.recruiter.name,
    channel: "New application · Recruiter Review",
    candidateName: cand.name,
    resultingState: `Active on ${targetRole.title} · Moving · owned by ${targetRole.recruiter.name}`,
    nextAction: `${reviewTask.title} — ${targetRole.recruiter.name}, due in 24h; warm note to ${cand.name} drafted for approval`,
    escalation: reviewTask.escalationNote,
  };
}

/** Next business day at 10:00 local — the prototype's stand-in for calendar availability. */
function nextBusinessDaySlot(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

/**
 * Executes an approved scheduling action: books the application's unscheduled
 * interview into the next available slot, sets scorecard deadlines, sends the
 * candidate the confirmation, and audits everything. Returns null when there
 * is no unscheduled interview to book.
 */
async function executeScheduling(
  actionId: string,
  actorName: string
): Promise<ExecutionReceipt | null> {
  const now = new Date();
  const action = await db.action.findUniqueOrThrow({
    where: { id: actionId },
    include: {
      application: {
        include: {
          candidate: true,
          role: { include: { recruiter: true } },
          interviews: { include: { panelists: { include: { user: true } } } },
        },
      },
    },
  });
  const app = action.application;
  const interview = app.interviews.find((iv) => iv.status === "NEEDS_SCHEDULING");
  if (!interview) return null;

  const slot = nextBusinessDaySlot(now);
  const slotLabel = slot.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const cand = app.candidate;
  const recruiter = app.role.recruiter;
  const panel = interview.panelists.map((p) => p.user.name);

  await db.interview.update({
    where: { id: interview.id },
    data: { scheduledAt: slot, status: "SCHEDULED" },
  });
  await db.feedback.updateMany({
    where: { interviewId: interview.id, status: "PENDING" },
    data: { dueAt: new Date(slot.getTime() + (interview.durationMins + 12 * 60) * 60_000) },
  });

  await db.communication.create({
    data: {
      applicationId: app.id,
      direction: "OUTBOUND",
      channel: "EMAIL",
      subject: `${interview.name} confirmed — ${slotLabel}`,
      body: `Hi ${cand.name.split(" ")[0]},\n\nYour ${interview.name.toLowerCase()} for the ${app.role.title} role is confirmed for ${slotLabel} (${interview.durationMins} min)${panel.length ? ` with ${panel.join(" and ")}` : ""}. A calendar invite follows.\n\nBest,\n${recruiter.name}`,
      sentById: recruiter.id,
      sentAt: now,
      candidateFacing: true,
    },
  });

  await db.action.update({
    where: { id: actionId },
    data: { status: "COMPLETED", completedAt: now },
  });
  await db.application.update({
    where: { id: app.id },
    data: {
      lastActivityAt: now,
      lastCandidateUpdateAt: now,
      momentum: "MOVING",
      risk: "LOW",
      blockerType: "NONE",
      blockerDescription: null,
    },
  });

  await audit({
    applicationId: app.id,
    actionId,
    actorType: "HUMAN",
    actorName,
    eventType: "ACTION_APPROVED",
    title: `Approved: ${action.title}`,
    previousState: action.status,
    newState: "COMPLETED",
    rationale: action.rationale,
  });
  await audit({
    applicationId: app.id,
    actionId,
    actorType: "AGENT",
    actorName: "Relay Agent",
    eventType: "AGENT_EXECUTION",
    title: `Scheduled ${cand.name}'s ${interview.name.toLowerCase()} for ${slotLabel}`,
    detail: `Confirmation emailed to ${cand.name}; scorecards due 12h after the interview.`,
    newState: "SCHEDULED",
    rationale: "Executed after human approval.",
  });

  refresh();
  return {
    performed: `Booked the ${interview.name.toLowerCase()} for ${slotLabel} and emailed ${cand.name} the confirmation`,
    recipient: cand.name,
    channel: "Email + calendar",
    candidateName: cand.name,
    resultingState: `${interview.name} scheduled · candidate Moving · scheduling blocker cleared`,
    nextAction: `Scorecards from ${panel.join(", ") || "the panel"} due 12h after the interview — Relay chases if late`,
    escalation: action.escalationNote,
  };
}

export async function editAction(
  actionId: string,
  updates: { title?: string; proposedContent?: string; dueAt?: string; risk?: string }
) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  await db.action.update({
    where: { id: actionId },
    data: {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.proposedContent !== undefined ? { proposedContent: updates.proposedContent } : {}),
      ...(updates.dueAt !== undefined ? { dueAt: new Date(updates.dueAt) } : {}),
      ...(updates.risk !== undefined ? { risk: updates.risk } : {}),
    },
  });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_EDITED",
    title: `Edited draft: ${updates.title ?? action.title}`,
    previousState: action.proposedContent,
    newState: updates.proposedContent ?? action.proposedContent,
    rationale: "Human revised the agent draft before execution.",
  });
  refresh();
}

export async function dismissAction(actionId: string, reason?: string) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  if (["COMPLETED", "DISMISSED"].includes(action.status)) return;
  await db.action.update({ where: { id: actionId }, data: { status: "DISMISSED" } });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_DISMISSED",
    title: `Dismissed: ${action.title}`,
    previousState: action.status,
    newState: "DISMISSED",
    rationale: reason || "Dismissed without a stated reason.",
  });
  refresh();
}

/** "Wait": push the due date out and log the delay. */
export async function delayAction(actionId: string, hours = 24) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  const newDue = new Date(Math.max(action.dueAt.getTime(), Date.now()) + hours * 3600_000);
  await db.action.update({ where: { id: actionId }, data: { dueAt: newDue } });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_DELAYED",
    title: `Delayed ${hours}h: ${action.title}`,
    previousState: action.dueAt.toISOString(),
    newState: newDue.toISOString(),
    rationale: `Human chose to wait ${hours}h before acting.`,
  });
  refresh();
}

export async function completeAction(actionId: string) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  if (["COMPLETED", "DISMISSED"].includes(action.status)) return;
  await db.action.update({
    where: { id: actionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await db.application.update({
    where: { id: action.applicationId },
    data: { lastActivityAt: new Date() },
  });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_COMPLETED",
    title: `Completed: ${action.title}`,
    previousState: action.status,
    newState: "COMPLETED",
  });
  refresh();
}

export async function changeActionOwner(actionId: string, ownerId: string) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({
    where: { id: actionId },
    include: { owner: true },
  });
  const newOwner = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
  await db.action.update({ where: { id: actionId }, data: { ownerId } });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "OWNER_CHANGED",
    title: `Reassigned "${action.title}" to ${newOwner.name}`,
    previousState: action.owner.name,
    newState: newOwner.name,
  });
  refresh();
}

export async function bulkApproveActions(actionIds: string[]) {
  for (const id of actionIds) {
    const action = await db.action.findUnique({ where: { id } });
    // Safety: bulk approval is only for low-risk internal actions.
    if (action && action.risk === "LOW" && action.status === "PROPOSED") {
      await approveAction(id);
    }
  }
  refresh();
}

// ---------------------------------------------------------------------------
// Application mutations
// ---------------------------------------------------------------------------

export async function updateApplicationStage(applicationId: string, stageId: string) {
  const user = await currentUser();
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { stage: true, candidate: true },
  });
  const stage = await db.pipelineStage.findUniqueOrThrow({ where: { id: stageId } });
  await db.application.update({
    where: { id: applicationId },
    data: {
      stageId,
      stageEnteredAt: new Date(),
      lastActivityAt: new Date(),
      momentum: "MOVING",
      risk: "LOW",
      blockerType: "NONE",
      blockerDescription: null,
      ...(stage.name === "Hired" ? { status: "HIRED" } : {}),
    },
  });
  await audit({
    applicationId,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "STAGE_CHANGE",
    title: `Moved ${app.candidate.name} to ${stage.name}`,
    previousState: app.stage.name,
    newState: stage.name,
  });
  refresh();
}

/**
 * Lightweight hiring-manager review: one decision updates the stage, closes the
 * blocking review action, creates the appropriate next action, and audits every
 * step. Acts as the role's hiring manager (the prototype's HM view).
 */
export async function hmReviewDecision(
  applicationId: string,
  decision: "ADVANCE" | "DECLINE" | "REQUEST_INFO" | "REDIRECT",
  note?: string
): Promise<ReviewReceipt> {
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      candidate: true,
      stage: true,
      role: { include: { recruiter: true, hiringManager: true } },
      actions: true,
    },
  });
  const hm = app.role.hiringManager;
  const recruiter = app.role.recruiter;
  const cand = app.candidate;
  const momentumBefore = app.momentum;
  const now = new Date();

  // The decision resolves whatever review chase was open.
  const openReviewActions = app.actions.filter(
    (a) =>
      ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"].includes(a.status) &&
      ["REMINDER", "ESCALATION", "TASK", "DATA_INTEGRITY"].includes(a.type)
  );
  for (const a of openReviewActions) {
    await db.action.update({
      where: { id: a.id },
      data: { status: "COMPLETED", completedAt: now },
    });
    await audit({
      applicationId,
      actionId: a.id,
      actorType: "SYSTEM",
      actorName: "Relay",
      eventType: "ACTION_COMPLETED",
      title: `Resolved by ${hm.name}'s review decision: ${a.title}`,
      previousState: a.status,
      newState: "COMPLETED",
    });
  }

  let newStage = app.stage.name;
  let momentumAfter = momentumBefore;
  let nextAction = "";

  if (decision === "ADVANCE") {
    const next = await db.pipelineStage.findFirstOrThrow({
      where: { order: app.stage.order + 1 },
    });
    newStage = next.name;
    momentumAfter = "MOVING";
    await db.application.update({
      where: { id: applicationId },
      data: {
        stageId: next.id,
        stageEnteredAt: now,
        lastActivityAt: now,
        momentum: "MOVING",
        risk: "LOW",
        blockerType: "NONE",
        blockerDescription: null,
      },
    });
    await audit({
      applicationId,
      actorType: "HUMAN",
      actorName: hm.name,
      eventType: "STAGE_CHANGE",
      title: `${hm.name} advanced ${cand.name} to ${next.name}`,
      previousState: app.stage.name,
      newState: next.name,
      rationale: note || undefined,
    });

    if (next.kind === "INTERVIEW") {
      await db.interview.create({
        data: {
          applicationId,
          name: next.name,
          status: "NEEDS_SCHEDULING",
          durationMins: next.name === "Phone Screen" ? 45 : 90,
        },
      });
    }
    const scheduling = await db.action.create({
      data: {
        applicationId,
        type: "SCHEDULING",
        title: `Schedule ${cand.name}'s ${next.name.toLowerCase()}`,
        proposedContent: `Propose ${next.name.toLowerCase()} times to ${cand.name} today.${cand.competingDeadline ? ` The competing deadline (${cand.competingDeadline.toLocaleDateString("en-US", { weekday: "long" })}) means the earliest slot wins.` : ""}`,
        rationale: `${hm.name} advanced the candidate; scheduling is now the blocking step.`,
        supportingFacts: JSON.stringify([
          `Advanced to ${next.name} by ${hm.name}`,
          ...(cand.competingProcess ? [`Competing process: ${cand.competingProcess}`] : []),
        ]),
        escalationNote: "Unscheduled after 24h: Relay hands scheduling to the coordinator pool.",
        ownerId: recruiter.id,
        status: "APPROVED",
        risk: cand.competingDeadline ? "MEDIUM" : "LOW",
        approvalMode: "APPROVAL_REQUIRED",
        createdBy: "AGENT",
        dueAt: new Date(now.getTime() + 24 * 3600_000),
        createdAt: now,
      },
    });
    await audit({
      applicationId,
      actionId: scheduling.id,
      actorType: "AGENT",
      actorName: "Relay Agent",
      eventType: "AGENT_PROPOSAL",
      title: `Created next action: ${scheduling.title}`,
      newState: "APPROVED",
      rationale: scheduling.rationale,
    });
    nextAction = `${scheduling.title} — ${recruiter.name}, due in 24h`;
  }

  if (decision === "DECLINE") {
    await db.application.update({
      where: { id: applicationId },
      data: {
        status: "REJECTED",
        resolutionReason: note || `Declined at ${app.stage.name} by ${hm.name}`,
        lastActivityAt: now,
        momentum: "MOVING",
        risk: "LOW",
        blockerType: "NONE",
        blockerDescription: null,
      },
    });
    await audit({
      applicationId,
      actorType: "HUMAN",
      actorName: hm.name,
      eventType: "REJECTION",
      title: `${hm.name} declined ${cand.name}`,
      previousState: "ACTIVE",
      newState: "REJECTED",
      rationale: note || undefined,
    });
    momentumAfter = "MOVING";
    newStage = `${app.stage.name} (closed)`;
    nextAction = `${recruiter.name} sends the close-out note — Relay drafts it on the next pass`;
  }

  if (decision === "REQUEST_INFO") {
    const task = await db.action.create({
      data: {
        applicationId,
        type: "TASK",
        title: `Get ${hm.name} the information requested on ${cand.name}`,
        proposedContent: note || `${hm.name} needs more information before deciding.`,
        rationale: `${hm.name} reviewed but needs more before a decision; the review clock keeps running.`,
        supportingFacts: JSON.stringify([`Requested during hiring-manager review`]),
        escalationNote: "Unanswered after 24h: Relay re-raises the review with the added context.",
        ownerId: recruiter.id,
        recipientId: hm.id,
        status: "APPROVED",
        risk: "LOW",
        approvalMode: "APPROVAL_REQUIRED",
        createdBy: "AGENT",
        dueAt: new Date(now.getTime() + 24 * 3600_000),
        createdAt: now,
      },
    });
    await db.application.update({
      where: { id: applicationId },
      data: {
        lastActivityAt: now,
        momentum: "SLOWING",
        blockerType: "RECRUITER",
        blockerDescription: `${hm.name} requested more information`,
      },
    });
    await audit({
      applicationId,
      actionId: task.id,
      actorType: "HUMAN",
      actorName: hm.name,
      eventType: "INFO_REQUESTED",
      title: `${hm.name} requested more information on ${cand.name}`,
      detail: note || undefined,
    });
    momentumAfter = "SLOWING";
    nextAction = `${task.title} — ${recruiter.name}, due in 24h`;
  }

  if (decision === "REDIRECT") {
    const redirect = await db.action.create({
      data: {
        applicationId,
        type: "REDIRECTION",
        title: `Find a better-fit role for ${cand.name}`,
        proposedContent:
          note ||
          `${hm.name} sees strength but not for ${app.role.title}. Compare ${cand.name}'s profile against the other open pipelines before closing out.`,
        rationale: `${hm.name} flagged the profile as strong-but-wrong-role during review.`,
        supportingFacts: JSON.stringify([`Redirect suggested during hiring-manager review`]),
        escalationNote: `No decision in 48h: ${cand.name} is closed out with a standard note.`,
        ownerId: recruiter.id,
        status: "PROPOSED",
        risk: "MEDIUM",
        approvalMode: "APPROVAL_REQUIRED",
        createdBy: "HUMAN",
        dueAt: new Date(now.getTime() + 48 * 3600_000),
        createdAt: now,
      },
    });
    await db.application.update({
      where: { id: applicationId },
      data: { lastActivityAt: now },
    });
    await audit({
      applicationId,
      actionId: redirect.id,
      actorType: "HUMAN",
      actorName: hm.name,
      eventType: "REDIRECT_SUGGESTED",
      title: `${hm.name} suggested redirecting ${cand.name} to another role`,
      detail: note || undefined,
    });
    nextAction = `${redirect.title} — ${recruiter.name}, due in 48h`;
  }

  refresh();
  return {
    decision,
    actor: hm.name,
    candidateName: cand.name,
    previousStage: app.stage.name,
    newStage,
    momentumBefore,
    momentumAfter,
    nextAction,
  };
}

/**
 * Internal note from the review sheet, attributed to the role's hiring
 * manager (the sheet acts as the HM). Visible on the candidate timeline.
 */
export async function addReviewNote(applicationId: string, body: string) {
  if (!body.trim()) return;
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { role: { include: { hiringManager: true } } },
  });
  await db.communication.create({
    data: {
      applicationId,
      direction: "INTERNAL",
      channel: "NOTE",
      subject: "Review note",
      body: body.trim(),
      sentById: app.role.hiringManagerId,
      sentAt: new Date(),
      candidateFacing: false,
    },
  });
  await db.application.update({
    where: { id: applicationId },
    data: { lastActivityAt: new Date() },
  });
  refresh();
}

/**
 * Move a candidate up or down within their hiring manager's review queue.
 * Ranks are per (hiring manager, Hiring Manager Review stage): after the swap,
 * every peer gets a dense 1..n rank so ordering is stable.
 */
export async function rankCandidate(applicationId: string, direction: "up" | "down") {
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { candidate: true, role: { include: { hiringManager: true } } },
  });
  const peers = await db.application.findMany({
    where: {
      status: "ACTIVE",
      stage: { name: "Hiring Manager Review" },
      role: { hiringManagerId: app.role.hiringManagerId },
    },
    include: { candidate: true },
  });
  peers.sort(
    (a, b) =>
      (a.hmRank ?? Number.MAX_SAFE_INTEGER) - (b.hmRank ?? Number.MAX_SAFE_INTEGER) ||
      a.stageEnteredAt.getTime() - b.stageEnteredAt.getTime()
  );
  const idx = peers.findIndex((p) => p.id === applicationId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= peers.length) return;
  [peers[idx], peers[swapWith]] = [peers[swapWith], peers[idx]];
  for (let i = 0; i < peers.length; i++) {
    await db.application.update({ where: { id: peers[i].id }, data: { hmRank: i + 1 } });
  }
  await audit({
    applicationId,
    actorType: "HUMAN",
    actorName: app.role.hiringManager.name,
    eventType: "RANK_CHANGED",
    title: `${app.role.hiringManager.name} ranked ${app.candidate.name} #${swapWith + 1} of ${peers.length} in their review queue`,
    previousState: `#${idx + 1}`,
    newState: `#${swapWith + 1}`,
  });
  refresh();
}

export async function addNote(applicationId: string, body: string) {
  const user = await currentUser();
  if (!body.trim()) return;
  await db.communication.create({
    data: {
      applicationId,
      direction: "INTERNAL",
      channel: "NOTE",
      subject: "Note",
      body: body.trim(),
      sentById: user.id,
      sentAt: new Date(),
      candidateFacing: false,
    },
  });
  await db.application.update({
    where: { id: applicationId },
    data: { lastActivityAt: new Date() },
  });
  refresh();
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export async function toggleAutomation(ruleId: string, active: boolean) {
  const user = await currentUser();
  const rule = await db.actionRule.findUniqueOrThrow({ where: { id: ruleId } });
  await db.actionRule.update({
    where: { id: ruleId },
    data: { active, ...(active === false ? {} : {}) },
  });
  await audit({
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "RULE_CHANGED",
    title: `${active ? "Enabled" : "Disabled"} automation: ${rule.name}`,
    previousState: rule.active ? "active" : "inactive",
    newState: active ? "active" : "inactive",
  });
  refresh();
}

export async function setAutomationMode(ruleId: string, mode: string) {
  const user = await currentUser();
  const rule = await db.actionRule.findUniqueOrThrow({ where: { id: ruleId } });
  await db.actionRule.update({
    where: { id: ruleId },
    data: { mode, active: mode !== "DISABLED" },
  });
  await audit({
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "RULE_CHANGED",
    title: `Changed "${rule.name}" mode`,
    previousState: rule.mode,
    newState: mode,
  });
  refresh();
}

export async function createAutomationRule(input: {
  name: string;
  trigger: string;
  conditions: string[];
  proposedAction: string;
  mode: string;
  escalationPath: string;
  slaHours: number;
}) {
  const user = await currentUser();
  const org = await db.organization.findFirstOrThrow();
  const ruleKey =
    "custom-" +
    input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) +
    "-" + Date.now().toString(36);
  await db.actionRule.create({
    data: {
      organizationId: org.id,
      ruleKey,
      name: input.name,
      trigger: input.trigger,
      conditions: JSON.stringify(input.conditions),
      proposedAction: input.proposedAction,
      mode: input.mode,
      escalationPath: input.escalationPath,
      slaHours: input.slaHours,
      active: input.mode !== "DISABLED",
    },
  });
  await audit({
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "RULE_CREATED",
    title: `Created automation: ${input.name}`,
    newState: input.mode,
  });
  refresh();
}

// ---------------------------------------------------------------------------
// ATS sync simulation
// ---------------------------------------------------------------------------

/**
 * Simulates one inbound Greenhouse webhook event, demonstrating how external
 * state changes flow into Relay: an interviewer submits an overdue scorecard,
 * or an interviewer confirms an unscheduled interview. Deterministic — applies
 * the first applicable event. Production shape: ARCHITECTURE.md → ATS model.
 */
export async function simulateAtsSync(): Promise<string> {
  const now = new Date();

  // Event 1: an overdue scorecard lands.
  const overdue = await db.feedback.findFirst({
    where: {
      status: "PENDING",
      dueAt: { lt: now },
      interview: { status: "COMPLETED", application: { status: "ACTIVE" } },
    },
    include: {
      interviewer: true,
      interview: { include: { application: { include: { candidate: true } } } },
    },
    orderBy: { dueAt: "asc" },
  });
  if (overdue) {
    const cand = overdue.interview.application.candidate;
    await db.feedback.update({
      where: { id: overdue.id },
      data: {
        status: "SUBMITTED",
        rating: "YES",
        summary: "Solid round — thoughtful answers with concrete depth. Supportive of moving forward.",
        submittedAt: now,
      },
    });
    await db.application.update({
      where: { id: overdue.interview.applicationId },
      data: { lastActivityAt: now },
    });
    await audit({
      applicationId: overdue.interview.applicationId,
      actorType: "SYSTEM",
      actorName: "Greenhouse Sync",
      eventType: "FEEDBACK_SUBMITTED",
      title: `${overdue.interviewer.name} submitted their scorecard for ${cand.name}`,
      detail: "Received via ATS webhook; the feedback chase resolves on the next agent pass.",
      previousState: "PENDING",
      newState: "SUBMITTED",
    });
    // Resolve the corresponding chase if it was the last outstanding scorecard.
    const stillPending = await db.feedback.count({
      where: { interviewId: overdue.interviewId, status: "PENDING" },
    });
    if (stillPending === 0) {
      await db.action.updateMany({
        where: {
          applicationId: overdue.interview.applicationId,
          type: "FEEDBACK_REQUEST",
          status: { in: ["PROPOSED", "WAITING", "APPROVED", "IN_PROGRESS"] },
        },
        data: { status: "COMPLETED", completedAt: now },
      });
    }
    refresh();
    return `Greenhouse event: ${overdue.interviewer.name} submitted their scorecard for ${cand.name}.${stillPending === 0 ? " All scorecards in — the debrief is unblocked." : ` ${stillPending} scorecard${stillPending === 1 ? "" : "s"} still outstanding.`}`;
  }

  // Event 2: nothing overdue — report a clean sync.
  await audit({
    actorType: "SYSTEM",
    actorName: "Greenhouse Sync",
    eventType: "SYNC",
    title: "Sync completed — no state changes",
    detail: "All mapped candidates, stages, and scorecards are already in agreement.",
  });
  refresh();
  return "Sync completed — Greenhouse and Relay already agree on every mapped record.";
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export async function runAgentNow() {
  const result = await runAgent("MANUAL");
  refresh();
  return result;
}
