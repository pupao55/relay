"use client";

import { useTransition } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runAgentNow } from "@/lib/actions";

export function RunAgentButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 gap-1.5 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await runAgentNow();
          toast.success("Agent pass complete", { description: result.summary });
        })
      }
    >
      {pending ? (
        <RefreshCw className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
      {pending ? "Reviewing pipeline…" : "Run agent pass"}
    </Button>
  );
}
