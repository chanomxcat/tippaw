"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import type { NavItem } from "@/ui/nav-config";

export type DashboardNavProps = {
  nav: NavItem[];
  className?: string;
};

export function DashboardNav({ nav, className }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <ul className={`menu w-64 ${className ?? ""}`}>
      {nav.map((item) => {
        const isActive = item.path === pathname;

        return (
          <li key={item.title}>
            <Link href={item.path} className={isActive ? "active" : undefined}>
              <item.icon size={20} />
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
