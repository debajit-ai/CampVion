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
  setPreferredDisplayName: (name: string) => void;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  signup: (payload: SignupPayload) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserProfile | null>;
}

const DISPLAY_NAME_STORAGE_KEY = "campvion_user_display_name";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [preferredDisplayName, setPreferredDisplayNameState] = useState<string>("");

  // Initialize preferred display name from localStorage if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
      if (stored && stored.trim()) {
        setPreferredDisplayNameState(stored.trim());
      }
    }
  }, []);

  const setPreferredDisplayName = useCallback((name: string) => {
    const trimmed = name.trim();
    setPreferredDisplayNameState(trimmed);
    if (typeof window !== "undefined") {
      if (trimmed) {
        localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
      }
    }
  }, []);

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
    const res = await apiClient.login(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(async (payload: SignupPayload): Promise<UserProfile> => {
    const res = await apiClient.signup(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await apiClient.logout();
    setUser(null);
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
    }),
    [user, isLoading, preferredDisplayName, setPreferredDisplayName, login, signup, logout, refreshSession]
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
