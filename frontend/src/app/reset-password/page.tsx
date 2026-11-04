"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { apiClient } from "../../lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [verifyingToken, setVerifyingToken] = useState(
    () => initialToken.trim().length >= 16
  );
  const [tokenVerifiedMessage, setTokenVerifiedMessage] = useState<string | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initialToken || initialToken.trim().length < 16) return;
    let active = true;
    apiClient
      .verifyResetToken(initialToken.trim())
      .then((res) => {
        if (!active) return;
        if (res.valid) {
          setTokenVerifiedMessage("Recovery token verified and active.");
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof Error) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setVerifyingToken(false);
      });

    return () => {
      active = false;
    };
  }, [initialToken]);

  const passwordChecks = useMemo(() => {
    return [
      { label: "At least 8 characters", met: newPassword.length >= 8 },
      { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(newPassword) },
      { label: "One lowercase letter (a-z)", met: /[a-z]/.test(newPassword) },
      { label: "One number (0-9)", met: /\d/.test(newPassword) },
      {
        label: "Passwords match",
        met: newPassword.length > 0 && newPassword === confirmPassword,
      },
    ];
  }, [newPassword, confirmPassword]);

  const allPasswordChecksMet = passwordChecks.every((c) => c.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedToken = token.trim();
    if (trimmedToken.length < 16) {
      setError("Please enter a valid password reset token.");
      return;
    }
    if (!allPasswordChecksMet) {
      setError("Please ensure all password security requirements are met.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.resetPassword({
        token: trimmedToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMessage(res.message);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to complete password reset. Your token may have expired.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-cv-success-soft border border-cv-success-line text-xs space-y-2">
          <div className="flex items-center space-x-2 text-cv-success font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Password Updated Successfully</span>
          </div>
          <p className="text-cv-fg leading-relaxed">{successMessage}</p>
        </div>

        <Link
          href="/login"
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent transition"
        >
          <span>Sign In With New Password</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {verifyingToken && (
        <div className="flex items-center space-x-2 p-3 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg-2">
          <Loader2 className="h-4 w-4 animate-spin text-cv-accent-ink shrink-0" />
          <span>Validating recovery token...</span>
        </div>
      )}

      {tokenVerifiedMessage && !error && (
        <div className="flex items-center space-x-2 p-3 rounded-xl bg-cv-success-soft border border-cv-success-line text-xs text-cv-success font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{tokenVerifiedMessage}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-cv-error-soft border border-cv-error-line text-cv-error text-xs"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold block">Reset Failed</span>
            <span className="text-cv-fg block mt-0.5">{error}</span>
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="reset-token"
          className="block text-xs font-semibold text-cv-fg mb-1.5"
        >
          Reset Token
        </label>
        <div className="relative">
          <KeyRound className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="reset-token"
            name="token"
            type="text"
            required
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste your one-time recovery token"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs font-mono text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="reset-new-password"
          className="block text-xs font-semibold text-cv-fg mb-1.5"
        >
          New Password
        </label>
        <div className="relative">
          <Lock className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="reset-new-password"
            name="new_password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Create a strong new password"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-cv-fg-3 hover:text-cv-fg transition cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="reset-confirm-password"
          className="block text-xs font-semibold text-cv-fg mb-1.5"
        >
          Confirm New Password
        </label>
        <div className="relative">
          <Lock className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="reset-confirm-password"
            name="confirm_password"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Re-enter your new password"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:border-cv-accent-line focus:bg-cv-surface transition"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-cv-fg-3 hover:text-cv-fg transition cursor-pointer"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-cv-inset border border-cv-line space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-cv-fg-3">
          Security Requirements
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {passwordChecks.map((check) => (
            <div
              key={check.label}
              className={`flex items-center space-x-1.5 text-[11px] ${
                check.met ? "text-cv-success font-medium" : "text-cv-fg-3"
              }`}
            >
              {check.met ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-cv-success" />
              ) : (
                <Circle className="h-3 w-3 shrink-0 text-cv-fg-3" />
              )}
              <span>{check.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Updating password...</span>
          </>
        ) : (
          <>
            <span>Complete Password Reset</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Complete Password Reset"
      subtitle="Enter your one-time recovery token and set a new cryptographic password."
      badgeText="CREDENTIAL UPDATE"
      footerPrompt={
        <div className="flex items-center justify-center space-x-4">
          <Link
            href="/login"
            className="inline-flex items-center space-x-1 font-semibold text-cv-accent-ink hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Sign In</span>
          </Link>
          <span className="text-cv-fg-3">&bull;</span>
          <Link
            href="/forgot-password"
            className="font-medium text-cv-fg-2 hover:text-cv-fg hover:underline"
          >
            Request new token
          </Link>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-8 text-xs text-cv-fg-2">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span>Loading password reset form...</span>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
