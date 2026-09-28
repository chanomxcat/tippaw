import { requireOnboarded } from "@/server/auth/page-guards";
import { DashboardShell } from "@/ui/minimal/layouts/dashboard";
import { STREAMER_NAV } from "@/ui/nav-config";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboarded();

  return (
    <DashboardShell nav={STREAMER_NAV} user={{ name: user.name }}>
      {children}
    </DashboardShell>
  );
}
