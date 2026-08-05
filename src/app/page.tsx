import {
  AlertTriangle,
  CalendarClock,
  Gauge,
  Scale,
  Siren,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { durationSince, dueLabel, shortDateTime } from "@/lib/format";
import { CURRENT_USER_EMAIL } from "@/lib/current-user";
import { AttentionList, type AttentionItem } from "@/components/attention-list";
import type { ExecutionState } from "@/components/status-badges";
import type { HmReviewData } from "@/components/hm-review-sheet";
import { RunAgentButton } from "@/components/run-agent-button";
import { ALWAYS_APPROVAL_ACTION_TYPES, type ActionType } from "@/lib/types";

export const dynamic = "force-dynamic";

const HOUR = 3600_000;

export default async function CommandCenterPage() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * HOUR);

  const [
    currentUser,
    users,
    activeApps,
    proposedActions,
    completedAgentActions,
    autoExecutedToday,
    hmReviewCount,
    needsSchedulingCount,
    overdueFeedbackCount,
    lastRun,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: CURRENT_USER_EMAIL } }),
    db.user.findMany({
      where: { userRole: { in: ["RECRUITER", "HIRING_MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.application.findMany({
      where: { status: "ACTIVE" },
      include: { actions: true, candidate: true },
    }),
    db.action.findMany({
      where: { status: "PROPOSED" },
      include: {
        owner: true,
        application: {
          include: {
            candidate: true,
            source: true,
            stage: true,
            role: { include: { hiringManager: true, recruiter: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.action.findMany({
      where: { status: "COMPLETED", createdBy: "AGENT", completedAt: { gte: weekAgo } },
      select: { createdAt: true, completedAt: true },
    }),
    db.action.count({
      where: {
        approvalMode: "AUTO",
        createdBy: "AGENT",
        createdAt: { gte: new Date(now.getTime() - 24 * HOUR) },
      },
    }),
    db.application.count({
      where: { status: "ACTIVE", stage: { name: "Hiring Manager Review" } },
    }),
    db.interview.count({
      where: { status: "NEEDS_SCHEDULING", application: { status: "ACTIVE" } },
    }),
    db.feedback.count({
      where: { status: "PENDING", dueAt: { lt: now }, interview: { status: "COMPLETED" } },
    }),
    db.agentRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  // ---- Execution state per proposed action ------------------------------
  const stateFor = (a: (typeof proposedActions)[number], overdue: boolean): ExecutionState => {
    if (a.type === "DATA_INTEGRITY") return "UNOWNED";
    const m = a.application.momentum;
    if (m === "AT_RISK") return "AT_RISK";
    if (m === "BLOCKED") return "BLOCKED";
    if (overdue) return "OVERDUE";
    if (m === "SLOWING") return "SLOWING";
    return "MOVING";
  };

  const items: AttentionItem[] = proposedActions.map((a) => {
    const due = dueLabel(a.dueAt, now);
    const app = a.application;
    const cand = app.candidate;
    const isHmReview = app.stage.name === "Hiring Manager Review";

    let hmReview: HmReviewData | null = null;
    if (isHmReview) {
      const strengths: string[] = JSON.parse(cand.strengths);
      const concerns: string[] = JSON.parse(cand.concerns);
      const required: string[] = JSON.parse(app.role.requiredCriteria);
      const profileText = (strengths.join(" ") + " " + cand.summary).toLowerCase();
      hmReview = {
        applicationId: app.id,
        candidateName: cand.name,
        currentTitle: cand.currentTitle,
        currentCompany: cand.currentCompany,
        roleTitle: app.role.title,
        hmName: app.role.hiringManager.name,
        summary: cand.summary,
        evidence: required.map((criterion) => ({
          criterion,
          hit: criterion
            .toLowerCase()
            .split(/[^a-z+]+/)
            .some((w) => w.length > 3 && profileText.includes(w)),
        })),
        primaryConcern: concerns[0] ?? null,
        timingRisk:
          cand.competingProcess && cand.competingDeadline
            ? `${cand.competingProcess} on ${shortDateTime(cand.competingDeadline)}`
            : null,
        timeInStage: durationSince(app.stageEnteredAt, now),
        sourceName: app.source.name,
      };
    }

    return {
      actionId: a.id,
      actionTitle: a.title,
      proposedContent: a.proposedContent,
      rationale: a.rationale,
      escalationNote: a.escalationNote,
      status: a.status,
      risk: a.risk,
      dueLabel: due.label,
      overdue: due.overdue,
      candidateId: cand.id,
      candidateName: cand.name,
      roleTitle: app.role.title,
      stageName: app.stage.name,
      timeInStage: durationSince(app.stageEnteredAt, now),
      momentum: app.momentum,
      state: stateFor(a, due.overdue),
      blocker: app.blockerDescription,
      blockerType: app.blockerType,
      ownerId: a.ownerId,
      ownerName: a.owner.name,
      context:
        cand.competingProcess && cand.competingDeadline
          ? `${cand.name.split(" ")[0]} has ${cand.competingProcess} on ${shortDateTime(cand.competingDeadline)}`
          : null,
      hmReview,
    };
  });

  // ---- Intervention summary ---------------------------------------------
  const interventionCandidates = new Set(
    items.filter((i) => i.state !== "MOVING" && i.state !== "SLOWING").map((i) => i.candidateId)
  );
  const autoExecutable = proposedActions.filter(
    (a) => a.risk === "LOW" && !ALWAYS_APPROVAL_ACTION_TYPES.includes(a.type as ActionType)
  ).length;
  const humanJudgment = proposedActions.length - autoExecutable;
  const withdrawalRisk = new Set(
    items.filter((i) => i.state === "AT_RISK").map((i) => i.candidateId)
  ).size;

  // ---- Idle candidate-days ----------------------------------------------
  // Outstanding = Σ over active applications of days since last activity.
  const idleDaysOutstanding = activeApps.reduce(
    (sum, a) => sum + Math.floor((now.getTime() - a.lastActivityAt.getTime()) / (24 * HOUR)),
    0
  );
  // Resolved = Σ over Relay actions completed this week of (completed − created) in days:
  // the time the blocker had been standing when the action closed it.
  const idleDaysResolved =
    Math.round(
      completedAgentActions.reduce(
        (sum, a) => sum + (a.completedAt!.getTime() - a.createdAt.getTime()) / (24 * HOUR),
        0
      ) * 10
    ) / 10;

  const tiles = [
    {
      label: "Candidates requiring intervention",
      value: interventionCandidates.size,
      sub: "blocked, at risk, overdue, or unowned",
      icon: AlertTriangle,
      tone: "text-red-600 dark:text-red-400",
    },
    {
      label: "Relay executes automatically",
      value: autoExecutable + autoExecutedToday,
      sub:
        autoExecutable > 0
          ? `${autoExecutedToday} sent today · ${autoExecutable} awaiting batch approval`
          : `internal reminders sent in the last 24h — no approval needed`,
      icon: Zap,
      tone: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Decisions needing human judgment",
      value: humanJudgment,
      sub: "candidate-facing, escalations, redirects",
      icon: Scale,
      tone: "text-foreground",
    },
    {
      label: "Immediate withdrawal risk",
      value: withdrawalRisk,
      sub: "competing deadlines inside 3 days",
      icon: Siren,
      tone: "text-orange-600 dark:text-orange-400",
    },
  ];

  const brief: { text: string; urgent: boolean }[] = [
    { text: `${hmReviewCount} candidate${hmReviewCount === 1 ? "" : "s"} waiting on hiring-manager review`, urgent: false },
    { text: `${needsSchedulingCount} interview${needsSchedulingCount === 1 ? " needs" : "s need"} scheduling`, urgent: needsSchedulingCount > 0 },
    { text: `${overdueFeedbackCount} scorecard${overdueFeedbackCount === 1 ? " is" : "s are"} overdue`, urgent: overdueFeedbackCount > 0 },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {interventionCandidates.size > 0 ? (
              <>
                {interventionCandidates.size} candidate
                {interventionCandidates.size === 1 ? " needs" : "s need"} intervention now
              </>
            ) : (
              "Every candidate is owned and moving"
            )}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {activeApps.length} active candidates — every one has a next action, an owner, and a
            due date. These are the ones where the clock is losing.
          </p>
        </div>
        <RunAgentButton />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border bg-card px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
              <t.icon className={`size-3.5 ${t.tone}`} strokeWidth={1.75} />
              {t.label}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{t.value}</div>
            <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{t.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_290px]">
        <section aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="mb-3 text-sm font-semibold">
            Interventions
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {items.length}
            </span>
          </h2>
          <AttentionList items={items} currentUserId={currentUser.id} users={users} />
        </section>

        <aside aria-labelledby="brief-heading" className="space-y-4">
          <div>
            <h2 id="brief-heading" className="mb-3 text-sm font-semibold">
              Today&apos;s execution brief
            </h2>
            <div className="rounded-lg border border-border bg-card p-4">
              <ul className="space-y-2.5">
                {brief.map((b) => (
                  <li key={b.text} className="flex items-start gap-2 text-[13px] leading-snug">
                    <span
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                        b.urgent ? "bg-red-500" : "bg-neutral-300 dark:bg-neutral-600"
                      }`}
                      aria-hidden
                    />
                    {b.text}
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Gauge className="size-3.5" /> Idle candidate-days
                </div>
                <div className="mt-1.5 flex items-baseline gap-3">
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{idleDaysOutstanding}</div>
                    <div className="text-[10.5px] text-muted-foreground">outstanding now</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {idleDaysResolved}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">resolved this week</div>
                  </div>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">
                  Days candidates have sat without activity; resolved = blocker age closed out by
                  completed Relay actions. Full formula in Analytics.
                </p>
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <CalendarClock className="size-3.5" /> Last agent pass
                </div>
                {lastRun ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {shortDateTime(lastRun.startedAt)} — {lastRun.summary}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">No agent pass yet.</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
