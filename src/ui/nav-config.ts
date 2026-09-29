"use client";

import type { LucideIcon } from "lucide-react";

import { Bell, Heart, Receipt, Ticket, User, Users } from "lucide-react";

// `"use client"` here isn't about interactivity — STREAMER_NAV/ADMIN_NAV are
// consumed by `requireOnboarded()`/`requireAdmin()` Server Component layouts
// and forwarded as props into the Client Component `DashboardNav`. Lucide
// icon components are plain functions; passed as prop *data* across a
// Server->Client boundary, React's Flight serializer rejects them ("Functions
// cannot be passed directly to Client Components..."). Marking this module
// client turns each export into an already-registered Client Reference
// instead, which *is* serializable — the array crosses the boundary as an
// opaque reference and resolves to the real values once client-side code
// (DashboardNav) actually reads it.

export type NavItem = {
  title: string;
  path: string;
  icon: LucideIcon;
};

// ----------------------------------------------------------------------
// Nav config for DashboardShell (src/components/layout).
// Pages (later tasks) pass STREAMER_NAV or ADMIN_NAV as the `nav` prop.
// ----------------------------------------------------------------------

export const STREAMER_NAV: NavItem[] = [
  {
    title: "ธุรกรรม",
    path: "/dashboard/transactions",
    icon: Receipt,
  },
  {
    title: "หน้า Tip",
    path: "/dashboard/tip-page",
    icon: Heart,
  },
  {
    title: "Alert",
    path: "/dashboard/overlays/alert",
    icon: Bell,
  },
  {
    title: "โปรไฟล์",
    path: "/dashboard/profile",
    icon: User,
  },
];

export const ADMIN_NAV: NavItem[] = [
  {
    title: "Invite codes",
    path: "/admin/invites",
    icon: Ticket,
  },
  {
    title: "ผู้ใช้",
    path: "/admin/users",
    icon: Users,
  },
];
