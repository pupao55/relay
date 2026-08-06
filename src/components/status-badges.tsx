import { cn } from "@/lib/utils";
import {
  ACTION_STATUS_META,
  MOMENTUM_META,
  RISK_META,
  SOURCE_TYPE_LABELS,
  type ActionStatus,
  type Momentum,
  type RiskLevel,
  type SourceType,
} from "@/lib/types";

const base =
  "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function MomentumBadge({ momentum, className }: { momentum: string; className?: string }) {
  const meta = MOMENTUM_META[momentum as Momentum] ?? MOMENTUM_META.MOVING;
  return (
    <span className={cn(base, meta.className, className)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function RiskBadge({ risk, className }: { risk: string; className?: string }) {
  const meta = RISK_META[risk as RiskLevel] ?? RISK_META.LOW;
  return <span className={cn(base, meta.className, className)}>{meta.label}</span>;
}

export function ActionStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = ACTION_STATUS_META[status as ActionStatus] ?? ACTION_STATUS_META.PROPOSED;
  return <span className={cn(base, meta.className, className)}>{meta.label}</span>;
}

/**
 * The five execution states, in priority order. Distinct from pipeline stage:
 * this answers "does anyone need to act, and how urgently?"
 */
export type ExecutionState = "UNOWNED" | "AT_RISK" | "BLOCKED" | "OVERDUE" | "SLOWING" | "MOVING";

export const EXECUTION_STATE_META: Record<
  ExecutionState,
  { label: string; className: string; dot: string; describe: string }
> = {
  UNOWNED: {
    label: "Unowned",
    className:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-900",
    dot: "bg-violet-500",
    describe: "No next action or owner — error state",
  },
  AT_RISK: {
    label: "At Risk",
    className:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900",
    dot: "bg-orange-500",
    describe: "Competing deadline — likely withdrawal if unaddressed",
  },
  BLOCKED: {
    label: "Blocked",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900",
    dot: "bg-red-500",
    describe: "Waiting on a specific person past SLA",
  },
  OVERDUE: {
    label: "Overdue",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
    dot: "bg-amber-500",
    describe: "The next action is past its due date",
  },
  SLOWING: {
    label: "Slowing",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
    dot: "bg-amber-500",
    describe: "Past SLA but not yet blocked",
  },
  MOVING: {
    label: "Moving",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900",
    dot: "bg-emerald-500",
    describe: "On track — owned, in SLA",
  },
};

export function StateBadge({ state, className }: { state: string; className?: string }) {
  const meta = EXECUTION_STATE_META[state as ExecutionState] ?? EXECUTION_STATE_META.MOVING;
  return (
    <span className={cn(base, meta.className, className)} title={meta.describe}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function StageBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        base,
        "border-border bg-muted/60 text-foreground/80",
        className
      )}
    >
      {name}
    </span>
  );
}

export function SourceBadge({ type, name, className }: { type: string; name?: string; className?: string }) {
  const label = SOURCE_TYPE_LABELS[type as SourceType] ?? type;
  return (
    <span className={cn(base, "border-border bg-transparent text-muted-foreground", className)} title={name}>
      {label}
    </span>
  );
}
