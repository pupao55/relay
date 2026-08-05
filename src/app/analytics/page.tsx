import { db } from "@/lib/db";
import {
  BlockedOverTimeChart,
  ConversionChart,
  MomentumByRoleChart,
  OverdueByOwnerChart,
  StageWaitChart,
} from "@/components/analytics-charts";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"];
const HOUR = 3600_000;

function fmtHours(h: number): string {
  if (h >= 48) return `${(h / 24).toFixed(1)}d`;
  return `${Math.round(h)}h`;
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <p className="mb-3 mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>
      {children}
    </section>
  );
}

export default async function AnalyticsPage() {
  const now = new Date();

  const [apps, actions, stages, feedback, interviews] = await Promise.all([
    db.application.findMany({
      include: { stage: true, role: true, actions: true },
    }),
    db.action.findMany({ include: { owner: true } }),
    db.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    db.feedback.findMany({ include: { interview: true } }),
    db.interview.findMany(),
  ]);

  const active = apps.filter((a) => a.status === "ACTIVE");

  // -- Execution health stats --------------------------------------------
  const withNextAction = active.filter((a) =>
    a.actions.some((x) => OPEN_STATUSES.includes(x.status))
  );
  const pctNextAction =
    active.length > 0 ? Math.round((withNextAction.length / active.length) * 100) : 100;
  const avgIdleHours =
    active.length > 0
      ? active.reduce((s, a) => s + (now.getTime() - a.lastActivityAt.getTime()) / HOUR, 0) /
        active.length
      : 0;
  const withdrawn = apps.filter((a) => a.status === "WITHDRAWN").length;
  const withdrawalRate = apps.length > 0 ? Math.round((withdrawn / apps.length) * 100) : 0;

  const submitted = feedback.filter((f) => f.submittedAt && f.interview.scheduledAt);
  const avgFeedbackHours =
    submitted.length > 0
      ? submitted.reduce(
          (s, f) => s + (f.submittedAt!.getTime() - f.interview.scheduledAt!.getTime()) / HOUR,
          0
        ) / submitted.length
      : 0;

  // Current waits for the three chokepoints.
  const hmApps = active.filter((a) => a.stage.name === "Hiring Manager Review");
  const avgHmWait =
    hmApps.length > 0
      ? hmApps.reduce((s, a) => s + (now.getTime() - a.stageEnteredAt.getTime()) / HOUR, 0) /
        hmApps.length
      : 0;
  const unscheduled = interviews.filter((iv) => iv.status === "NEEDS_SCHEDULING");
  const pendingOverdueFb = feedback.filter(
    (f) => f.status === "PENDING" && f.dueAt < now && f.interview.status === "COMPLETED"
  );

  // -- Blocked over time (derived: blocked ≈ stage entry + stage SLA) ----
  const blockedNow = active.filter((a) => a.momentum === "BLOCKED" || a.momentum === "AT_RISK");
  const series: { day: string; blocked: number }[] = [];
  for (let d = 13; d >= 0; d--) {
    const dayEnd = new Date(now.getTime() - d * 24 * HOUR);
    const count = blockedNow.filter(
      (a) => a.stageEnteredAt.getTime() + a.stage.slaHours * HOUR <= dayEnd.getTime()
    ).length;
    series.push({
      day: dayEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      blocked: count,
    });
  }

  // -- Overdue actions by owner ------------------------------------------
  const overdueMap = new Map<string, number>();
  for (const a of actions) {
    if (OPEN_STATUSES.includes(a.status) && a.dueAt < now) {
      overdueMap.set(a.owner.name, (overdueMap.get(a.owner.name) ?? 0) + 1);
    }
  }
  const overdueByOwner = [...overdueMap.entries()]
    .map(([owner, overdue]) => ({ owner, overdue }))
    .sort((a, b) => b.overdue - a.overdue);

  // -- Time in stage vs SLA ----------------------------------------------
  const stageWait = stages
    .filter((s) => s.kind !== "TERMINAL")
    .map((s) => {
      const inStage = active.filter((a) => a.stageId === s.id);
      const avg =
        inStage.length > 0
          ? inStage.reduce((sum, a) => sum + (now.getTime() - a.stageEnteredAt.getTime()) / HOUR, 0) /
            inStage.length
          : 0;
      return { stage: s.name, avgHours: Math.round(avg), slaHours: s.slaHours };
    })
    .filter((s) => s.avgHours > 0 || s.slaHours <= 168);

  // -- Stage conversion ---------------------------------------------------
  const conversion = stages
    .filter((s) => s.kind !== "TERMINAL")
    .map((s) => ({
      stage: s.name,
      reached: apps.filter((a) => a.stage.order >= s.order).length,
    }));

  // -- Momentum by role ---------------------------------------------------
  const roleMap = new Map<string, { moving: number; slowing: number; blocked: number }>();
  for (const a of active) {
    const entry = roleMap.get(a.role.title) ?? { moving: 0, slowing: 0, blocked: 0 };
    if (a.momentum === "MOVING") entry.moving++;
    else if (a.momentum === "SLOWING") entry.slowing++;
    else entry.blocked++;
    roleMap.set(a.role.title, entry);
  }
  const momentumByRole = [...roleMap.entries()].map(([role, v]) => ({ role, ...v }));

  const stats = [
    {
      label: "Applications with a valid next action",
      value: `${pctNextAction}%`,
      sub: `${withNextAction.length} of ${active.length} active`,
      alert: pctNextAction < 100,
    },
    { label: "Average idle time", value: fmtHours(avgIdleHours), sub: "across active candidates" },
    { label: "Withdrawal rate", value: `${withdrawalRate}%`, sub: `${withdrawn} of ${apps.length} applications` },
    { label: "Feedback turnaround", value: fmtHours(avgFeedbackHours), sub: "interview → scorecard, submitted only" },
    { label: "Hiring-manager review wait", value: fmtHours(avgHmWait), sub: `${hmApps.length} currently waiting · SLA 48h`, alert: avgHmWait > 48 },
    { label: "Awaiting scheduling / scorecards", value: `${unscheduled.length} / ${pendingOverdueFb.length}`, sub: "unscheduled interviews / overdue scorecards", alert: unscheduled.length + pendingOverdueFb.length > 0 },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
        <p className="text-[13px] text-muted-foreground">
          Candidate movement, not vanity metrics: where processes wait, and on whom.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-3.5 py-3">
            <div className="text-[11px] font-medium leading-snug text-muted-foreground">{s.label}</div>
            <div
              className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${
                s.alert ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {s.value}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section
          title="Blocked candidates over time"
          sub="Candidates whose stage exceeded its SLA, by day (last 14 days)"
        >
          <BlockedOverTimeChart data={series} />
        </Section>

        <Section title="Overdue actions by owner" sub="Open actions past their due date">
          {overdueByOwner.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              No overdue actions. The pipeline is current.
            </p>
          ) : (
            <OverdueByOwnerChart data={overdueByOwner} />
          )}
        </Section>

        <Section
          title="Time in stage vs SLA"
          sub="Average current wait per stage against its SLA — reviews and approvals are the chokepoints"
        >
          <StageWaitChart data={stageWait} />
        </Section>

        <Section
          title="Stage conversion"
          sub="Applications that reached each stage (all-time, all roles)"
        >
          <ConversionChart data={conversion} />
        </Section>

        <div className="lg:col-span-2">
          <Section
            title="Movement by role"
            sub="Momentum of active candidates per role — where recruiting attention should go"
          >
            <MomentumByRoleChart data={momentumByRole} />
          </Section>
        </div>
      </div>
    </div>
  );
}
