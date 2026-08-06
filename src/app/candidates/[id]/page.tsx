import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CalendarClock,
  Check,
  CircleAlert,
  Mail,
  MapPin,
  MessageSquare,
  Minus,
  StickyNote,
  UserRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { durationSince, dueLabel, shortDate, shortDateTime } from "@/lib/format";
import { SOURCE_TYPE_LABELS, type SourceType } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionControls } from "@/components/action-controls";
import { HmReviewSheet, type HmReviewData } from "@/components/hm-review-sheet";
import { NoteForm } from "@/components/note-form";
import { StageSelect } from "@/components/stage-select";
import { MomentumBadge, RiskBadge, SourceBadge, StageBadge, ActionStatusBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"];

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      applications: {
        include: {
          role: { include: { recruiter: true, hiringManager: true } },
          stage: true,
          source: true,
          actions: { include: { owner: true, recipient: true }, orderBy: { dueAt: "asc" } },
          communications: { include: { sentBy: true }, orderBy: { sentAt: "desc" } },
          interviews: {
            include: {
              panelists: { include: { user: true } },
              feedback: { include: { interviewer: true } },
            },
            orderBy: { scheduledAt: "asc" },
          },
          auditLogs: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { appliedAt: "desc" },
      },
    },
  });
  if (!candidate || candidate.applications.length === 0) notFound();

  const app =
    candidate.applications.find((a) => a.status === "ACTIVE") ?? candidate.applications[0];
  const [stages, users, openRoles] = await Promise.all([
    db.pipelineStage.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { userRole: { in: ["RECRUITER", "HIRING_MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.role.findMany({ where: { status: "OPEN", id: { not: app.roleId } } }),
  ]);

  const strengths: string[] = JSON.parse(candidate.strengths);
  const concerns: string[] = JSON.parse(candidate.concerns);
  const prior: { company: string; title: string; years: string }[] = JSON.parse(
    candidate.priorCompanies
  );
  const required: string[] = JSON.parse(app.role.requiredCriteria);
  const preferred: string[] = JSON.parse(app.role.preferredCriteria);

  const strengthText = (strengths.join(" ") + " " + candidate.summary).toLowerCase();
  const criteriaMatch = (c: string) =>
    c.toLowerCase().split(/[^a-z+]+/).filter((w) => w.length > 3).some((w) => strengthText.includes(w));

  const relatedRoles = openRoles
    .map((r) => {
      const crit: string[] = JSON.parse(r.requiredCriteria);
      const overlap = crit.filter(criteriaMatch);
      return { title: r.title, id: r.id, overlap };
    })
    .filter((r) => r.overlap.length >= 2)
    .sort((a, b) => b.overlap.length - a.overlap.length)
    .slice(0, 2);

  const nextAction = app.actions.find((a) => OPEN_STATUSES.includes(a.status));
  const facts: string[] = nextAction ? JSON.parse(nextAction.supportingFacts) : [];
  const nextDue = nextAction ? dueLabel(nextAction.dueAt, now) : null;

  const hmReview: HmReviewData | null =
    app.status === "ACTIVE" && app.stage.name === "Hiring Manager Review"
      ? {
          applicationId: app.id,
          candidateName: candidate.name,
          currentTitle: candidate.currentTitle,
          currentCompany: candidate.currentCompany,
          roleTitle: app.role.title,
          hmName: app.role.hiringManager.name,
          summary: candidate.summary,
          evidence: required.map((criterion) => ({ criterion, hit: criteriaMatch(criterion) })),
          primaryConcern: concerns[0] ?? null,
          timingRisk:
            candidate.competingProcess && candidate.competingDeadline
              ? `${candidate.competingProcess} on ${shortDateTime(candidate.competingDeadline)}`
              : null,
          timeInStage: durationSince(app.stageEnteredAt, now),
          sourceName: app.source.name,
          history: prior.map((p) => `${p.company} · ${p.title} · ${p.years}`),
          notes: app.communications
            .filter((c) => c.channel === "NOTE")
            .slice(0, 3)
            .map((c) => ({
              author: c.sentBy?.name ?? "Team",
              when: `${durationSince(c.sentAt, now)} ago`,
              body: c.body,
            })),
        }
      : null;

  // Timeline: merge audit logs, communications, and interviews.
  type TimelineEvent = {
    ts: Date;
    icon: "bot" | "human" | "system" | "mail" | "note" | "calendar";
    actor: string;
    title: string;
    detail?: string | null;
    meta?: string | null;
  };
  const timeline: TimelineEvent[] = [
    ...app.auditLogs.map((l): TimelineEvent => ({
      ts: l.createdAt,
      icon: l.actorType === "AGENT" ? "bot" : l.actorType === "SYSTEM" ? "system" : "human",
      actor: l.actorName,
      title: l.title,
      detail: l.rationale ?? l.detail,
      meta:
        l.previousState && l.newState && l.previousState !== l.newState
          ? `${l.previousState} → ${l.newState}`
          : null,
    })),
    ...app.communications.map((c): TimelineEvent => ({
      ts: c.sentAt,
      icon: c.channel === "NOTE" ? "note" : "mail",
      actor: c.sentBy?.name ?? (c.direction === "INBOUND" ? candidate.name : "Relay Agent"),
      title:
        c.channel === "NOTE"
          ? "Internal note"
          : `${c.direction === "INBOUND" ? "Received" : c.direction === "INTERNAL" ? "Internal" : "Sent"}: ${c.subject}`,
      detail: c.body,
      meta: c.candidateFacing ? "Candidate-facing" : null,
    })),
    ...app.interviews
      .filter((iv) => iv.scheduledAt)
      .map((iv): TimelineEvent => ({
        ts: iv.scheduledAt!,
        icon: "calendar",
        actor: iv.panelists.map((p) => p.user.name.split(" ")[0]).join(", ") || "Panel",
        title: `${iv.name} — ${iv.status === "COMPLETED" ? "completed" : iv.status === "CANCELLED" ? "cancelled" : "scheduled"}`,
        detail: null,
        meta: `${iv.durationMins} min`,
      })),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime());

  const lastMeaningful = timeline.find((t) => t.ts <= now);

  return (
    <div>
      <Link
        href="/candidates"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Candidates
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <UserAvatar name={candidate.name} size="lg" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{candidate.name}</h1>
            <p className="text-[13px] text-muted-foreground">
              {candidate.currentTitle} at {candidate.currentCompany} · considering{" "}
              <span className="font-medium text-foreground">{app.role.title}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {app.status === "ACTIVE" ? (
                <StageSelect
                  applicationId={app.id}
                  currentStageId={app.stageId}
                  stages={stages}
                />
              ) : (
                <StageBadge name={`${app.status.charAt(0)}${app.status.slice(1).toLowerCase()} — ${app.stage.name}`} />
              )}
              {app.status === "ACTIVE" && <MomentumBadge momentum={app.momentum} />}
              {app.status === "ACTIVE" && <RiskBadge risk={app.risk} />}
              <SourceBadge type={app.source.type} name={app.source.name} />
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
              <UserAvatar name={app.role.recruiter.name} size="sm" />
              {app.role.recruiter.name}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hiring manager</dt>
            <dd className="mt-0.5 font-medium">{app.role.hiringManager.name}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3" /> Location
            </dt>
            <dd className="mt-0.5 font-medium">{candidate.location}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="mt-0.5 font-medium">{app.source.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time in stage</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{durationSince(app.stageEnteredAt, now)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last activity</dt>
            <dd className="mt-0.5 font-medium" title={lastMeaningful?.title}>
              {lastMeaningful ? durationSince(lastMeaningful.ts, now) + " ago" : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Next best action */}
      {nextAction ? (
        <div className="mt-5 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <ArrowRight className="size-3.5 text-blue-600 dark:text-blue-400" />
                Next best action
                <ActionStatusBadge status={nextAction.status} />
                <RiskBadge risk={nextAction.risk} />
              </div>
              <h2 className="mt-1.5 text-[15px] font-semibold leading-snug">{nextAction.title}</h2>
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">
                {nextAction.proposedContent}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Why:</span> {nextAction.rationale}
              </p>
              {facts.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {facts.map((f) => (
                    <li
                      key={f}
                      className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {nextAction.escalationNote && (
                <p className="mt-2 text-xs leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground">If no one responds:</span>{" "}
                  {nextAction.escalationNote}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <div>
                Owner: <span className="font-medium text-foreground">{nextAction.owner.name}</span>
              </div>
              <div className={nextDue?.overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
                Due {nextDue?.label}
              </div>
              <div className="mt-1 flex items-center justify-end gap-1 text-[11px]">
                {nextAction.createdBy === "AGENT" ? (
                  <>
                    <Bot className="size-3" /> Agent-proposed
                  </>
                ) : (
                  <>
                    <UserRound className="size-3" /> Human-created
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <ActionControls
              action={{
                id: nextAction.id,
                title: nextAction.title,
                proposedContent: nextAction.proposedContent,
                status: nextAction.status,
                risk: nextAction.risk,
              }}
              users={users}
              showComplete
            />
            {hmReview && <HmReviewSheet data={hmReview} />}
          </div>
        </div>
      ) : app.status === "ACTIVE" ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              No next action — error state
            </p>
            <p className="mt-0.5 text-xs text-red-600/90 dark:text-red-400/90">
              Every active application must have a next action, owner, and due date. Run an agent
              pass from the Command Center to repair this.
            </p>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="h-8">
          {["overview", "timeline", "interviews", "feedback", "communications", "applications"].map((t) => (
            <TabsTrigger key={t} value={t} className="px-3 text-xs capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* -------- Overview -------- */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-[13px] font-semibold">Summary</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">
                  {candidate.summary}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Strengths</h4>
                    <ul className="mt-1.5 space-y-1">
                      {strengths.map((s) => (
                        <li key={s} className="flex items-start gap-1.5 text-xs leading-snug">
                          <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-amber-700 dark:text-amber-400">Concerns</h4>
                    <ul className="mt-1.5 space-y-1">
                      {concerns.map((c) => (
                        <li key={c} className="flex items-start gap-1.5 text-xs leading-snug">
                          <Minus className="mt-0.5 size-3 shrink-0 text-amber-600" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-[13px] font-semibold">Role criteria — {app.role.title}</h3>
                <ul className="mt-2 space-y-1.5">
                  {required.map((c) => {
                    const hit = criteriaMatch(c);
                    return (
                      <li key={c} className="flex items-start gap-2 text-xs leading-snug">
                        {hit ? (
                          <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className={hit ? "" : "text-muted-foreground"}>{c}</span>
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                          required
                        </span>
                      </li>
                    );
                  })}
                  {preferred.map((c) => {
                    const hit = criteriaMatch(c);
                    return (
                      <li key={c} className="flex items-start gap-2 text-xs leading-snug">
                        {hit ? (
                          <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className={hit ? "" : "text-muted-foreground"}>{c}</span>
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                          preferred
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Signal derived from profile keywords — verify in interviews.
                </p>
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <Building2 className="size-3.5 text-muted-foreground" /> History
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {prior.map((p) => (
                    <li key={`${p.company}-${p.years}`} className="flex items-baseline justify-between gap-3 text-xs">
                      <span>
                        <span className="font-medium">{p.company}</span>{" "}
                        <span className="text-muted-foreground">— {p.title}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{p.years}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <CalendarClock className="size-3.5 text-muted-foreground" /> Active deadlines
                </h3>
                <ul className="mt-2 space-y-2 text-xs">
                  {candidate.competingDeadline && (
                    <li className="rounded-md border border-orange-200 bg-orange-50 p-2 leading-snug dark:border-orange-900 dark:bg-orange-950/40">
                      <span className="font-medium text-orange-800 dark:text-orange-300">
                        Competing process:
                      </span>{" "}
                      {candidate.competingProcess} — {shortDateTime(candidate.competingDeadline)}
                    </li>
                  )}
                  {app.actions
                    .filter((a) => OPEN_STATUSES.includes(a.status))
                    .slice(0, 4)
                    .map((a) => {
                      const d = dueLabel(a.dueAt, now);
                      return (
                        <li key={a.id} className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate">{a.title}</span>
                          <span
                            className={`shrink-0 tabular-nums ${d.overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                          >
                            {d.label}
                          </span>
                        </li>
                      );
                    })}
                  {!candidate.competingDeadline &&
                    app.actions.filter((a) => OPEN_STATUSES.includes(a.status)).length === 0 && (
                      <li className="text-muted-foreground">No active deadlines.</li>
                    )}
                </ul>
              </section>

              {relatedRoles.length > 0 && (
                <section className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-[13px] font-semibold">Also matches</h3>
                  <ul className="mt-2 space-y-2">
                    {relatedRoles.map((r) => (
                      <li key={r.id} className="text-xs leading-snug">
                        <Link href={`/roles/${r.id}`} className="font-medium hover:underline">
                          {r.title}
                        </Link>
                        <p className="mt-0.5 text-muted-foreground">
                          Overlaps: {r.overlap.slice(0, 2).join("; ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <StickyNote className="size-3.5 text-muted-foreground" /> Notes
                </h3>
                <div className="mt-2">
                  <NoteForm applicationId={app.id} />
                </div>
              </section>
            </div>
          </div>
        </TabsContent>

        {/* -------- Timeline -------- */}
        <TabsContent value="timeline" className="mt-4">
          {timeline.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ol className="relative ml-3 space-y-4 border-l border-border pl-5">
              {timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span
                    className={`absolute -left-[27px] top-0.5 flex size-4 items-center justify-center rounded-full border bg-background ${
                      e.icon === "bot" ? "border-blue-300 text-blue-600 dark:border-blue-800 dark:text-blue-400" : "border-border text-muted-foreground"
                    }`}
                  >
                    {e.icon === "bot" ? (
                      <Bot className="size-2.5" />
                    ) : e.icon === "mail" ? (
                      <Mail className="size-2.5" />
                    ) : e.icon === "note" ? (
                      <StickyNote className="size-2.5" />
                    ) : e.icon === "calendar" ? (
                      <CalendarClock className="size-2.5" />
                    ) : e.icon === "system" ? (
                      <MessageSquare className="size-2.5" />
                    ) : (
                      <UserRound className="size-2.5" />
                    )}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-medium leading-snug">{e.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {e.actor} · {shortDateTime(e.ts)}
                    </span>
                    {e.meta && (
                      <span className="rounded border border-border px-1 py-px text-[10px] text-muted-foreground">
                        {e.meta}
                      </span>
                    )}
                  </div>
                  {e.detail && (
                    <p className="mt-1 max-w-2xl whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {e.detail}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        {/* -------- Interviews -------- */}
        <TabsContent value="interviews" className="mt-4">
          {app.interviews.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No interviews yet for this application.
            </p>
          ) : (
            <ul className="space-y-3">
              {app.interviews.map((iv) => (
                <li key={iv.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold">{iv.name}</span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                          iv.status === "COMPLETED"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                            : iv.status === "SCHEDULED"
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400"
                              : iv.status === "NEEDS_SCHEDULING"
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                                : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {iv.status.replace("_", " ").toLowerCase()}
                      </span>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {iv.scheduledAt ? shortDateTime(iv.scheduledAt) : "Not scheduled"} · {iv.durationMins} min
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Panel:</span>
                    {iv.panelists.map((p) => (
                      <span key={p.userId} className="flex items-center gap-1 text-xs">
                        <UserAvatar name={p.user.name} size="sm" /> {p.user.name}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* -------- Feedback -------- */}
        <TabsContent value="feedback" className="mt-4">
          {app.interviews.flatMap((iv) => iv.feedback).length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No scorecards requested yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {app.interviews.flatMap((iv) =>
                iv.feedback.map((f) => {
                  const overdue = f.status === "PENDING" && f.dueAt < now && iv.status === "COMPLETED";
                  return (
                    <li key={f.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={f.interviewer.name} size="sm" />
                          <span className="text-[13px] font-medium">{f.interviewer.name}</span>
                          <span className="text-[11px] text-muted-foreground">{iv.name}</span>
                        </div>
                        {f.status === "SUBMITTED" && f.rating ? (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                              f.rating.includes("YES")
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                                : f.rating === "MIXED"
                                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                            }`}
                          >
                            {f.rating.replace("_", " ").toLowerCase()}
                          </span>
                        ) : (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                              overdue
                                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                                : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            {overdue ? `overdue ${durationSince(f.dueAt, now)}` : "pending"}
                          </span>
                        )}
                      </div>
                      {f.summary && (
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.summary}</p>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </TabsContent>

        {/* -------- Communications -------- */}
        <TabsContent value="communications" className="mt-4">
          {app.communications.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No communications logged.
            </p>
          ) : (
            <ul className="space-y-3">
              {app.communications.map((c) => (
                <li key={c.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[13px]">
                      <Mail className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{c.subject}</span>
                      <span className="rounded border border-border px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                        {c.channel}
                      </span>
                      {c.candidateFacing && (
                        <span className="rounded border border-blue-200 bg-blue-50 px-1 py-px text-[10px] text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
                          candidate-facing
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {c.sentBy?.name ?? (c.direction === "INBOUND" ? candidate.name : "Relay Agent")} ·{" "}
                      {shortDateTime(c.sentAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* -------- Applications -------- */}
        <TabsContent value="applications" className="mt-4">
          <ul className="space-y-3">
            {candidate.applications.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/roles/${a.roleId}`} className="text-[13px] font-semibold hover:underline">
                      {a.role.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Applied {shortDate(a.appliedAt)} · {SOURCE_TYPE_LABELS[a.source.type as SourceType] ?? a.source.type} ({a.source.name})
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StageBadge name={a.stage.name} />
                    {a.status !== "ACTIVE" && (
                      <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                      </span>
                    )}
                    {a.status === "ACTIVE" && <MomentumBadge momentum={a.momentum} />}
                  </div>
                </div>
                {a.resolutionReason && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Resolution:</span> {a.resolutionReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
