"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Mail,
} from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { apiClient } from "../../lib/api";
import { ForgotPasswordResponse } from "../../types/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.forgotPassword(trimmed);
      setResult(res);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to process password recovery request.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Password Recovery"
      subtitle="Request a secure, time-limited password reset token for your CampVion account."
      badgeText="ACCOUNT RECOVERY"
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
            href="/reset-password"
            className="font-medium text-cv-fg-2 hover:text-cv-fg hover:underline"
          >
            Have a reset token?
          </Link>
        </div>
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-cv-success-soft border border-cv-success-line text-xs space-y-2">
            <div className="flex items-center space-x-2 text-cv-success font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Recovery Request Processed</span>
            </div>
            <p className="text-cv-fg leading-relaxed">{result.message}</p>
          </div>

          {!result.email_service_configured && result.configuration_notice && (
            <div className="p-3.5 rounded-xl bg-cv-warning-soft border border-cv-warning-line text-xs space-y-1.5">
              <div className="flex items-center space-x-2 text-cv-warning font-semibold">
                <Info className="h-4 w-4 shrink-0" />
                <span>Email Delivery Status: Development Outbox Mode</span>
              </div>
              <p className="text-cv-fg-2 leading-relaxed">
                {result.configuration_notice}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Link
              href="/reset-password"
              className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent transition"
            >
              <span>Proceed to Reset Password</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setEmail("");
              }}
              className="py-2.5 px-4 rounded-xl text-xs font-medium bg-cv-inset hover:bg-cv-raised text-cv-fg border border-cv-line transition cursor-pointer"
            >
              Submit Another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-cv-error-soft border border-cv-error-line text-cv-error text-xs"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold block">Request Error</span>
                <span className="text-cv-fg block mt-0.5">{error}</span>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="forgot-email"
              className="block text-xs font-semibold text-cv-fg mb-1.5"
            >
              Registered Email Address
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-cv-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="forgot-email"
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
            <p className="text-[11px] text-cv-fg-3 mt-1.5 leading-relaxed">
              For security, CampVion never discloses whether an email address is registered.
              Reset tokens expire after 30 minutes and can only be used once.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating recovery token...</span>
              </>
            ) : (
              <>
                <span>Request Password Reset</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

