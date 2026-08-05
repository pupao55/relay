"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bot, CheckCheck, Inbox, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionControls } from "@/components/action-controls";
import { ActionStatusBadge, RiskBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";
import { bulkApproveActions } from "@/lib/actions";
import { ACTION_TYPE_LABELS, type ActionType } from "@/lib/types";

export interface ActionItem {
  id: string;
  type: string;
  title: string;
  proposedContent: string;
  rationale: string;
  facts: string[];
  status: string;
  risk: string;
  createdBy: string;
  candidateId: string;
  candidateName: string;
  roleTitle: string;
  ownerName: string;
  recipientName: string | null;
  createdLabel: string;
  dueLabel: string;
  overdue: boolean;
}

const TABS = [
  { key: "approval", label: "Needs Approval" },
  { key: "waiting", label: "Waiting on Others" },
  { key: "escalations", label: "Escalations" },
  { key: "executed", label: "Executed" },
  { key: "dismissed", label: "Dismissed" },
] as const;

export function ActionsView({
  groups,
  users,
}: {
  groups: Record<(typeof TABS)[number]["key"], ActionItem[]>;
  users: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const lowRiskApprovals = useMemo(
    () => groups.approval.filter((a) => a.risk === "LOW"),
    [groups.approval]
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkApprove = () =>
    startTransition(async () => {
      await bulkApproveActions([...selected]);
      toast.success(`Approved ${selected.size} low-risk action${selected.size === 1 ? "" : "s"}`);
      setSelected(new Set());
    });

  const renderItem = (a: ActionItem, opts?: { selectable?: boolean; controls?: boolean }) => (
    <li key={a.id} className="p-4">
      <div className="flex items-start gap-3">
        {opts?.selectable && (
          <Checkbox
            checked={selected.has(a.id)}
            onCheckedChange={() => toggle(a.id)}
            aria-label={`Select ${a.title}`}
            className="mt-1"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
              {ACTION_TYPE_LABELS[a.type as ActionType] ?? a.type}
            </span>
            <span className="text-[13px] font-semibold leading-snug">{a.title}</span>
            <RiskBadge risk={a.risk} />
            <ActionStatusBadge status={a.status} />
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
              {a.createdBy === "AGENT" ? <Bot className="size-3" /> : <UserRound className="size-3" />}
              {a.createdBy === "AGENT" ? "Agent" : "Human"} · created {a.createdLabel}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link href={`/candidates/${a.candidateId}`} className="flex items-center gap-1.5 hover:underline">
              <UserAvatar name={a.candidateName} size="sm" />
              <span className="font-medium text-foreground">{a.candidateName}</span>
            </Link>
            <span>{a.roleTitle}</span>
            <span>
              Owner: <span className="font-medium text-foreground">{a.ownerName}</span>
            </span>
            {a.recipientName && <span>To: {a.recipientName}</span>}
            <span className={cn(a.overdue && "font-medium text-red-600 dark:text-red-400")}>
              Due {a.dueLabel}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line rounded-md border border-border bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground/90">
            {a.proposedContent}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Why:</span> {a.rationale}
          </p>
          {a.facts.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {a.facts.map((f) => (
                <li key={f} className="rounded border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                  {f}
                </li>
              ))}
            </ul>
          )}
          {opts?.controls !== false && (
            <div className="mt-2.5">
              <ActionControls
                action={{
                  id: a.id,
                  title: a.title,
                  proposedContent: a.proposedContent,
                  status: a.status,
                  risk: a.risk,
                }}
                users={users}
                showComplete
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );

  const emptyState = (message: string) => (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border py-14 text-center">
      <Inbox className="mb-2 size-5 text-muted-foreground" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );

  return (
    <Tabs defaultValue="approval">
      <TabsList className="h-8">
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="gap-1.5 px-3 text-xs">
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
              {groups[t.key].length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="approval" className="mt-4">
        {lowRiskApprovals.length > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {lowRiskApprovals.length} low-risk internal action{lowRiskApprovals.length === 1 ? "" : "s"} eligible
              for bulk approval. High-risk and candidate-facing actions always require individual review.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  setSelected((prev) =>
                    prev.size === lowRiskApprovals.length
                      ? new Set()
                      : new Set(lowRiskApprovals.map((a) => a.id))
                  )
                }
              >
                {selected.size === lowRiskApprovals.length ? "Clear" : "Select all"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={selected.size === 0 || pending}
                onClick={bulkApprove}
              >
                <CheckCheck className="size-3.5" /> Approve {selected.size > 0 ? selected.size : ""}
              </Button>
            </div>
          </div>
        )}
        {groups.approval.length === 0 ? (
          emptyState("Nothing waiting for approval")
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {groups.approval.map((a) => renderItem(a, { selectable: a.risk === "LOW" }))}
          </ul>
        )}
      </TabsContent>

      {(["waiting", "escalations", "executed", "dismissed"] as const).map((key) => (
        <TabsContent key={key} value={key} className="mt-4">
          {groups[key].length === 0 ? (
            emptyState(
              key === "waiting"
                ? "Nothing is waiting on others"
                : key === "escalations"
                  ? "No open escalations"
                  : key === "executed"
                    ? "No executed actions yet"
                    : "No dismissed actions"
            )
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {groups[key].map((a) =>
                renderItem(a, { controls: key === "waiting" || key === "escalations" })
              )}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
