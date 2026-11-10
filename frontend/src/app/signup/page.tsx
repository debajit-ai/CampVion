"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  User,
} from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";

export default function SignupPage() {
  const router = useRouter();
  const { signup, isAuthenticated, isLoading: authLoading, setPreferredDisplayName } = useAuth();

  const [fullName, setFullName] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/app");
    }
  }, [authLoading, isAuthenticated, router]);

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

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
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
      await signup({
        full_name: trimmedName,
        email: trimmedEmail,
        password,
        confirm_password: confirmPassword,
        accept_terms: acceptTerms,
      });
      router.push("/app");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to create account. Please verify your details.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your CampVion account"
      subtitle="Register with your institutional email to start managing campus service requests."
      badgeText="STUDENT & CAMPUS REGISTRATION"
      footerPrompt={
        <span>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-cv-accent-ink hover:underline"
          >
            Sign in instead
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
              <span className="font-semibold block">Registration Error</span>
              <span className="text-cv-fg block mt-0.5">{error}</span>
            </div>
          </div>
        )}

        {/* Full Name */}
        <div>
          <label
            htmlFor="signup-name"
            className="block text-xs font-semibold text-cv-fg mb-1.5"
          >
            Full Name
          </label>
          <div className="relative">
            <User className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
            />
          </div>
        </div>

        {/* Preferred Display Name (Optional) */}
        <div>
          <label
            htmlFor="signup-display-name"
            className="block text-xs font-semibold text-cv-fg mb-1.5"
          >
            What should CampVion call you?{" "}
            <span className="text-[10px] text-cv-fg-3 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <User className="h-4 w-4 text-cv-accent-ink absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="signup-display-name"
              name="displayName"
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="e.g., Alex, Dev, Champ"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
            />
          </div>
          <p className="text-[11px] text-cv-fg-3 mt-1">
            Leave empty to use your full name by default.
          </p>
        </div>

        {/* University Email */}
        <div>
          <label
            htmlFor="signup-email"
            className="block text-xs font-semibold text-cv-fg mb-1.5"
          >
            University Email
          </label>
          <div className="relative">
            <Mail className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
              placeholder="alice.sharma@university.edu"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="signup-password"
            className="block text-xs font-semibold text-cv-fg mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <KeyRound className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="signup-confirm-password"
            className="block text-xs font-semibold text-cv-fg mb-1.5"
          >
            Confirm Password
          </label>
          <div className="relative">
            <KeyRound className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={
                showConfirmPassword ? "Hide confirm password" : "Show confirm password"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cv-fg-3 hover:text-cv-fg p-1 rounded cursor-pointer"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Password Strength Checklist */}
        <div className="p-3 rounded-xl bg-cv-inset border border-cv-line grid grid-cols-2 gap-1.5 text-[11px]">
          {[
            { ok: rules.minLength, label: "8+ characters" },
            { ok: rules.hasUpper, label: "Uppercase letter" },
            { ok: rules.hasLower, label: "Lowercase letter" },
            { ok: rules.hasDigit, label: "At least 1 number" },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center space-x-1.5 ${
                item.ok ? "text-cv-success font-medium" : "text-cv-fg-3"
              }`}
            >
              <Check className="h-3 w-3 shrink-0" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Terms Acceptance */}
        <div className="pt-1">
          <label className="flex items-start space-x-2.5 text-xs text-cv-fg-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (error) setError(null);
              }}
              className="h-4 w-4 mt-0.5 rounded border-cv-line bg-cv-inset accent-[#EFFF00] cursor-pointer shrink-0"
            />
            <span className="leading-relaxed">
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-semibold text-cv-accent-ink hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-semibold text-cv-accent-ink hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

