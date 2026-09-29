export type ThemeName = "tippaw" | "tippaw-dark";

export const THEME_STORAGE_KEY = "tippaw-theme";

const VALID_THEMES: readonly ThemeName[] = ["tippaw", "tippaw-dark"];

function isThemeName(value: string | null): value is ThemeName {
  return value !== null && (VALID_THEMES as readonly string[]).includes(value);
}

export function getStoredTheme(): ThemeName | null {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeName(stored) ? stored : null;
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}
