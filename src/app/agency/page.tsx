// External-recruiter portal: self-serve status for agency submissions.
// Deliberately sanitized — no stages beyond coarse phases, no scorecards, no
// internal notes, no momentum/risk, no competing-process intel. The point is
// that partners stop emailing "any update?" and internal feedback stays
// internal (see Settings → Agent Permissions).

import Link from "next/link";
import { Zap } from "lucide-react";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { DECLINE_REASONS } from "@/lib/types";
import { AgencySubmitForm } from "@/components/agency-submit-form";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AppRow = {
  id: string;
  status: string;
  resolutionReason: string | null;
  appliedAt: Date;
  lastCandidateUpdateAt: Date;
  stage: { name: string };
  candidate: { name: string };
  role: { title: string };
};

function externalStatus(app: AppRow): { label: string; tone: string } {
  if (app.status === "HIRED")
    return { label: "Placed", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (app.status === "WITHDRAWN")
    return { label: "Withdrawn", tone: "border-border bg-muted text-muted-foreground" };
  if (app.status === "REJECTED") {
    const head = app.resolutionReason?.split(" — ")[0] ?? "";
    const known = DECLINE_REASONS.find((r) => head.startsWith(r));
    return {
      label: known ? `Closed — ${known.toLowerCase()}` : "Closed",
      tone: "border-border bg-muted text-muted-foreground",
    };
  }
  const s = app.stage.name;
  if (s === "Recruiter Review" || s === "Hiring Manager Review")
    return { label: "Under review", tone: "border-blue-200 bg-blue-50 text-blue-700" };
  if (s === "Debrief" || s === "Offer Approval")
    return { label: "Decision pending", tone: "border-amber-200 bg-amber-50 text-amber-700" };
  if (s === "Offer Extended")
    return { label: "Offer stage", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  return { label: "Interviewing", tone: "border-blue-200 bg-blue-50 text-blue-700" };
}

export default async function AgencyPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ firm?: string }>;
}) {
  const { firm } = await searchParams;
  const agencies = await db.externalSource.findMany({
    where: { type: "AGENCY" },
    orderBy: { name: "asc" },
  });
  const active = agencies.find((a) => a.id === firm) ?? agencies[0];
  if (!active) return null;

  const [apps, roles] = await Promise.all([
    db.application.findMany({
      where: { sourceId: active.id },
      include: { candidate: true, role: true, stage: true },
      orderBy: { appliedAt: "desc" },
    }),
    db.role.findMany({
      where: { status: "OPEN" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);
  const open = apps.filter((a) => a.status === "ACTIVE");
  const closed = apps.filter((a) => a.status !== "ACTIVE");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-foreground">
            <Zap className="size-4 text-background" strokeWidth={2.25} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Relay · Partner Portal</div>
            <div className="text-xs text-muted-foreground">Helios Capital</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agencies.map((a) => (
            <Link
              key={a.id}
              href={`/agency?firm=${a.id}`}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                a.id === active.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {a.name}
            </Link>
          ))}
        </div>
      </header>

      <section className="mt-6">
        <h1 className="text-base font-semibold">Your submissions</h1>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {open.length === 0 ? (
            <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              No active submissions.
            </li>
          ) : (
            open.map((a) => {
              const st = externalStatus(a);
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar name={a.candidate.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.candidate.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.role.title}</div>
                  </div>
                  <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium", st.tone)}>
                    {st.label}
                  </span>
                  <span className="hidden w-32 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:inline">
                    updated {shortDate(a.lastCandidateUpdateAt)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {closed.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Closed</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
            {closed.map((a) => {
              const st = externalStatus(a);
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium">{a.candidate.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{a.role.title}</span>
                  </div>
                  <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium", st.tone)}>
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Submit a candidate</h2>
        <div className="mt-3">
          <AgencySubmitForm sourceId={active.id} roles={roles} />
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Statuses update automatically as candidates move. Interview feedback is never shared
        through this portal.
      </p>
    </div>
  );
}
