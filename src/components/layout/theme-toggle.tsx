"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { applyTheme, getStoredTheme, type ThemeName } from "@/lib/theme";

const DARK_THEME: ThemeName = "tippaw-dark";
const LIGHT_THEME: ThemeName = "tippaw";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>(LIGHT_THEME);

  useEffect(() => {
    const stored = getStoredTheme();
    const current = stored ?? (document.documentElement.dataset.theme as ThemeName | undefined);
    if (current === DARK_THEME || current === LIGHT_THEME) {
      setTheme(current);
    }
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.checked ? DARK_THEME : LIGHT_THEME;
    setTheme(next);
    applyTheme(next);
  }

  return (
    <label className="swap swap-rotate btn btn-ghost btn-circle" aria-label="สลับธีม">
      <input
        type="checkbox"
        checked={theme === DARK_THEME}
        onChange={handleChange}
        aria-label="สลับธีมมืด/สว่าง"
      />
      <Sun className="swap-off" size={20} />
      <Moon className="swap-on" size={20} />
    </label>
  );
}
