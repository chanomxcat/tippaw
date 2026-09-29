"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { TippawLogo } from "@/components/brand/logo";
import type { NavItem } from "@/ui/nav-config";

export type DashboardNavProps = {
  nav: NavItem[];
  className?: string;
};

export function DashboardNav({ nav, className }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <ul className={`menu w-64 gap-1 ${className ?? ""}`}>
      <li className="mb-4 px-2 pt-1">
        <Link href="/" aria-label="TipPaw หน้าแรก" className="hover:bg-transparent">
          <TippawLogo />
        </Link>
      </li>
      {nav.map((item) => {
        const isActive = item.path === pathname;

        return (
          <li key={item.title}>
            <Link
              href={item.path}
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "active font-medium" : undefined}
            >
              <item.icon size={20} />
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
