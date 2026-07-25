import { useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "kazhutha:theme";

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

export function storeThemePreference(theme: ThemePreference) {
  localStorage.setItem(THEME_KEY, theme);
}

export function resolveDark(preference: ThemePreference): boolean {
  if (preference === "dark") return true;
  if (preference === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(preference: ThemePreference) {
  const dark = resolveDark(preference);
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0a0a0a" : "#ffffff");
}

let systemListener: (() => void) | null = null;

export function initTheme() {
  applyTheme(getThemePreference());

  if (systemListener) {
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", systemListener);
  }

  systemListener = () => {
    if (getThemePreference() === "system") applyTheme("system");
  };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", systemListener);
}

export function useThemePreference() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getThemePreference());

  function changeThemePreference(theme: ThemePreference) {
    setThemePreference(theme);
    storeThemePreference(theme);
    applyTheme(theme);
  }

  return { themePreference, changeThemePreference };
}
