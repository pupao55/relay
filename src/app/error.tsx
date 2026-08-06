"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
      <CircleAlert className="mb-3 size-6 text-red-500" />
      <h2 className="text-sm font-semibold">Something went wrong</h2>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        {error.message || "An unexpected error occurred while loading this view."}
        {" "}If the database is empty, run <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code>.
      </p>
      <Button size="sm" variant="outline" className="mt-4 h-8 text-[13px]" onClick={reset}>
        <RotateCcw className="size-3.5" /> Try again
      </Button>
    </div>
  );
}
