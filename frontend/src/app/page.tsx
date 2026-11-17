"use client";

import React, { useEffect, useState, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  FileCheck2,
  GitBranch,
  Lock,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  Workflow,
  X,
} from "lucide-react";
import { ThemeMode, useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import type { LandingColorMode } from "../components/landing-3d/theme";
import type { BuildingId, PromptPreset } from "../components/landing-3d/campusData";
import { PromptCommandBar } from "../components/landing-3d/PromptSandboxHUD";

const CampusExperience = dynamic(
  () => import("../components/landing-3d/CampusExperience"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[380px] bg-[#05070F] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-10 w-10 rounded-2xl border border-white/10 bg-[#0B1020] flex items-center justify-center mb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] animate-ping" />
        </div>
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#38BDF8]">
          Initializing 3D Living Campus...
        </span>
      </div>
    ),
  }
);

const ScrollytellingPipeline = dynamic(
  () => import("../components/landing-3d/ScrollytellingPipeline"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[380px] rounded-3xl bg-[#0B1020]/85 border border-white/10 flex items-center justify-center text-xs font-mono font-bold text-[#22D3EE]">
        Loading 3D Pipeline...
      </div>
    ),
  }
);

const IntentPointCloudCanvas = dynamic(
  () =>
    import("../components/landing-3d/BentoMiniCanvases").then(
      (m) => m.IntentPointCloudCanvas
    ),
  { ssr: false }
);

const GovernanceGlassShieldCanvas = dynamic(
  () =>
    import("../components/landing-3d/BentoMiniCanvases").then(
      (m) => m.GovernanceGlassShieldCanvas
    ),
  { ssr: false }
);

const BENTO_FEATURES = [
  {
    id: "intent-parsing",
    title: "Intent Parsing",
    badge: "Groq Llama 3.3 70B",
    description:
      "Students type everyday requests; our NLP engine converts raw sentences into structured parameters without tedious form menus.",
    tag: "3D Semantic Point Cloud",
    metric: "<450ms Latency",
    chip: "Natural Language",
    spanClass: "lg:col-span-4",
    icon: MessageSquare,
  },
  {
    id: "dag-planning",
    title: "DAG Planning",
    badge: "Kahn's Algorithm",
    description:
      "Multi-step campus goals compile into deterministic Directed Acyclic Graphs so tool ordering never hallucinates.",
    tag: "Topological Sort",
    metric: "100% Deterministic",
    chip: "Zero Loops",
    spanClass: "lg:col-span-2",
    icon: GitBranch,
  },
  {
    id: "policy-verification",
    title: "Policy Verification",
    badge: "Bylaw Engine",
    description:
      "Every action verifies attendance thresholds (75% rule) and semester leave quotas directly against SQLite / Postgres records.",
    tag: "Live SQLAlchemy Tools",
    metric: "Zero Hallucination",
    chip: "75% Attendance Rule",
    spanClass: "lg:col-span-2",
    icon: Scale,
  },
  {
    id: "human-governance",
    title: "Human Governance",
    badge: "Strict HITL Gate",
    description:
      "Consequential actions halt automatically at institutional approval checkpoints for Dean, Registrar, or Warden sign-off.",
    tag: "3D Glass Authority Shield",
    metric: "1-Click Approval",
    chip: "WAITING_FOR_HUMAN",
    spanClass: "lg:col-span-4",
    icon: UserCheck,
  },
  {
    id: "audit-trail",
    title: "Audit Trail",
    badge: "Telemetry Replay",
    description:
      "Every decomposed intent, intermediate tool result, policy check, and authority vote is recorded permanently for inspection.",
    tag: "Decision Trace Log",
    metric: "100% Traceable",
    chip: "Immutable Log",
    spanClass: "lg:col-span-3",
    icon: FileCheck2,
  },
  {
    id: "data-privacy",
    title: "Data Privacy",
    badge: "Zero XSS Tokens",
    description:
      "Student identities and institutional authorizations stay isolated via Scrypt password hashing and HttpOnly SameSite cookies.",
    tag: "Scrypt + HttpOnly",
    metric: "RBAC Protected",
    chip: "Role Isolated",
    spanClass: "lg:col-span-3",
    icon: Lock,
  },
];

const TECHNICAL_PILLARS = [
  {
    title: "Groq Cloud LLM Intent Decomposition",
    detail:
      "Sub-second natural language parsing using Llama-3.3-70B with robust rule-based fallback.",
    icon: Cpu,
  },
  {
    title: "Deterministic Topological Sorting",
    detail:
      "Reproducible task sequencing eliminating hallucinated or infinite execution loops.",
    icon: Workflow,
  },
  {
    title: "Stateful Pause & Resume Checkpoints",
    detail:
      "Safe workflow serialization at WAITING_FOR_HUMAN gates with cryptographic state resumption.",
    icon: GitBranch,
  },
  {
    title: "Direct Relational Tool Layer",
    detail:
      "FastAPI and SQLAlchemy tools bound directly to normalized student and campus database tables.",
    icon: Database,
  },
  {
    title: "Strict Zero-Hallucination Guardrails",
    detail:
      "Every eligibility decision explicitly cites institutional policy bylaws and live database values.",
    icon: Scale,
  },
  {
    title: "Role-Based Authority Isolation",
    detail:
      "Granular student, warden, and administrator separation with HttpOnly SameSite cookie security.",
    icon: Lock,
  },
  {
    title: "Bounded Self-Healing Re-Planner",
    detail:
      "Automatic fallback to alternative tool branches when transient upstream data checks fail.",
    icon: RefreshCw,
  },
  {
    title: "Dual Observability Views",
    detail:
      "User-friendly milestone progress bar paired with full DAG execution decision telemetry.",
    icon: Activity,
  },
];

const LANDING_THEME_KEY = "campvion_landing_theme";
const LANDING_THEME_EVENT = "campvion_landing_theme_change";
const emptySubscribe = () => () => {};

function subscribeLandingTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(LANDING_THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LANDING_THEME_EVENT, callback);
  };
}

