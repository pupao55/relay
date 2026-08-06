import { db } from "@/lib/db";
import { durationSince, dueLabel } from "@/lib/format";
import { CandidatesTable, type CandidateRow } from "@/components/candidates-table";
import { SOURCE_TYPE_LABELS, type SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"];

export default async function CandidatesPage() {
  const now = new Date();
  const apps = await db.application.findMany({
    include: {
      candidate: true,
      role: { include: { recruiter: true, hiringManager: true } },
      stage: true,
      source: true,
      actions: { include: { owner: true }, orderBy: { dueAt: "asc" } },
    },
    orderBy: { appliedAt: "desc" },
  });

  const rows: CandidateRow[] = apps.map((a) => {
    const next = a.actions.find((x) => OPEN_STATUSES.includes(x.status));
    const due = next ? dueLabel(next.dueAt, now) : null;
    return {
      applicationId: a.id,
      candidateId: a.candidate.id,
      name: a.candidate.name,
      company: a.candidate.currentCompany,
      roleTitle: a.role.title,
      recruiterName: a.role.recruiter.name,
      hmName: a.role.hiringManager.name,
      stageName: a.stage.name,
      stageOrder: a.stage.order,
      momentum: a.momentum,
      status: a.status,
      nextAction: next?.title ?? null,
      ownerName: next?.owner.name ?? null,
      dueLabel: due?.label ?? null,
      dueOverdue: (a.status === "ACTIVE" && due?.overdue) ?? false,
      dueTs: next ? next.dueAt.getTime() : null,
      timeInStage: durationSince(a.stageEnteredAt, now),
      hoursInStage: Math.floor((now.getTime() - a.stageEnteredAt.getTime()) / 3600_000),
      risk: a.risk,
      sourceType: a.source.type,
      sourceLabel: SOURCE_TYPE_LABELS[a.source.type as SourceType] ?? a.source.type,
      sourceName: a.source.name,
      blocked: a.momentum === "BLOCKED" || a.momentum === "AT_RISK",
    };
  });

  const uniq = (xs: string[]) => [...new Set(xs)].sort();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Candidates</h1>
        <p className="text-sm text-muted-foreground">
          Every application, its momentum, and its next action.
        </p>
      </div>
      <CandidatesTable
        rows={rows}
        roles={uniq(rows.map((r) => r.roleTitle))}
        recruiters={uniq(rows.map((r) => r.recruiterName))}
        hms={uniq(rows.map((r) => r.hmName))}
        stages={[...new Set(apps.sort((a, b) => a.stage.order - b.stage.order).map((a) => a.stage.name))]}
        sources={uniq(rows.map((r) => r.sourceLabel))}
      />
    </div>
  );
}
