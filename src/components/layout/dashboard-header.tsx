"use client";

import { Menu } from "lucide-react";
import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export type DashboardHeaderProps = {
  user: { name: string };
};

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    // better-auth's endpoint requires a JSON content type even for an empty
    // body, or it 415s and the session cookie never gets cleared.
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <div className="navbar bg-base-100 border-base-300 border-b">
      <div className="navbar-start">
        <label htmlFor="dashboard-drawer" className="btn btn-square btn-ghost lg:hidden">
          <Menu />
        </label>
      </div>

      <div className="navbar-end gap-1">
        <ThemeToggle />

        <div className="dropdown dropdown-end">
          <button
            type="button"
            aria-label="บัญชีผู้ใช้"
            className="btn btn-circle btn-ghost avatar avatar-placeholder"
          >
            <div className="bg-primary text-primary-content size-10 rounded-full font-semibold">
              <span>{user.name.charAt(0).toUpperCase()}</span>
            </div>
          </button>

          <ul className="menu dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 border-base-300 border">
            <li className="menu-title">{user.name}</li>
            <li>
              <hr className="border-base-300 my-1" />
            </li>
            <li>
              <button type="button" onClick={handleSignOut} className="text-error">
                ออกจากระบบ
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
