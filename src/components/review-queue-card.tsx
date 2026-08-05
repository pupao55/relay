"use client";

// The hiring-manager side of the loop: every candidate waiting on an HM
// review, visible before the SLA breaches — not after. One click opens the
// same lightweight review sheet used everywhere else.

import Link from "next/link";
import { UserRoundSearch } from "lucide-react";
import { HmReviewSheet, type HmReviewData } from "@/components/hm-review-sheet";
import { UserAvatar } from "@/components/user-avatar";
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

export function ReviewQueueCard({ items }: { items: ReviewQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          No candidates are waiting on hiring-manager review.
        </p>
      </div>
    );
  }

  const byHm = new Map<string, ReviewQueueItem[]>();
  for (const it of items) {
    byHm.set(it.hmName, [...(byHm.get(it.hmName) ?? []), it]);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="space-y-3">
        {[...byHm.entries()].map(([hm, list]) => (
          <div key={hm}>
            <div className="flex items-center gap-1.5">
              <UserAvatar name={hm} size="sm" />
              <span className="text-xs font-medium">{hm}</span>
              <span className="text-[11px] text-muted-foreground">
                {list.length} waiting
              </span>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {list.map((it) => (
                <li
                  key={it.data.applicationId}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/candidates/${it.candidateId}`}
                      className="block truncate text-xs font-medium hover:underline"
                    >
                      {it.candidateName}
                    </Link>
                    <div className="text-[10.5px] text-muted-foreground">
                      <span className={cn(it.overSla && "font-medium text-red-600 dark:text-red-400")}>
                        {it.waitingLabel}
                      </span>{" "}
                      · {it.roleTitle}
                    </div>
                  </div>
                  <HmReviewSheet data={it.data} triggerLabel="Review" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-2.5 text-[10.5px] leading-snug text-muted-foreground">
        <UserRoundSearch className="mt-px size-3 shrink-0" />
        Each review takes under a minute: summary, criteria fit, concern, timing — then
        Advance, Request info, Redirect, or Decline.
      </p>
    </div>
  );
}
