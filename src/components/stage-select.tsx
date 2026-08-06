"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateApplicationStage } from "@/lib/actions";

export function StageSelect({
  applicationId,
  currentStageId,
  stages,
}: {
  applicationId: string;
  currentStageId: string;
  stages: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={currentStageId}
      disabled={pending}
      onValueChange={(stageId) => {
        const stage = stages.find((s) => s.id === stageId);
        startTransition(async () => {
          await updateApplicationStage(applicationId, stageId);
          toast.success(`Moved to ${stage?.name}`);
        });
      }}
    >
      <SelectTrigger size="sm" className="h-7 w-auto gap-1.5 text-[13px]" aria-label="Change stage">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stages.map((s) => (
          <SelectItem key={s.id} value={s.id} className="text-[13px]">
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
