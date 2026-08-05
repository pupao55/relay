import {
  Bot,
  Calendar,
  Check,
  CircleAlert,
  Database,
  Mail,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { durationSince, shortDateTime } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<string, typeof Database> = {
  ATS: Database,
  EMAIL: Mail,
  CALENDAR: Calendar,
  SLACK: MessageSquare,
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  CONNECTED: { label: "Connected", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900" },
  SYNCING: { label: "Syncing", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900" },
  ERROR: { label: "Needs attention", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" },
  DISCONNECTED: { label: "Not connected", className: "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800" },
};

const STAGE_MAPPING: { relay: string; greenhouse: string }[] = [
  { relay: "Recruiter Review", greenhouse: "Application Review" },
  { relay: "Hiring Manager Review", greenhouse: "HM Screen" },
  { relay: "Phone Screen", greenhouse: "Preliminary Phone Screen" },
  { relay: "Technical Interview", greenhouse: "Technical Round" },
  { relay: "Onsite", greenhouse: "Face to Face" },
  { relay: "Debrief", greenhouse: "Debrief / Roundup" },
  { relay: "Offer Approval", greenhouse: "Offer — Pending Approval" },
  { relay: "Offer Extended", greenhouse: "Offer Extended" },
  { relay: "Hired", greenhouse: "Hired" },
];

const AGENT_PERMISSIONS = [
  { action: "Send internal reminders (Slack/email to teammates)", allowed: true, note: "Auto-executes when a rule is set to automatic mode" },
  { action: "Create and assign tasks", allowed: true, note: "Auto-executes; always audit-logged" },
  { action: "Propose interview scheduling", allowed: true, note: "Suggestions only; humans confirm times" },
  { action: "Draft candidate-facing messages", allowed: true, note: "Drafts only — sending always requires approval" },
  { action: "Send candidate-facing messages", allowed: false, note: "Always requires human approval" },
  { action: "Reject candidates", allowed: false, note: "Never automated — human decision only" },
  { action: "Offer or compensation communication", allowed: false, note: "Never automated — human decision only" },
  { action: "Disclose interview feedback externally", allowed: false, note: "Blocked at the policy layer" },
];

export default async function SettingsPage() {
  const now = new Date();
  const [integrations, users, rules, logs] = await Promise.all([
    db.integration.findMany({ orderBy: { kind: "asc" } }),
    db.user.findMany({ orderBy: [{ userRole: "asc" }, { name: "asc" }] }),
    db.actionRule.findMany({ orderBy: { slaHours: "asc" } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
  ]);

  const roleLabel: Record<string, string> = {
    RECRUITER: "Recruiter",
    HIRING_MANAGER: "Hiring Manager",
    INTERVIEWER: "Interviewer",
    COORDINATOR: "Coordinator",
    ADMIN: "Admin",
  };

  const rolePermissions: Record<string, string> = {
    RECRUITER: "Approve low/medium-risk actions · edit drafts · move stages",
    HIRING_MANAGER: "Review candidates · submit feedback · approve offers for own roles",
    INTERVIEWER: "View assigned candidates · submit scorecards",
    COORDINATOR: "Schedule interviews · send logistics messages",
    ADMIN: "Full access · manage automations and integrations",
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-[13px] text-muted-foreground">
          Integrations, policies, permissions, and the audit trail.
        </p>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList className="h-8">
          {[
            ["integrations", "Integrations"],
            ["stages", "Stage Mapping"],
            ["sla", "SLA Policies"],
            ["permissions", "Roles & Permissions"],
            ["agent", "Agent Permissions"],
            ["audit", "Audit Logs"],
          ].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="px-3 text-xs">
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="integrations" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {integrations.map((i) => {
              const Icon = KIND_ICON[i.kind] ?? Database;
              const meta = STATUS_META[i.status] ?? STATUS_META.DISCONNECTED;
              return (
                <div key={i.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted/50">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold">{i.provider}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {i.kind === "ATS" ? "Applicant tracking" : i.kind.charAt(0) + i.kind.slice(1).toLowerCase()}
                        </div>
                      </div>
                    </div>
                    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {i.lastSyncAt ? `Last sync ${durationSince(i.lastSyncAt, now)} ago` : "Never synced"}
                    </span>
                    {i.status === "ERROR" && (
                      <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                        <CircleAlert className="size-3" /> Reauthorize required
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="stages" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Relay stage</th>
                  <th className="px-4 py-2 font-medium">Greenhouse stage</th>
                  <th className="px-4 py-2 font-medium">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {STAGE_MAPPING.map((m) => (
                  <tr key={m.relay}>
                    <td className="px-4 py-2 font-medium">{m.relay}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.greenhouse}</td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                        <Check className="size-3" /> Two-way
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Stage changes in either system reconcile within one sync cycle (~2 min).
          </p>
        </TabsContent>

        <TabsContent value="sla" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Policy</th>
                  <th className="px-4 py-2 font-medium">SLA</th>
                  <th className="px-4 py-2 font-medium">Escalation path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {r.slaHours >= 48 ? `${Math.round(r.slaHours / 24)}d` : `${r.slaHours}h`}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.escalationPath}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <UserAvatar name={u.name} size="sm" />
                        <span>
                          <span className="font-medium">{u.name}</span>{" "}
                          <span className="text-[11px] text-muted-foreground">· {u.title}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {roleLabel[u.userRole] ?? u.userRole}
                    </td>
                    <td className="hidden px-4 py-2 text-[11px] text-muted-foreground md:table-cell">
                      {rolePermissions[u.userRole]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="agent" className="mt-4">
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              The agent may execute <span className="font-medium text-foreground">low-risk internal actions</span> automatically
              when a rule allows it. Candidate-facing, offer-related, and rejection actions{" "}
              <span className="font-medium text-foreground">always require human approval</span>, regardless of automation mode.
              Every proposal and execution is written to the audit log.
            </p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {AGENT_PERMISSIONS.map((p) => (
              <li key={p.action} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div>
                  <div className="text-[13px] font-medium">{p.action}</div>
                  <div className="text-[11px] text-muted-foreground">{p.note}</div>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                    p.allowed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                  }`}
                >
                  {p.allowed ? "Allowed" : "Approval required"}
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    l.actorType === "AGENT"
                      ? "border-blue-200 text-blue-600 dark:border-blue-900 dark:text-blue-400"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {l.actorType === "AGENT" ? <Bot className="size-3" /> : <UserRound className="size-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-medium leading-snug">{l.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {l.actorName} ({l.actorType.toLowerCase()}) · {shortDateTime(l.createdAt)}
                    </span>
                  </div>
                  {l.previousState && l.newState && l.previousState !== l.newState && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      <span className="line-clamp-1">
                        {l.previousState.length > 60 ? l.previousState.slice(0, 60) + "…" : l.previousState}
                        {" → "}
                        {l.newState.length > 60 ? l.newState.slice(0, 60) + "…" : l.newState}
                      </span>
                    </div>
                  )}
                  {l.rationale && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {l.rationale}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