function getLandingThemeSnapshot(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = window.localStorage.getItem(LANDING_THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Ignore storage restriction
  }
  return "dark";
}

function getLandingThemeServerSnapshot(): ThemeMode {
  return "dark";
}

function subscribeWindowScroll(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("scroll", callback, { passive: true });
  return () => {
    window.removeEventListener("scroll", callback);
  };
}

function getWindowScrolledSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.scrollY > 24;
}

function SpotlightBentoCard({
  spanClass,
  isDark,
  prefersReducedMotion,
  delay,
  children,
}: {
  spanClass: string;
  isDark: boolean;
  prefersReducedMotion: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.45 }}
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      className={`p-[1px] rounded-3xl group relative overflow-hidden transition-all duration-300 ${spanClass} ${
        isDark
          ? "bg-gradient-to-br from-white/15 via-white/5 to-[#22D3EE]/30 shadow-[0_24px_64px_-18px_rgba(34,211,238,0.14)]"
          : "bg-gradient-to-br from-indigo-200/80 via-slate-200/70 to-cyan-200/80 shadow-[0_20px_50px_rgba(79,70,229,0.08)]"
      }`}
    >
      <div
        className={`h-full rounded-[23px] p-6 backdrop-blur-xl flex flex-col justify-between space-y-5 relative overflow-hidden transition-colors ${
          isDark
            ? "bg-[#0B1020]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
            : "bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
        }`}
      >
        {/* Mouse-Follow Radial Spotlight */}
        {!prefersReducedMotion && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: isDark
                ? "radial-gradient(360px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(34, 211, 238, 0.12), transparent 65%)"
                : "radial-gradient(360px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(99, 102, 241, 0.08), transparent 65%)",
            }}
          />
        )}
        {/* Top Gradient Highlight Bar on Hover */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#22D3EE] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {children}
      </div>
    </motion.div>
  );
}

