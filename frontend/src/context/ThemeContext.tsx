"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type ExperienceMode = "simple" | "advanced";

export interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  reducedMotion: boolean;
  setReducedMotion: (val: boolean) => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  experienceMode: ExperienceMode;
  setExperienceMode: (mode: ExperienceMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "campvion_theme";
const MOTION_STORAGE_KEY = "campvion_reduced_motion";
const CONTRAST_STORAGE_KEY = "campvion_high_contrast";
const EXPERIENCE_MODE_KEY = "campvion_experience_mode";

const EVENT_THEME_CHANGE = "campvion_theme_change";
const EVENT_MODE_CHANGE = "campvion_mode_change";
const EVENT_ACCESSIBILITY_CHANGE = "campvion_accessibility_change";

function subscribeStore(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_THEME_CHANGE, callback);
  window.addEventListener(EVENT_MODE_CHANGE, callback);
  window.addEventListener(EVENT_ACCESSIBILITY_CHANGE, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT_THEME_CHANGE, callback);
    window.removeEventListener(EVENT_MODE_CHANGE, callback);
    window.removeEventListener(EVENT_ACCESSIBILITY_CHANGE, callback);
  };
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function getThemeSnapshot(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // safe fallback
  }
  return "system";
}

function getThemeServerSnapshot(): ThemeMode {
  return "system";
}

function getExperienceModeSnapshot(): ExperienceMode {
  try {
    const saved = localStorage.getItem(EXPERIENCE_MODE_KEY) as ExperienceMode | null;
    if (saved === "simple" || saved === "advanced") {
      return saved;
    }
  } catch {
    // safe fallback
  }
  return "simple";
}

function getExperienceModeServerSnapshot(): ExperienceMode {
  return "simple";
}

function getReducedMotionSnapshot(): boolean {
  try {
    const saved = localStorage.getItem(MOTION_STORAGE_KEY);
    if (saved !== null) return saved === "true";
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return true;
    }
  } catch {
    // safe fallback
  }
  return false;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function getHighContrastSnapshot(): boolean {
  try {
    const saved = localStorage.getItem(CONTRAST_STORAGE_KEY);
    if (saved !== null) return saved === "true";
  } catch {
    // safe fallback
  }
  return false;
}

function getHighContrastServerSnapshot(): boolean {
  return false;
}

function getResolvedThemeSnapshot(): ResolvedTheme {
  const currentTheme = getThemeSnapshot();
  if (currentTheme === "system") {
    return getSystemTheme();
  }
  return currentTheme;
}

function getResolvedThemeServerSnapshot(): ResolvedTheme {
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeStore, getThemeSnapshot, getThemeServerSnapshot);
  const resolvedTheme = useSyncExternalStore(
    subscribeStore,
    getResolvedThemeSnapshot,
    getResolvedThemeServerSnapshot
  );
  const experienceMode = useSyncExternalStore(
    subscribeStore,
    getExperienceModeSnapshot,
    getExperienceModeServerSnapshot
  );
  const reducedMotion = useSyncExternalStore(
    subscribeStore,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const highContrast = useSyncExternalStore(
    subscribeStore,
    getHighContrastSnapshot,
    getHighContrastServerSnapshot
  );

  // Synchronize DOM attributes with resolved theme
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);

    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  // Synchronize reduced motion with DOM
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.setAttribute("data-reduced-motion", "true");
    } else {
      root.removeAttribute("data-reduced-motion");
    }
  }, [reducedMotion]);

  // Synchronize high contrast with DOM
  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) {
      root.setAttribute("data-high-contrast", "true");
    } else {
      root.removeAttribute("data-high-contrast");
    }
  }, [highContrast]);

  // Listen to OS system color scheme changes dynamically
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemChange = () => {
      if (theme === "system") {
        window.dispatchEvent(new Event(EVENT_THEME_CHANGE));
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    try {
      // Briefly enable a short colour cross-fade so the theme switch feels smooth.
      // Reduced-motion preferences override this via CSS (!important rules).
      const root = document.documentElement;
      root.classList.add("cv-theme-transition");
      window.setTimeout(() => root.classList.remove("cv-theme-transition"), 260);

      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      window.dispatchEvent(new Event(EVENT_THEME_CHANGE));
    } catch {
      // safe fallback
    }
  };

  const setReducedMotion = (val: boolean) => {
    try {
      localStorage.setItem(MOTION_STORAGE_KEY, String(val));
      window.dispatchEvent(new Event(EVENT_ACCESSIBILITY_CHANGE));
    } catch {
      // safe fallback
    }
  };

  const setHighContrast = (val: boolean) => {
    try {
      localStorage.setItem(CONTRAST_STORAGE_KEY, String(val));
      window.dispatchEvent(new Event(EVENT_ACCESSIBILITY_CHANGE));
    } catch {
      // safe fallback
    }
  };

  const setExperienceMode = (mode: ExperienceMode) => {
    try {
      localStorage.setItem(EXPERIENCE_MODE_KEY, mode);
      window.dispatchEvent(new Event(EVENT_MODE_CHANGE));
    } catch {
      // safe fallback
    }
  };

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      reducedMotion,
      setReducedMotion,
      highContrast,
      setHighContrast,
      experienceMode,
      setExperienceMode,
    }),
    [theme, resolvedTheme, reducedMotion, highContrast, experienceMode]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
