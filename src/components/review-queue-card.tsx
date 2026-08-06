"use client";

// The hiring-manager side of the loop: every candidate waiting on an HM
// review, visible before the SLA breaches. Managers control their own order —
// the rank arrows persist a stack rank per manager, and one click opens the
// review sheet.

import { useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CompareDialog } from "@/components/compare-dialog";
import { HmReviewSheet, type HmReviewData } from "@/components/hm-review-sheet";
import { UserAvatar } from "@/components/user-avatar";
import { rankCandidate } from "@/lib/actions";
import { cn } from "@/lib/utils";

export interface ReviewQueueItem {
  hmName: string;
  candidateId: string;
  candidateName: string;
  roleTitle: string;
  waitingLabel: string;
  overSla: boolean;
  data: HmReviewData;
}

export function ReviewQueueCard({
  items,
  currentUserName,
}: {
  items: ReviewQueueItem[];
  currentUserName?: string;
}) {
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-[13px] text-muted-foreground">
          No candidates are waiting on hiring-manager review.
        </p>
      </div>
    );
  }

  const byHm = new Map<string, ReviewQueueItem[]>();
  for (const it of items) {
    byHm.set(it.hmName, [...(byHm.get(it.hmName) ?? []), it]);
  }

  const move = (applicationId: string, direction: "up" | "down") =>
    startTransition(async () => {
      await rankCandidate(applicationId, direction);
    });

  // The signed-in persona's own queue comes first.
  const groups = [...byHm.entries()].sort(([a], [b]) => {
    if (a === currentUserName) return -1;
    if (b === currentUserName) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="space-y-3">
        {groups.map(([hm, list]) => (
          <div key={hm}>
            <div className="flex items-center gap-1.5">
              <UserAvatar name={hm} size="sm" />
              <span className="text-[13px] font-medium">{hm}</span>
              {hm === currentUserName ? (
                <span className="rounded border border-blue-200 bg-blue-50 px-1 py-px text-[11px] font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
                  your queue
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {list.length} waiting
              </span>
              {list.length > 1 && (
                <span className="ml-auto">
                  <CompareDialog
                    items={list.map((x) => ({ ...x.data, candidateId: x.candidateId }))}
                    rankable
                  />
                </span>
              )}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {list.map((it, i) => (
                <li
                  key={it.data.applicationId}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-2"
                >
                  {/* Fixed-width slot whether or not arrows render, so names align across groups. */}
                  <div className="flex w-4 shrink-0 flex-col items-center">
                    {list.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label={`Move ${it.candidateName} up`}
                          disabled={pending || i === 0}
                          onClick={() => move(it.data.applicationId, "up")}
                          className="rounded p-px text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <button
                          type="button"
                          aria-label={`Move ${it.candidateName} down`}
                          disabled={pending || i === list.length - 1}
                          onClick={() => move(it.data.applicationId, "down")}
                          className="rounded p-px text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/candidates/${it.candidateId}`}
                      className="block truncate text-[13px] font-medium hover:underline"
                    >
                      {it.candidateName}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground" title={it.roleTitle}>
                      <span className={cn(it.overSla && "font-medium text-red-600 dark:text-red-400")}>
                        {it.waitingLabel}
                      </span>
                    </div>
                  </div>
                  <HmReviewSheet data={it.data} triggerLabel="Review" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
