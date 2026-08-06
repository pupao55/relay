"use client";

// The lazy path to a submitted scorecard: one click, right where you are.

import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitScorecard } from "@/lib/actions";

const RATINGS: {
  value: "STRONG_YES" | "YES" | "MIXED" | "NO";
  label: string;
  className: string;
}[] = [
  {
    value: "STRONG_YES",
    label: "Strong yes",
    className:
      "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950",
  },
  {
    value: "YES",
    label: "Yes",
    className:
      "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-500 dark:hover:bg-emerald-950",
  },
  {
    value: "MIXED",
    label: "Mixed",
    className:
      "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950",
  },
  {
    value: "NO",
    label: "No",
    className:
      "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950",
  },
];

export function ScorecardButtons({ feedbackId }: { feedbackId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-1">
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            startTransition(async () => {
              const result = await submitScorecard(feedbackId, r.value);
              toast.success(r.label, { description: result });
            });
          }}
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50",
            r.className
          )}
        >
          {r.label}
        </button>
      ))}
    </span>
  );
}
