"use client";

import { useSyncExternalStore, useCallback } from "react";

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "popcorn-theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const val = localStorage.getItem(THEME_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch {
    // localStorage not accessible
  }
  return "system";
}

export function getEffectiveTheme(preference?: ThemePreference): "light" | "dark" {
  const pref = preference ?? getStoredTheme();
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyTheme(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const effective = getEffectiveTheme(pref);
  const root = document.documentElement;

  if (effective === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // ignore
  }

  window.dispatchEvent(
    new CustomEvent("popcorn-theme-change", { detail: { preference: pref, effective } })
  );
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleThemeChange = () => callback();
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  window.addEventListener("popcorn-theme-change", handleThemeChange);
  window.addEventListener("storage", handleThemeChange);
  mediaQuery.addEventListener("change", handleThemeChange);

  return () => {
    window.removeEventListener("popcorn-theme-change", handleThemeChange);
    window.removeEventListener("storage", handleThemeChange);
    mediaQuery.removeEventListener("change", handleThemeChange);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore<ThemePreference>(
    subscribe,
    () => getStoredTheme(),
    () => "system"
  );

  const effectiveTheme = useSyncExternalStore<"light" | "dark">(
    subscribe,
    () => getEffectiveTheme(),
    () => "light"
  );

  const setTheme = useCallback((newTheme: ThemePreference) => {
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = getEffectiveTheme();
    const next: ThemePreference = current === "dark" ? "light" : "dark";
    applyTheme(next);
  }, []);

  return {
    theme,
    effectiveTheme,
    isDark: effectiveTheme === "dark",
    isMounted: true,
    setTheme,
    toggleTheme,
  };
}
