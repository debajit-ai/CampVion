"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Eye,
  FileCheck2,
  GitBranch,
  GraduationCap,
  Layers,
  Lock,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Network,
  RefreshCw,
  Scale,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  Workflow,
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

interface ServiceNode {
  id: string;
  label: string;
  shortLabel: string;
  tag: string;
  summary: string;
  metric: string;
  /** Percentage coordinates on the desktop 3D orbital stage */
  x: number;
  y: number;
  floatDelay: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SERVICE_NODES: ServiceNode[] = [
  {
    id: "student-requests",
    label: "Student Requests",
    shortLabel: "Requests",
    tag: "NATURAL LANGUAGE",
    summary: "Plain-language requests parsed and routed to the right department.",
    metric: "Structured Intent Engine",
    x: 50,
    y: 11,
    floatDelay: "0s",
    icon: MessageSquare,
  },
  {
    id: "leave-management",
    label: "Leave Management",
    shortLabel: "Leave",
    tag: "QUOTA & ELIGIBILITY",
    summary: "Medical, duty, and personal leave verified against semester balances.",
    metric: "Automated Leave Pipeline",
    x: 15,
    y: 29,
    floatDelay: "0.7s",
    icon: Clock,
  },
  {
    id: "academic-services",
    label: "Academic Services",
    shortLabel: "Academics",
    tag: "CERTIFICATES & RECORDS",
    summary: "Bonafide certificates, transcripts, and enrollment standing checks.",
    metric: "Instant Record Lookup",
    x: 85,
    y: 29,
    floatDelay: "1.2s",
    icon: GraduationCap,
  },
  {
    id: "hostel-services",
    label: "Hostel Services",
    shortLabel: "Hostel",
    tag: "RESIDENTIAL OPS",
    summary: "Room allocations, gate passes, and facility maintenance dispatch.",
    metric: "Resident Verification",
    x: 15,
    y: 71,
    floatDelay: "1.8s",
    icon: Building2,
  },
  {
    id: "attendance",
    label: "Attendance",
    shortLabel: "Attendance",
    tag: "POLICY THRESHOLDS",
    summary: "Real-time course attendance checked against 75% institutional rules.",
    metric: "Live Threshold Check",
    x: 85,
    y: 71,
    floatDelay: "2.3s",
    icon: CalendarCheck,
  },
  {
    id: "campus-admin",
    label: "Campus Administration",
    shortLabel: "Administration",
    tag: "HUMAN GOVERNANCE",
    summary: "High-impact requests paused for authorized advisor or admin sign-off.",
    metric: "Human-in-the-Loop Gate",
    x: 50,
    y: 89,
    floatDelay: "2.9s",
    icon: ShieldCheck,
  },
];

const CAPABILITIES = [
  {
    title: "Intelligent Request Understanding",
    description: "Interprets student and staff requests written in everyday language.",
    tag: "NLP Intent",
    icon: MessageSquare,
  },
  {
    title: "Smart Workflow Planning",
    description: "Organizes multi-step campus processes into deterministic actions.",
    tag: "DAG Planner",
    icon: Workflow,
  },
  {
    title: "Campus Service Integration",
    description: "Unifies attendance, leave, academics, hostel, library and admin.",
    tag: "6 Domains",
    icon: Network,
  },
  {
    title: "Policy-Based Verification",
    description: "Validates institutional eligibility rules before taking action.",
    tag: "Rule Engine",
    icon: Scale,
  },
  {
    title: "Secure Human Approval",
    description: "Routes sensitive or exception requests for human authorization.",
    tag: "Governance",
    icon: UserCheck,
  },
  {
    title: "Transparent Execution",
    description: "Tracks live status updates, policy citations and audit history.",
    tag: "Audit Trace",
    icon: Eye,
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Submit Request",
    caption: "Ask in plain language.",
  },
  {
    step: "02",
    title: "Understand Intent",
    caption: "Extract required actions.",
  },
  {
    step: "03",
    title: "Check Policies",
    caption: "Verify records & rules.",
  },
  {
    step: "04",
    title: "Plan Workflow",
    caption: "Sequence multi-step DAG.",
  },
  {
    step: "05",
    title: "Human Approval",
    caption: "Review sensitive actions.",
  },
  {
    step: "06",
    title: "Track Outcome",
    caption: "Complete audit history.",
  },
];

const TECHNICAL_PILLARS = [
  {
    title: "Agentic AI Architecture",
    detail: "Cloud-first Groq LLM intent extraction paired with deterministic fallback.",
    icon: Cpu,
  },
  {
    title: "Deterministic Planning",
    detail: "Reproducible action graphs prevent unpredictable free-form execution.",
    icon: Workflow,
  },
  {
    title: "DAG-Based Execution",
    detail: "Topological task sequencing with stateful pause-and-resume checkpoints.",
    icon: GitBranch,
  },
  {
    title: "Database-Connected Tools",
    detail: "Live SQLAlchemy tools bound to relational student and campus records.",
    icon: Database,
  },
  {
    title: "Policy-Driven Validation",
    detail: "Zero-hallucination eligibility checks citing exact university policy codes.",
    icon: Scale,
  },
  {
    title: "Human-in-the-Loop Governance",
    detail: "High-impact workflows pause at WAITING_FOR_APPROVAL until signed off.",
    icon: UserCheck,
  },
  {
    title: "Bounded Failure Recovery",
    detail: "Strict timeouts, retry budgets, and safe fallback parsing.",
    icon: RefreshCw,
  },
  {
    title: "Execution Observability",
    detail: "Dual-mode Simple View and technical Advanced View with step telemetry.",
    icon: Activity,
  },
];

const PREVIEW_VIEWS = [
  {
    id: "assistant",
    label: "Conversational Assistant",
    badge: "Natural Language Desk",
    headline: "Ask for any campus service in plain English.",
    prompt: "I need 3 days of medical leave starting Monday for a dental procedure.",
    status: "COMPLETED • POLICY VERIFIED",
    steps: [
      { label: "Student Identity", value: "Alice Sharma (S001) • B.Tech CSE", state: "pass" },
      { label: "Attendance & Quota (POL-LVE-001)", value: "88.5% Attendance • 12 Days Available", state: "pass" },
      { label: "Leave Registered", value: "Leave #LV-2026-108 • Advisor Notified", state: "pass" },
    ],
  },
  {
    id: "progress",
    label: "Request Progress",
    badge: "Live Step Tracker",
    headline: "Track every milestone from submission to approval.",
    prompt: "Requesting 4-day attendance waiver for inter-university robotics finals.",
    status: "WAITING FOR APPROVAL",
    steps: [
      { label: "Step 1 • Intent & Event Check", value: "Academic duty request verified", state: "pass" },
      { label: "Step 2 • Policy Threshold (POL-ATT-002)", value: "Duty waiver > 3 days requires sign-off", state: "gate" },
      { label: "Step 3 • Faculty Advisor Gate", value: "Awaiting one-click authorization", state: "wait" },
    ],
  },
  {
    id: "history",
    label: "Activity History",
    badge: "Searchable Archive",
    headline: "Instant access to past and active campus workflows.",
    prompt: "Recent verified executions for Student S001",
    status: "3 VERIFIED TRACES",
    steps: [
      { label: "Bonafide Certificate Request", value: "Issued in 420ms • Ref #CV-DOC-881", state: "pass" },
      { label: "Hostel Wi-Fi Maintenance (B-304)", value: "Ticket #HST-409 Dispatched", state: "pass" },
      { label: "Medical Leave (3 Days)", value: "Approved • 9 Leave Days Remaining", state: "pass" },
    ],
  },
  {
    id: "services",
    label: "Campus Services",
    badge: "Connected Departments",
    headline: "One unified directory across university departments.",
    prompt: "Integrated operational domains active in workspace",
    status: "ALL DOMAINS ONLINE",
    steps: [
      { label: "Academic & Exam Services", value: "Certificates, transcripts, CGPA records", state: "pass" },
      { label: "Attendance & Leave Desk", value: "Threshold checks, medical & duty leave", state: "pass" },
      { label: "Hostel, Library & Facilities", value: "Room maintenance, gate passes, renewals", state: "pass" },
    ],
  },
  {
    id: "details",
    label: "Request Details",
    badge: "Policy Breakdown",
    headline: "Clear eligibility metrics and governing policy citations.",
    prompt: "Trace #TR-89418 • Bonafide Certificate Verification",
    status: "ELIGIBILITY CONFIRMED",
    steps: [
      { label: "Academic Standing", value: "CGPA 8.92 • Attendance 88.5% • No Holds", state: "pass" },
      { label: "Governing Policy", value: "POL-ACAD-002 • Active Semester Verified", state: "pass" },
      { label: "Issued Artifact", value: "Digital Bonafide Certificate Logged", state: "pass" },
    ],
  },
  {
    id: "advanced",
    label: "Advanced DAG View",
    badge: "Engineering Telemetry",
    headline: "Inspect live DAG nodes, SQL tool I/O, and latency.",
    prompt: "Provider: groq (llama-3.3-70b-versatile) • Mode: Deterministic DAG",
    status: "482ms • 0 RETRIES",
    steps: [
      { label: "n1_verify_student -> get_student_profile", value: "200 OK • 14ms SQLite query", state: "pass" },
      { label: "n2_check_policy -> verify_attendance", value: "88.5% >= 75.0% -> PASS (9ms)", state: "pass" },
      { label: "n3_commit_record -> create_leave", value: "Row #108 committed (18ms)", state: "pass" },
    ],
  },
];

const SECURITY_CARDS = [
  {
    title: "Cryptographic Authentication",
    description: "Salted OpenSSL scrypt password hashing with HttpOnly, SameSite=Lax sessions and CSRF protection.",
    icon: Lock,
  },
  {
    title: "Policy-Verified Execution",
    description: "Every request is checked against institutional database records and policy rules before execution.",
    icon: FileCheck2,
  },
  {
    title: "Human Approval Controls",
    description: "Sensitive or exception workflows pause automatically for authorized faculty or admin review.",
    icon: UserCheck,
  },
  {
    title: "Complete Auditability",
    description: "Immutable step-by-step execution traces log every tool call, policy check, and timestamp.",
    icon: Server,
  },
];

const PARTICLES = [
  { left: "14%", top: "18%", size: 4, delay: "0s" },
  { left: "82%", top: "16%", size: 5, delay: "1.1s" },
  { left: "24%", top: "82%", size: 4, delay: "2.2s" },
  { left: "78%", top: "79%", size: 6, delay: "0.6s" },
  { left: "50%", top: "24%", size: 3, delay: "1.7s" },
  { left: "33%", top: "48%", size: 4, delay: "2.8s" },
  { left: "68%", top: "52%", size: 4, delay: "1.4s" },
];

export default function CampVionLandingPage() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(SERVICE_NODES[0].id);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>(PREVIEW_VIEWS[0].id);
  const [showTechSpecs, setShowTechSpecs] = useState(false);

