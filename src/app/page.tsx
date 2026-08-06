import Link from "next/link";
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
import { getCurrentUser } from "@/lib/current-user";
import { AttentionList, type AttentionItem } from "@/components/attention-list";
import type { ExecutionState } from "@/components/status-badges";
import type { HmReviewData } from "@/components/hm-review-sheet";
import { ReviewQueueCard, type ReviewQueueItem } from "@/components/review-queue-card";
import { RunAgentButton } from "@/components/run-agent-button";
import { ALWAYS_APPROVAL_ACTION_TYPES, type ActionType } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    hmQueueApps,
    waitingActions,
    needsSchedulingCount,
    overdueFeedbackCount,
    lastRun,
  ] = await Promise.all([
    getCurrentUser(),
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
            communications: {
              where: { channel: "NOTE" },
              orderBy: { sentAt: "desc" },
              take: 3,
              include: { sentBy: true },
            },
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
    db.application.findMany({
      where: { status: "ACTIVE", stage: { name: "Hiring Manager Review" } },
      include: {
        candidate: true,
        source: true,
        stage: true,
        role: { include: { hiringManager: true, recruiter: true } },
        communications: {
          where: { channel: "NOTE" },
          orderBy: { sentAt: "desc" },
          take: 3,
          include: { sentBy: true },
        },
      },
      orderBy: { stageEnteredAt: "asc" },
    }),
    db.action.findMany({
      where: { status: "WAITING", recipientId: { not: null } },
      include: { recipient: true, application: { include: { candidate: true } } },
      orderBy: { dueAt: "asc" },
      take: 4,
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

  const buildReview = (app: {
    id: string;
    stageEnteredAt: Date;
    candidate: (typeof proposedActions)[number]["application"]["candidate"];
    source: { name: string };
    role: { title: string; requiredCriteria: string; hiringManager: { name: string } };
    communications: { body: string; sentAt: Date; sentBy: { name: string } | null }[];
  }): HmReviewData => {
    const cand = app.candidate;
    const strengths: string[] = JSON.parse(cand.strengths);
    const concerns: string[] = JSON.parse(cand.concerns);
    const required: string[] = JSON.parse(app.role.requiredCriteria);
    const prior: { company: string; title: string; years: string }[] = JSON.parse(
      cand.priorCompanies
    );
    const profileText = (strengths.join(" ") + " " + cand.summary).toLowerCase();
    return {
      history: prior.map((p) => `${p.company} · ${p.title} · ${p.years}`),
      notes: app.communications.map((c) => ({
        author: c.sentBy?.name ?? "Team",
        when: `${durationSince(c.sentAt, now)} ago`,
        body: c.body,
      })),
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
  };

  // Managers' own stack rank first; unranked candidates fall back to wait time.
  hmQueueApps.sort(
    (a, b) =>
      (a.hmRank ?? Number.MAX_SAFE_INTEGER) - (b.hmRank ?? Number.MAX_SAFE_INTEGER) ||
      a.stageEnteredAt.getTime() - b.stageEnteredAt.getTime()
  );
  const reviewQueue: ReviewQueueItem[] = hmQueueApps.map((app) => ({
    hmName: app.role.hiringManager.name,
    candidateId: app.candidateId,
    candidateName: app.candidate.name,
    roleTitle: app.role.title,
    waitingLabel: `waiting ${durationSince(app.stageEnteredAt, now)}`,
    overSla: now.getTime() - app.stageEnteredAt.getTime() > 48 * HOUR,
    data: buildReview(app),
  }));

  const items: AttentionItem[] = proposedActions.map((a) => {
    const due = dueLabel(a.dueAt, now);
    const app = a.application;
    const cand = app.candidate;
    const hmReview: HmReviewData | null =
      app.stage.name === "Hiring Manager Review" ? buildReview(app) : null;

    return {
      actionId: a.id,
      actionTitle: a.title,
      proposedContent: a.proposedContent,
      rationale: a.rationale,
      escalationNote: a.escalationNote,
      status: a.status,
      risk: a.risk,
      dueLabel: due.label,
      dueTs: a.dueAt.getTime(),
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
      label: "Need intervention",
      value: interventionCandidates.size,
      hint: "Candidates blocked, at risk, overdue, or unowned",
      icon: AlertTriangle,
      tone: "text-red-600 dark:text-red-400",
    },
    {
      label: "Auto-executed",
      value: autoExecutable + autoExecutedToday,
      hint: "Low-risk internal reminders Relay sent in the last 24h",
      icon: Zap,
      tone: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Need your judgment",
      value: humanJudgment,
      hint: "Candidate-facing messages, escalations, and redirects awaiting approval",
      icon: Scale,
      tone: "text-foreground",
    },
    {
      label: "Withdrawal risk",
      value: withdrawalRisk,
      hint: "Competing deadlines inside 3 days",
      icon: Siren,
      tone: "text-orange-600 dark:text-orange-400",
    },
  ];

  const brief: { text: string; urgent: boolean }[] = [
    { text: `${needsSchedulingCount} interview${needsSchedulingCount === 1 ? " needs" : "s need"} scheduling`, urgent: needsSchedulingCount > 0 },
    { text: `${overdueFeedbackCount} scorecard${overdueFeedbackCount === 1 ? " is" : "s are"} overdue`, urgent: overdueFeedbackCount > 0 },
  ];

  // ---- Hiring-manager home: their work, not the recruiter's dashboard ----
  if (currentUser.userRole === "HIRING_MANAGER") {
    const myReviews = reviewQueue.filter((r) => r.hmName === currentUser.name);
    const [myScorecards, myRoles] = await Promise.all([
      db.feedback.findMany({
        where: {
          interviewerId: currentUser.id,
          status: "PENDING",
          interview: { application: { status: "ACTIVE" } },
        },
        include: {
          interview: {
            include: { application: { include: { candidate: true, role: true } } },
          },
        },
        orderBy: { dueAt: "asc" },
      }),
      db.role.findMany({
        where: { hiringManagerId: currentUser.id, status: "OPEN" },
        include: { applications: { where: { status: "ACTIVE" } } },
      }),
    ]);
    const myRoleItems = items.filter((i) =>
      myRoles.some((r) => r.title === i.roleTitle)
    );

    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {myReviews.length > 0
              ? `${myReviews.length} candidate${myReviews.length === 1 ? "" : "s"} waiting on your review`
              : "Your review queue is clear"}
          </h1>
          <RunAgentButton />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_290px]">
          <div className="space-y-6">
            <section aria-label="Waiting on your review">
              <h2 className="mb-3 text-sm font-semibold">Waiting on your review</h2>
              <ReviewQueueCard items={myReviews} currentUserName={currentUser.name} />
            </section>

            <section aria-label="Scorecards you owe">
              <h2 className="mb-3 text-sm font-semibold">
                Scorecards you owe
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {myScorecards.length}
                </span>
              </h2>
              {myScorecards.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-[13px] text-muted-foreground">No scorecards outstanding.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {myScorecards.map((f) => {
                    const d = dueLabel(f.dueAt, now);
                    const app = f.interview.application;
                    return (
                      <li key={f.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                        <Link
                          href={`/candidates/${app.candidate.id}`}
                          className="w-36 shrink-0 truncate text-sm font-medium hover:underline"
                        >
                          {app.candidate.name}
                        </Link>
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {f.interview.name} · {app.role.title}
                        </span>
                        <span
                          className={`w-20 shrink-0 text-right text-xs tabular-nums ${
                            f.interview.status === "COMPLETED" && d.overdue
                              ? "font-medium text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {f.interview.status === "COMPLETED" ? `due ${d.label}` : "after interview"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-label="Your pipelines">
              <h2 className="mb-3 text-sm font-semibold">Your pipelines</h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {myRoles.map((r) => {
                  const active = r.applications;
                  const blocked = active.filter(
                    (a) => a.momentum === "BLOCKED" || a.momentum === "AT_RISK"
                  ).length;
                  return (
                    <li key={r.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <Link
                        href={`/roles/${r.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {active.length} active
                      </span>
                      <span
                        className={`w-20 shrink-0 text-right text-xs tabular-nums ${
                          blocked > 0
                            ? "font-medium text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {blocked > 0 ? `${blocked} blocked` : "healthy"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <div>
              <h2 className="mb-3 text-sm font-semibold">
                Relay is handling
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {myRoleItems.length}
                </span>
              </h2>
              <div className="rounded-lg border border-border bg-card p-4">
                {myRoleItems.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    Nothing pending on your roles.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {myRoleItems.map((i) => (
                      <li key={i.actionId} className="text-xs leading-snug">
                        <Link
                          href={`/candidates/${i.candidateId}`}
                          className="font-medium hover:underline"
                        >
                          {i.candidateName}
                        </Link>
                        <span className="text-muted-foreground"> — {i.actionTitle}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold">Last agent pass</h2>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {lastRun ? `${shortDateTime(lastRun.startedAt)} — ${lastRun.summary}` : "No agent pass yet."}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {interventionCandidates.size > 0 ? (
            <>
              {interventionCandidates.size} of {activeApps.length} candidates need intervention
            </>
          ) : (
            "Every candidate is owned and moving"
          )}
        </h1>
        <RunAgentButton />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} title={t.hint} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
              <t.icon className={`size-4 ${t.tone}`} strokeWidth={1.75} />
              {t.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_290px]">
        <section aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="mb-3 text-sm font-semibold">
            Interventions
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {items.length}
            </span>
          </h2>
          <AttentionList items={items} currentUserId={currentUser.id} users={users} />
        </section>

        <aside className="space-y-4">
          <div>
            <h2 className="mb-3 text-sm font-semibold">
              Review queue
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {reviewQueue.length}
              </span>
            </h2>
            <ReviewQueueCard items={reviewQueue} currentUserName={currentUser.name} />
          </div>
          <div>
            <h2 id="brief-heading" className="mb-3 text-sm font-semibold">
              Today&apos;s execution brief
            </h2>
            <div className="rounded-lg border border-border bg-card p-4">
              <ul className="space-y-2.5">
                {brief.map((b) => (
                  <li key={b.text} className="flex items-start gap-2 text-sm leading-snug">
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
              {waitingActions.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Waiting on replies
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {waitingActions.map((w) => {
                      const d = dueLabel(w.dueAt, now);
                      return (
                        <li key={w.id} className="flex items-baseline gap-2 text-[13px] leading-snug">
                          <span className="w-24 shrink-0 truncate font-medium">
                            {w.recipient!.name}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            re {w.application.candidate.name.split(" ")[0]}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 tabular-nums",
                              d.overdue
                                ? "font-medium text-red-600 dark:text-red-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {d.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Gauge className="size-3.5" /> Idle candidate-days
                </div>
                <div className="mt-1.5 flex items-baseline gap-3">
                  <div>
                    <div className="text-xl font-semibold tabular-nums">{idleDaysOutstanding}</div>
                    <div className="text-xs text-muted-foreground">outstanding now</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {idleDaysResolved}
                    </div>
                    <div className="text-xs text-muted-foreground">resolved this week</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <CalendarClock className="size-3.5" /> Last agent pass
                </div>
                {lastRun ? (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {shortDateTime(lastRun.startedAt)} — {lastRun.summary}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-muted-foreground">No agent pass yet.</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
