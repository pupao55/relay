"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { simulateAtsSync } from "@/lib/actions";

export function SimulateSyncButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 gap-1 px-2 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await simulateAtsSync();
          toast.success("Webhook received", { description: result });
        })
      }
    >
      <RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} />
      Simulate sync event
    </Button>
  );
}
