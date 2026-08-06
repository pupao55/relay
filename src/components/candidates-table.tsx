"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MomentumBadge, RiskBadge, SourceBadge, StageBadge } from "@/components/status-badges";
import { UserAvatar } from "@/components/user-avatar";

export interface CandidateRow {
  applicationId: string;
  candidateId: string;
  name: string;
  company: string;
  roleTitle: string;
  recruiterName: string;
  hmName: string;
  stageName: string;
  stageOrder: number;
  momentum: string;
  status: string;
  nextAction: string | null;
  ownerName: string | null;
  dueLabel: string | null;
  dueOverdue: boolean;
  dueTs: number | null;
  timeInStage: string;
  hoursInStage: number;
  risk: string;
  sourceType: string;
  sourceLabel: string;
  sourceName: string;
  blocked: boolean;
}

type SortKey = "name" | "role" | "stage" | "momentum" | "due" | "timeInStage" | "risk";

const RISK_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const MOMENTUM_ORDER: Record<string, number> = { BLOCKED: 0, AT_RISK: 1, SLOWING: 2, MOVING: 3 };

export function CandidatesTable({
  rows,
  roles,
  recruiters,
  hms,
  stages,
  sources,
}: {
  rows: CandidateRow[];
  roles: string[];
  recruiters: string[];
  hms: string[];
  stages: string[];
  sources: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [recruiter, setRecruiter] = useState("all");
  const [hm, setHm] = useState("all");
  const [stage, setStage] = useState("all");
  const [source, setSource] = useState("all");
  const [risk, setRisk] = useState("all");
  const [flag, setFlag] = useState("all"); // all | blocked | overdue
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (q && !`${r.name} ${r.company} ${r.roleTitle}`.toLowerCase().includes(q)) return false;
      if (role !== "all" && r.roleTitle !== role) return false;
      if (recruiter !== "all" && r.recruiterName !== recruiter) return false;
      if (hm !== "all" && r.hmName !== hm) return false;
      if (stage !== "all" && r.stageName !== stage) return false;
      if (source !== "all" && r.sourceLabel !== source) return false;
      if (risk !== "all" && r.risk !== risk) return false;
      if (flag === "blocked" && !r.blocked) return false;
      if (flag === "overdue" && !r.dueOverdue) return false;
      return true;
    });
    const cmp = (a: CandidateRow, b: CandidateRow): number => {
      switch (sortKey) {
        case "name": return a.name.localeCompare(b.name);
        case "role": return a.roleTitle.localeCompare(b.roleTitle);
        case "stage": return a.stageOrder - b.stageOrder;
        case "momentum": return (MOMENTUM_ORDER[a.momentum] ?? 9) - (MOMENTUM_ORDER[b.momentum] ?? 9);
        case "due": return (a.dueTs ?? Infinity) - (b.dueTs ?? Infinity);
        case "timeInStage": return b.hoursInStage - a.hoursInStage;
        case "risk": return (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9);
      }
    };
    return [...out].sort((a, b) => cmp(a, b) * sortDir);
  }, [rows, search, role, recruiter, hm, stage, source, risk, flag, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const sortHeader = (label: string, k: SortKey, className?: string) => (
    <TableHead key={label} className={cn("h-8 text-xs", className)}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      >
        {label}
        {sortKey === k ? (
          sortDir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  const selects: [string, string, (v: string) => void, string[]][] = [
    ["Role", role, setRole, roles],
    ["Recruiter", recruiter, setRecruiter, recruiters],
    ["Hiring manager", hm, setHm, hms],
    ["Stage", stage, setStage, stages],
    ["Source", source, setSource, sources],
    ["Risk", risk, setRisk, ["LOW", "MEDIUM", "HIGH", "CRITICAL"]],
    ["Status", flag, setFlag, ["blocked", "overdue"]],
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates…"
            className="h-8 w-56 pl-8 text-sm"
            aria-label="Search candidates"
          />
        </div>
        {selects.map(([label, value, set, options]) => (
          <Select key={label} value={value} onValueChange={set}>
            <SelectTrigger
              size="sm"
              className={cn(
                "h-8 gap-1 text-[13px]",
                value !== "all" && "border-foreground/40"
              )}
              aria-label={`Filter by ${label.toLowerCase()}`}
            >
              <span className="text-muted-foreground">{label}:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {label === "Risk"
                    ? o.charAt(0) + o.slice(1).toLowerCase()
                    : label === "Status"
                      ? o.charAt(0).toUpperCase() + o.slice(1)
                      : o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {sortHeader("Candidate", "name")}
              {sortHeader("Role", "role")}
              {sortHeader("Stage", "stage")}
              {sortHeader("Momentum", "momentum")}
              <TableHead className="h-8 text-xs font-medium">Next Action</TableHead>
              <TableHead className="h-8 text-xs font-medium">Owner</TableHead>
              {sortHeader("Due", "due")}
              {sortHeader("In Stage", "timeInStage")}
              {sortHeader("Risk", "risk")}
              <TableHead className="h-8 text-xs font-medium">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-14 text-center">
                  <SearchX className="mx-auto mb-2 size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">No candidates match</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Adjust the filters or clear the search.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.applicationId}
                  className="cursor-pointer text-sm"
                  onClick={() => router.push(`/candidates/${r.candidateId}`)}
                >
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={r.name} size="sm" />
                      <div className="min-w-0">
                        <Link
                          href={`/candidates/${r.candidateId}`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.company}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-muted-foreground">{r.roleTitle}</TableCell>
                  <TableCell className="py-2">
                    {r.status === "ACTIVE" ? (
                      <StageBadge name={r.stageName} />
                    ) : (
                      <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {r.status === "ACTIVE" ? <MomentumBadge momentum={r.momentum} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="max-w-[240px] py-2">
                    {r.nextAction ? (
                      <span className="line-clamp-2 leading-snug">{r.nextAction}</span>
                    ) : r.status === "ACTIVE" ? (
                      <span className="font-medium text-red-600 dark:text-red-400">Missing — error state</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {r.ownerName ? (
                      <span className="flex items-center gap-1.5">
                        <UserAvatar name={r.ownerName} size="sm" />
                        <span className="text-[13px]">{r.ownerName.split(" ")[0]}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-[13px]">
                    {r.dueLabel ? (
                      <span className={cn(r.dueOverdue && "font-medium text-red-600 dark:text-red-400")}>
                        {r.dueLabel}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-[13px] tabular-nums text-muted-foreground">
                    {r.status === "ACTIVE" ? r.timeInStage : "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    {r.status === "ACTIVE" ? <RiskBadge risk={r.risk} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="py-2">
                    <SourceBadge type={r.sourceType} name={r.sourceName} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {filtered.length} of {rows.length} candidates
      </p>
    </div>
  );
}