export default function CampVionLandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const landThemeMode = useSyncExternalStore(
    subscribeLandingTheme,
    getLandingThemeSnapshot,
    getLandingThemeServerSnapshot
  );
  const isScrolled = useSyncExternalStore(
    subscribeWindowScroll,
    getWindowScrolledSnapshot,
    () => false
  );
  const prefersReducedMotion = Boolean(useReducedMotion());

  const resolvedLandMode: LandingColorMode =
    landThemeMode === "system"
      ? mounted
        ? resolvedTheme
        : "dark"
      : landThemeMode;
  const isDark = resolvedLandMode === "dark";

  const handleSelectLandingTheme = (next: ThemeMode) => {
    try {
      window.localStorage.setItem(LANDING_THEME_KEY, next);
      window.dispatchEvent(new Event(LANDING_THEME_EVENT));
    } catch {
      // Ignore storage restriction
    }
    setTheme(next);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTechSpecs, setShowTechSpecs] = useState(false);

  // Interactive 3D Campus state coordinated between hero canvas & below-hero command bar
  const [selectedId, setSelectedId] = useState<BuildingId | null>(null);
  const [hoveredId, setHoveredId] = useState<BuildingId | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [promptSpinTrigger, setPromptSpinTrigger] = useState(0);

  const handleSelectBuilding = (id: BuildingId) => {
    setSelectedId(id);
    setActivePresetId(null);
    setResetTrigger((prev) => prev + 1);
  };

  const handleRunPreset = (preset: PromptPreset) => {
    setSelectedId(preset.targetBuilding);
    setActivePresetId(preset.id);
    setResetTrigger((prev) => prev + 1);
    setPromptSpinTrigger((prev) => prev + 1);
  };

  const handleClearSelection = () => {
    setSelectedId(null);
    setHoveredId(null);
    setActivePresetId(null);
    setResetTrigger((prev) => prev + 1);
  };

  // Smooth scrolling via Lenis synced to GSAP ScrollTrigger + Stats Count-up + Section Reveals
  const mainRef = useRef<HTMLElement | null>(null);
  const statsRef = useRef<HTMLElement | null>(null);
  const domainsCountRef = useRef<HTMLSpanElement | null>(null);
  const verifiedCountRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion || typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      if (statsRef.current) {
        const counts = { domains: 0, verified: 0 };
        gsap.to(counts, {
          domains: 6,
          verified: 100,
          duration: 0.72,
          ease: "power2.out",
          scrollTrigger: {
            trigger: statsRef.current,
            start: "top 88%",
            once: true,
          },
          onUpdate: () => {
            if (domainsCountRef.current) {
              domainsCountRef.current.textContent = String(
                Math.round(counts.domains)
              );
            }
            if (verifiedCountRef.current) {
              verifiedCountRef.current.textContent = String(
                Math.round(counts.verified)
              );
            }
          },
        });
      }

      gsap.utils.toArray<HTMLElement>("[data-reveal-section]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 24, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.65,
            ease: "power3.out",
            clearProps: "transform,filter",
            scrollTrigger: {
              trigger: el,
              start: "top 86%",
              once: true,
            },
          }
        );
      });
    }, mainRef);

    return () => {
      ctx.revert();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [prefersReducedMotion]);

  // Interactive Cursor-Reactive Indigo/Cyan Halo inside Hero
  const heroRef = useRef<HTMLElement | null>(null);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 110, damping: 24, mass: 0.5 });
  const smoothY = useSpring(mouseY, { stiffness: 110, damping: 24, mass: 0.5 });

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!heroRef.current || prefersReducedMotion) return;
    const rect = heroRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
    if (!isHeroHovered) setIsHeroHovered(true);
  };

  const handleHeroMouseLeave = () => {
    setIsHeroHovered(false);
  };

  const enableContinuousMotion = mounted && !prefersReducedMotion;

  return (
    <div
      data-land-theme={resolvedLandMode}
      className={`cv-landing min-h-screen flex flex-col font-sans relative overflow-x-hidden transition-colors duration-300 ${
        isDark
          ? "bg-[#05070F] text-[#F5F7FF] selection:bg-[#6366F1] selection:text-white"
          : "bg-[#F6F7FB] text-[#0F172A] selection:bg-[#4F46E5] selection:text-white"
      }`}
    >
      {/* =====================================================================
          1. FLOATING GLASS NAVIGATION BAR (Transparent -> Frosted Glass on Scroll)
         ===================================================================== */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${
          isScrolled
            ? isDark
              ? "border-white/10 bg-[#05070F]/82 backdrop-blur-xl shadow-[0_10px_32px_rgba(2,4,10,0.45)]"
              : "border-slate-200/85 bg-[#F6F7FB]/88 backdrop-blur-xl shadow-sm"
            : "border-transparent bg-transparent backdrop-blur-none"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative z-10">
          {/* Exact CampVion Emblem + Brand Wordmark */}
          <Link href="/" className="flex items-center space-x-3 group shrink-0">
            <div
              className={`h-10 w-10 rounded-2xl border p-1.5 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                isDark
                  ? "bg-[#0B1020] border-white/10"
                  : "bg-white border-slate-200 shadow-xs"
              }`}
            >
              <BrandLogo
                variant="mark"
                isDark={isDark}
                size={28}
                alt="CampVion Official Emblem"
                priority
                className="h-full w-auto"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`text-base font-extrabold tracking-tight ${
                  isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                }`}
              >
                Camp
                <span
                  className={isDark ? "text-[#22D3EE]" : "text-[#0E7490]"}
                >
                  Vion
                </span>
              </span>
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isDark
                    ? "bg-indigo-500/15 text-[#22D3EE] border-cyan-400/30"
                    : "bg-indigo-50 text-[#4338CA] border-indigo-200"
                }`}
              >
                AI
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center space-x-1 lg:space-x-2"
          >
            {[
              { href: "#platform", label: "Platform" },
              { href: "#capabilities", label: "Capabilities" },
              { href: "#how-it-works", label: "How It Works" },
              { href: "#security", label: "Security" },
            ].map((nav) => (
              <a
                key={nav.href}
                href={nav.href}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  isDark
                    ? "text-[#8B95B0] hover:text-[#F5F7FF] hover:bg-white/5"
                    : "text-slate-600 hover:text-slate-950 hover:bg-indigo-50/70"
                }`}
              >
                {nav.label}
              </a>
            ))}
          </nav>

          {/* Right Controls: Theme Switcher & Auth CTA Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Theme Switcher */}
            <div
              className={`flex items-center p-1 rounded-xl border ${
                isDark
                  ? "bg-[#0B1020] border-white/10"
                  : "bg-white border-slate-200/80"
              }`}
              role="group"
              aria-label="Theme Switcher"
            >
              <button
                type="button"
                onClick={() => handleSelectLandingTheme("light")}
                title="Light Mode"
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  mounted && landThemeMode === "light"
                    ? "bg-indigo-600 text-white font-bold shadow-xs"
                    : isDark
                    ? "text-[#8B95B0] hover:text-[#F5F7FF]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                aria-label="Light mode"
              >
                <Sun
                  className={`h-3.5 w-3.5 ${
                    isDark || landThemeMode === "light"
                      ? "text-[#FBBF24]"
                      : "text-[#B45309]"
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => handleSelectLandingTheme("dark")}
                title="Dark Mode"
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  mounted && landThemeMode === "dark"
                    ? isDark
                      ? "bg-white/12 text-[#22D3EE] font-bold"
                      : "bg-slate-900 text-white font-bold"
                    : isDark
                    ? "text-[#8B95B0] hover:text-[#F5F7FF]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                aria-label="Dark mode"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSelectLandingTheme("system")}
                title="System Theme"
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  mounted && landThemeMode === "system"
                    ? isDark
                      ? "bg-white/12 text-[#22D3EE] font-bold"
                      : "bg-indigo-50 text-indigo-700 font-bold"
                    : isDark
                    ? "text-[#8B95B0] hover:text-[#F5F7FF]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                aria-label="System theme"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>

            {user ? (
              <div className="flex items-center space-x-2">
                <Link
                  href="/app"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-2xl text-xs font-bold cv-land-btn-primary transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(34,211,238,0.48)]"
                >
                  <span>Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-semibold border transition cursor-pointer ${
                    isDark
                      ? "bg-[#0B1020]/90 hover:bg-white/10 text-[#F5F7FF] border-white/10"
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5">
                <Link
                  href="/login"
                  className={`px-4 py-2 rounded-2xl text-xs font-bold border transition ${
                    isDark
                      ? "text-[#F5F7FF] hover:text-[#22D3EE] bg-[#0B1020]/75 border-white/10 hover:border-cyan-400/45"
                      : "text-slate-700 hover:text-indigo-700 bg-white/90 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-2xl text-xs font-bold cv-land-btn-primary transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(34,211,238,0.48)]"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className={`p-2 rounded-xl border ${
                isDark
                  ? "bg-[#0B1020] border-white/10 text-[#F5F7FF]"
                  : "bg-white border-slate-200 text-slate-700"
              }`}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className={`md:hidden border-t backdrop-blur-xl px-4 pt-3 pb-5 space-y-3 shadow-xl ${
              isDark
                ? "border-white/10 bg-[#0B1020]/95"
                : "border-slate-200 bg-white/95"
            }`}
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "#platform", label: "Platform" },
                { href: "#capabilities", label: "Capabilities" },
                { href: "#how-it-works", label: "How It Works" },
                { href: "#security", label: "Security" },
              ].map((nav) => (
                <a
                  key={nav.href}
                  href={nav.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                    isDark
                      ? "text-[#F5F7FF] hover:bg-white/5"
                      : "text-slate-700 hover:bg-indigo-50"
                  }`}
                >
                  {nav.label}
                </a>
              ))}
            </div>

            <div
              className={`pt-2 border-t flex flex-col gap-2 ${
                isDark ? "border-white/10" : "border-slate-200"
              }`}
            >
              {user ? (
                <Link
                  href="/app"
                  className="w-full py-2.5 px-4 rounded-2xl text-xs font-bold text-center cv-land-btn-primary"
                >
                  Open Workspace ({user.full_name})
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="w-full py-2.5 px-4 rounded-2xl text-xs font-bold text-center cv-land-btn-primary"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/login"
                    className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold text-center border ${
                      isDark
                        ? "bg-[#05070F] text-[#F5F7FF] border-white/10"
                        : "bg-white text-slate-800 border-slate-200"
                    }`}
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main ref={mainRef} className="flex-1 relative z-10">
        {/* ===================================================================
            2. TWO-ZONE DIGITAL TWIN HERO (LEFT COPY / RIGHT ~60% 3D CANVAS)
           =================================================================== */}
        <section
          ref={heroRef}
          id="platform"
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={handleHeroMouseLeave}
          className={`relative pt-16 min-h-[640px] lg:h-[calc(100dvh-5rem)] lg:min-h-[580px] lg:max-h-[880px] flex flex-col overflow-hidden ${
            isDark
              ? "bg-[#05070F]"
              : "bg-[#F6F7FB]"
          }`}
        >
          {enableContinuousMotion && (
            <motion.div
              aria-hidden="true"
              style={{
                x: smoothX,
                y: smoothY,
                translateX: "-50%",
                translateY: "-50%",
                willChange: "transform, opacity",
                background:
                  "radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.04) 45%, transparent 72%)",
              }}
              animate={{ opacity: isHeroHovered ? 0.65 : 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="pointer-events-none absolute top-0 left-0 w-[420px] h-[420px] rounded-full blur-[100px] z-10"
            />
          )}

          {/* Asymmetric Split Grid: Desktop 5/12 (~41%) Left Text | 7/12 (~59%) Right 3D Zone; Stacked on <1024px */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 relative">
            {/* LEFT TEXT COLUMN (max-w-[560px], Guaranteed Zero Canvas Overlap + Left-to-Right Scrim) */}
            <div
              className={`lg:col-span-5 flex items-center justify-center lg:justify-end relative z-20 px-5 sm:px-8 lg:pl-10 xl:pl-16 lg:pr-6 pt-8 pb-5 lg:py-8 ${
                isDark
                  ? "bg-gradient-to-r from-[#05070F] via-[#05070F]/95 to-[#05070F]/85"
                  : "bg-gradient-to-r from-[#F6F7FB] via-[#F6F7FB]/95 to-[#F6F7FB]/85"
              }`}
            >
              <div className="w-full max-w-[560px] flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
                {/* Pill Badge */}
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.45,
                    delay: prefersReducedMotion ? 0 : 0.15,
                  }}
                  className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full backdrop-blur-xl border ${
                    isDark
                      ? "bg-[#0B1020]/85 border-white/10 shadow-[0_6px_20px_rgba(56,189,248,0.10)]"
                      : "bg-white/90 border-slate-200/80 shadow-xs"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full animate-ping ${
                      isDark ? "bg-[#38BDF8]" : "bg-[#0E7490]"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isDark ? "text-[#38BDF8]" : "text-[#0E7490]"
                    }`}
                  >
                    AUTONOMOUS CAMPUS OPERATIONS
                  </span>
                </motion.div>

                {/* Kinetic Typography Headline */}
                <motion.h1
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.55,
                    delay: prefersReducedMotion ? 0 : 0.25,
                  }}
                  className={`text-[clamp(2.15rem,4.4vw,3.9rem)] font-extrabold tracking-tight leading-[1.05] ${
                    isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                  }`}
                >
                  ONE PLATFORM.
                  <span className="block cv-land-gradient-text mt-0.5">
                    ALL CAMPUS SERVICES.
                  </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.55,
                    delay: prefersReducedMotion ? 0 : 0.35,
                  }}
                  className={`text-sm sm:text-base max-w-[490px] leading-relaxed font-normal ${
                    isDark ? "text-[#8B95B0]" : "text-[#475569]"
                  }`}
                >
                  Connecting students to institutional authorities with natural
                  language intent parsing, deterministic DAG planning, and policy
                  verification.
                </motion.p>

                {/* Dual Action Buttons */}
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.55,
                    delay: prefersReducedMotion ? 0 : 0.45,
                  }}
                  className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1"
                >
                  <motion.div
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  >
                    <Link
                      href={user ? "/app" : "/signup"}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold cv-land-btn-primary transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2"
                    >
                      <span>{user ? "Open Workspace" : "Get Started"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  >
                    <a
                      href="#capabilities"
                      className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold backdrop-blur-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2 ${
                        isDark
                          ? "bg-[#0B1020]/85 hover:bg-white/10 text-[#F5F7FF] border-white/10 hover:border-sky-400/45"
                          : "bg-white/95 hover:bg-indigo-50/70 text-[#0F172A] border-slate-300 hover:border-indigo-400 shadow-xs"
                      }`}
                    >
                      <span>Explore Platform</span>
                      <ChevronRight
                        className={`h-4 w-4 ${
                          isDark ? "text-[#38BDF8]" : "text-[#0E7490]"
                        }`}
                      />
                    </a>
                  </motion.div>
                </motion.div>
              </div>
            </div>

            {/* RIGHT 3D CAMPUS COLUMN (~60% Desktop / Stacked Below Text on Mobile & Tablet) */}
            <div className="lg:col-span-7 relative min-h-[380px] sm:min-h-[450px] lg:min-h-0 flex flex-col">
              <CampusExperience
                themeMode={resolvedLandMode}
                selectedId={selectedId}
                hoveredId={hoveredId}
                activePresetId={activePresetId}
                resetTrigger={resetTrigger}
                promptSpinTrigger={promptSpinTrigger}
                onSelectBuilding={handleSelectBuilding}
                onHoverBuilding={setHoveredId}
                onClearSelection={handleClearSelection}
              />
            </div>
          </div>
        </section>

        {/* Prompt-to-3D Command Bar in Normal Flow Below Hero (Zero Canvas Cut / Clipping) */}
        <section
          aria-label="Prompt-to-3D Controls"
          className={`relative z-20 border-b py-3.5 ${
            isDark
              ? "border-white/10 bg-[#05070F]"
              : "border-slate-200/80 bg-[#F6F7FB]"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PromptCommandBar
              selectedId={selectedId}
              activePresetId={activePresetId}
              isNightMode={isDark}
              onRunPreset={handleRunPreset}
              onClearSelection={handleClearSelection}
            />
          </div>
        </section>

        {/* Thin Enterprise Stats Strip Below Hero */}
        <section
          ref={statsRef}
          aria-label="Platform Guarantees"
          className={`border-b py-6 relative z-10 ${
            isDark
              ? "border-white/10 bg-[#0B1020]/65"
              : "border-slate-200/80 bg-white/85"
          }`}
        >
          <div
            className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:divide-x text-center ${
              isDark ? "sm:divide-white/10" : "sm:divide-slate-200"
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-0.5 py-1">
              <span
                className={`text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
                  isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                }`}
              >
                <span ref={domainsCountRef}>6</span> Campus Domains
              </span>
              <span
                className={`text-[11px] font-mono uppercase tracking-wider ${
                  isDark ? "text-[#8B95B0]" : "text-slate-600"
                }`}
              >
                Unified Service Graph
              </span>
            </div>

            <div className="flex flex-col items-center justify-center space-y-0.5 py-1">
              <span
                className={`inline-flex items-center space-x-1.5 text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
                  isDark ? "text-[#34D399]" : "text-[#047857]"
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>
                  <span ref={verifiedCountRef}>100</span>% Policy-Verified
                </span>
              </span>
              <span
                className={`text-[11px] font-mono uppercase tracking-wider ${
                  isDark ? "text-[#8B95B0]" : "text-slate-600"
                }`}
              >
                Zero Hallucination Bylaws
              </span>
            </div>

            <div className="flex flex-col items-center justify-center space-y-0.5 py-1">
              <span
                className={`inline-flex items-center space-x-2 text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
                  isDark ? "text-[#FBBF24]" : "text-[#B45309]"
                }`}
              >
                <span className="relative flex h-3 w-3 items-center justify-center">
                  {enableContinuousMotion && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#FBBF24] opacity-75 animate-ping" />
                  )}
                  <ShieldCheck
                    className={`relative h-4 w-4 ${
                      isDark ? "text-[#FBBF24]" : "text-[#B45309]"
                    }`}
                  />
                </span>
                <span>Human-in-the-loop</span>
              </span>
              <span
                className={`text-[11px] font-mono uppercase tracking-wider ${
                  isDark ? "text-[#8B95B0]" : "text-slate-600"
                }`}
              >
                Dean &amp; Warden Sign-Off
              </span>
            </div>
          </div>
        </section>

        {/* ===================================================================
            3. ASYMMETRIC BENTO GRID — CAMPUS CAPABILITIES
           =================================================================== */}
        <section
          id="capabilities"
          className={`py-24 border-b relative ${
            isDark
              ? "border-white/10 bg-[#05070F]"
              : "border-slate-200/80 bg-[#F6F7FB]"
          }`}
        >
          <div
            data-reveal-section
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2">
                <div
                  className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full backdrop-blur-xl border ${
                    isDark
                      ? "bg-[#0B1020]/85 border-white/10"
                      : "bg-white/90 border-slate-200 shadow-2xs"
                  }`}
                >
                  <Sparkles
                    className={`h-3.5 w-3.5 ${
                      isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                      isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                    }`}
                  >
                    CAMPUS CAPABILITIES
                  </span>
                </div>
                <h2
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                  }`}
                >
                  Architected for zero-error university governance.
                </h2>
              </div>
              <p
                className={`text-xs sm:text-sm max-w-sm ${
                  isDark ? "text-[#8B95B0]" : "text-[#475569]"
                }`}
              >
                Six specialized systems working symbiotically inside one unified
                agentic platform.
              </p>
            </div>

            {/* Asymmetric 6-Tile Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
              {BENTO_FEATURES.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <SpotlightBentoCard
                    key={item.id}
                    spanClass={item.spanClass}
                    isDark={isDark}
                    prefersReducedMotion={prefersReducedMotion}
                    delay={idx * 0.07}
                  >

                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`h-11 w-11 rounded-2xl border flex items-center justify-center group-hover:scale-105 transition-transform ${
                          isDark
                            ? "bg-[#05070F]/80 border-white/10 text-[#22D3EE]"
                            : "bg-indigo-50/80 border-indigo-200/80 text-[#4338CA]"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold ${
                            isDark
                              ? "bg-indigo-500/15 border-cyan-400/25 text-[#22D3EE]"
                              : "bg-indigo-50 border-indigo-200 text-[#4338CA]"
                          }`}
                        >
                          {item.chip}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider hidden sm:inline-block ${
                            isDark
                              ? "bg-[#05070F] border-white/10 text-[#8B95B0]"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                    </div>

                    {item.id === "intent-parsing" && (
                      <IntentPointCloudCanvas isDark={isDark} />
                    )}
                    {item.id === "human-governance" && (
                      <GovernanceGlassShieldCanvas isDark={isDark} />
                    )}

                    {item.id === "dag-planning" && (
                      <div
                        className={`h-28 rounded-2xl border px-3 flex items-center justify-between gap-1.5 ${
                          isDark
                            ? "bg-[#05070F]/75 border-white/10"
                            : "bg-indigo-50/40 border-indigo-100"
                        }`}
                      >
                        {["t1: Parse", "t2: Check", "t3: Gate"].map((node, i) => (
                          <React.Fragment key={node}>
                            <motion.div
                              whileHover={{ scale: 1.06 }}
                              className={`px-2 py-1.5 rounded-xl border text-[10px] font-mono font-bold ${
                                isDark
                                  ? "bg-[#0B1020] border-white/15 text-[#F5F7FF]"
                                  : "bg-white border-indigo-200/80 text-[#0F172A] shadow-2xs"
                              }`}
                            >
                              {node}
                            </motion.div>
                            {i < 2 && (
                              <div
                                className={`flex-1 h-[2px] relative overflow-hidden rounded-full ${
                                  isDark ? "bg-white/10" : "bg-indigo-200"
                                }`}
                              >
                                <motion.div
                                  animate={{ x: ["-100%", "100%"] }}
                                  transition={{
                                    duration: 1.8,
                                    repeat: Infinity,
                                    ease: "linear",
                                    delay: i * 0.4,
                                  }}
                                  className="w-1/2 h-full bg-gradient-to-r from-[#6366F1] to-[#22D3EE]"
                                />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}

                    {item.id === "policy-verification" && (
                      <div
                        className={`h-28 rounded-2xl border p-3 flex flex-col justify-center space-y-2 ${
                          isDark
                            ? "bg-[#05070F]/75 border-white/10"
                            : "bg-indigo-50/40 border-indigo-100"
                        }`}
                      >
                        {[
                          { code: "POL-ATT-001", val: "88.5% >= 75% \u2713" },
                          { code: "POL-LVE-001", val: "Quota 12d \u2713" },
                        ].map((rule, rIdx) => (
                          <motion.div
                            key={rule.code}
                            initial={{ opacity: 0.85, x: -4 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: rIdx * 0.15 }}
                            className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-[10px] font-mono ${
                              isDark
                                ? "bg-[#0B1020] border-white/10"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            <span
                              className={`font-bold ${
                                isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                              }`}
                            >
                              {rule.code}
                            </span>
                            <span
                              className={`font-bold ${
                                isDark ? "text-[#34D399]" : "text-[#047857]"
                              }`}
                            >
                              {rule.val}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {item.id === "audit-trail" && (
                      <div
                        className={`h-28 rounded-2xl border p-3 flex flex-col justify-center space-y-1.5 ${
                          isDark
                            ? "bg-[#05070F]/75 border-white/10"
                            : "bg-indigo-50/40 border-indigo-100"
                        }`}
                      >
                        {[
                          "12:04:01  #LV-2026-108  Intent Parsed",
                          "12:04:02  POL-LVE-001  Eligibility Pass",
                          "12:04:03  GOV-HITL-001  Warden Signed \u2713",
                        ].map((log, lIdx) => (
                          <motion.div
                            key={log}
                            whileHover={{ x: 4 }}
                            className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono truncate flex items-center space-x-2 ${
                              isDark
                                ? "bg-[#0B1020] border-white/10 text-[#F5F7FF]"
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                lIdx === 2
                                  ? "bg-[#34D399]"
                                  : lIdx === 1
                                  ? "bg-[#FBBF24]"
                                  : "bg-[#22D3EE]"
                              }`}
                            />
                            <span className="truncate">{log}</span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {item.id === "data-privacy" && (
                      <div
                        className={`h-28 rounded-2xl border p-3 flex items-center justify-around gap-2 ${
                          isDark
                            ? "bg-[#05070F]/75 border-white/10"
                            : "bg-indigo-50/40 border-indigo-100"
                        }`}
                      >
                        {[
                          { label: "HttpOnly", sub: "SameSite" },
                          { label: "Scrypt", sub: "Salted Hash" },
                          { label: "RBAC", sub: "Role Isolated" },
                        ].map((sec) => (
                          <motion.div
                            key={sec.label}
                            whileHover={{ scale: 1.05 }}
                            className={`flex-1 py-2 px-2 rounded-xl border text-center ${
                              isDark
                                ? "bg-[#0B1020] border-white/10"
                                : "bg-white border-slate-200 shadow-2xs"
                            }`}
                          >
                            <span
                              className={`block text-[10px] font-mono font-extrabold ${
                                isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                              }`}
                            >
                              {sec.label}
                            </span>
                            <span
                              className={`block text-[9px] font-mono mt-0.5 ${
                                isDark ? "text-[#8B95B0]" : "text-slate-600"
                              }`}
                            >
                              {sec.sub}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <h3
                        className={`text-lg font-bold transition-colors ${
                          isDark
                            ? "text-[#F5F7FF] group-hover:text-[#22D3EE]"
                            : "text-[#0F172A] group-hover:text-[#0E7490]"
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p
                        className={`text-xs sm:text-sm leading-relaxed font-normal ${
                          isDark ? "text-[#8B95B0]" : "text-[#475569]"
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>

                    <div
                      className={`pt-3 border-t flex items-center justify-between text-xs font-mono ${
                        isDark ? "border-white/10" : "border-slate-200/80"
                      }`}
                    >
                      <span
                        className={`font-bold ${
                          isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                        }`}
                      >
                        {item.tag}
                      </span>
                      <span
                        className={`font-semibold ${
                          isDark ? "text-[#8B95B0]" : "text-slate-500"
                        }`}
                      >
                        {item.metric}
                      </span>
                    </div>
                  </SpotlightBentoCard>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================================
            4. CHOREOGRAPHED 3D PIPELINE ("HOW IT WORKS")
           =================================================================== */}
        <section
          id="how-it-works"
          className={`py-24 border-b relative ${
            isDark
              ? "border-white/10 bg-[#05070F]"
              : "border-slate-200/80 bg-[#F6F7FB]"
          }`}
        >
          <div
            data-reveal-section
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12"
          >
            <div className="space-y-2">
              <div
                className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full backdrop-blur-xl border ${
                  isDark
                    ? "bg-[#0B1020]/85 border-white/10"
                    : "bg-white/90 border-slate-200 shadow-2xs"
                }`}
              >
                <Workflow
                  className={`h-3.5 w-3.5 ${
                    isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                  }`}
                />
                <span
                  className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                    isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                  }`}
                >
                  CHOREOGRAPHED PIPELINE
                </span>
              </div>
              <h2
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                  isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                }`}
              >
                From student prompt to verified administrative execution.
              </h2>
            </div>

            <ScrollytellingPipeline isDark={isDark} />

            {/* Expandable Technical Architecture Drawer */}
            <div
              className={`rounded-3xl backdrop-blur-xl border overflow-hidden transition-colors ${
                isDark
                  ? "bg-[#0B1020]/85 border-white/10 shadow-[0_24px_64px_-18px_rgba(34,211,238,0.12)]"
                  : "bg-white/90 border-slate-200/80 shadow-[0_20px_50px_rgba(79,70,229,0.08)]"
              }`}
            >
              <button
                type="button"
                onClick={() => setShowTechSpecs((prev) => !prev)}
                aria-expanded={showTechSpecs}
                className={`w-full px-6 py-4.5 flex items-center justify-between text-left transition cursor-pointer ${
                  isDark ? "hover:bg-white/5" : "hover:bg-indigo-50/40"
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isDark
                        ? "bg-[#05070F] border-white/10 text-[#22D3EE]"
                        : "bg-indigo-50 border-indigo-200 text-[#4F46E5]"
                    }`}
                  >
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider block ${
                        isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                      }`}
                    >
                      Under The Hood — 8 Project 55 System Specifications
                    </span>
                    <span
                      className={`text-[11px] ${
                        isDark ? "text-[#8B95B0]" : "text-[#475569]"
                      }`}
                    >
                      Deterministic topological sort, SQLAlchemy tools, bounded
                      recovery &amp; strict Human-in-the-Loop halts
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    showTechSpecs
                      ? "rotate-180 text-[#22D3EE]"
                      : isDark
                      ? "text-[#8B95B0]"
                      : "text-slate-500"
                  }`}
                />
              </button>

              <AnimatePresence>
                {showTechSpecs && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-6 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${
                      isDark
                        ? "border-white/10 bg-[#05070F]/70"
                        : "border-slate-200/80 bg-white"
                    }`}
                  >
                    {TECHNICAL_PILLARS.map((pillar) => {
                      const Icon = pillar.icon;
                      return (
                        <div
                          key={pillar.title}
                          className={`p-4 rounded-2xl border space-y-2 ${
                            isDark
                              ? "bg-[#0B1020] border-white/10"
                              : "bg-slate-50/70 border-slate-200/80"
                          }`}
                        >
                          <div
                            className={`flex items-center space-x-2 ${
                              isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <h4
                              className={`text-xs font-bold ${
                                isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                              }`}
                            >
                              {pillar.title}
                            </h4>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed font-normal ${
                              isDark ? "text-[#8B95B0]" : "text-[#475569]"
                            }`}
                          >
                            {pillar.detail}
                          </p>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ===================================================================
            5. ENTERPRISE TRUST & GOVERNANCE BANNER
           =================================================================== */}
        <section
          id="security"
          className={`py-24 border-b relative ${
            isDark
              ? "border-white/10 bg-[#05070F]"
              : "border-slate-200/80 bg-[#F6F7FB]"
          }`}
        >
          <div
            data-reveal-section
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12"
          >
            <div className="space-y-2">
              <div
                className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full backdrop-blur-xl border ${
                  isDark
                    ? "bg-[#0B1020]/85 border-white/10"
                    : "bg-white/90 border-slate-200 shadow-2xs"
                }`}
              >
                <ShieldCheck
                  className={`h-3.5 w-3.5 ${
                    isDark ? "text-[#34D399]" : "text-[#047857]"
                  }`}
                />
                <span
                  className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                    isDark ? "text-[#34D399]" : "text-[#047857]"
                  }`}
                >
                  TRUST &amp; COMPLIANCE
                </span>
              </div>
              <h2
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                  isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                }`}
              >
                Built strictly for institutional compliance.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "HttpOnly Cookie Sessions",
                  desc: "XSS-immune session tokens with Scrypt cryptographic password hashing.",
                  icon: Lock,
                },
                {
                  title: "Deterministic Execution",
                  desc: "Zero hallucinated actions. Kahn's algorithm validates prerequisites before dispatch.",
                  icon: Workflow,
                },
                {
                  title: "Warden & Dean Halts",
                  desc: "High-consequence actions pause automatically at institutional authorization gates.",
                  icon: ShieldCheck,
                },
                {
                  title: "Zero-Hallucination Policy Check",
                  desc: "Every condition validates directly against relational course and student records.",
                  icon: Scale,
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.title}
                    whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    className={`p-[1px] rounded-3xl transition-all ${
                      isDark
                        ? "bg-gradient-to-br from-white/15 via-white/5 to-[#22D3EE]/30 shadow-[0_20px_50px_rgba(34,211,238,0.08)]"
                        : "bg-gradient-to-br from-indigo-200/80 via-slate-200/60 to-cyan-200/80 shadow-sm"
                    }`}
                  >
                    <div
                      className={`h-full p-6 rounded-[23px] backdrop-blur-xl space-y-3.5 ${
                        isDark
                          ? "bg-[#0B1020]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                          : "bg-white/95"
                      }`}
                    >
                      <div
                        className={`h-11 w-11 rounded-2xl border flex items-center justify-center ${
                          isDark
                            ? "bg-[#05070F] border-white/10 text-[#22D3EE]"
                            : "bg-indigo-50 border-indigo-200 text-[#4F46E5]"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3
                        className={`text-sm font-bold ${
                          isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                        }`}
                      >
                        {card.title}
                      </h3>
                      <p
                        className={`text-xs leading-relaxed font-normal ${
                          isDark ? "text-[#8B95B0]" : "text-[#475569]"
                        }`}
                      >
                        {card.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Callout Banner */}
            <div
              className={`mt-14 rounded-3xl backdrop-blur-xl border p-8 sm:p-14 text-center space-y-6 relative overflow-hidden ${
                isDark
                  ? "bg-[#0B1020]/88 border-white/10 shadow-[0_24px_64px_-18px_rgba(99,102,241,0.25)]"
                  : "bg-white/92 border-slate-200/80 shadow-[0_20px_50px_rgba(79,70,229,0.10)]"
              }`}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[320px] rounded-full blur-[120px] opacity-25"
                style={{
                  background:
                    "radial-gradient(circle, #6366F1 0%, #22D3EE 48%, transparent 75%)",
                }}
              />

              {/* Official CampVion Emblem */}
              <div className="relative inline-flex items-center justify-center mx-auto z-10">
                <div
                  className={`h-20 w-20 sm:h-24 sm:w-24 rounded-3xl border p-3 flex items-center justify-center ${
                    isDark
                      ? "bg-[#05070F] border-white/15 shadow-[0_12px_32px_rgba(34,211,238,0.18)]"
                      : "bg-white border-slate-200 shadow-md"
                  }`}
                >
                  <BrandLogo
                    variant="mark"
                    isDark={isDark}
                    size={72}
                    alt="CampVion Emblem"
                    className="h-full w-auto"
                  />
                </div>
              </div>

              <h2
                className={`text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight relative z-10 ${
                  isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                }`}
              >
                MAKE CAMPUS OPERATIONS EFFORTLESS.
              </h2>

              <p
                className={`text-sm sm:text-base max-w-lg mx-auto leading-relaxed font-normal relative z-10 ${
                  isDark ? "text-[#8B95B0]" : "text-[#475569]"
                }`}
              >
                Empower university students, enforce institutional rules
                automatically, and let campus authorities authorize
                consequential actions in a single click.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 relative z-10">
                {user ? (
                  <Link
                    href="/app"
                    className="inline-flex items-center space-x-2 px-7 py-3.5 rounded-2xl text-sm font-bold cv-land-btn-primary transition transform hover:-translate-y-0.5"
                  >
                    <span>Launch Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="inline-flex items-center space-x-2 px-7 py-3.5 rounded-2xl text-sm font-bold cv-land-btn-primary transition transform hover:-translate-y-0.5"
                    >
                      <span>Create Free Account</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/login"
                      className={`inline-flex items-center space-x-2 px-7 py-3.5 rounded-2xl text-sm font-bold backdrop-blur-xl border transition ${
                        isDark
                          ? "bg-[#05070F]/80 hover:bg-white/10 text-[#F5F7FF] border-white/15"
                          : "bg-white hover:bg-indigo-50/70 text-[#0F172A] border-slate-200"
                      }`}
                    >
                      <span>Sign In</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          MINIMALIST ENTERPRISE FOOTER
         ===================================================================== */}
      <footer
        className={`border-t relative z-10 ${
          isDark
            ? "bg-[#05070F] text-[#8B95B0] border-white/10"
            : "bg-[#F6F7FB] text-slate-600 border-slate-200/80"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div
            className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b ${
              isDark ? "border-white/10" : "border-slate-200/80"
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div
                className={`h-10 w-10 rounded-2xl border p-1.5 flex items-center justify-center shrink-0 ${
                  isDark
                    ? "bg-[#0B1020] border-white/10"
                    : "bg-white border-slate-200 shadow-2xs"
                }`}
              >
                <BrandLogo
                  variant="mark"
                  isDark={isDark}
                  size={26}
                  alt="CampVion Emblem"
                  className="h-full w-auto"
                />
              </div>
              <div>
                <span
                  className={`text-sm font-bold block ${
                    isDark ? "text-[#F5F7FF]" : "text-[#0F172A]"
                  }`}
                >
                  Camp
                  <span
                    className={isDark ? "text-[#22D3EE]" : "text-[#0E7490]"}
                  >
                    Vion
                  </span>
                </span>
                <span
                  className={`text-xs ${
                    isDark ? "text-[#8B95B0]" : "text-slate-600"
                  }`}
                >
                  Autonomous Campus Operations Platform &bull; CSE276 Project 55
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold">
              <a
                href="#platform"
                className={`transition rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  isDark ? "hover:text-[#22D3EE]" : "hover:text-[#0E7490]"
                }`}
              >
                Platform
              </a>
              <a
                href="#capabilities"
                className={`transition rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  isDark ? "hover:text-[#22D3EE]" : "hover:text-[#0E7490]"
                }`}
              >
                Capabilities
              </a>
              <a
                href="#how-it-works"
                className={`transition rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  isDark ? "hover:text-[#22D3EE]" : "hover:text-[#0E7490]"
                }`}
              >
                How It Works
              </a>
              <a
                href="#security"
                className={`transition rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  isDark ? "hover:text-[#22D3EE]" : "hover:text-[#0E7490]"
                }`}
              >
                Security
              </a>
              <Link
                href="/login"
                className={`transition rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  isDark ? "hover:text-[#22D3EE]" : "hover:text-[#0E7490]"
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className={`font-bold hover:underline transition rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  isDark ? "text-[#22D3EE]" : "text-[#0E7490]"
                }`}
              >
                Register
              </Link>
              <Link
                href="/signup"
                className={`font-bold hover:underline transition rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] ${
                  isDark ? "text-[#6366F1]" : "text-[#4338CA]"
                }`}
              >
                Get Started
              </Link>
            </div>
          </div>

          <div
            className={`pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
              isDark ? "text-[#8B95B0]" : "text-slate-600"
            }`}
          >
            <span>
              &copy; {mounted ? new Date().getFullYear() : 2026} CampVion. All
              rights reserved.
            </span>
            <div className="flex items-center space-x-4">
              <Link
                href="/privacy"
                className={`transition ${
                  isDark ? "hover:text-[#F5F7FF]" : "hover:text-slate-900"
                }`}
              >
                Privacy Policy
              </Link>
              <span>&bull;</span>
              <Link
                href="/terms"
                className={`transition ${
                  isDark ? "hover:text-[#F5F7FF]" : "hover:text-slate-900"
                }`}
              >
                Terms of Service
              </Link>
              <span>&bull;</span>
              <Link
                href="/forgot-password"
                className={`transition ${
                  isDark ? "hover:text-[#F5F7FF]" : "hover:text-slate-900"
                }`}
              >
                Account Recovery
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
