"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Database,
  Lock,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function PrivacyPolicyPage() {
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
                Privacy &amp; Data Protection
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
            <ShieldCheck className="h-3.5 w-3.5 text-cv-accent-ink" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-cv-accent-ink">
              PRIVACY ARCHITECTURE
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-cv-fg">
            CampVion Privacy Policy &amp; Data Handling Statement
          </h1>
          <p className="text-sm text-cv-fg-2 leading-relaxed">
            Effective for the CampVion Intelligent Campus Operations Platform. This document outlines how account credentials, academic records, and natural-language service requests are processed, stored, and protected.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line space-y-2">
            <Lock className="h-5 w-5 text-cv-accent-ink" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cv-fg">
              Cryptographic Credentials
            </h2>
            <p className="text-xs text-cv-fg-2 leading-relaxed">
              Passwords are never stored or logged in plain text. Every password is hashed server-side using salted OpenSSL scrypt key derivation ($N=16384, r=8, p=1$).
            </p>
          </div>
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line space-y-2">
            <ShieldCheck className="h-5 w-5 text-cv-accent-ink" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cv-fg">
              HttpOnly Session Cookies
            </h2>
            <p className="text-xs text-cv-fg-2 leading-relaxed">
              Session tokens are stored as SHA-256 digests in the database and delivered via HttpOnly, SameSite=Lax cookies with CSRF verification.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line space-y-2">
            <Database className="h-5 w-5 text-cv-accent-ink" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cv-fg">
              Auditable Execution Traces
            </h2>
            <p className="text-xs text-cv-fg-2 leading-relaxed">
              Workflow executions record structured intent, policy checks, and tool invocations so students and administrators can inspect every decision step.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-cv-surface border border-cv-line space-y-6 text-xs text-cv-fg-2 leading-relaxed">
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cv-fg">
              1. Information Processed by CampVion
            </h3>
            <p>
              CampVion processes the following categories of campus operational data to execute student and administrative workflows:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-cv-fg">Account Identity:</strong> Full name, university email address, role assignment (`student`, `faculty`, `staff`, or `admin`), and salted password hash.
              </li>
              <li>
                <strong className="text-cv-fg">Academic &amp; Campus Records:</strong> Student enrollment profiles, course attendance percentages, leave balances, hostel room assignments, library records, and fee statuses stored in the relational campus database.
              </li>
              <li>
                <strong className="text-cv-fg">Service Requests &amp; Workflow Traces:</strong> Natural-language request prompts, structured intent parameters, policy evaluation results, DAG execution steps, and human-in-the-loop approval logs.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cv-fg">
              2. Cloud LLM Intent Parsing &amp; Secret Protection
            </h3>
            <p>
              When cloud-first LLM intent parsing (Groq API) is enabled, natural-language service requests are sanitized and length-bounded on the backend before structured intent extraction. Backend API keys (`GROQ_API_KEY`) are strictly isolated on the server and are never exposed to client browsers or frontend bundles.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cv-fg">
              3. Session Security &amp; Account Recovery
            </h3>
            <p>
              Active sessions can be terminated immediately via Sign Out, which revokes the server-side session record and clears browser cookies. Password reset tokens are single-use, cryptographically random, stored only as SHA-256 hashes, and expire automatically after 30 minutes.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-cv-fg">
              4. Institutional Scope &amp; Governance Transparency
            </h3>
            <p>
              CampVion enforces deterministic university policies and role-based access controls across all campus tools. No external compliance certifications are claimed beyond the verified cryptographic, session, and policy-governance controls implemented in the platform.
            </p>
          </section>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-cv-line text-xs text-cv-fg-3">
          <span>CampVion — Intelligent Campus Operations Platform</span>
          <div className="flex items-center space-x-4">
            <Link href="/terms" className="hover:text-cv-fg transition">
              Terms of Service
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

