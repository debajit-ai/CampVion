"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Monitor,
  Moon,
  Scale,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function TermsOfServicePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-cv-canvas text-cv-fg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-cv-line bg-cv-surface/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="h-9 w-9 rounded-xl campvion-emblem-surface p-1.5 flex items-center justify-center overflow-hidden">
              <Image
                src="/brand/campvion-symbol.png"
                alt="CampVion Logo"
                width={26}
                height={26}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-cv-fg block">
                CampVion
              </span>
              <span className="text-[10px] font-medium text-cv-fg-3 block">
                Terms of Service &amp; Governance
              </span>
            </div>
          </Link>

          <div className="flex items-center space-x-3">
            <div className="flex items-center p-0.5 rounded-lg bg-cv-inset border border-cv-line">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                  theme === "light"
                    ? "bg-cv-accent text-cv-on-accent"
                    : "text-cv-fg-2 hover:text-cv-fg"
                }`}
                aria-label="Light mode"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                  theme === "dark"
                    ? "bg-cv-accent text-cv-on-accent"
                    : "text-cv-fg-2 hover:text-cv-fg"
                }`}
                aria-label="Dark mode"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                  theme === "system"
                    ? "bg-cv-accent text-cv-on-accent"
                    : "text-cv-fg-2 hover:text-cv-fg"
                }`}
                aria-label="System theme"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>

            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cv-inset hover:bg-cv-raised text-cv-fg border border-cv-line transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cv-accent-soft border border-cv-accent-line">
            <Scale className="h-3.5 w-3.5 text-cv-accent-ink" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-cv-accent-ink">
              PLATFORM GOVERNANCE
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-cv-fg">
            CampVion Terms of Service &amp; Operational Governance
          </h1>
          <p className="text-sm text-cv-fg-2 leading-relaxed">
            These terms govern access to the CampVion Intelligent Campus Operations Platform, including student self-service workflows, policy verification tools, and administrative review controls.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line space-y-2">
            <FileText className="h-5 w-5 text-cv-accent-ink" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cv-fg">
              Policy-Bound Execution
            </h2>
            <p className="text-xs text-cv-fg-2 leading-relaxed">
              Every service request is evaluated against deterministic university policy rules before any database modification occurs.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line space-y-2">
            <CheckCircle2 className="h-5 w-5 text-cv-accent-ink" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cv-fg">
              Human-in-the-Loop
            </h2>
            <p className="text-xs text-cv-fg-2 leading-relaxed">
              High-impact or exception-requiring requests automatically pause for authorized human review and approval.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line space-y-2">
            <ShieldAlert className="h-5 w-5 text-cv-accent-ink" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cv-fg">
              Account Responsibility
            </h2>
            <p className="text-xs text-cv-fg-2 leading-relaxed">
              Users must maintain credential confidentiality and submit accurate academic and administrative information.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-cv-surface border border-cv-line space-y-6 text-xs text-cv-fg-2 leading-relaxed">
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cv-fg">
              1. Authorized Platform Use
            </h3>
            <p>
              CampVion provides authenticated access for students, faculty, staff, and administrators to submit, track, and govern campus service workflows—including attendance verification, leave requests, academic document issuance, hostel maintenance, library operations, and grievance escalation.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cv-fg">
              2. Deterministic Policy Enforcement &amp; Approvals
            </h3>
            <p>
              While CampVion uses natural-language understanding to interpret user requests, final eligibility decisions are governed by deterministic university policy checks and verified database records. Requests that require administrative discretion are routed to a human-in-the-loop approval state (`WAITING_FOR_APPROVAL`) before completion.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cv-fg">
              3. Security Controls &amp; Rate Limiting
            </h3>
            <p>
              Users may not attempt to bypass authentication, forge CSRF tokens, or submit automated brute-force requests. CampVion enforces sliding-window rate limits and temporary account lockouts after repeated failed authentication attempts.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cv-fg">
              4. Auditability &amp; Trace Retention
            </h3>
            <p>
              All workflow submissions generate an immutable execution trace containing step-by-step tool calls, policy references, and approval timestamps to ensure transparent institutional accountability.
            </p>
          </section>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-cv-line text-xs text-cv-fg-3">
          <span>CampVion — Intelligent Campus Operations Platform</span>
          <div className="flex items-center space-x-4">
            <Link href="/privacy" className="hover:text-cv-fg transition">
              Privacy Policy
            </Link>
            <Link href="/login" className="hover:text-cv-fg transition">
              Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

