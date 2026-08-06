"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Inbox,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionControls } from "@/components/action-controls";
import { HmReviewSheet, type HmReviewData } from "@/components/hm-review-sheet";
import {
  EXECUTION_STATE_META,
  StageBadge,
  StateBadge,
  type ExecutionState,
} from "@/components/status-badges";
import { RiskBadge } from "@/components/status-badges";

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

const GROUPS: { state: ExecutionState; title: string }[] = [
  { state: "AT_RISK", title: "Immediate withdrawal risk" },
  { state: "UNOWNED", title: "Unowned — error state" },
  { state: "BLOCKED", title: "Blocked on a person" },
  { state: "OVERDUE", title: "Overdue" },
  { state: "SLOWING", title: "Slowing" },
  { state: "MOVING", title: "Healthy — queued actions" },
];

/** One card per candidate: highest-priority action leads, the rest ride along. */
type Card = { primary: AttentionItem; alsoQueued: AttentionItem[] };

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const matches = (it: AttentionItem, key: FilterKey): boolean => {
    switch (key) {
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
  };

  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>;
    for (const f of FILTERS) c[f.key] = items.filter((it) => matches(it, f.key)).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, currentUserId]);

  const grouped = useMemo(() => {
    const filtered = [...items.filter((it) => matches(it, filter))].sort(
      (a, b) => (RISK_ORDER[a.risk] ?? 4) - (RISK_ORDER[b.risk] ?? 4)
    );
    return GROUPS.map((g) => {
      const inGroup = filtered.filter((it) => it.state === g.state);
      const byCandidate = new Map<string, AttentionItem[]>();
      for (const it of inGroup) {
        byCandidate.set(it.candidateId, [...(byCandidate.get(it.candidateId) ?? []), it]);
      }
      const cards: Card[] = [...byCandidate.values()].map(([primary, ...alsoQueued]) => ({
        primary,
        alsoQueued,
      }));
      return { ...g, cards };
    }).filter((g) => g.cards.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, currentUserId]);

  // The top-priority card starts expanded; clicking a row moves the spotlight.
  const orderedIds = grouped.flatMap((g) => g.cards.map((c) => c.primary.actionId));
  const expandedId =
    selectedId === "__collapsed__"
      ? null
      : selectedId && orderedIds.includes(selectedId)
        ? selectedId
        : (orderedIds[0] ?? null);

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
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span className={cn("ml-1 tabular-nums", filter === f.key ? "opacity-80" : "opacity-60")}>
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-14 text-center">
          <Inbox className="mb-2 size-5 text-muted-foreground" />
          <p className="text-sm font-medium">No interventions needed</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {filter === "all"
              ? "Every active candidate is owned, in SLA, and moving."
              : "No candidates match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <section key={g.state} aria-label={g.title}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <StateBadge state={g.state} />
                <h3 className="text-sm font-semibold">{g.title}</h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {g.cards.length}
                </span>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {g.cards.map(({ primary: it, alsoQueued }) => {
                  const expanded = it.actionId === expandedId;
                  return (
                    <li key={it.actionId}>
                      {/* Triage row: who, why, whose court, when. */}
                      <div
                        data-testid="intervention-row"
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() =>
                          setSelectedId(expanded ? "__collapsed__" : it.actionId)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(expanded ? "__collapsed__" : it.actionId);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-muted/40",
                          expanded && "bg-muted/30"
                        )}
                      >
                        {/* Fixed column widths so rows align vertically like a table. */}
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            EXECUTION_STATE_META[it.state].dot
                          )}
                          aria-hidden
                        />
                        <Link
                          href={`/candidates/${it.candidateId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-32 shrink-0 truncate text-sm font-semibold hover:underline"
                          title={it.candidateName}
                        >
                          {it.candidateName}
                        </Link>
                        <span
                          className="hidden w-44 shrink-0 truncate text-xs text-muted-foreground lg:inline"
                          title={it.roleTitle}
                        >
                          {it.roleTitle}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                          {it.blocker ?? it.actionTitle}
                          {alsoQueued.length > 0 && (
                            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] tabular-nums">
                              +{alsoQueued.length}
                            </span>
                          )}
                        </span>
                        <span className="hidden w-16 shrink-0 items-center gap-1 truncate text-xs text-muted-foreground md:flex">
                          <UserRound className="size-3 shrink-0" />
                          {it.ownerName.split(" ")[0]}
                        </span>
                        <span
                          className={cn(
                            "w-16 shrink-0 text-right text-xs tabular-nums",
                            it.overdue
                              ? "font-medium text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {it.dueLabel}
                        </span>
                        {expanded ? (
                          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </div>

                      {/* Spotlight: the full anatomy, one card at a time. */}
                      {expanded && (
                        <div className="border-t border-border/60 px-4 pb-4 pt-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StageBadge name={it.stageName} />
                            <span className="text-xs text-muted-foreground">
                              {it.timeInStage} in stage
                            </span>
                            <RiskBadge risk={it.risk} />
                            <span className="ml-auto text-xs text-muted-foreground">
                              Owner: <span className="font-medium text-foreground">{it.ownerName}</span>
                            </span>
                          </div>

                          <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-snug">
                            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                            <span className="text-muted-foreground">
                              {it.blocker ?? it.rationale}
                              {it.context ? ` — ${it.context}` : ""}
                            </span>
                          </p>

                          <div className="mt-2.5 rounded-md border border-border bg-muted/40 p-2.5">
                            <p className="flex items-start gap-1.5 text-sm leading-snug">
                              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                              <span>
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Relay will:
                                </span>{" "}
                                <span className="font-medium">{it.actionTitle}</span>
                              </span>
                            </p>
                            <p className="mt-1 whitespace-pre-line pl-5 text-[13px] leading-relaxed text-muted-foreground">
                              {it.proposedContent}
                            </p>
                            {it.escalationNote && (
                              <p className="mt-1.5 flex items-start gap-1.5 pl-5 text-xs leading-snug text-muted-foreground">
                                <ShieldAlert className="mt-px size-3 shrink-0 text-amber-600" />
                                <span>
                                  <span className="font-medium text-foreground/80">
                                    If no one responds:
                                  </span>{" "}
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

                          {alsoQueued.length > 0 && (
                            <div className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
                              {alsoQueued.map((s) => (
                                <div
                                  key={s.actionId}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5"
                                >
                                  <p className="min-w-0 text-[13px] leading-snug">
                                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Also queued:
                                    </span>{" "}
                                    <span className="font-medium">{s.actionTitle}</span>{" "}
                                    <span
                                      className={cn(
                                        "text-muted-foreground",
                                        s.overdue && "font-medium text-red-600 dark:text-red-400"
                                      )}
                                    >
                                      · due {s.dueLabel}
                                    </span>
                                  </p>
                                  <ActionControls
                                    action={{
                                      id: s.actionId,
                                      title: s.actionTitle,
                                      proposedContent: s.proposedContent,
                                      status: s.status,
                                      risk: s.risk,
                                    }}
                                    size="xs"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
