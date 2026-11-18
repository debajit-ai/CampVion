"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";
import { toUserFacingError } from "../../lib/api";
import {
  DEMO_ACCOUNTS,
  getWorkspaceRedirectPath,
  IS_DEMO_MODE,
} from "../../lib/authRedirect";
import { useAuthTheme } from "../../lib/landingThemeStore";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const { isDark } = useAuthTheme();
  const {
    user,
    login,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !successMsg) {
      router.replace(getWorkspaceRedirectPath(user.role));
    }
  }, [authLoading, isAuthenticated, user, successMsg, router]);

  const performLogin = async (targetEmail: string, targetPassword: string) => {
    setError(null);
    setSuccessMsg(null);

    const trimmedEmail = targetEmail.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Please enter a valid institutional email address.");
      return;
    }
    if (!targetPassword || targetPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      const authenticatedUser = await login({
        email: trimmedEmail,
        password: targetPassword,
        remember_me: rememberMe,
      });
      setSuccessMsg(`Signed in as ${authenticatedUser.full_name}. Opening workspace...`);
      const destination = getWorkspaceRedirectPath(authenticatedUser.role);
      window.setTimeout(() => {
        router.push(destination);
      }, 320);
    } catch (err: unknown) {
      setError(toUserFacingError(err, "Invalid email or password."));
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  const signInDemoAccount = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    await performLogin(demoEmail, demoPass);
  };

  const inputClass = `w-full pl-10 py-2.5 rounded-2xl border text-xs font-medium transition focus:outline-none focus:ring-4 ${
    isDark
      ? "bg-white/[0.04] border-white/10 text-[#F5F7FF] placeholder-[#8B95B0] focus:bg-[#0B1020] focus:border-[#38BDF8] focus:ring-[#38BDF8]/15"
      : "bg-slate-50/90 border-slate-200 text-[#0F172A] placeholder-slate-400 focus:bg-white focus:border-[#0E7490] focus:ring-[#0E7490]/15"
  }`;

  const linkClass = isDark
    ? "font-semibold text-[#38BDF8] hover:text-[#7DD3FC] hover:underline"
    : "font-semibold text-[#0E7490] hover:text-[#0284C7] hover:underline";

  return (
    <AuthShell
      title="Sign in to CampVion"
      subtitle="Access policy-verified campus automation and approval queues."
      badgeText="AUTHENTICATED WORKSPACE ACCESS"
      footerPrompt={
        <span>
          New to CampVion?{" "}
          <Link href="/signup" className={linkClass}>
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Inline Accessible Error / Success Banners */}
        <div aria-live="polite" className="space-y-2">
          <AnimatePresence mode="wait">
            {successMsg && (
              <motion.div
                key="login-success"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center space-x-2.5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-xs"
              >
                <CheckCircle2 className="h-4 w-4 text-[#34D399] shrink-0" />
                <span className="font-semibold text-[#34D399]">{successMsg}</span>
              </motion.div>
            )}

            {error && !successMsg && (
              <motion.div
                key="login-error"
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                role="alert"
                className={`flex items-start space-x-2.5 p-3.5 rounded-2xl border text-xs ${
                  isDark
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold block">Authentication Failed</span>
                  <span className="block mt-0.5 leading-relaxed opacity-90">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Email Field */}
        <div>
          <label
            htmlFor="login-email"
            className={`block text-xs font-bold mb-1.5 ${
              isDark ? "text-[#F5F7FF]" : "text-slate-700"
            }`}
          >
            University or Account Email
          </label>
          <div className="relative">
            <Mail
              className={`h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                isDark ? "text-[#8B95B0]" : "text-slate-400"
              }`}
            />
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
              placeholder="alice@lpu.edu"
              className={`${inputClass} pr-3.5`}
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className={`block text-xs font-bold ${
                isDark ? "text-[#F5F7FF]" : "text-slate-700"
              }`}
            >
              Password
            </label>
            <Link href="/forgot-password" className={`text-xs ${linkClass}`}>
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <KeyRound
              className={`h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                isDark ? "text-[#8B95B0]" : "text-slate-400"
              }`}
            />
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
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg cursor-pointer transition ${
                isDark
                  ? "text-[#8B95B0] hover:text-[#38BDF8]"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between pt-0.5">
          <label
            className={`inline-flex items-center space-x-2 text-xs font-medium cursor-pointer select-none ${
              isDark ? "text-[#B6C0D8]" : "text-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#38BDF8] cursor-pointer"
            />
            <span>Remember me for 14 days</span>
          </label>
        </div>

        {/* Primary Submit Button (Landing Indigo->Cyan Gradient) */}
        <motion.button
          whileHover={{ scale: submitting ? 1 : 1.01 }}
          whileTap={{ scale: submitting ? 1 : 0.99 }}
          type="submit"
          disabled={submitting || Boolean(successMsg)}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl text-xs font-bold cv-land-btn-primary transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Verifying institutional session...</span>
            </>
          ) : successMsg ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-white" />
              <span>Workspace Ready</span>
            </>
          ) : (
            <>
              <span>Sign In to Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>

        {/* Demo Mode Evaluation Cards */}
        {IS_DEMO_MODE && (
          <div
            className={`pt-4 mt-4 border-t ${
              isDark ? "border-white/10" : "border-slate-200/80"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span
                className={`text-[10px] font-mono uppercase tracking-wider flex items-center space-x-1.5 font-bold ${
                  isDark ? "text-[#B6C0D8]" : "text-slate-600"
                }`}
              >
                <Sparkles className="h-3 w-3 text-[#38BDF8]" />
                <span>Quick Evaluation Credentials</span>
              </span>
              <span
                className={`text-[10px] font-mono ${
                  isDark ? "text-[#8B95B0]" : "text-slate-400"
                }`}
              >
                Demo Mode
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Student Card */}
              <div
                className={`rounded-2xl border p-2.5 flex flex-col gap-2 transition-colors ${
                  isDark
                    ? "bg-white/[0.04] border-white/10 hover:border-[#38BDF8]/40"
                    : "bg-slate-50 border-slate-200 hover:border-sky-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    fillDemoAccount(DEMO_ACCOUNTS.student.email, DEMO_ACCOUNTS.student.password)
                  }
                  className="text-left cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold transition-colors ${
                        isDark
                          ? "text-[#F5F7FF] group-hover:text-[#38BDF8]"
                          : "text-slate-900 group-hover:text-[#0E7490]"
                      }`}
                    >
                      {DEMO_ACCOUNTS.student.label}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 font-mono font-semibold">
                      {DEMO_ACCOUNTS.student.badge}
                    </span>
                  </div>
                  <div
                    className={`text-[10px] font-mono truncate mt-0.5 ${
                      isDark ? "text-[#B6C0D8]" : "text-slate-500"
                    }`}
                  >
                    {DEMO_ACCOUNTS.student.email}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={submitting || Boolean(successMsg)}
                  onClick={() =>
                    signInDemoAccount(DEMO_ACCOUNTS.student.email, DEMO_ACCOUNTS.student.password)
                  }
                  className="w-full py-1.5 px-2 rounded-xl text-[10px] font-bold bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#38BDF8] border border-[#38BDF8]/35 transition cursor-pointer disabled:opacity-50"
                >
                  Sign in as Student
                </button>
              </div>

              {/* Admin Card */}
              <div
                className={`rounded-2xl border p-2.5 flex flex-col gap-2 transition-colors ${
                  isDark
                    ? "bg-white/[0.04] border-white/10 hover:border-[#8B5CF6]/45"
                    : "bg-slate-50 border-slate-200 hover:border-violet-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    fillDemoAccount(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password)
                  }
                  className="text-left cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold transition-colors ${
                        isDark
                          ? "text-[#F5F7FF] group-hover:text-[#A78BFA]"
                          : "text-slate-900 group-hover:text-violet-700"
                      }`}
                    >
                      {DEMO_ACCOUNTS.admin.label}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/35 font-mono font-semibold">
                      {DEMO_ACCOUNTS.admin.badge}
                    </span>
                  </div>
                  <div
                    className={`text-[10px] font-mono truncate mt-0.5 ${
                      isDark ? "text-[#B6C0D8]" : "text-slate-500"
                    }`}
                  >
                    {DEMO_ACCOUNTS.admin.email}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={submitting || Boolean(successMsg)}
                  onClick={() =>
                    signInDemoAccount(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password)
                  }
                  className="w-full py-1.5 px-2 rounded-xl text-[10px] font-bold bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 text-[#A78BFA] border border-[#8B5CF6]/35 transition cursor-pointer disabled:opacity-50"
                >
                  Sign in as Admin
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </AuthShell>
  );
}
