"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, Clock, Inbox, ShieldAlert, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionControls } from "@/components/action-controls";
import { HmReviewSheet, type HmReviewData } from "@/components/hm-review-sheet";
import { StageBadge, StateBadge, type ExecutionState } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";

export interface AttentionItem {
  actionId: string;
  actionTitle: string;
  proposedContent: string;
  rationale: string;
  escalationNote: string | null;
  status: string;
  risk: string;
  dueLabel: string;
  overdue: boolean;
  candidateId: string;
  candidateName: string;
  roleTitle: string;
  stageName: string;
  timeInStage: string;
  momentum: string;
  state: ExecutionState;
  blocker: string | null;
  blockerType: string;
  ownerId: string;
  ownerName: string;
  context: string | null;
  hmReview: HmReviewData | null;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "mine", label: "My actions" },
  { key: "overdue", label: "Overdue" },
  { key: "risk", label: "Withdrawal risk" },
  { key: "hm", label: "Hiring manager" },
  { key: "scheduling", label: "Scheduling" },
  { key: "feedback", label: "Feedback" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const RISK_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const GROUPS: { state: ExecutionState; title: string; sub: string }[] = [
  {
    state: "AT_RISK",
    title: "Immediate withdrawal risk",
    sub: "Competing deadlines — hours matter, not days",
  },
  {
    state: "UNOWNED",
    title: "Unowned — error state",
    sub: "Active candidates with no next action or owner",
  },
  {
    state: "BLOCKED",
    title: "Blocked on a person",
    sub: "Waiting on a named individual past SLA",
  },
  {
    state: "OVERDUE",
    title: "Overdue",
    sub: "The committed next action slipped its due date",
  },
  {
    state: "SLOWING",
    title: "Slowing",
    sub: "Past SLA but not yet blocked — cheap to fix now",
  },
  {
    state: "MOVING",
    title: "Keeping healthy processes on track",
    sub: "Owned and in SLA — shown for completeness",
  },
];

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
          return it.state === "AT_RISK";
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
    return [...f].sort((a, b) => (RISK_ORDER[a.risk] ?? 4) - (RISK_ORDER[b.risk] ?? 4));
  }, [items, filter, currentUserId]);

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: filtered.filter((it) => it.state === g.state),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter interventions">
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

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-14 text-center">
          <Inbox className="mb-2 size-5 text-muted-foreground" />
          <p className="text-sm font-medium">No interventions needed</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filter === "all"
              ? "Every active candidate is owned, in SLA, and moving."
              : "No candidates match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <section key={g.state} aria-label={g.title}>
              <div className="mb-2 flex items-baseline gap-2">
                <StateBadge state={g.state} />
                <h3 className="text-[13px] font-semibold">{g.title}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {g.items.length} · {g.sub}
                </span>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {g.items.map((it) => (
                  <li key={it.actionId} className="p-4">
                    {/* Who and where */}
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
                            <StageBadge name={it.stageName} />
                            <span className="text-[11px] text-muted-foreground">
                              {it.timeInStage} in stage
                            </span>
                          </div>
                          {/* Why blocked / why now */}
                          <div className="mt-1.5 space-y-0.5">
                            {it.blocker && (
                              <p className="flex items-start gap-1.5 text-xs leading-snug">
                                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                                <span>
                                  <span className="font-medium">Blocked:</span>{" "}
                                  <span className="text-muted-foreground">{it.blocker}</span>
                                </span>
                              </p>
                            )}
                            <p className="flex items-start gap-1.5 text-xs leading-snug">
                              <Clock className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                              <span>
                                <span className="font-medium">Why now:</span>{" "}
                                <span className="text-muted-foreground">
                                  {it.context ? `${it.context}. ` : ""}
                                  {it.rationale}
                                </span>
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <UserRound className="size-3" />
                          <span className="font-medium text-foreground">{it.ownerName}</span>
                        </div>
                        <div className={cn("mt-0.5", it.overdue && "font-medium text-red-600 dark:text-red-400")}>
                          Due {it.dueLabel}
                        </div>
                      </div>
                    </div>

                    {/* What Relay will do */}
                    <div className="mt-2.5 rounded-md border border-border bg-muted/40 p-2.5">
                      <p className="flex items-start gap-1.5 text-[13px] leading-snug">
                        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Relay will:
                          </span>{" "}
                          <span className="font-medium">{it.actionTitle}</span>
                        </span>
                      </p>
                      <p className="mt-1 line-clamp-2 pl-5 text-xs leading-relaxed text-muted-foreground">
                        {it.proposedContent}
                      </p>
                      {it.escalationNote && (
                        <p className="mt-1.5 flex items-start gap-1.5 pl-5 text-[11px] leading-snug text-muted-foreground">
                          <ShieldAlert className="mt-px size-3 shrink-0 text-amber-600" />
                          <span>
                            <span className="font-medium text-foreground/80">If no one responds:</span>{" "}
                            {it.escalationNote}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-0.5">
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
                      {it.hmReview && <HmReviewSheet data={it.hmReview} />}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
