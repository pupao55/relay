import Link from "next/link";
import { db } from "@/lib/db";
import { durationSince } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["PROPOSED", "APPROVED", "IN_PROGRESS", "WAITING"];

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" },
  HIGH: { label: "High", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900" },
  STANDARD: { label: "Standard", className: "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800" },
};

export default async function RolesPage() {
  const now = new Date();
  const roles = await db.role.findMany({
    include: {
      recruiter: true,
      hiringManager: true,
      applications: {
        include: { actions: true },
      },
    },
    orderBy: { openedAt: "asc" },
  });

  const rows = roles.map((r) => {
    const active = r.applications.filter((a) => a.status === "ACTIVE");
    const blocked = active.filter((a) => a.momentum === "BLOCKED" || a.momentum === "AT_RISK");
    const avgIdleHours =
      active.length > 0
        ? Math.round(
            active.reduce((sum, a) => sum + (now.getTime() - a.lastActivityAt.getTime()) / 3600_000, 0) /
              active.length
          )
        : 0;
    const openActions = r.applications
      .flatMap((a) => a.actions)
      .filter((x) => OPEN_STATUSES.includes(x.status));
    const oldest = openActions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    return { r, active, blocked, avgIdleHours, oldest };
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Roles</h1>
        <p className="text-sm text-muted-foreground">
          Open roles with pipeline health and unresolved work.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Role", "Department", "Recruiter", "Hiring Manager", "Priority", "Active", "Blocked", "Avg Idle", "Oldest Unresolved Action"].map((h) => (
                <TableHead key={h} className="h-8 text-xs font-medium">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ r, active, blocked, avgIdleHours, oldest }) => (
              <TableRow key={r.id} className="text-sm">
                <TableCell className="py-2.5">
                  <Link href={`/roles/${r.id}`} className="font-medium hover:underline">
                    {r.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.location}</div>
                </TableCell>
                <TableCell className="py-2.5 text-muted-foreground">{r.department}</TableCell>
                <TableCell className="py-2.5">
                  <span className="flex items-center gap-1.5">
                    <UserAvatar name={r.recruiter.name} size="sm" />
                    <span className="text-[13px]">{r.recruiter.name}</span>
                  </span>
                </TableCell>
                <TableCell className="py-2.5">
                  <span className="flex items-center gap-1.5">
                    <UserAvatar name={r.hiringManager.name} size="sm" />
                    <span className="text-[13px]">{r.hiringManager.name}</span>
                  </span>
                </TableCell>
                <TableCell className="py-2.5">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-xs font-medium",
                      (PRIORITY_META[r.priority] ?? PRIORITY_META.STANDARD).className
                    )}
                  >
                    {(PRIORITY_META[r.priority] ?? PRIORITY_META.STANDARD).label}
                  </span>
                </TableCell>
                <TableCell className="py-2.5 tabular-nums">{active.length}</TableCell>
                <TableCell className="py-2.5">
                  <span
                    className={cn(
                      "tabular-nums",
                      blocked.length > 0 && "font-semibold text-red-600 dark:text-red-400"
                    )}
                  >
                    {blocked.length}
                  </span>
                </TableCell>
                <TableCell className="py-2.5 tabular-nums text-muted-foreground">
                  {avgIdleHours >= 24 ? `${Math.round(avgIdleHours / 24)}d` : `${avgIdleHours}h`}
                </TableCell>
                <TableCell className="max-w-[260px] py-2.5">
                  {oldest ? (
                    <span className="line-clamp-1 text-[13px]">
                      {oldest.title}{" "}
                      <span className="text-muted-foreground">
                        · open {durationSince(oldest.createdAt, now)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">None</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
