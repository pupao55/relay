import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
      <SearchX className="mb-3 size-6 text-muted-foreground" />
      <h2 className="text-sm font-semibold">Not found</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        This record doesn&apos;t exist — it may have been removed or re-seeded.
      </p>
      <Link href="/" className="mt-4 text-xs font-medium underline underline-offset-2">
        Back to Command Center
      </Link>
    </div>
  );
}
