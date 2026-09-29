"use client";

import { Menu } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export type DashboardHeaderProps = {
  user: { name: string };
};

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Controlled instead of daisyUI's :focus-within dropdown, which closes
  // before the click lands in browsers that don't focus buttons on click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
        <label
          htmlFor="dashboard-drawer"
          className="btn btn-square btn-ghost lg:hidden"
        >
          <Menu />
        </label>
      </div>

      <div className="navbar-end gap-1">
        <ThemeToggle />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="บัญชีผู้ใช้"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="btn btn-circle btn-ghost avatar avatar-placeholder"
          >
            <div className="bg-primary text-primary-content size-10 rounded-full font-semibold">
              <span>{user.name.charAt(0).toUpperCase()}</span>
            </div>
          </button>

          {open && (
            <ul
              role="menu"
              className="menu bg-base-100 rounded-box border-base-300 absolute right-0 z-50 mt-3 w-52 border p-2"
            >
              <li className="menu-title">{user.name}</li>
              <li>
                <hr className="border-base-300 my-1" />
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void handleSignOut();
                  }}
                  className="text-error"
                >
                  ออกจากระบบ
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
