const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** "3d 4h" / "6h" / "22m" duration since a past date. */
export function durationSince(date: Date | string, now = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = Math.max(0, now.getTime() - d.getTime());
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / 60000))}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  return hours > 0 && days < 4 ? `${days}d ${hours}h` : `${days}d`;
}

/** "in 4h" / "2h overdue" for due dates. */
export function dueLabel(date: Date | string, now = new Date()): { label: string; overdue: boolean } {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = d.getTime() - now.getTime();
  if (ms >= 0) return { label: `in ${durationSince(now, d)}`, overdue: false };
  return { label: `${durationSince(d, now)} overdue`, overdue: true };
}

export function shortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function shortDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
