"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  Briefcase,
  ListChecks,
  Menu,
  Settings,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENT_USER_NAME } from "@/lib/current-user";

const NAV = [
  { href: "/", label: "Command Center", icon: Activity },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/roles", label: "Roles", icon: Briefcase },
  { href: "/actions", label: "Actions", icon: ListChecks },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Primary">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-foreground">
          <Zap className="size-3.5 text-background" strokeWidth={2.25} />
        </div>
        <span className="text-sm font-semibold tracking-tight">Relay</span>
        <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Helios
        </span>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            SK
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{CURRENT_USER_NAME}</div>
            <div className="truncate text-[11px] text-muted-foreground">Recruiting Lead</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-border bg-sidebar md:block">
        <SidebarContent />
      </aside>

      {/* Mobile */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-border bg-background px-4 py-2.5 md:hidden">
        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded bg-foreground">
            <Zap className="size-3 text-background" strokeWidth={2.25} />
          </div>
          <span className="text-sm font-semibold">Relay</span>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-background shadow-lg">
            <div className="flex justify-end p-2">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="size-5" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      {/* Spacer for mobile header */}
      <div className="h-11 md:hidden" aria-hidden />
    </>
  );
}
