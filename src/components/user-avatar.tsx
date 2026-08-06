import { cn } from "@/lib/utils";
import { avatarColor, initials } from "@/lib/format";

export function UserAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-5 text-[9px]",
    md: "size-7 text-xs",
    lg: "size-10 text-sm",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        avatarColor(name),
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
