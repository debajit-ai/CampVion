"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, preferredDisplayName, setPreferredDisplayName } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preferredDisplayName) {
      setDisplayNameInput(preferredDisplayName);
    }
  }, [preferredDisplayName]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/app");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      if (displayNameInput.trim()) {
        setPreferredDisplayName(displayNameInput.trim());
      }
      await login({
        email: trimmedEmail,
        password,
        remember_me: rememberMe,
      });
      router.push("/app");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Unable to sign in. Please check your credentials.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <AuthShell
      title="Sign in to CampVion"
      subtitle="Enter your institutional credentials to access your campus workspace."
      badgeText="AUTHENTICATED WORKSPACE ACCESS"
      footerPrompt={
        <span>
          New to CampVion?{" "}
          <Link
            href="/signup"
            className="font-semibold text-cv-accent-ink hover:underline"
          >
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-cv-error-soft border border-cv-error-line text-cv-error text-xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold block">Sign-In Failed</span>
              <span className="text-cv-fg block mt-0.5">{error}</span>
            </div>
          </div>
        )}

        {/* Email Field */}
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-cv-fg mb-1.5"
          >
            University or Account Email
          </label>
          <div className="relative">
            <Mail className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="you@university.edu"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-cv-fg"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-cv-accent-ink hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <KeyRound className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your password"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cv-fg-3 hover:text-cv-fg p-1 rounded cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Preferred Display Name (Optional) */}
        <div>
          <label
            htmlFor="login-display-name"
            className="block text-xs font-semibold text-cv-fg mb-1.5"
          >
            What should CampVion call you?{" "}
            <span className="text-[10px] text-cv-fg-3 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <Sparkles className="h-4 w-4 text-cv-accent-ink absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-display-name"
              name="displayName"
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="e.g., Alex, Dev, Champ"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
            />
          </div>
          <p className="text-[11px] text-cv-fg-3 mt-1">
            Leave empty to use your default student profile name.
          </p>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between pt-1">
          <label className="inline-flex items-center space-x-2 text-xs text-cv-fg-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-cv-line bg-cv-inset accent-[#EFFF00] cursor-pointer"
            />
            <span>Remember me for 14 days</span>
          </label>
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {/* Seeded Institutional Evaluation Accounts */}
        <div className="pt-4 mt-4 border-t border-cv-line">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cv-fg-3 flex items-center space-x-1">
              <Sparkles className="h-3 w-3 text-cv-accent-ink" />
              <span>Quick Evaluation Credentials</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount("alice@lpu.edu", "CampVion@2026")}
              className="text-left p-2.5 rounded-xl bg-cv-inset hover:bg-cv-raised border border-cv-line hover:border-cv-accent-line/50 transition cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-cv-fg">
                Student Account (S001)
              </div>
              <div className="text-[10px] font-mono text-cv-fg-2 truncate">
                alice@lpu.edu
              </div>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount("admin@campvion.edu", "Admin@CampVion2026")}
              className="text-left p-2.5 rounded-xl bg-cv-inset hover:bg-cv-raised border border-cv-line hover:border-cv-accent-line/50 transition cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-cv-fg">
                Administrator Account
              </div>
              <div className="text-[10px] font-mono text-cv-fg-2 truncate">
                admin@campvion.edu
              </div>
            </button>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}

