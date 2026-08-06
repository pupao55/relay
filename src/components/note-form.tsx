"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNote } from "@/lib/actions";

export function NoteForm({ applicationId }: { applicationId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        startTransition(async () => {
          await addNote(applicationId, body);
          setBody("");
          toast.success("Note added");
        });
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add an internal note… (visible to the team, logged to the timeline)"
        rows={2}
        className="text-sm"
        aria-label="Add note"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" className="h-7 text-[13px]" disabled={pending || !body.trim()}>
          Add note
        </Button>
      </div>
    </form>
  );
}
