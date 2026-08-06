"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  ClipboardList,
  FileText,
  Minus,
  StickyNote,
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
import { addReviewNote, hmReviewDecision } from "@/lib/actions";
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
  /** "Company · Title · Years" lines, most recent first. */
  history: string[];
  /** Recent internal notes on this application, newest first. */
  notes: { author: string; when: string; body: string }[];
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

  const saveNote = () =>
    startTransition(async () => {
      await addReviewNote(data.applicationId, note.trim());
      setNote("");
      toast.success("Note saved", { description: "Visible to the team on the candidate's timeline." });
    });

  const hits = data.evidence.filter((e) => e.hit);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant={triggerVariant} className="h-7 gap-1.5 px-2.5 text-[13px]">
          <UserRoundSearch className="size-3.5" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2.5 text-base">
            <UserAvatar name={data.candidateName} />
            {data.candidateName}
          </SheetTitle>
          <SheetDescription className="text-[13px]">
            {data.currentTitle} at {data.currentCompany} · for{" "}
            <span className="font-medium text-foreground">{data.roleTitle}</span> · in your queue{" "}
            {data.timeInStage} · via {data.sourceName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {data.timingRisk && (
            <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-2.5 dark:border-orange-900 dark:bg-orange-950/40">
              <Timer className="mt-0.5 size-3.5 shrink-0 text-orange-600" />
              <p className="text-[13px] leading-snug text-orange-900 dark:text-orange-200">
                <span className="font-semibold">Timing:</span> {data.timingRisk}. A decision today
                keeps this candidate in play.
              </p>
            </div>
          )}

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Summary
            </h3>
            <p className="mt-1 text-sm leading-relaxed">{data.summary}</p>
          </section>

          {data.history.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Building2 className="size-3" /> History
              </h3>
              <ul className="mt-1 space-y-0.5">
                {data.history.map((h) => (
                  <li key={h} className="text-[13px] leading-snug text-foreground/90">
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fit against your criteria · {hits.length}/{data.evidence.length}
            </h3>
            <ul className="mt-1.5 space-y-1">
              {data.evidence.map((e) => (
                <li key={e.criterion} className="flex items-start gap-1.5 text-[13px] leading-snug">
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
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Primary concern
              </h3>
              <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug">
                <CircleAlert className="mt-0.5 size-3 shrink-0 text-amber-600" />
                {data.primaryConcern}
              </p>
            </section>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full gap-1.5 text-[13px]"
            onClick={() => toast.info("Résumé opened", { description: "Synced copy from Greenhouse." })}
          >
            <FileText className="size-3.5" /> Open résumé
          </Button>

          <section className="border-t border-border pt-3">
            <h3 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <StickyNote className="size-3" /> Internal notes
            </h3>
            {data.notes.length > 0 ? (
              <ul className="mt-1.5 space-y-1.5">
                {data.notes.map((n, i) => (
                  <li key={i} className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                    <p className="text-[13px] leading-snug">{n.body}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {n.author} · {n.when}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-muted-foreground">No notes yet.</p>
            )}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add a note — saved to the candidate, or attached to your decision below"
              className="mt-2 text-[13px]"
              aria-label="Internal note"
            />
            <div className="mt-1.5 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                disabled={pending || !note.trim()}
                onClick={saveNote}
              >
                Save note
              </Button>
            </div>
          </section>

          <section className="border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" className="h-8 text-[13px]" disabled={pending} onClick={() => decide("ADVANCE")}>
                <Check className="size-3.5" /> Advance
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[13px]"
                disabled={pending}
                onClick={() => decide("REQUEST_INFO")}
              >
                <ClipboardList className="size-3.5" /> Request info
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[13px]"
                disabled={pending}
                onClick={() => decide("REDIRECT")}
              >
                <ArrowRight className="size-3.5" /> Redirect
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[13px] text-red-600 hover:text-red-700 dark:text-red-400"
                disabled={pending}
                onClick={() => decide("DECLINE")}
              >
                <ThumbsDown className="size-3.5" /> Decline
              </Button>
            </div>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              Acting as {data.hmName}. Your decision updates the stage, closes the review chase,
              creates the next action, and is audit-logged.
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
