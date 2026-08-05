import { db } from "@/lib/db";
import { durationSince, dueLabel } from "@/lib/format";
import { ActionsView, type ActionItem } from "@/components/actions-view";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const now = new Date();
  const [actions, users] = await Promise.all([
    db.action.findMany({
      include: {
        owner: true,
        recipient: true,
        application: { include: { candidate: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { userRole: { in: ["RECRUITER", "HIRING_MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const toItem = (a: (typeof actions)[number]): ActionItem => {
    const due = dueLabel(a.dueAt, now);
    return {
      id: a.id,
      type: a.type,
      title: a.title,
      proposedContent: a.proposedContent,
      rationale: a.rationale,
      facts: JSON.parse(a.supportingFacts),
      status: a.status,
      risk: a.risk,
      createdBy: a.createdBy,
      candidateId: a.application.candidate.id,
      candidateName: a.application.candidate.name,
      roleTitle: a.application.role.title,
      ownerName: a.owner.name,
      recipientName: a.recipient?.name ?? null,
      createdLabel: `${durationSince(a.createdAt, now)} ago`,
      dueLabel: due.label,
      overdue: due.overdue && !["COMPLETED", "DISMISSED"].includes(a.status),
    };
  };

  const isEscalation = (a: (typeof actions)[number]) =>
    ["ESCALATION", "OFFER_APPROVAL", "DATA_INTEGRITY"].includes(a.type) ||
    a.risk === "CRITICAL";

  const groups = {
    approval: actions.filter((a) => a.status === "PROPOSED").map(toItem),
    waiting: actions
      .filter((a) => ["WAITING", "APPROVED", "IN_PROGRESS"].includes(a.status))
      .map(toItem),
    escalations: actions
      .filter(
        (a) =>
          isEscalation(a) &&
          ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"].includes(a.status)
      )
      .map(toItem),
    executed: actions.filter((a) => a.status === "COMPLETED").map(toItem),
    dismissed: actions
      .filter((a) => ["DISMISSED", "FAILED"].includes(a.status))
      .map(toItem),
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight">Actions</h1>
        <p className="text-[13px] text-muted-foreground">
          Every proposed, running, and completed action across the pipeline. Approvals execute
          immediately; everything is audit-logged.
        </p>
      </div>
      <ActionsView groups={groups} users={users} />
    </div>
  );
}
