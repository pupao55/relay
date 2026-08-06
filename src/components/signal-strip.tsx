// Panel consensus in one glance: an avatar per interviewer, rating-colored
// dot, pending ghosted. Reads left to right like the debrief will.

import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  STRONG_YES: "bg-emerald-600",
  YES: "bg-emerald-400",
  MIXED: "bg-amber-500",
  NO: "bg-red-500",
};

export function SignalStrip({
  entries,
}: {
  entries: { name: string; rating: string | null }[];
}) {
  if (entries.length === 0) return null;
  const submitted = entries.filter((e) => e.rating).length;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex -space-x-1">
        {entries.map((e, i) => (
          <span
            key={`${e.name}-${i}`}
            className="relative"
            title={`${e.name}: ${e.rating ? e.rating.replace("_", " ").toLowerCase() : "pending"}`}
          >
            <UserAvatar name={e.name} size="sm" className={cn(!e.rating && "opacity-40")} />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background",
                e.rating ? DOT[e.rating] : "bg-neutral-300 dark:bg-neutral-600"
              )}
              aria-hidden
            />
          </span>
        ))}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {submitted}/{entries.length} in
      </span>
    </span>
  );
}
