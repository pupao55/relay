"use client";

// Execution receipts outlive the card that triggered them: approving an action
// (or an HM decision changing the stage) removes the originating card/sheet on
// revalidation, so receipt dialogs must live at the layout level. Components
// publish here via showReceipt() / showReviewReceipt().

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ExecutionReceiptDialog } from "@/components/execution-receipt-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MomentumBadge } from "@/components/status-badges";
import type { ExecutionReceipt, ReviewReceipt } from "@/lib/types";

let receiptListener: ((r: ExecutionReceipt) => void) | null = null;
let reviewListener: ((r: ReviewReceipt) => void) | null = null;

export function showReceipt(r: ExecutionReceipt) {
  receiptListener?.(r);
}
export function showReviewReceipt(r: ReviewReceipt) {
  reviewListener?.(r);
}

const DECISION_LABEL: Record<ReviewReceipt["decision"], string> = {
  ADVANCE: "Advanced",
  DECLINE: "Declined",
  REQUEST_INFO: "Information requested",
  REDIRECT: "Redirect suggested",
};

export function ReceiptHost() {
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [review, setReview] = useState<ReviewReceipt | null>(null);

  useEffect(() => {
    receiptListener = setReceipt;
    reviewListener = setReview;
    return () => {
      receiptListener = null;
      reviewListener = null;
    };
  }, []);

  return (
    <>
      <ExecutionReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      <Dialog open={review !== null} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="sm:max-w-md">
          {review && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-[15px]">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  {DECISION_LABEL[review.decision]}
                </DialogTitle>
                <DialogDescription>
                  {review.actor}&apos;s decision on {review.candidateName} — executed and logged.
                </DialogDescription>
              </DialogHeader>
              <dl className="space-y-2.5 text-[13px]">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Stage
                  </dt>
                  <dd className="mt-0.5">
                    {review.previousStage}
                    {review.newStage !== review.previousStage && (
                      <>
                        {" "}
                        <ArrowRight className="inline size-3 text-muted-foreground" />{" "}
                        <span className="font-medium">{review.newStage}</span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Momentum
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5">
                    <MomentumBadge momentum={review.momentumBefore} />
                    {review.momentumAfter !== review.momentumBefore && (
                      <>
                        <ArrowRight className="size-3 text-muted-foreground" />
                        <MomentumBadge momentum={review.momentumAfter} />
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Next action
                  </dt>
                  <dd className="mt-0.5 leading-snug">{review.nextAction}</dd>
                </div>
              </dl>
              <div className="flex justify-end">
                <Button size="sm" className="h-7 text-xs" onClick={() => setReview(null)}>
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
