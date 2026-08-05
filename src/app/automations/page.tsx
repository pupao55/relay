import { db } from "@/lib/db";
import { AutomationsView, type RuleItem } from "@/components/automations-view";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const rules = await db.actionRule.findMany({ orderBy: { slaHours: "asc" } });

  const items: RuleItem[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    conditions: JSON.parse(r.conditions),
    proposedAction: r.proposedAction,
    mode: r.mode,
    escalationPath: r.escalationPath,
    active: r.active,
    slaHours: r.slaHours,
  }));

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-lg font-semibold tracking-tight">Automations</h1>
        <p className="text-[13px] text-muted-foreground">
          The rules Relay runs on every agent pass. High-risk actions (rejections, offers,
          external messages) always require human approval, whatever the mode.
        </p>
      </div>
      <AutomationsView rules={items} />
    </div>
  );
}
