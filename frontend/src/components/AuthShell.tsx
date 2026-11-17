"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Cpu, Lock, Moon, ShieldCheck, Sparkles, Sun, Workflow } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useAuthTheme } from "../lib/landingThemeStore";

const AuthShowcase3D = dynamic(
  () => import("./auth/AuthShowcase3D").then((m) => m.AuthShowcase3D),
  { ssr: false }
);

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
  badgeText = "AUTHENTICATED WORKSPACE ACCESS",
  children,
  footerPrompt,
}: AuthShellProps) {
  const { isDark, mounted, toggleTheme } = useAuthTheme();
  const prefersReducedMotion = Boolean(useReducedMotion());

  const features = [
    {
      step: "01",
      title: "Natural Language Request Understanding",
      desc: "Intent parsing for leaves, attendance waivers, hostels & academic approvals.",
      icon: Sparkles,
      accent: "cyan" as const,
    },
    {
      step: "02",
      title: "Deterministic Policy Verification",
      desc: "Zero-hallucination validation against 75% attendance rules & bylaws.",
      icon: Cpu,
      accent: "emerald" as const,
    },
    {
      step: "03",
      title: "Human-in-the-Loop Governance",
      desc: "High-impact requests pause cleanly at Dean / Warden sign-off gates.",
      icon: Workflow,
      accent: "amber" as const,
    },
  ];

  return (
    <div
      data-theme={isDark ? "dark" : "light"}
      data-land-theme={isDark ? "dark" : "light"}
      className={`cv-landing min-h-screen w-full flex flex-col justify-between relative overflow-hidden transition-colors duration-300 ${
        isDark
          ? "dark bg-[#05070F] text-[#F5F7FF] selection:bg-[#22D3EE] selection:text-[#05070F]"
          : "bg-[#F6F7FB] text-[#0F172A] selection:bg-[#4338CA] selection:text-white"
      }`}
    >
      {/* Subtle Architectural Radial Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/4 w-[620px] h-[620px] rounded-full blur-3xl opacity-35"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 72%)"
            : "radial-gradient(circle, rgba(99, 102, 241, 0.14) 0%, rgba(56, 189, 248, 0.06) 45%, transparent 72%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 right-1/6 w-[540px] h-[540px] rounded-full blur-3xl opacity-30"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 72%)"
            : "radial-gradient(circle, rgba(14, 116, 144, 0.10) 0%, transparent 72%)",
        }}
      />

      {/* Minimal Glass Navbar */}
      <header
        className={`w-full border-b backdrop-blur-xl sticky top-0 z-30 transition-colors ${
          isDark
            ? "border-white/10 bg-[#05070F]/80"
            : "border-slate-200/80 bg-[#F6F7FB]/85"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group shrink-0">
            <BrandLogo
              variant="mark"
              isDark={isDark}
              size={28}
              alt="CampVion Official Emblem"
              priority
              className="h-7 w-auto transition-transform group-hover:scale-105"
            />
            <span
              className={`text-base font-extrabold tracking-tight ${
                isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
              }`}
            >
              Camp
              <span className={isDark ? "text-[#22D3EE]" : "text-[#0E7490]"}>Vion</span>
            </span>
          </Link>

          <div className="flex items-center space-x-2.5">
            <Link
              href="/"
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                isDark
                  ? "bg-white/[0.04] border-white/10 text-[#B6C0D8] hover:text-[#F5F7FF] hover:border-[#38BDF8]/40"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Overview</span>
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                mounted
                  ? isDark
                    ? "Switch to Light Mode"
                    : "Switch to Dark Mode"
                  : "Toggle Theme"
              }
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] border-white/10 text-[#38BDF8] hover:border-[#38BDF8]/50"
                  : "bg-white border-slate-200 text-[#0E7490] hover:border-sky-400 shadow-2xs"
              }`}
            >
              {mounted && isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Split-Screen Content: Left Interactive 3D Showcase (Desktop), Right Glass Form Card */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 lg:py-10 relative z-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* LEFT PANEL (Desktop Only — Hidden on Mobile so Form Appears First) */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="hidden lg:flex lg:col-span-6 flex-col justify-between h-full min-h-[580px] relative"
          >
            {/* Top Status Badge */}
            <div className="space-y-3 relative z-10">
              <div
                className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isDark
                    ? "bg-white/[0.04] border-white/10 text-[#38BDF8]"
                    : "bg-white border-slate-200 text-[#0E7490] shadow-2xs"
                }`}
              >
                <Lock className="h-3 w-3" />
                <span>{badgeText}</span>
              </div>

              <h2
                className={`text-2xl font-extrabold tracking-tight ${
                  isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                }`}
              >
                Autonomous University Governance
              </h2>
              <p
                className={`text-xs leading-relaxed max-w-md ${
                  isDark ? "text-[#B6C0D8]" : "text-slate-600"
                }`}
              >
                Deterministic DAG workflows backed by policy verification and human
                approval checkpoints.
              </p>
            </div>

            {/* Center Lightweight 3D Logo Stage */}
            <div className="relative flex-1 min-h-[270px] w-full my-2">
              <AuthShowcase3D isDark={isDark} />
            </div>

            {/* Overlaid / Anchored 3 Glass Feature Chips */}
            <div className="space-y-2.5 relative z-10">
              {features.map((feat) => {
                const Icon = feat.icon;
                const iconStyle =
                  feat.accent === "amber"
                    ? "text-[#FBBF24] bg-[#FBBF24]/10 border-[#FBBF24]/30"
                    : feat.accent === "emerald"
                    ? isDark
                      ? "text-[#34D399] bg-[#34D399]/10 border-[#34D399]/25"
                      : "text-[#047857] bg-emerald-50 border-emerald-200"
                    : isDark
                    ? "text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/25"
                    : "text-[#0E7490] bg-sky-50 border-sky-200";

                return (
                  <div
                    key={feat.step}
                    className={`flex items-start space-x-3 p-3 rounded-2xl border backdrop-blur-xl transition-colors ${
                      isDark
                        ? "bg-white/[0.04] border-white/10"
                        : "bg-white/90 border-slate-200/80 shadow-2xs"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconStyle}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            feat.accent === "amber"
                              ? "text-[#FBBF24]"
                              : feat.accent === "emerald"
                              ? isDark
                                ? "text-[#34D399]"
                                : "text-[#047857]"
                              : isDark
                              ? "text-[#38BDF8]"
                              : "text-[#0E7490]"
                          }`}
                        >
                          {feat.step}
                        </span>
                        <span
                          className={`text-xs font-bold truncate ${
                            isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                          }`}
                        >
                          {feat.title}
                        </span>
                        {feat.accent === "amber" && (
                          <span
                            title="Human Approval Checkpoint"
                            className="h-2 w-2 rounded-full bg-[#FBBF24] shrink-0"
                          />
                        )}
                      </div>
                      <p
                        className={`text-[11px] leading-snug mt-0.5 ${
                          isDark ? "text-[#B6C0D8]" : "text-slate-600"
                        }`}
                      >
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div
                className={`pt-2 flex items-center justify-between text-[11px] ${
                  isDark ? "text-[#8B95B0]" : "text-slate-500"
                }`}
              >
                <span className="inline-flex items-center space-x-1.5 font-medium">
                  <ShieldCheck
                    className={`h-4 w-4 ${isDark ? "text-[#34D399]" : "text-[#047857]"}`}
                  />
                  <span>Scrypt + HttpOnly SameSite=Lax Session</span>
                </span>
                <span className="font-mono text-[10px] opacity-80">CSE276 v0.2.0</span>
              </div>
            </div>
          </motion.div>

          {/* RIGHT PANEL — Glass Form Card Centered */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="lg:col-span-6 flex flex-col justify-center"
          >
            <div
              className={`w-full max-w-md mx-auto rounded-3xl border p-6 sm:p-8 backdrop-blur-2xl relative overflow-hidden transition-colors ${
                isDark
                  ? "bg-white/[0.04] border-white/10 shadow-[0_24px_64px_-18px_rgba(34,211,238,0.14)]"
                  : "bg-white/95 border-slate-200/90 shadow-xl"
              }`}
            >
              {/* Subtle Indigo->Cyan Hairline Glow on Top Edge */}
              <div
                aria-hidden="true"
                className="absolute top-0 left-10 right-10 h-[2px] opacity-80"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, #6366F1 35%, #38BDF8 65%, transparent 100%)",
                }}
              />

              {/* Logo (Clean Mark Without White Box) + Title */}
              <div className="flex items-start space-x-3.5 mb-6">
                <BrandLogo
                  variant="mark"
                  isDark={isDark}
                  size={34}
                  alt="CampVion Shield"
                  priority
                  className="h-9 w-auto shrink-0 mt-0.5"
                />
                <div>
                  <h1
                    className={`text-xl font-extrabold tracking-tight ${
                      isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                    }`}
                  >
                    {title}
                  </h1>
                  <p
                    className={`text-xs mt-0.5 font-medium ${
                      isDark ? "text-[#B6C0D8]" : "text-slate-600"
                    }`}
                  >
                    {subtitle}
                  </p>
                </div>
              </div>

              {children}

              {footerPrompt && (
                <div
                  className={`mt-6 pt-5 border-t text-center text-xs ${
                    isDark
                      ? "border-white/10 text-[#B6C0D8]"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {footerPrompt}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`w-full border-t py-4 px-4 sm:px-6 lg:px-8 relative z-10 transition-colors ${
          isDark
            ? "border-white/10 bg-[#05070F]/80 text-[#8B95B0]"
            : "border-slate-200/80 bg-[#F6F7FB]/80 text-slate-500"
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 font-medium">
            <span className={`font-bold ${isDark ? "text-[#F5F7FF]" : "text-slate-900"}`}>
              CampVion
            </span>
            <span>&bull;</span>
            <span>Autonomous Campus Operations Platform</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/privacy"
              className={`transition ${isDark ? "hover:text-[#38BDF8]" : "hover:text-[#0E7490]"}`}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className={`transition ${isDark ? "hover:text-[#38BDF8]" : "hover:text-[#0E7490]"}`}
            >
              Terms of Service
            </Link>
            <Link
              href="/"
              className={`transition ${isDark ? "hover:text-[#38BDF8]" : "hover:text-[#0E7490]"}`}
            >
              Platform Overview
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
