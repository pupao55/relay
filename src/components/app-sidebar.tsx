"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Activity,
  BarChart3,
  Briefcase,
  ChevronsUpDown,
  ListChecks,
  Menu,
  Settings,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { switchUser } from "@/lib/actions";

const NAV = [
  { href: "/", label: "Command Center", icon: Activity },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/roles", label: "Roles", icon: Briefcase },
  { href: "/actions", label: "Actions", icon: ListChecks },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Hiring managers decide; recruiters operate. The nav reflects the job.
const HM_NAV_HREFS = ["/", "/candidates", "/roles"];

export interface Persona {
  id: string;
  name: string;
  title: string;
  userRole: string;
}

function NavLinks({
  onNavigate,
  userRole,
}: {
  onNavigate?: () => void;
  userRole: string;
}) {
  const pathname = usePathname();
  const nav =
    userRole === "HIRING_MANAGER" ? NAV.filter((n) => HM_NAV_HREFS.includes(n.href)) : NAV;
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Primary">
      {nav.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
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

function PersonaSwitcher({
  currentUser,
  personas,
}: {
  currentUser: { id: string; name: string; title: string; userRole: string };
  personas: Persona[];
}) {
  const [pending, startTransition] = useTransition();
  const recruiters = personas.filter((p) => p.userRole === "RECRUITER");
  const hms = personas.filter((p) => p.userRole === "HIRING_MANAGER");

  const pick = (p: Persona) =>
    startTransition(async () => {
      await switchUser(p.id);
      toast.success(`Now viewing as ${p.name}`, { description: p.title });
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label="Switch persona"
          className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-accent/60"
        >
          <UserAvatar name={currentUser.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{currentUser.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {currentUser.title}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold">View as (demo)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Recruiters
        </DropdownMenuLabel>
        {recruiters.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => pick(p)} className="gap-2 text-[13px]">
            <UserAvatar name={p.name} size="sm" />
            <span className="flex-1">{p.name}</span>
            {p.id === currentUser.id && <span className="text-[11px] text-muted-foreground">current</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Hiring managers
        </DropdownMenuLabel>
        {hms.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => pick(p)} className="gap-2 text-[13px]">
            <UserAvatar name={p.name} size="sm" />
            <span className="flex-1">{p.name}</span>
            {p.id === currentUser.id && <span className="text-[11px] text-muted-foreground">current</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({
  currentUser,
  personas,
  onNavigate,
}: {
  currentUser: { id: string; name: string; title: string; userRole: string };
  personas: Persona[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-foreground">
          <Zap className="size-3.5 text-background" strokeWidth={2.25} />
        </div>
        <span className="text-sm font-semibold tracking-tight">Relay</span>
        <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Helios
        </span>
      </div>
      <NavLinks onNavigate={onNavigate} userRole={currentUser.userRole} />
      <div className="border-t border-border px-2.5 py-2.5">
        <PersonaSwitcher currentUser={currentUser} personas={personas} />
      </div>
    </div>
  );
}

export function AppSidebar({
  currentUser,
  personas,
}: {
  currentUser: { id: string; name: string; title: string; userRole: string };
  personas: Persona[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-border bg-sidebar md:block">
        <SidebarContent currentUser={currentUser} personas={personas} />
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
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
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
            <SidebarContent
              currentUser={currentUser}
              personas={personas}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
      {/* Spacer for mobile header */}
      <div className="h-11 md:hidden" aria-hidden />
    </>
  );
}
