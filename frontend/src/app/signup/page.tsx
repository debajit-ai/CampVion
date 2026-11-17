"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Sparkles,
  User,
} from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";
import { getWorkspaceRedirectPath } from "../../lib/authRedirect";
import { useAuthTheme } from "../../lib/landingThemeStore";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const router = useRouter();
  const { isDark } = useAuthTheme();
  const {
    user,
    signup,
    isAuthenticated,
    isLoading: authLoading,
    setPreferredDisplayName,
  } = useAuth();

  const [fullName, setFullName] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !successMsg) {
      router.replace(getWorkspaceRedirectPath(user.role));
    }
  }, [authLoading, isAuthenticated, user, successMsg, router]);

  const rules = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasDigit: /\d/.test(password),
    matches: password.length > 0 && password === confirmPassword,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Please enter a valid university or institutional email address.");
      return;
    }
    if (!rules.minLength || !rules.hasUpper || !rules.hasLower || !rules.hasDigit) {
      setError(
        "Password must be at least 8 characters and include uppercase, lowercase, and a number."
      );
      return;
    }
    if (!rules.matches) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);
    try {
      if (displayNameInput.trim()) {
        setPreferredDisplayName(displayNameInput.trim());
      }
      const newUser = await signup({
        full_name: trimmedName,
        email: trimmedEmail.toLowerCase(),
        password,
        confirm_password: confirmPassword,
        accept_terms: acceptTerms,
      });
      setSuccessMsg(`Welcome, ${newUser.full_name}. Preparing your campus workspace...`);
      const destination = getWorkspaceRedirectPath(newUser.role);
      window.setTimeout(() => {
        router.push(destination);
      }, 320);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to create account. Please verify your details.";
      setError(msg);
      setSubmitting(false);
    }
  };

  const inputClass = `w-full pl-10 py-2.5 rounded-2xl border text-xs font-medium transition focus:outline-none focus:ring-4 ${
    isDark
      ? "bg-white/[0.04] border-white/10 text-[#F5F7FF] placeholder-[#8B95B0] focus:bg-[#0B1020] focus:border-[#38BDF8] focus:ring-[#38BDF8]/15"
      : "bg-slate-50/90 border-slate-200 text-[#0F172A] placeholder-slate-400 focus:bg-white focus:border-[#0E7490] focus:ring-[#0E7490]/15"
  }`;

  const linkClass = isDark
    ? "font-semibold text-[#38BDF8] hover:text-[#7DD3FC] hover:underline"
    : "font-semibold text-[#0E7490] hover:text-[#0284C7] hover:underline";

  const labelClass = `block text-xs font-bold mb-1.5 ${
    isDark ? "text-[#F5F7FF]" : "text-slate-700"
  }`;

  const iconClass = `h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
    isDark ? "text-[#8B95B0]" : "text-slate-400"
  }`;

  return (
    <AuthShell
      title="Create your CampVion account"
      subtitle="Register with your institutional email to manage campus workflows."
      badgeText="STUDENT & CAMPUS REGISTRATION"
      footerPrompt={
        <span>
          Already have an account?{" "}
          <Link href="/login" className={linkClass}>
            Sign in instead
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        <div aria-live="polite" className="space-y-2">
          <AnimatePresence mode="wait">
            {successMsg && (
              <motion.div
                key="signup-success"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center space-x-2.5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/35 text-xs"
              >
                <CheckCircle2 className="h-4 w-4 text-[#34D399] shrink-0" />
                <span className="font-semibold text-[#34D399]">{successMsg}</span>
              </motion.div>
            )}

            {error && !successMsg && (
              <motion.div
                key="signup-error"
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
                  <span className="font-bold block">Registration Error</span>
                  <span className="block mt-0.5 leading-relaxed opacity-90">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Full Name */}
        <div>
          <label htmlFor="signup-name" className={labelClass}>
            Full Name
          </label>
          <div className="relative">
            <User className={iconClass} />
            <input
              id="signup-name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Alice Sharma"
              className={`${inputClass} pr-3.5`}
            />
          </div>
        </div>

        {/* Preferred Display Name (kept strictly on sign-up) */}
        <div>
          <label htmlFor="signup-display-name" className={labelClass}>
            What should CampVion call you?{" "}
            <span
              className={`text-[10px] font-normal ${
                isDark ? "text-[#8B95B0]" : "text-slate-400"
              }`}
            >
              (Optional)
            </span>
          </label>
          <div className="relative">
            <Sparkles className="h-4 w-4 text-[#38BDF8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="signup-display-name"
              name="displayName"
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="e.g., Alex, Dev, Champ"
              className={`${inputClass} pr-3.5`}
            />
          </div>
        </div>

        {/* University Email */}
        <div>
          <label htmlFor="signup-email" className={labelClass}>
            University Email
          </label>
          <div className="relative">
            <Mail className={iconClass} />
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="student@university.edu"
              className={`${inputClass} pr-3.5`}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signup-password" className={labelClass}>
            Password
          </label>
          <div className="relative">
            <KeyRound className={iconClass} />
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Create a strong password"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg cursor-pointer transition ${
                isDark ? "text-[#8B95B0] hover:text-[#38BDF8]" : "text-slate-400 hover:text-slate-700"
              }`}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="signup-confirm-password" className={labelClass}>
            Confirm Password
          </label>
          <div className="relative">
            <KeyRound className={iconClass} />
            <input
              id="signup-confirm-password"
              name="confirm_password"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Re-enter your password"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg cursor-pointer transition ${
                isDark ? "text-[#8B95B0] hover:text-[#38BDF8]" : "text-slate-400 hover:text-slate-700"
              }`}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Password Strength Checklist */}
        <div
          className={`p-3 rounded-2xl border grid grid-cols-2 gap-2 text-[11px] ${
            isDark
              ? "bg-white/[0.03] border-white/10"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          {[
            { ok: rules.minLength, label: "8+ characters" },
            { ok: rules.hasUpper, label: "Uppercase letter" },
            { ok: rules.hasLower, label: "Lowercase letter" },
            { ok: rules.hasDigit, label: "At least 1 number" },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center space-x-1.5 transition-colors ${
                item.ok
                  ? isDark
                    ? "text-[#34D399] font-bold"
                    : "text-[#047857] font-bold"
                  : isDark
                  ? "text-[#8B95B0]"
                  : "text-slate-400"
              }`}
            >
              <div
                className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${
                  item.ok
                    ? isDark
                      ? "bg-[#34D399]/20 text-[#34D399]"
                      : "bg-emerald-100 text-emerald-700"
                    : isDark
                    ? "bg-white/10 text-[#8B95B0]"
                    : "bg-slate-200/80 text-slate-400"
                }`}
              >
                <Check className="h-2.5 w-2.5" />
              </div>
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Terms Acceptance */}
        <div className="pt-0.5">
          <label
            className={`flex items-start space-x-2.5 text-xs cursor-pointer select-none ${
              isDark ? "text-[#B6C0D8]" : "text-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (error) setError(null);
              }}
              className="h-4 w-4 mt-0.5 rounded border-white/20 bg-white/5 accent-[#38BDF8] cursor-pointer shrink-0"
            />
            <span className="leading-relaxed">
              I agree to the{" "}
              <Link href="/terms" className={linkClass}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className={linkClass}>
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        {/* Submit Button (Landing Indigo->Cyan Gradient) */}
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
              <span>Creating your account...</span>
            </>
          ) : successMsg ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-white" />
              <span>Account Verified</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>
      </form>
    </AuthShell>
  );
}