  // Subtle 3D mouse parallax state for the Hero Intelligence Core
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  const selectedNode =
    SERVICE_NODES.find((n) => n.id === selectedNodeId) || SERVICE_NODES[0];
  const selectedPreview =
    PREVIEW_VIEWS.find((p) => p.id === selectedPreviewId) || PREVIEW_VIEWS[0];

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const rect = stageRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-ny * 10).toFixed(2)),
      ry: Number((nx * 12).toFixed(2)),
    });
  };

  const handleStageMouseLeave = () => {
    setTilt({ rx: 0, ry: 0 });
  };

  const handleNodeKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = SERVICE_NODES[(index + 1) % SERVICE_NODES.length];
      setSelectedNodeId(next.id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev =
        SERVICE_NODES[(index - 1 + SERVICE_NODES.length) % SERVICE_NODES.length];
      setSelectedNodeId(prev.id);
    }
  };

  return (
    <div className="min-h-screen bg-cv-canvas text-cv-fg flex flex-col selection:bg-cv-accent selection:text-cv-on-accent">
      {/* =====================================================================
          TOP NAVIGATION BAR
         ===================================================================== */}
      <header className="sticky top-0 z-50 border-b border-cv-line bg-cv-surface/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Official CampVion Emblem + Brand Name */}
          <Link href="/" className="flex items-center space-x-3 group shrink-0">
            <div className="h-10 w-10 rounded-xl campvion-emblem-surface p-1.5 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/brand/campvion-symbol.png"
                alt="CampVion Official Emblem"
                width={28}
                height={28}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-extrabold tracking-tight text-cv-fg">
                CampVion
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-cv-accent-soft text-cv-accent-ink border border-cv-accent-soft-line">
                AI
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center space-x-1 lg:space-x-2"
          >
            <a
              href="#platform"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-cv-fg-2 hover:text-cv-fg hover:bg-cv-inset transition"
            >
              Platform
            </a>
            <a
              href="#capabilities"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-cv-fg-2 hover:text-cv-fg hover:bg-cv-inset transition"
            >
              Capabilities
            </a>
            <a
              href="#how-it-works"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-cv-fg-2 hover:text-cv-fg hover:bg-cv-inset transition"
            >
              How It Works
            </a>
            <a
              href="#preview"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-cv-fg-2 hover:text-cv-fg hover:bg-cv-inset transition"
            >
              Preview
            </a>
            <a
              href="#security"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-cv-fg-2 hover:text-cv-fg hover:bg-cv-inset transition"
            >
              Security
            </a>
          </nav>

          {/* Right Actions: Theme Switcher + Auth Actions */}
          <div className="hidden md:flex items-center space-x-3">
            <div
              className="flex items-center p-0.5 rounded-lg bg-cv-inset border border-cv-line"
              role="group"
              aria-label="Theme Switcher"
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                title="Light Mode"
                className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                  theme === "light"
                    ? "bg-cv-accent text-cv-on-accent font-semibold"
                    : "text-cv-fg-2 hover:text-cv-fg"
                }`}
                aria-label="Light mode"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                title="Dark Mode"
                className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                  theme === "dark"
                    ? "bg-cv-accent text-cv-on-accent font-semibold"
                    : "text-cv-fg-2 hover:text-cv-fg"
                }`}
                aria-label="Dark mode"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                title="System Theme"
                className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                  theme === "system"
                    ? "bg-cv-accent text-cv-on-accent font-semibold"
                    : "text-cv-fg-2 hover:text-cv-fg"
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
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shadow-xs transition"
                >
                  <span>Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-cv-inset hover:bg-cv-raised text-cv-fg-2 hover:text-cv-fg border border-cv-line transition cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5">
                <Link
                  href="/login"
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-cv-fg hover:bg-cv-inset border border-cv-line transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shadow-xs transition"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg bg-cv-inset border border-cv-line text-cv-fg"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg bg-cv-inset border border-cv-line text-cv-fg"
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

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-cv-line bg-cv-surface px-4 pt-3 pb-5 space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              <a
                href="#platform"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-cv-fg hover:bg-cv-inset"
              >
                Platform
              </a>
              <a
                href="#capabilities"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-cv-fg hover:bg-cv-inset"
              >
                Capabilities
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-cv-fg hover:bg-cv-inset"
              >
                How It Works
              </a>
              <a
                href="#preview"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-cv-fg hover:bg-cv-inset"
              >
                Preview
              </a>
              <a
                href="#security"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-cv-fg hover:bg-cv-inset"
              >
                Security
              </a>
            </div>

            <div className="pt-2 border-t border-cv-line flex flex-col gap-2">
              {user ? (
                <Link
                  href="/app"
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-center bg-cv-accent text-cv-on-accent"
                >
                  Open Workspace ({user.full_name})
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-center bg-cv-accent text-cv-on-accent"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/login"
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center bg-cv-inset text-cv-fg border border-cv-line"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* ===================================================================
            SECTION 1 — CINEMATIC 3D HERO + LARGE CAMPVION INTELLIGENCE CORE
           =================================================================== */}
        <section
          id="platform"
          className="relative overflow-hidden border-b border-cv-line pt-10 pb-16 lg:pt-16 lg:pb-24"
        >
          {/* Ambient Lighting Backdrop */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 72% 45%, var(--cv-accent-glow) 0%, transparent 48%)",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
              {/* Left Column: Minimal, High-Impact Hero Copy */}
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cv-accent-soft border border-cv-accent-soft-line">
                  <span className="h-2 w-2 rounded-full bg-cv-accent-ink animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-cv-accent-ink">
                    INTELLIGENT CAMPUS OPERATIONS
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-cv-fg leading-[1.04]">
                  ONE PLATFORM.
                  <span className="block mt-1 underline decoration-cv-accent decoration-4 underline-offset-8">
                    ALL CAMPUS SERVICES.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-cv-fg-2 leading-relaxed max-w-md">
                  Your university services, connected through intelligent
                  automation.
                </p>

                {/* Primary & Secondary CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link
                    href={user ? "/app" : "/signup"}
                    className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shadow-sm transition"
                  >
                    <span>{user ? "Open Workspace" : "Get Started"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <a
                    href="#capabilities"
                    className="inline-flex items-center space-x-2 px-5 py-3.5 rounded-xl text-sm font-semibold bg-cv-surface hover:bg-cv-raised text-cv-fg border border-cv-line-strong transition"
                  >
                    <span>Explore Platform</span>
                    <ChevronRight className="h-4 w-4 text-cv-fg-3" />
                  </a>
                </div>

                {!user && (
                  <div className="pt-1 flex items-center space-x-2 text-xs text-cv-fg-2">
                    <span>Already registered?</span>
                    <Link
                      href="/login"
                      className="font-bold text-cv-accent-ink hover:underline"
                    >
                      Sign In &rarr;
                    </Link>
                  </div>
                )}

                {/* Minimal Visual Trust Pills */}
                <div className="pt-6 border-t border-cv-line flex flex-wrap items-center gap-2.5">
                  <span className="px-3 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-xs font-semibold text-cv-fg">
                    6 Campus Domains
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-xs font-semibold text-cv-fg">
                    Policy-Verified
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-xs font-semibold text-cv-fg">
                    Human-Governed
                  </span>
                </div>
              </div>

              {/* Right Column: Cinematic 3D CampVion Intelligence Core */}
              <div className="lg:col-span-7 cv-perspective-stage">
                <div
                  ref={stageRef}
                  onMouseMove={handleStageMouseMove}
                  onMouseLeave={handleStageMouseLeave}
                  style={{
                    transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                    transition: "transform 180ms ease-out",
                  }}
                  className="cv-emblem-stage cv-preserve-3d rounded-3xl p-4 sm:p-6 relative overflow-hidden text-[#F5F5F5]"
                >
                  {/* Top Stage Status Bar */}
                  <div className="relative z-20 flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center space-x-2">
                      <span className="h-2 w-2 rounded-full bg-[#EFFF00] shadow-[0_0_8px_#EFFF00]" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">
                        CampVion 3D Intelligence Core
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#EFFF00]">
                      {selectedNode.tag}
                    </span>
                  </div>

                  {/* =========================================================
                      DESKTOP / TABLET 3D ORBITAL STAGE (sm and up)
                     ========================================================= */}
                  <div className="hidden sm:block relative h-[440px] lg:h-[470px] w-full select-none">
                    {/* Ambient Depth Particles */}
                    {PARTICLES.map((p, idx) => (
                      <span
                        key={idx}
                        style={{
                          left: p.left,
                          top: p.top,
                          width: p.size,
                          height: p.size,
                          animationDelay: p.delay,
                        }}
                        className="cv-animate-particle pointer-events-none absolute rounded-full bg-[#EFFF00]/60 shadow-[0_0_10px_#EFFF00]"
                      />
                    ))}

                    {/* 3D Tilted Orbital Rings */}
                    <div
                      style={{ left: "50%", top: "50%" }}
                      className="cv-animate-ring pointer-events-none absolute w-[270px] h-[270px] lg:w-[300px] lg:h-[300px] rounded-full border border-white/15"
                    />
                    <div
                      style={{ left: "50%", top: "50%" }}
                      className="cv-animate-ring-reverse pointer-events-none absolute w-[390px] h-[390px] lg:w-[430px] lg:h-[430px] rounded-full border border-dashed border-[#EFFF00]/25"
                    />

                    {/* SVG Dynamic Connection Beams */}
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    >
                      {SERVICE_NODES.map((node) => {
                        const isSelected = node.id === selectedNode.id;
                        return (
                          <g key={node.id}>
                            <line
                              x1="50"
                              y1="50"
                              x2={node.x}
                              y2={node.y}
                              stroke={
                                isSelected
                                  ? "#EFFF00"
                                  : "rgba(255, 255, 255, 0.16)"
                              }
                              strokeWidth={isSelected ? "0.75" : "0.35"}
                            />
                            {isSelected && (
                              <line
                                x1="50"
                                y1="50"
                                x2={node.x}
                                y2={node.y}
                                stroke="#EFFF00"
                                strokeWidth="1.2"
                                className="cv-animate-beam"
                              />
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    {/* LARGE CENTRAL OFFICIAL WHITE CAMPVION EMBLEM */}
                    <div
                      style={{ left: "50%", top: "50%" }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                    >
                      <div className="cv-animate-core relative flex items-center justify-center">
                        {/* Outer Neon & White Rim Halo */}
                        <div className="pointer-events-none absolute -inset-5 rounded-[36px] bg-[#EFFF00]/12 blur-xl" />
                        <div className="pointer-events-none absolute -inset-2.5 rounded-[32px] border border-white/20 bg-white/[0.03]" />

                        {/* Pure White Emblem Medallion Preserving Exact Artwork */}
                        <div className="cv-hero-emblem-core h-32 w-32 lg:h-36 lg:w-36 rounded-[28px] p-4 flex items-center justify-center relative">
                          <Image
                            src="/brand/campvion-symbol.png"
                            alt="CampVion Official Emblem"
                            width={112}
                            height={112}
                            priority
                            className="h-full w-full object-contain select-none"
                          />
                        </div>
                      </div>
                      <span className="mt-3 px-3 py-1 rounded-full bg-[#121218]/90 border border-white/20 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-lg">
                        CampVion Core
                      </span>
                    </div>

                    {/* 6 Floating Interactive 3D Campus Service Nodes */}
                    {SERVICE_NODES.map((node, index) => {
                      const IconComponent = node.icon;
                      const isSelected = node.id === selectedNode.id;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          onMouseEnter={() => setSelectedNodeId(node.id)}
                          onFocus={() => setSelectedNodeId(node.id)}
                          onKeyDown={(e) => handleNodeKeyDown(e, index)}
                          aria-pressed={isSelected}
                          style={{
                            left: `${node.x}%`,
                            top: `${node.y}%`,
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-30 focus:outline-none group cursor-pointer"
                        >
                          <div
                            style={{ animationDelay: node.floatDelay }}
                            className={`cv-animate-node flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl border transition-all duration-200 ${
                              isSelected
                                ? "bg-[#EFFF00] text-[#080808] border-[#EFFF00] shadow-[0_0_28px_rgba(239,255,0,0.45)] scale-105"
                                : "bg-[#12121A]/90 hover:bg-[#191924] text-white border-white/15 hover:border-[#EFFF00]/60 shadow-lg"
                            }`}
                          >
                            <div
                              className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-[#080808]/15 text-[#080808]"
                                  : "bg-white/10 text-[#EFFF00]"
                              }`}
                            >
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div className="text-left pr-1">
                              <span className="block text-xs font-bold leading-tight whitespace-nowrap">
                                {node.label}
                              </span>
                              <span
                                className={`block text-[10px] font-mono leading-tight mt-0.5 ${
                                  isSelected
                                    ? "text-[#080808]/80 font-semibold"
                                    : "text-white/55"
                                }`}
                              >
                                {node.shortLabel}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* =========================================================
                      MOBILE 3D STAGE (< sm) — NON-OVERLAPPING & RESPONSIVE
                     ========================================================= */}
                  <div className="sm:hidden py-6 space-y-6">
                    <div className="relative flex flex-col items-center justify-center py-4">
                      <div className="pointer-events-none absolute w-48 h-48 rounded-full border border-dashed border-[#EFFF00]/30" />
                      <div className="cv-animate-core relative">
                        <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-[#EFFF00]/15 blur-lg" />
                        <div className="cv-hero-emblem-core h-28 w-28 rounded-3xl p-3.5 flex items-center justify-center relative">
                          <Image
                            src="/brand/campvion-symbol.png"
                            alt="CampVion Official Emblem"
                            width={92}
                            height={92}
                            priority
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </div>
                      <span className="mt-3 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-widest text-white">
                        CampVion Core
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {SERVICE_NODES.map((node) => {
                        const IconComponent = node.icon;
                        const isSelected = node.id === selectedNode.id;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => setSelectedNodeId(node.id)}
                            aria-pressed={isSelected}
                            className={`flex items-center space-x-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? "bg-[#EFFF00] text-[#080808] border-[#EFFF00] font-bold"
                                : "bg-[#12121A] text-white border-white/15"
                            }`}
                          >
                            <IconComponent
                              className={`h-4 w-4 shrink-0 ${
                                isSelected ? "text-[#080808]" : "text-[#EFFF00]"
                              }`}
                            />
                            <span className="text-xs font-semibold truncate">
                              {node.shortLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive Bottom HUD Readout Bar (Minimal 1-Line Explanation) */}
                  <div className="relative z-20 mt-2 p-3.5 sm:px-4 sm:py-3 rounded-2xl bg-[#0D0D14]/95 border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-[#EFFF00] text-[#080808] text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                        {selectedNode.label}
                      </span>
                      <p className="text-xs text-white/90 truncate">
                        {selectedNode.summary}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-[#EFFF00] shrink-0 flex items-center space-x-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{selectedNode.metric}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 2 — KEY CAPABILITIES (3D TILT CARDS, MINIMAL COPY)
           =================================================================== */}
        <section
          id="capabilities"
          className="py-20 border-b border-cv-line bg-cv-canvas"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cv-accent-soft border border-cv-accent-soft-line">
                  <Sparkles className="h-3.5 w-3.5 text-cv-accent-ink" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-cv-accent-ink">
                    KEY CAPABILITIES
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-cv-fg">
                  Built for intelligent campus execution.
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-cv-fg-2 max-w-xs">
                Six core systems working together inside one unified platform.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {CAPABILITIES.map((cap) => {
                const IconComponent = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="cv-card-3d p-6 rounded-2xl bg-cv-surface border border-cv-line flex flex-col justify-between space-y-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-11 w-11 rounded-xl bg-cv-accent-soft border border-cv-accent-soft-line flex items-center justify-center text-cv-accent-ink">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-cv-inset border border-cv-line text-[10px] font-mono font-bold uppercase tracking-wider text-cv-fg-2">
                        {cap.tag}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-cv-fg">
                        {cap.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-cv-fg-2 leading-relaxed">
                        {cap.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 3 — HOW CAMPVION WORKS (VISUAL PIPELINE + EXPANDABLE SPECS)
           =================================================================== */}
        <section
          id="how-it-works"
          className="py-20 border-b border-cv-line bg-cv-surface/40"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cv-accent-soft border border-cv-accent-soft-line">
                <Workflow className="h-3.5 w-3.5 text-cv-accent-ink" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-cv-accent-ink">
                  HOW CAMPVION WORKS
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-cv-fg">
                From plain-language request to verified resolution.
              </h2>
            </div>

            {/* 6-Step Visual Flow */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {WORKFLOW_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="cv-card-3d p-4 rounded-2xl bg-cv-surface border border-cv-line flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-cv-accent text-cv-on-accent text-[11px] font-extrabold font-mono">
                      {item.step}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-cv-fg-3" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-cv-fg">
                      {item.title}
                    </h3>
                    <p className="text-xs text-cv-fg-2 mt-0.5">
                      {item.caption}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progressive Disclosure: Expandable Technical Architecture */}
            <div className="rounded-2xl bg-cv-surface border border-cv-line overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTechSpecs((prev) => !prev)}
                aria-expanded={showTechSpecs}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-cv-inset transition cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <Cpu className="h-4 w-4 text-cv-accent-ink shrink-0" />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-cv-fg block">
                      Under the Hood — 8 Architectural Specifications
                    </span>
                    <span className="text-[11px] text-cv-fg-2">
                      Deterministic DAG planning, SQLite campus tools, policy validation &amp; human governance
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-cv-fg-2 transition-transform duration-200 ${
                    showTechSpecs ? "rotate-180 text-cv-accent-ink" : ""
                  }`}
                />
              </button>

              {showTechSpecs && (
                <div className="p-6 border-t border-cv-line bg-cv-inset grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {TECHNICAL_PILLARS.map((pillar) => {
                    const IconComponent = pillar.icon;
                    return (
                      <div
                        key={pillar.title}
                        className="p-4 rounded-xl bg-cv-surface border border-cv-line space-y-2"
                      >
                        <div className="flex items-center space-x-2 text-cv-accent-ink">
                          <IconComponent className="h-4 w-4 shrink-0" />
                          <h4 className="text-xs font-bold text-cv-fg">
                            {pillar.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-cv-fg-2 leading-relaxed">
                          {pillar.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 4 — INTERACTIVE PRODUCT PREVIEW
           =================================================================== */}
        <section
          id="preview"
          className="py-20 border-b border-cv-line bg-cv-canvas"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cv-accent-soft border border-cv-accent-soft-line">
                  <Layers className="h-3.5 w-3.5 text-cv-accent-ink" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-cv-accent-ink">
                    PRODUCT PREVIEW
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-cv-fg">
                  Inside the CampVion Workspace.
                </h2>
              </div>

              <Link
                href={user ? "/app" : "/login"}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shrink-0 self-start lg:self-auto transition"
              >
                <span>{user ? "Launch Workspace" : "Sign In to Workspace"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Interactive View Switcher */}
            <div className="flex flex-wrap gap-2">
              {PREVIEW_VIEWS.map((tab) => {
                const active = tab.id === selectedPreview.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedPreviewId(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      active
                        ? "bg-cv-accent text-cv-on-accent border-cv-accent shadow-xs"
                        : "bg-cv-surface hover:bg-cv-raised text-cv-fg-2 hover:text-cv-fg border-cv-line"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Compact Interactive Console Showcase */}
            <div className="rounded-2xl bg-cv-surface border border-cv-line-strong overflow-hidden shadow-lg">
              <div className="px-5 py-3.5 bg-cv-inset border-b border-cv-line flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="h-7 w-7 rounded-lg campvion-emblem-surface p-1 flex items-center justify-center">
                    <Image
                      src="/brand/campvion-symbol.png"
                      alt="CampVion Emblem"
                      width={20}
                      height={20}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <span className="text-xs font-bold text-cv-fg">
                    {selectedPreview.label}
                  </span>
                  <span className="text-[11px] text-cv-fg-3 hidden sm:inline">
                    &bull; {selectedPreview.headline}
                  </span>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-cv-accent-soft border border-cv-accent-soft-line text-[10px] font-bold text-cv-accent-ink">
                  {selectedPreview.status}
                </span>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                <div className="lg:col-span-4 p-4 rounded-xl bg-cv-inset border border-cv-line space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cv-accent-ink block">
                    {selectedPreview.badge}
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-cv-fg leading-relaxed">
                    &ldquo;{selectedPreview.prompt}&rdquo;
                  </p>
                </div>

                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectedPreview.steps.map((step) => (
                    <div
                      key={step.label}
                      className="p-3.5 rounded-xl bg-cv-inset border border-cv-line flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-cv-fg truncate">
                          {step.label}
                        </span>
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            step.state === "pass"
                              ? "bg-cv-success-solid"
                              : step.state === "gate"
                              ? "bg-cv-warning-solid"
                              : "bg-cv-accent-ink"
                          }`}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-cv-fg-2 leading-snug">
                        {step.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 5 — TRUST & SECURITY (COMPACT 4-CARD MATRIX)
           =================================================================== */}
        <section
          id="security"
          className="py-20 border-b border-cv-line bg-cv-surface/40"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cv-accent-soft border border-cv-accent-soft-line">
                <ShieldCheck className="h-3.5 w-3.5 text-cv-accent-ink" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-cv-accent-ink">
                  TRUST &amp; SECURITY
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-cv-fg">
                Protected access. Governed decisions.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {SECURITY_CARDS.map((card) => {
                const IconComponent = card.icon;
                return (
                  <div
                    key={card.title}
                    className="cv-card-3d p-5 rounded-2xl bg-cv-surface border border-cv-line space-y-3"
                  >
                    <div className="h-10 w-10 rounded-xl bg-cv-accent-soft border border-cv-accent-soft-line flex items-center justify-center text-cv-accent-ink">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-cv-fg">
                      {card.title}
                    </h3>
                    <p className="text-xs text-cv-fg-2 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 6 — FINAL CALL TO ACTION (LARGE OFFICIAL EMBLEM CENTERPIECE)
           =================================================================== */}
        <section
          id="about"
          className="py-20 border-b border-cv-line bg-cv-canvas"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="cv-emblem-stage rounded-3xl p-8 sm:p-12 text-center space-y-6 relative overflow-hidden">
              {/* Large Official White CampVion Emblem Centerpiece */}
              <div className="relative inline-flex items-center justify-center mx-auto">
                <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-[#EFFF00]/15 blur-lg" />
                <div className="cv-hero-emblem-core h-20 w-20 sm:h-24 sm:w-24 rounded-2xl p-3 flex items-center justify-center relative">
                  <Image
                    src="/brand/campvion-symbol.png"
                    alt="CampVion Official Emblem"
                    width={76}
                    height={76}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                MAKE CAMPUS OPERATIONS SIMPLER.
              </h2>

              <p className="text-sm sm:text-base text-white/75 max-w-lg mx-auto">
                Connect requests, workflows, and university services in one
                intelligent platform.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                {user ? (
                  <Link
                    href="/app"
                    className="inline-flex items-center space-x-2 px-7 py-3.5 rounded-xl text-sm font-bold bg-[#EFFF00] hover:bg-[#D7E600] text-[#080808] shadow-sm transition"
                  >
                    <span>Enter Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="inline-flex items-center space-x-2 px-7 py-3.5 rounded-xl text-sm font-bold bg-[#EFFF00] hover:bg-[#D7E600] text-[#080808] shadow-sm transition"
                    >
                      <span>Create Your Account</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/login"
                      className="inline-flex items-center space-x-2 px-7 py-3.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition"
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
          MINIMAL OFFICIAL FOOTER
         ===================================================================== */}
      <footer className="bg-cv-surface text-cv-fg-2 border-t border-cv-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-cv-line">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl campvion-emblem-surface p-1.5 flex items-center justify-center shrink-0">
                <Image
                  src="/brand/campvion-symbol.png"
                  alt="CampVion Official Emblem"
                  width={26}
                  height={26}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <span className="text-sm font-bold text-cv-fg block">
                  CampVion
                </span>
                <span className="text-xs text-cv-fg-3">
                  Intelligent Campus Operations Platform
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium">
              <a href="#platform" className="hover:text-cv-fg transition">
                Platform
              </a>
              <a href="#capabilities" className="hover:text-cv-fg transition">
                Capabilities
              </a>
              <a href="#how-it-works" className="hover:text-cv-fg transition">
                How It Works
              </a>
              <a href="#preview" className="hover:text-cv-fg transition">
                Preview
              </a>
              <a href="#security" className="hover:text-cv-fg transition">
                Security
              </a>
              <Link href="/login" className="hover:text-cv-fg transition">
                Sign In
              </Link>
              <Link href="/signup" className="hover:text-cv-fg transition">
                Get Started
              </Link>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-cv-fg-3">
            <span>
              &copy; {new Date().getFullYear()} CampVion. All rights reserved.
            </span>
            <div className="flex items-center space-x-4">
              <Link href="/privacy" className="hover:text-cv-fg transition">
                Privacy Policy
              </Link>
              <span>&bull;</span>
              <Link href="/terms" className="hover:text-cv-fg transition">
                Terms of Service
              </Link>
              <span>&bull;</span>
              <Link
                href="/forgot-password"
                className="hover:text-cv-fg transition"
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
