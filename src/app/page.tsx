import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileWarning,
  Timer,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { durationSince, dueLabel, shortDateTime } from "@/lib/format";
import { CURRENT_USER_EMAIL } from "@/lib/current-user";
import { AttentionList, type AttentionItem } from "@/components/attention-list";
import { RunAgentButton } from "@/components/run-agent-button";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"];

export default async function CommandCenterPage() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);

  const [
    currentUser,
    users,
    activeCount,
    blockedCount,
    atRiskCount,
    overdueCount,
    completedThisWeek,
    proposedActions,
    hmReviewCount,
    needsSchedulingCount,
    overdueFeedbackCount,
    pendingOfferApprovals,
    lastRun,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: CURRENT_USER_EMAIL } }),
    db.user.findMany({
      where: { userRole: { in: ["RECRUITER", "HIRING_MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.application.count({ where: { status: "ACTIVE" } }),
    db.application.count({ where: { status: "ACTIVE", momentum: "BLOCKED" } }),
    db.application.count({ where: { status: "ACTIVE", momentum: "AT_RISK" } }),
    db.action.count({ where: { status: { in: OPEN_STATUSES }, dueAt: { lt: now } } }),
    db.action.count({ where: { status: "COMPLETED", completedAt: { gte: weekAgo } } }),
    db.action.findMany({
      where: { status: "PROPOSED" },
      include: {
        owner: true,
        application: {
          include: { candidate: true, role: true, stage: true },
        },
      },
      orderBy: { createdAt: "desc" },
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
    db.application.findMany({
      where: { status: "ACTIVE", stage: { name: "Offer Approval" } },
      select: { stageEnteredAt: true },
    }),
    db.agentRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  const staleOfferApprovals = pendingOfferApprovals.filter(
    (a) => now.getTime() - a.stageEnteredAt.getTime() > 24 * 3600_000
  ).length;

  const items: AttentionItem[] = proposedActions.map((a) => {
    const due = dueLabel(a.dueAt, now);
    const cand = a.application.candidate;
    return {
      actionId: a.id,
      actionTitle: a.title,
      proposedContent: a.proposedContent,
      rationale: a.rationale,
      status: a.status,
      risk: a.risk,
      dueLabel: due.label,
      overdue: due.overdue,
      candidateId: cand.id,
      candidateName: cand.name,
      roleTitle: a.application.role.title,
      stageName: a.application.stage.name,
      timeInStage: durationSince(a.application.stageEnteredAt, now),
      momentum: a.application.momentum,
      blocker: a.application.blockerDescription,
      blockerType: a.application.blockerType,
      ownerId: a.ownerId,
      ownerName: a.owner.name,
      context:
        cand.competingProcess && cand.competingDeadline
          ? `Candidate has ${cand.competingProcess} (${shortDateTime(cand.competingDeadline)})`
          : null,
    };
  });

  const stats = [
    { label: "Active candidates", value: activeCount, icon: Users, tone: "" },
    { label: "Blocked", value: blockedCount, icon: FileWarning, tone: "text-red-600 dark:text-red-400" },
    { label: "At risk", value: atRiskCount, icon: AlertTriangle, tone: "text-orange-600 dark:text-orange-400" },
    { label: "Overdue actions", value: overdueCount, icon: Timer, tone: "text-amber-600 dark:text-amber-400" },
    { label: "Completed this week", value: completedThisWeek, icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  ];

  const brief: { text: string; urgent: boolean }[] = [
    { text: `${hmReviewCount} candidate${hmReviewCount === 1 ? "" : "s"} require hiring-manager review`, urgent: false },
    { text: `${needsSchedulingCount} interview${needsSchedulingCount === 1 ? " needs" : "s need"} scheduling`, urgent: needsSchedulingCount > 0 },
    { text: `${overdueFeedbackCount} scorecard${overdueFeedbackCount === 1 ? "" : "s"} are overdue`, urgent: overdueFeedbackCount > 0 },
    {
      text:
        staleOfferApprovals > 0
          ? `${staleOfferApprovals} offer approval${staleOfferApprovals === 1 ? "" : "s"} waiting more than 24 hours`
          : "No offer approvals are stuck",
      urgent: staleOfferApprovals > 0,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Command Center</h1>
          <p className="text-[13px] text-muted-foreground">
            Every active candidate has a next action, an owner, and a due date.
          </p>
        </div>
        <RunAgentButton />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
              <s.icon className={`size-3.5 ${s.tone}`} strokeWidth={1.75} />
              {s.label}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_290px]">
        <section aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="mb-3 text-sm font-semibold">
            Attention Required
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {items.length}
            </span>
          </h2>
          <AttentionList items={items} currentUserId={currentUser.id} users={users} />
        </section>

        <aside aria-labelledby="agent-summary-heading">
          <h2 id="agent-summary-heading" className="mb-3 text-sm font-semibold">
            Today&apos;s Agent Summary
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
        </aside>
      </div>
    </div>
  );
}
