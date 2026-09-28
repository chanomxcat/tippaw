import { requireAdmin } from "@/server/auth/page-guards";
import { DashboardShell } from "@/ui/minimal/layouts/dashboard";
import { ADMIN_NAV } from "@/ui/nav-config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <DashboardShell nav={ADMIN_NAV} user={{ name: user.name }}>
      {children}
    </DashboardShell>
  );
}
