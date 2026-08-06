"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { agencySubmitCandidate } from "@/lib/actions";

export function AgencySubmitForm({
  sourceId,
  roles,
}: {
  sourceId: string;
  roles: { id: string; title: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [note, setNote] = useState("");

  const submit = () =>
    startTransition(async () => {
      const message = await agencySubmitCandidate({
        sourceId,
        roleId,
        name,
        email,
        company,
        title,
        note: note || undefined,
      });
      toast.success("Submission received", { description: message });
      setName("");
      setEmail("");
      setCompany("");
      setTitle("");
      setNote("");
    });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="ag-name">Candidate name</Label>
        <Input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ag-email">Email</Label>
        <Input id="ag-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ag-company">Current company</Label>
        <Input id="ag-company" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ag-title">Current title</Label>
        <Input id="ag-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Role</Label>
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger className="text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-[13px]">
                {r.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="ag-note">Submission note</Label>
        <Textarea
          id="ag-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why this candidate, comp expectations, timeline…"
          className="text-[13px]"
        />
      </div>
      <div className="sm:col-span-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-[13px]"
          disabled={pending || !name.trim() || !email.trim() || !roleId}
          onClick={submit}
        >
          <Send className="size-3.5" /> Submit candidate
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Submissions enter review immediately — a named recruiter owns the response within 24 hours.
        </p>
      </div>
    </div>
  );
}
