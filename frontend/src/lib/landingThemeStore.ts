"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useTheme } from "../context/ThemeContext";

export type AuthThemeMode = "light" | "dark" | "system";

const LANDING_THEME_KEY = "campvion_landing_theme";
const LANDING_THEME_EVENT = "campvion_landing_theme_change";

function subscribeAuthTheme(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(LANDING_THEME_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LANDING_THEME_EVENT, handler);
  };
}

function getAuthThemeSnapshot(): AuthThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem(LANDING_THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return "dark";
}

export function useAuthTheme() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const mode = useSyncExternalStore(
    subscribeAuthTheme,
    getAuthThemeSnapshot,
    () => "dark" as AuthThemeMode
  );

  const isDark =
    mode === "system" ? (mounted ? resolvedTheme === "dark" : true) : mode === "dark";

  const toggleTheme = useCallback(() => {
    const next: AuthThemeMode = isDark ? "light" : "dark";
    try {
      window.localStorage.setItem(LANDING_THEME_KEY, next);
      window.dispatchEvent(new Event(LANDING_THEME_EVENT));
    } catch {
      // Ignore storage access errors
    }
    setTheme(next);
  }, [isDark, setTheme]);

  return { isDark, mounted, toggleTheme };
}
