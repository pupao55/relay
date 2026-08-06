import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Star } from "lucide-react";
import { db } from "@/lib/db";
import { durationSince } from "@/lib/format";
import { BLOCKER_LABELS, type BlockerType } from "@/lib/types";
import { CompareDialog } from "@/components/compare-dialog";
import type { HmReviewData } from "@/components/hm-review-sheet";
import { MomentumBadge, RiskBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";

export const dynamic = "force-dynamic";

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();

  const role = await db.role.findUnique({
    where: { id },
    include: {
      recruiter: true,
      hiringManager: true,
      applications: {
        include: {
          candidate: true,
          stage: true,
          source: true,
          actions: { include: { owner: true } },
          interviews: { include: { feedback: { include: { interviewer: true } } } },
          communications: {
            where: { channel: "NOTE" },
            orderBy: { sentAt: "desc" },
            take: 3,
            include: { sentBy: true },
          },
        },
      },
    },
  });
  if (!role) notFound();

  const stages = await db.pipelineStage.findMany({ orderBy: { order: "asc" } });
  const required: string[] = JSON.parse(role.requiredCriteria);
  const preferred: string[] = JSON.parse(role.preferredCriteria);

  const active = role.applications.filter((a) => a.status === "ACTIVE");
  const pipeline = stages
    .filter((s) => s.kind !== "TERMINAL")
    .map((s) => ({
      stage: s,
      apps: active.filter((a) => a.stageId === s.id),
    }));

  const buildCompare = (
    app: (typeof role.applications)[number]
  ): HmReviewData & { candidateId: string } => {
    const cand = app.candidate;
    const strengths: string[] = JSON.parse(cand.strengths);
    const concerns: string[] = JSON.parse(cand.concerns);
    const prior: { company: string; title: string; years: string }[] = JSON.parse(
      cand.priorCompanies
    );
    const profileText = (strengths.join(" ") + " " + cand.summary).toLowerCase();
    return {
      candidateId: cand.id,
      applicationId: app.id,
      candidateName: cand.name,
      currentTitle: cand.currentTitle,
      currentCompany: cand.currentCompany,
      roleTitle: role.title,
      hmName: role.hiringManager.name,
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
          ? `${cand.competingProcess} on ${cand.competingDeadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : null,
      timeInStage: durationSince(app.stageEnteredAt, now),
      sourceName: app.source.name,
      history: prior.map((p) => `${p.company} · ${p.title} · ${p.years}`),
      notes: app.communications.map((c) => ({
        author: c.sentBy?.name ?? "Team",
        when: `${durationSince(c.sentAt, now)} ago`,
        body: c.body,
      })),
    };
  };

  // Common blockers
  const blockerCounts = new Map<string, number>();
  for (const a of active) {
    if (a.blockerType !== "NONE") {
      blockerCounts.set(a.blockerType, (blockerCounts.get(a.blockerType) ?? 0) + 1);
    }
  }
  const blockers = [...blockerCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Team response times: recruiter, HM, and everyone who owes/owed feedback on this role.
  const interviewers = new Map<string, { name: string; hours: number }>();
  for (const a of role.applications) {
    for (const iv of a.interviews) {
      for (const f of iv.feedback) {
        interviewers.set(f.interviewerId, {
          name: f.interviewer.name,
          hours: f.interviewer.avgResponseHours,
        });
      }
    }
  }
  const team = [
    { name: role.recruiter.name, title: "Recruiter", hours: role.recruiter.avgResponseHours },
    { name: role.hiringManager.name, title: "Hiring manager", hours: role.hiringManager.avgResponseHours },
    ...[...interviewers.values()].map((v) => ({ name: v.name, title: "Interviewer", hours: v.hours })),
  ].filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i);

  // Recommended interventions: open agent-proposed actions on this role.
  const interventions = role.applications
    .flatMap((a) => a.actions.map((x) => ({ ...x, candidate: a.candidate })))
    .filter((x) => x.status === "PROPOSED")
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  const maxHours = Math.max(...team.map((t) => t.hours), 1);

  return (
    <div>
      <Link
        href="/roles"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Roles
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{role.title}</h1>
          <p className="text-sm text-muted-foreground">
            {role.department} · {role.location} · open {durationSince(role.openedAt, now)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[13px]">
          <span className="flex items-center gap-1.5">
            <UserAvatar name={role.recruiter.name} size="sm" />
            <span>
              <span className="text-muted-foreground">Recruiter</span>{" "}
              <span className="font-medium">{role.recruiter.name}</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <UserAvatar name={role.hiringManager.name} size="sm" />
            <span>
              <span className="text-muted-foreground">HM</span>{" "}
              <span className="font-medium">{role.hiringManager.name}</span>
            </span>
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Hiring brief</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{role.hiringBrief}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <h3 className="text-[13px] font-medium text-muted-foreground">Required</h3>
                <ul className="mt-1.5 space-y-1">
                  {required.map((c) => (
                    <li key={c} className="flex items-start gap-1.5 text-[13px] leading-snug">
                      <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[13px] font-medium text-muted-foreground">Preferred</h3>
                <ul className="mt-1.5 space-y-1">
                  {preferred.map((c) => (
                    <li key={c} className="flex items-start gap-1.5 text-[13px] leading-snug">
                      <Star className="mt-0.5 size-3 shrink-0 text-amber-500" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Pipeline</h2>
            <div className="mt-3 space-y-3">
              {pipeline.map(({ stage, apps }) => (
                <div key={stage.id}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      {stage.name}
                      {apps.length > 1 && (
                        <CompareDialog
                          items={apps.map(buildCompare)}
                          rankable={stage.name === "Hiring Manager Review"}
                        />
                      )}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {apps.length} candidate{apps.length === 1 ? "" : "s"} · SLA {stage.slaHours}h
                    </span>
                  </div>
                  {apps.length > 0 && (
                    <ul className="mt-1.5 space-y-1.5">
                      {apps.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5"
                        >
                          <span className="flex items-center gap-2">
                            <UserAvatar name={a.candidate.name} size="sm" />
                            <Link
                              href={`/candidates/${a.candidate.id}`}
                              className="text-[13px] font-medium hover:underline"
                            >
                              {a.candidate.name}
                            </Link>
                            <MomentumBadge momentum={a.momentum} />
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {durationSince(a.stageEnteredAt, now)} in stage
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {active.length === 0 && (
                <p className="rounded-md border border-dashed border-border py-6 text-center text-[13px] text-muted-foreground">
                  No active candidates in this pipeline.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Common blockers</h2>
            {blockers.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">No active blockers. Pipeline is healthy.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {blockers.map(([type, count]) => (
                  <li key={type} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-1.5">
                      <CircleAlert className="size-3 text-red-500" />
                      {BLOCKER_LABELS[type as BlockerType] ?? type}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Team response times</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Median hours to respond to requests</p>
            <ul className="mt-2.5 space-y-2">
              {team.map((t) => (
                <li key={t.name} className="text-[13px]">
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="font-medium">{t.name}</span>{" "}
                      <span className="text-muted-foreground">· {t.title}</span>
                    </span>
                    <span className={`tabular-nums ${t.hours > 36 ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      {t.hours}h
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${t.hours > 36 ? "bg-red-500" : t.hours > 20 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, (t.hours / maxHours) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Recommended interventions</h2>
            {interventions.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">Nothing pending — Relay has no open proposals for this role.</p>
            ) : (
              <ul className="mt-2 space-y-2.5">
                {interventions.map((x) => (
                  <li key={x.id} className="text-[13px] leading-snug">
                    <div className="flex items-start gap-1.5">
                      <ArrowRight className="mt-0.5 size-3 shrink-0 text-blue-600 dark:text-blue-400" />
                      <div>
                        <Link href={`/candidates/${x.candidate.id}`} className="font-medium hover:underline">
                          {x.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <RiskBadge risk={x.risk} />
                          <span className="text-muted-foreground">owner {x.owner.name.split(" ")[0]}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
