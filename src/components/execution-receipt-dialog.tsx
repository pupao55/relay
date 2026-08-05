"use client";

import { ArrowRight, CheckCircle2, CornerDownRight, ShieldAlert, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ExecutionReceipt } from "@/lib/types";

export function ExecutionReceiptDialog({
  receipt,
  onClose,
}: {
  receipt: ExecutionReceipt | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={receipt !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {receipt && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[15px]">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Executed
              </DialogTitle>
              <DialogDescription>
                What Relay just did for {receipt.candidateName} — logged to the audit trail.
              </DialogDescription>
            </DialogHeader>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex items-start gap-2">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Action performed
                  </dt>
                  <dd className="mt-0.5 leading-snug">
                    {receipt.performed}
                    {receipt.channel && (
                      <span className="ml-1.5 rounded border border-border px-1 py-px text-[10px] text-muted-foreground">
                        {receipt.channel}
                      </span>
                    )}
                  </dd>
                </div>
              </div>
              {receipt.recipient && (
                <div className="flex items-start gap-2">
                  <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Recipient
                    </dt>
                    <dd className="mt-0.5">{receipt.recipient}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Candidate state
                  </dt>
                  <dd className="mt-0.5 leading-snug">{receipt.resultingState}</dd>
                  <dt className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Next action
                  </dt>
                  <dd className="mt-0.5 leading-snug">{receipt.nextAction}</dd>
                </div>
              </div>
              {receipt.escalation && (
                <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2.5">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      If no one responds
                    </dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {receipt.escalation}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
            <div className="flex justify-end">
              <Button size="sm" className="h-7 text-xs" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
