"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface AuthShellProps {
  title: string;
  subtitle: string;
  badgeText?: string;
  children: React.ReactNode;
  footerPrompt?: React.ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  badgeText = "SECURE CAMPUS ACCESS",
  children,
  footerPrompt,
}: AuthShellProps) {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen w-full bg-cv-canvas text-cv-fg flex flex-col justify-between selection:bg-cv-accent selection:text-cv-on-accent">
      {/* Top Bar */}
      <header className="w-full border-b border-cv-line bg-cv-surface/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2.5 group focus:outline-none"
            >
              <div className="h-9 w-9 rounded-xl campvion-emblem-surface p-1.5 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <Image
                  src="/brand/campvion-symbol.png"
                  alt="CampVion Emblem"
                  width={26}
                  height={26}
                  priority
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-cv-fg leading-none">
                  Camp<span className="text-cv-accent-ink">Vion</span>
                </span>
                <span className="text-[10px] font-mono text-cv-fg-3 tracking-wider uppercase mt-0.5">
                  Campus Operations AI
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-2.5">
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent hover:border-cv-line transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Overview</span>
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
              title={
                resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
              className="p-2 rounded-lg bg-cv-surface hover:bg-cv-raised text-cv-fg-2 hover:text-cv-accent-ink border border-cv-line transition cursor-pointer"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-cv-accent-ink" />
              ) : (
                <Moon className="h-4 w-4 text-cv-fg" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Architectural Briefing Column */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-7 rounded-2xl bg-cv-surface border border-cv-line space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-cv-accent-soft border border-cv-accent-soft-line text-[10px] font-mono uppercase tracking-wider text-cv-accent-ink font-semibold">
                <Lock className="h-3 w-3" />
                <span>{badgeText}</span>
              </div>

              <div className="flex items-center space-x-3.5">
                <div className="h-12 w-12 rounded-2xl campvion-emblem-surface p-2 flex items-center justify-center shrink-0">
                  <Image
                    src="/brand/campvion-symbol.png"
                    alt="CampVion Emblem"
                    width={34}
                    height={34}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-cv-fg">
                    Intelligent Campus Operations
                  </h2>
                  <p className="text-xs text-cv-fg-2">
                    Policy-verified multi-step service automation
                  </p>
                </div>
              </div>

              <p className="text-xs text-cv-fg-2 leading-relaxed">
                CampVion connects student service requests, academic eligibility checks,
                policy verification and human approval gates into one transparent workflow engine.
              </p>

              <div className="space-y-3 pt-2 border-t border-cv-line">
                <div className="flex items-start space-x-2.5">
                  <CheckCircle2 className="h-4 w-4 text-cv-accent-ink shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-cv-fg">
                      Natural Language Request Understanding
                    </div>
                    <p className="text-[11px] text-cv-fg-2">
                      Describe leave, attendance, transcript or hostel requests in plain words.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <CheckCircle2 className="h-4 w-4 text-cv-accent-ink shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-cv-fg">
                      Deterministic Policy &amp; Eligibility Verification
                    </div>
                    <p className="text-[11px] text-cv-fg-2">
                      Every step is checked against structured university rules and database records.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <CheckCircle2 className="h-4 w-4 text-cv-accent-ink shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-cv-fg">
                      Human-in-the-Loop Governance
                    </div>
                    <p className="text-[11px] text-cv-fg-2">
                      Consequential campus actions pause for explicit administrative authorization.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-cv-line flex items-center justify-between text-[11px] text-cv-fg-3">
              <span className="inline-flex items-center space-x-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-cv-accent-ink" />
                <span>Scrypt + HttpOnly Session Security</span>
              </span>
              <span className="font-mono">v0.2.0</span>
            </div>
          </div>

          {/* Right Form Surface */}
          <div className="lg:col-span-7">
            <div className="w-full max-w-md mx-auto rounded-2xl bg-cv-surface border border-cv-line p-6 sm:p-8 shadow-sm">
              <div className="flex items-center space-x-3 mb-6">
                <div className="h-11 w-11 rounded-xl campvion-emblem-surface p-1.5 flex items-center justify-center shrink-0">
                  <Image
                    src="/brand/campvion-symbol.png"
                    alt="CampVion Emblem"
                    width={30}
                    height={30}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-cv-fg">
                    {title}
                  </h1>
                  <p className="text-xs text-cv-fg-2 mt-0.5">{subtitle}</p>
                </div>
              </div>

              {children}

              {footerPrompt && (
                <div className="mt-6 pt-5 border-t border-cv-line text-center text-xs text-cv-fg-2">
                  {footerPrompt}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Bar */}
      <footer className="w-full border-t border-cv-line bg-cv-surface/60 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-cv-fg-3">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-cv-fg">CampVion</span>
            <span>&bull;</span>
            <span>Intelligent Campus Operations Platform</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/privacy" className="hover:text-cv-fg transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-cv-fg transition">
              Terms of Service
            </Link>
            <Link href="/" className="hover:text-cv-fg transition">
              Platform Overview
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

