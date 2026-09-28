export type NavItem = {
  title: string;
  path: string;
  icon: string;
};

// ----------------------------------------------------------------------
// Nav config for DashboardShell (src/ui/minimal/layouts/dashboard).
// Pages (later tasks) pass STREAMER_NAV or ADMIN_NAV as the `nav` prop.
// ----------------------------------------------------------------------

export const STREAMER_NAV: NavItem[] = [
  {
    title: "ธุรกรรม",
    path: "/dashboard/transactions",
    icon: "solar:bill-list-bold-duotone",
  },
  {
    title: "หน้า Tip",
    path: "/dashboard/tip-page",
    icon: "solar:cup-star-bold-duotone",
  },
  {
    title: "Alert",
    path: "/dashboard/overlays/alert",
    icon: "solar:bell-bing-bold-duotone",
  },
  {
    title: "โปรไฟล์",
    path: "/dashboard/profile",
    icon: "solar:user-id-bold-duotone",
  },
];

export const ADMIN_NAV: NavItem[] = [
  {
    title: "Invite codes",
    path: "/admin/invites",
    icon: "solar:ticket-bold-duotone",
  },
  {
    title: "ผู้ใช้",
    path: "/admin/users",
    icon: "solar:users-group-rounded-bold-duotone",
  },
];
