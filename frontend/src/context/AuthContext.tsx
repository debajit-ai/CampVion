"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiClient } from "../lib/api";
import { LoginPayload, SignupPayload, UserProfile } from "../types/api";

export interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  preferredDisplayName: string;
  setPreferredDisplayName: (name: string, targetEmail?: string) => void;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  signup: (payload: SignupPayload) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserProfile | null>;
  updateLocalUser: (profile: UserProfile) => void;
}

const LEGACY_DISPLAY_NAME_STORAGE_KEY = "campvion_user_display_name";
const SCOPED_DISPLAY_NAME_PREFIX = "campvion_display_name_";
const DISPLAY_NAME_EVENT = "campvion_display_name_change";

function purgeLegacyDisplayName(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_DISPLAY_NAME_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function getScopedDisplayName(email?: string | null): string {
  if (typeof window === "undefined") return "";
  purgeLegacyDisplayName();
  if (!email || !email.trim()) return "";
  try {
    return (
      window.localStorage.getItem(
        `${SCOPED_DISPLAY_NAME_PREFIX}${email.trim().toLowerCase()}`
      ) || ""
    ).trim();
  } catch {
    return "";
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [displayNameTick, setDisplayNameTick] = useState(0);

  useEffect(() => {
    purgeLegacyDisplayName();
    const handler = () => setDisplayNameTick((t) => t + 1);
    window.addEventListener("storage", handler);
    window.addEventListener(DISPLAY_NAME_EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(DISPLAY_NAME_EVENT, handler);
    };
  }, []);

  const preferredDisplayName = useMemo(() => {
    void displayNameTick;
    return getScopedDisplayName(user?.email);
  }, [user?.email, displayNameTick]);

  const setPreferredDisplayName = useCallback(
    (name: string, targetEmail?: string) => {
      const trimmed = name.trim();
      const emailKey = (targetEmail || user?.email || "").trim().toLowerCase();
      if (typeof window !== "undefined") {
        purgeLegacyDisplayName();
        try {
          if (emailKey) {
            if (trimmed) {
              window.localStorage.setItem(
                `${SCOPED_DISPLAY_NAME_PREFIX}${emailKey}`,
                trimmed
              );
            } else {
              window.localStorage.removeItem(
                `${SCOPED_DISPLAY_NAME_PREFIX}${emailKey}`
              );
            }
          }
          window.dispatchEvent(new Event(DISPLAY_NAME_EVENT));
        } catch {
          // Ignore storage errors
        }
      }
    },
    [user?.email]
  );

  const refreshSession = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const profile = await apiClient.getCurrentUser();
      setUser(profile);
      return profile;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const profile = await apiClient.getCurrentUser();
        if (isMounted) setUser(profile);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<UserProfile> => {
    purgeLegacyDisplayName();
    const res = await apiClient.login(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(async (payload: SignupPayload): Promise<UserProfile> => {
    purgeLegacyDisplayName();
    const res = await apiClient.signup(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    purgeLegacyDisplayName();
    await apiClient.logout();
    setUser(null);
  }, []);

  const updateLocalUser = useCallback((profile: UserProfile) => {
    setUser(profile);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      preferredDisplayName,
      setPreferredDisplayName,
      login,
      signup,
      logout,
      refreshSession,
      updateLocalUser,
    }),
    [user, isLoading, preferredDisplayName, setPreferredDisplayName, login, signup, logout, refreshSession, updateLocalUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
