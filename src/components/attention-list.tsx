"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionControls } from "@/components/action-controls";
import { MomentumBadge, RiskBadge, StageBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";

export interface AttentionItem {
  actionId: string;
  actionTitle: string;
  proposedContent: string;
  rationale: string;
  status: string;
  risk: string; // action risk
  dueLabel: string;
  overdue: boolean;
  candidateId: string;
  candidateName: string;
  roleTitle: string;
  stageName: string;
  timeInStage: string;
  momentum: string;
  blocker: string | null;
  blockerType: string;
  ownerId: string;
  ownerName: string;
  context: string | null; // competing process etc.
}

const FILTERS = [
  { key: "mine", label: "My actions" },
  { key: "all", label: "All actions" },
  { key: "overdue", label: "Overdue" },
  { key: "risk", label: "Candidate risk" },
  { key: "hm", label: "Hiring manager blockers" },
  { key: "scheduling", label: "Scheduling blockers" },
  { key: "feedback", label: "Feedback blockers" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const RISK_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function AttentionList({
  items,
  currentUserId,
  users,
}: {
  items: AttentionItem[];
  currentUserId: string;
  users: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    const f = items.filter((it) => {
      switch (filter) {
        case "mine":
          return it.ownerId === currentUserId;
        case "overdue":
          return it.overdue;
        case "risk":
          return it.risk === "HIGH" || it.risk === "CRITICAL";
        case "hm":
          return it.blockerType === "HIRING_MANAGER";
        case "scheduling":
          return it.blockerType === "SCHEDULING";
        case "feedback":
          return it.blockerType === "FEEDBACK";
        default:
          return true;
      }
    });
    return [...f].sort(
      (a, b) => (RISK_ORDER[a.risk] ?? 4) - (RISK_ORDER[b.risk] ?? 4)
    );
  }, [items, filter, currentUserId]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter attention items">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              filter === f.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-14 text-center">
          <Inbox className="mb-2 size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing needs attention here</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filter === "all"
              ? "Every active candidate has a healthy next action."
              : "No items match this filter — try another."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {filtered.map((it) => (
            <li key={it.actionId} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar name={it.candidateName} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/candidates/${it.candidateId}`}
                        className="text-[13.5px] font-semibold hover:underline"
                      >
                        {it.candidateName}
                      </Link>
                      <span className="text-xs text-muted-foreground">{it.roleTitle}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StageBadge name={it.stageName} />
                      <span className="text-[11px] text-muted-foreground">
                        {it.timeInStage} in stage
                      </span>
                      <MomentumBadge momentum={it.momentum} />
                      <RiskBadge risk={it.risk} />
                    </div>
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  <div>
                    Owner: <span className="font-medium text-foreground">{it.ownerName}</span>
                  </div>
                  <div className={cn(it.overdue && "font-medium text-red-600 dark:text-red-400")}>
                    Due {it.dueLabel}
                  </div>
                </div>
              </div>

              {(it.blocker || it.context) && (
                <div className="mt-2.5 space-y-1">
                  {it.blocker && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                      <span>
                        <span className="font-medium text-foreground">Blocker:</span> {it.blocker}
                      </span>
                    </p>
                  )}
                  {it.context && (
                    <p className="pl-5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Context:</span> {it.context}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-2.5 rounded-md border border-border bg-muted/40 p-2.5">
                <p className="flex items-start gap-1.5 text-[13px] leading-snug">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium">{it.actionTitle}</span>
                </p>
                <p className="mt-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                  {it.rationale}
                </p>
              </div>

              <div className="mt-2.5 pl-0.5">
                <ActionControls
                  action={{
                    id: it.actionId,
                    title: it.actionTitle,
                    proposedContent: it.proposedContent,
                    status: it.status,
                    risk: it.risk,
                  }}
                  users={users}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
