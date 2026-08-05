"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveAction,
  changeActionOwner,
  completeAction,
  delayAction,
  dismissAction,
  editAction,
} from "@/lib/actions";

export interface ActionControlsProps {
  action: {
    id: string;
    title: string;
    proposedContent: string;
    status: string;
    risk: string;
  };
  users?: { id: string; name: string }[];
  /** Show a "Mark complete" affordance for approved/in-progress actions. */
  showComplete?: boolean;
  size?: "sm" | "xs";
}

export function ActionControls({ action, users = [], showComplete = false, size = "sm" }: ActionControlsProps) {
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(action.title);
  const [content, setContent] = useState(action.proposedContent);

  const btnClass = size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs";
  const isOpen = ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"].includes(action.status);
  const isProposed = action.status === "PROPOSED";

  if (!isOpen) return null;

  const run = (fn: () => Promise<unknown>, message: string) =>
    startTransition(async () => {
      await fn();
      toast.success(message);
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isProposed && (
        <>
          <Button
            size="sm"
            className={btnClass}
            disabled={pending}
            onClick={() => run(() => approveAction(action.id), "Action approved — Relay is executing it")}
          >
            <Check className="size-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={btnClass}
            disabled={pending}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={btnClass}
            disabled={pending}
            onClick={() => run(() => delayAction(action.id, 24), "Delayed 24 hours")}
          >
            <Clock className="size-3" /> Wait
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`${btnClass} text-muted-foreground`}
            disabled={pending}
            onClick={() => run(() => dismissAction(action.id), "Action dismissed")}
          >
            <X className="size-3" /> Dismiss
          </Button>
        </>
      )}
      {!isProposed && showComplete && (
        <Button
          size="sm"
          variant="outline"
          className={btnClass}
          disabled={pending}
          onClick={() => run(() => completeAction(action.id), "Marked complete")}
        >
          <Check className="size-3" /> Mark complete
        </Button>
      )}
      {users.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className={`${btnClass} text-muted-foreground`} disabled={pending}>
              Reassign
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>New owner</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {users.map((u) => (
              <DropdownMenuItem
                key={u.id}
                onClick={() => run(() => changeActionOwner(action.id, u.id), `Reassigned to ${u.name}`)}
              >
                {u.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit draft action</DialogTitle>
            <DialogDescription>
              Revise the agent&apos;s draft before approving. Edits are logged to the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`title-${action.id}`}>Title</Label>
              <Input
                id={`title-${action.id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`content-${action.id}`}>Proposed content</Label>
              <Textarea
                id={`content-${action.id}`}
                rows={7}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="text-[13px] leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await editAction(action.id, { title, proposedContent: content });
                  toast.success("Draft updated");
                  setEditOpen(false);
                })
              }
            >
              Save draft
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await editAction(action.id, { title, proposedContent: content });
                  await approveAction(action.id);
                  toast.success("Updated and approved");
                  setEditOpen(false);
                })
              }
            >
              Save &amp; approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
