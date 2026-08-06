"use client";

// The agency portal is an external surface: no internal navigation, no
// personas, no internal chrome. Everything else gets the sidebar shell.

import { usePathname } from "next/navigation";
import { AppSidebar, type Persona } from "@/components/app-sidebar";

export function AppShell({
  currentUser,
  personas,
  children,
}: {
  currentUser: { id: string; name: string; title: string; userRole: string };
  personas: Persona[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/agency")) {
    return <main className="min-h-screen">{children}</main>;
  }
  return (
    <div className="flex min-h-screen">
      <AppSidebar currentUser={currentUser} personas={personas} />
      <main className="min-w-0 flex-1 md:pl-56">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
