import type { NavItem } from "@/ui/nav-config";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardNav } from "@/components/layout/dashboard-nav";

// ----------------------------------------------------------------------
// daisyUI `drawer` pattern: the checkbox toggles `drawer-side` visibility
// below `lg` via CSS only, no JS breakpoint prop needed (see
// DashboardHeader's `htmlFor="dashboard-drawer"` mobile menu button).
// ----------------------------------------------------------------------

export type DashboardShellProps = {
  nav: NavItem[];
  user: { name: string };
  children: React.ReactNode;
};

export function DashboardShell({ nav, user, children }: DashboardShellProps) {
  return (
    <div className="drawer lg:drawer-open">
      <input id="dashboard-drawer" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex min-h-screen flex-col">
        <DashboardHeader user={user} />

        <main className="flex-1 p-5">{children}</main>
      </div>

      <div className="drawer-side z-10">
        <label htmlFor="dashboard-drawer" aria-label="close sidebar" className="drawer-overlay" />
        <DashboardNav nav={nav} className="bg-base-100 min-h-full border-r border-base-300 p-4" />
      </div>
    </div>
  );
}
