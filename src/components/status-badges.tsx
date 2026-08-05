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
  "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap";

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
