"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ArrowRight,
  Check,

  CircleAlert,
  ClipboardList,
  FileText,
  Minus,
  ThumbsDown,
  Timer,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { hmReviewDecision } from "@/lib/actions";
import { showReviewReceipt } from "@/components/receipt-host";
import type { ReviewReceipt } from "@/lib/types";

export interface HmReviewData {
  applicationId: string;
  candidateName: string;
  currentTitle: string;
  currentCompany: string;
  roleTitle: string;
  hmName: string;
  summary: string;
  evidence: { criterion: string; hit: boolean }[];
  primaryConcern: string | null;
  timingRisk: string | null;
  timeInStage: string;
  sourceName: string;
}

export function HmReviewSheet({
  data,
  triggerLabel = "Review as hiring manager",
  triggerVariant = "outline",
}: {
  data: HmReviewData;
  triggerLabel?: string;
  triggerVariant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const decide = (decision: ReviewReceipt["decision"]) =>
    startTransition(async () => {
      const r = await hmReviewDecision(data.applicationId, decision, note.trim() || undefined);
      setOpen(false);
      setNote("");
      showReviewReceipt(r);
    });

  // Keyboard path: A / I / R / D decide directly (ignored while typing a note).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (pending || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["TEXTAREA", "INPUT"].includes(target.tagName)) return;
      const key = e.key.toLowerCase();
      const map: Record<string, ReviewReceipt["decision"]> = {
        a: "ADVANCE",
        i: "REQUEST_INFO",
        r: "REDIRECT",
        d: "DECLINE",
      };
      if (map[key]) {
        e.preventDefault();
        decide(map[key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending, note, data.applicationId]);

  const hits = data.evidence.filter((e) => e.hit);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm" variant={triggerVariant} className="h-7 gap-1.5 px-2.5 text-xs">
            <UserRoundSearch className="size-3.5" />
            {triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="pb-3">
            <SheetTitle className="flex items-center gap-2.5 text-[15px]">
              <UserAvatar name={data.candidateName} />
              {data.candidateName}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {data.currentTitle} at {data.currentCompany} · for{" "}
              <span className="font-medium text-foreground">{data.roleTitle}</span> · in your queue{" "}
              {data.timeInStage} · via {data.sourceName}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4">
            {data.timingRisk && (
              <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-2.5 dark:border-orange-900 dark:bg-orange-950/40">
                <Timer className="mt-0.5 size-3.5 shrink-0 text-orange-600" />
                <p className="text-xs leading-snug text-orange-900 dark:text-orange-200">
                  <span className="font-semibold">Timing:</span> {data.timingRisk}. A decision today
                  keeps this candidate in play.
                </p>
              </div>
            )}

            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Summary
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed">{data.summary}</p>
            </section>

            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Fit against your criteria · {hits.length}/{data.evidence.length}
              </h3>
              <ul className="mt-1.5 space-y-1">
                {data.evidence.map((e) => (
                  <li key={e.criterion} className="flex items-start gap-1.5 text-xs leading-snug">
                    {e.hit ? (
                      <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                    ) : (
                      <Minus className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className={e.hit ? "" : "text-muted-foreground"}>{e.criterion}</span>
                  </li>
                ))}
              </ul>
            </section>

            {data.primaryConcern && (
              <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Primary concern
                </h3>
                <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug">
                  <CircleAlert className="mt-0.5 size-3 shrink-0 text-amber-600" />
                  {data.primaryConcern}
                </p>
              </section>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full gap-1.5 text-xs"
              onClick={() => toast.info("Résumé opened", { description: "Synced copy from Greenhouse." })}
            >
              <FileText className="size-3.5" /> Open résumé
            </Button>

            <section className="border-t border-border pt-3">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Optional note — attached to your decision and the audit trail"
                className="text-xs"
                aria-label="Decision note"
              />
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={pending}
                  onClick={() => decide("ADVANCE")}
                >
                  <Check className="size-3.5" /> Advance
                  <kbd className="ml-auto rounded border border-background/40 px-1 font-mono text-[10px] opacity-70">A</kbd>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={pending}
                  onClick={() => decide("REQUEST_INFO")}
                >
                  <ClipboardList className="size-3.5" /> Request info
                  <kbd className="ml-auto rounded border border-border px-1 font-mono text-[10px] text-muted-foreground">I</kbd>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={pending}
                  onClick={() => decide("REDIRECT")}
                >
                  <ArrowRight className="size-3.5" /> Redirect
                  <kbd className="ml-auto rounded border border-border px-1 font-mono text-[10px] text-muted-foreground">R</kbd>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  disabled={pending}
                  onClick={() => decide("DECLINE")}
                >
                  <ThumbsDown className="size-3.5" /> Decline
                  <kbd className="ml-auto rounded border border-border px-1 font-mono text-[10px] text-muted-foreground">D</kbd>
                </Button>
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">
                Acting as {data.hmName}. Your decision updates the stage, closes the review chase,
                creates the next action, and is audit-logged.
              </p>
            </section>
          </div>
        </SheetContent>
      </Sheet>

    </>
  );
}
