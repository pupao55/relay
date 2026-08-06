"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Plus, Workflow } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createAutomationRule, setAutomationMode, toggleAutomation } from "@/lib/actions";
import { AUTOMATION_MODE_META, type AutomationMode } from "@/lib/types";

export interface RuleItem {
  id: string;
  name: string;
  trigger: string;
  conditions: string[];
  proposedAction: string;
  mode: string;
  escalationPath: string;
  active: boolean;
  slaHours: number;
}

const MODES: AutomationMode[] = ["SUGGEST_ONLY", "AUTO_INTERNAL", "APPROVAL_REQUIRED", "DISABLED"];

export function AutomationsView({ rules }: { rules: RuleItem[] }) {
  const [pending, startTransition] = useTransition();
  const [builderOpen, setBuilderOpen] = useState(false);

  // Rule builder state — composes a human-readable sentence.
  const [name, setName] = useState("");
  const [triggerWhen, setTriggerWhen] = useState("a candidate has been waiting in a stage");
  const [threshold, setThreshold] = useState("24");
  const [thenDo, setThenDo] = useState("send an internal reminder to the owner");
  const [mode, setMode] = useState<AutomationMode>("APPROVAL_REQUIRED");
  const [escalation, setEscalation] = useState("Recruiting lead");

  const sentence = `When ${triggerWhen} for more than ${threshold} hours, ${thenDo}.`;

  const submit = () =>
    startTransition(async () => {
      await createAutomationRule({
        name: name || sentence,
        trigger: `When ${triggerWhen}`,
        conditions: [`Condition holds for more than ${threshold} hours`],
        proposedAction: thenDo.charAt(0).toUpperCase() + thenDo.slice(1),
        mode,
        escalationPath: escalation,
        slaHours: parseInt(threshold, 10) || 24,
      });
      toast.success("Automation created");
      setBuilderOpen(false);
      setName("");
    });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" className="h-8 text-[13px]" onClick={() => setBuilderOpen(true)}>
          <Plus className="size-3.5" /> New rule
        </Button>
      </div>

      <ul className="space-y-3">
        {rules.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Workflow className="size-3.5 shrink-0 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{r.name}</h2>
                </div>
                <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-muted-foreground">Trigger</dt>
                    <dd className="mt-0.5">{r.trigger}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Conditions</dt>
                    <dd className="mt-0.5">
                      <ul className="space-y-0.5">
                        {r.conditions.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Proposed action</dt>
                    <dd className="mt-0.5 flex items-start gap-1">
                      <ArrowRight className="mt-0.5 size-3 shrink-0 text-blue-600 dark:text-blue-400" />
                      {r.proposedAction}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Escalation path</dt>
                    <dd className="mt-0.5">{r.escalationPath}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {r.active ? "Active" : "Off"}
                  </span>
                  <Switch
                    checked={r.active}
                    disabled={pending}
                    aria-label={`Toggle ${r.name}`}
                    onCheckedChange={(checked) =>
                      startTransition(async () => {
                        await toggleAutomation(r.id, checked);
                        toast.success(`${r.name} ${checked ? "enabled" : "disabled"}`);
                      })
                    }
                  />
                </div>
                <Select
                  value={r.mode}
                  disabled={pending}
                  onValueChange={(m) =>
                    startTransition(async () => {
                      await setAutomationMode(r.id, m);
                      toast.success(`Mode set to ${AUTOMATION_MODE_META[m as AutomationMode].label}`);
                    })
                  }
                >
                  <SelectTrigger size="sm" className="h-7 w-52 text-[13px]" aria-label={`Mode for ${r.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => (
                      <SelectItem key={m} value={m} className="text-[13px]">
                        <div>
                          <div>{AUTOMATION_MODE_META[m].label}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New automation rule</DialogTitle>
            <DialogDescription>
              Compose a rule in plain language. High-risk actions always require human approval
              regardless of mode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekend inbound triage"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>When…</Label>
                <Select value={triggerWhen} onValueChange={setTriggerWhen}>
                  <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      "a candidate has been waiting in a stage",
                      "a scorecard is pending after an interview",
                      "an interview is approved but unscheduled",
                      "a candidate has received no update",
                      "an offer approval is pending",
                    ].map((t) => (
                      <SelectItem key={t} value={t} className="text-[13px]">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-threshold">For more than (hours)</Label>
                <Input
                  id="rule-threshold"
                  type="number"
                  min={1}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Then…</Label>
              <Select value={thenDo} onValueChange={setThenDo}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    "send an internal reminder to the owner",
                    "draft a candidate status update for approval",
                    "escalate to the recruiting lead",
                    "create a review task for the recruiter",
                  ].map((t) => (
                    <SelectItem key={t} value={t} className="text-[13px]">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(m) => setMode(m as AutomationMode)}>
                  <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => (
                      <SelectItem key={m} value={m} className="text-[13px]">
                        {AUTOMATION_MODE_META[m].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-escalation">Escalation path</Label>
                <Input
                  id="rule-escalation"
                  value={escalation}
                  onChange={(e) => setEscalation(e.target.value)}
                />
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-[13px] leading-relaxed">
              <span className="font-medium">Rule preview: </span>
              {sentence}{" "}
              <span className="text-muted-foreground">
                Mode: {AUTOMATION_MODE_META[mode].label.toLowerCase()}. Escalates to {escalation || "—"}.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBuilderOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={pending} onClick={submit}>
              Create rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
