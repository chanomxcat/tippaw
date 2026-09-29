import type { Metadata } from "next";

import { requireAdmin } from "@/server/auth/page-guards";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ADMIN_NAV } from "@/ui/nav-config";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <DashboardShell nav={ADMIN_NAV} user={{ name: user.name }}>
      {children}
    </DashboardShell>
  );
}
