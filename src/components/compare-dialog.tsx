"use client";

// Side-by-side candidate comparison. Built from the same HmReviewData the
// review sheet uses; a label column keeps every section aligned across
// candidates so differences read row by row.

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpToLine, Check, Columns2, Minus, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rankCandidateTop } from "@/lib/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import type { HmReviewData } from "@/components/hm-review-sheet";
import { cn } from "@/lib/utils";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

export function CompareDialog({
  items,
  rankable = false,
}: {
  items: (HmReviewData & { candidateId: string })[];
  rankable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const cols = items.slice(0, 3);

  // When every candidate is measured against the same criteria (same role),
  // render one aligned row per criterion.
  const criteria = cols[0]?.evidence.map((e) => e.criterion) ?? [];
  const sameCriteria = cols.every(
    (c) => JSON.stringify(c.evidence.map((e) => e.criterion)) === JSON.stringify(criteria)
  );

  const gridStyle = {
    gridTemplateColumns: `120px repeat(${cols.length}, minmax(0, 1fr))`,
  } as const;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground">
          <Columns2 className="size-3.5" /> Compare
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-base">Compare candidates</DialogTitle>
        </DialogHeader>

        <div className="grid gap-x-5 gap-y-4" style={gridStyle}>
          {/* Header row */}
          <div />
          {cols.map((c) => (
            <div key={c.applicationId}>
              <div className="flex items-center gap-2">
                <UserAvatar name={c.candidateName} size="sm" />
                <Link
                  href={`/candidates/${c.candidateId}`}
                  className="truncate text-sm font-semibold hover:underline"
                >
                  {c.candidateName}
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.currentTitle} · {c.currentCompany}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.timeInStage} in queue · {c.sourceName}
              </p>
              {c.timingRisk && (
                <p className="mt-1 flex items-start gap-1 text-xs font-medium text-orange-700 dark:text-orange-400">
                  <Timer className="mt-0.5 size-3 shrink-0" />
                  {c.timingRisk}
                </p>
              )}
              {rankable && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-6 gap-1 px-2 text-xs"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await rankCandidateTop(c.applicationId);
                      toast.success(`${c.candidateName} ranked #1`);
                      setOpen(false);
                    })
                  }
                >
                  <ArrowUpToLine className="size-3" /> Put first
                </Button>
              )}
            </div>
          ))}

          {/* Criteria fit */}
          {sameCriteria ? (
            <>
              <Label>Fit</Label>
              {cols.map((c) => {
                const hits = c.evidence.filter((e) => e.hit).length;
                return (
                  <div key={c.applicationId} className="text-sm font-semibold tabular-nums">
                    {hits}/{c.evidence.length}
                  </div>
                );
              })}
              {criteria.map((criterion, i) => (
                <div key={criterion} className="contents">
                  <div className="text-xs leading-snug text-muted-foreground">{criterion}</div>
                  {cols.map((c) => (
                    <div key={c.applicationId}>
                      {c.evidence[i]?.hit ? (
                        <Check className="size-4 text-emerald-600" aria-label="Meets" />
                      ) : (
                        <Minus className="size-4 text-muted-foreground/50" aria-label="Not evident" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              <Label>Fit</Label>
              {cols.map((c) => (
                <ul key={c.applicationId} className="space-y-1">
                  {c.evidence.map((e) => (
                    <li key={e.criterion} className="flex items-start gap-1.5 text-xs leading-snug">
                      {e.hit ? (
                        <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                      ) : (
                        <Minus className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className={cn(!e.hit && "text-muted-foreground")}>{e.criterion}</span>
                    </li>
                  ))}
                </ul>
              ))}
            </>
          )}

          {/* Summary */}
          <Label>Summary</Label>
          {cols.map((c) => (
            <p key={c.applicationId} className="text-xs leading-relaxed text-foreground/90">
              {c.summary}
            </p>
          ))}

          {/* History */}
          <Label>History</Label>
          {cols.map((c) => (
            <ul key={c.applicationId} className="space-y-0.5">
              {c.history.map((h) => (
                <li key={h} className="text-xs leading-snug text-muted-foreground">
                  {h}
                </li>
              ))}
            </ul>
          ))}

          {/* Concern */}
          <Label>Concern</Label>
          {cols.map((c) => (
            <p key={c.applicationId} className="text-xs leading-snug text-muted-foreground">
              {c.primaryConcern ?? "—"}
            </p>
          ))}

          {/* Latest note */}
          <Label>Notes</Label>
          {cols.map((c) => (
            <p key={c.applicationId} className="text-xs leading-snug text-muted-foreground">
              {c.notes[0] ? `"${c.notes[0].body}" — ${c.notes[0].author}` : "—"}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
