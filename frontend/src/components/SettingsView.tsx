"use client";

import React, { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  Accessibility,
  Check,
  CheckCircle2,
  ExternalLink,
  Info,
  Laptop,
  Moon,
  Palette,
  RefreshCw,
  Shield,
  Sliders,
  Sun,
  Zap,
} from "lucide-react";
import { HealthResponse } from "../types/api";
import { useTheme } from "../context/ThemeContext";

const ENTER_STORAGE_KEY = "campvion_enter_to_send";
const EVENT_ENTER_CHANGE = "campvion_enter_change";

function subscribeEnterToSend(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_ENTER_CHANGE, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT_ENTER_CHANGE, callback);
  };
}

function getEnterToSendSnapshot(): boolean {
  try {
    const saved = localStorage.getItem(ENTER_STORAGE_KEY);
    return saved === "true";
  } catch {
    return false;
  }
}

function getEnterToSendServerSnapshot(): boolean {
  return false;
}

function subscribeSystemDark(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => {
    mq.removeEventListener("change", callback);
  };
}

function getSystemDarkSnapshot(): boolean {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

function getSystemDarkServerSnapshot(): boolean {
  return false;
}

interface SettingsViewProps {
  health: HealthResponse | null;
  selectedStudentId: string;
  onSelectStudentId: (id: string) => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  apiBaseUrl?: string;
}

type SettingsTab = "appearance" | "general" | "accessibility" | "about";

export function SettingsView({
  health,
  selectedStudentId,
  onSelectStudentId,
  inspectorOpen,
  onToggleInspector,
  apiBaseUrl = "http://127.0.0.1:8000",
}: SettingsViewProps) {
  const {
    theme,
    resolvedTheme,
    setTheme,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    experienceMode,
    setExperienceMode,
  } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  const enterToSend = useSyncExternalStore(
    subscribeEnterToSend,
    getEnterToSendSnapshot,
    getEnterToSendServerSnapshot
  );

  const systemIsDark = useSyncExternalStore(
    subscribeSystemDark,
    getSystemDarkSnapshot,
    getSystemDarkServerSnapshot
  );

  const handleToggleEnterToSend = (enabled: boolean) => {
    try {
      localStorage.setItem(ENTER_STORAGE_KEY, String(enabled));
      window.dispatchEvent(new Event(EVENT_ENTER_CHANGE));
    } catch {
      // safe fallback
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
    { id: "general", label: "General", icon: <Sliders className="h-4 w-4" /> },
    { id: "accessibility", label: "Accessibility", icon: <Accessibility className="h-4 w-4" /> },
    { id: "about", label: "About CampVion", icon: <Info className="h-4 w-4" /> },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Page Heading */}
      <div className="pb-4 border-b border-cv-line">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-cv-fg">Settings</h1>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              Manage your CampVion experience, interface appearance, and platform preferences.
            </p>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center space-x-1.5 mt-6 border-b border-cv-line overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-lg text-xs font-medium transition cursor-pointer border-b-2 whitespace-nowrap ${
                  isActive
                    ? "border-cv-accent-line text-cv-accent-ink bg-cv-surface font-semibold"
                    : "border-transparent text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: APPEARANCE (PRIMARY FUNCTIONAL REQUIREMENT) */}
      {/* ==================================================================== */}
      {activeTab === "appearance" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-cv-fg">Interface Theme</h2>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              Select your preferred visual atmosphere. The change applies dynamically across all
              surfaces, navigation, and workspace tools.
            </p>
          </div>

          {/* 3 Selectable Theme Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="radiogroup" aria-label="Theme selection">
            {/* Card 1: Light Mode */}
            <div
              role="radio"
              tabIndex={0}
              aria-checked={theme === "light"}
              onClick={() => setTheme("light")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setTheme("light")}
              className={`relative rounded-xl border p-4 cursor-pointer transition text-left flex flex-col justify-between ${
                theme === "light"
                  ? "bg-cv-surface border-cv-accent-line ring-2 ring-cv-accent-line/20 shadow-xs"
                  : "bg-cv-surface border-cv-line hover:border-cv-accent-line/50 hover:bg-cv-inset"
              }`}
            >
              <div>
                {/* Visual Preview Illustration: Light Mode */}
                <div className="w-full h-28 rounded-lg bg-[#FFFFFF] border border-[#E5E5E5] p-2 flex flex-col justify-between overflow-hidden relative shadow-inner mb-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E5E5E5]">
                    <div className="flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-[#EFFF00] ring-1 ring-[#8A9300]/40" />
                      <span className="h-1.5 w-10 rounded bg-[#111111]/30" />
                    </div>
                    <span className="h-1.5 w-6 rounded bg-[#15803D]/40" />
                  </div>
                  <div className="space-y-1.5 py-1">
                    <div className="h-4 w-3/4 rounded bg-[#FFFFFF] border border-[#E5E5E5] shadow-2xs" />
                    <div className="h-3 w-1/2 rounded bg-[#F5F5F0]" />
                  </div>
                  <div className="h-5 w-full rounded bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-between px-1.5">
                    <span className="h-1.5 w-12 rounded bg-[#666666]/40" />
                    <span className="h-3 w-8 rounded bg-[#EFFF00]" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sun className="h-4 w-4 text-cv-accent-ink" />
                    <span className="text-sm font-semibold text-cv-fg">Light</span>
                  </div>
                  {theme === "light" && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
                      <Check className="h-3 w-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-cv-fg-2 mt-1">
                  A crisp, bright workspace in pure white with neon-yellow highlights.
                </p>
              </div>

              {/* Palette tokens preview */}
              <div className="mt-4 pt-3 border-t border-cv-line flex items-center space-x-1.5">
                <span title="#FFFFFF (Canvas)" className="h-4 w-4 rounded-full bg-[#FFFFFF] border border-[#D4D4D4]" />
                <span title="#F5F5F0 (Surface)" className="h-4 w-4 rounded-full bg-[#F5F5F0] border border-[#D4D4D4]" />
                <span title="#EFFF00 (Neon Yellow)" className="h-4 w-4 rounded-full bg-[#EFFF00] border border-[#8A9300]/40" />
                <span title="#111111 (Ink)" className="h-4 w-4 rounded-full bg-[#111111]" />
                <span className="text-[10px] text-cv-fg-2 ml-1 font-mono">Pure White</span>
              </div>
            </div>

            {/* Card 2: Dark Mode */}
            <div
              role="radio"
              tabIndex={0}
              aria-checked={theme === "dark"}
              onClick={() => setTheme("dark")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setTheme("dark")}
              className={`relative rounded-xl border p-4 cursor-pointer transition text-left flex flex-col justify-between ${
                theme === "dark"
                  ? "bg-cv-surface border-cv-accent-line ring-2 ring-cv-accent-line/20 shadow-xs"
                  : "bg-cv-surface border-cv-line hover:border-cv-accent-line/50 hover:bg-cv-inset"
              }`}
            >
              <div>
                {/* Visual Preview Illustration: Dark Mode */}
                <div className="w-full h-28 rounded-lg bg-[#050505] border border-[#262626] p-2 flex flex-col justify-between overflow-hidden relative shadow-inner mb-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#262626]">
                    <div className="flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-[#EFFF00] shadow-[0_0_6px_rgba(239,255,0,0.6)]" />
                      <span className="h-1.5 w-10 rounded bg-[#F5F5F5]/30" />
                    </div>
                    <span className="h-1.5 w-6 rounded bg-[#3FB950]/40" />
                  </div>
                  <div className="space-y-1.5 py-1">
                    <div className="h-4 w-3/4 rounded bg-[#111111] border border-[#262626]" />
                    <div className="h-3 w-1/2 rounded bg-[#171717]" />
                  </div>
                  <div className="h-5 w-full rounded bg-[#111111] border border-[#262626] flex items-center justify-between px-1.5">
                    <span className="h-1.5 w-12 rounded bg-[#A3A3A3]/40" />
                    <span className="h-3 w-8 rounded bg-[#EFFF00]" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Moon className="h-4 w-4 text-cv-accent-ink" />
                    <span className="text-sm font-semibold text-cv-fg">Dark</span>
                  </div>
                  {theme === "dark" && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
                      <Check className="h-3 w-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-cv-fg-2 mt-1">
                  A focused, low-light workspace in pitch black with neon-yellow highlights.
                </p>
              </div>

              {/* Palette tokens preview */}
              <div className="mt-4 pt-3 border-t border-cv-line flex items-center space-x-1.5">
                <span title="#050505 (Canvas)" className="h-4 w-4 rounded-full bg-[#050505] border border-[#333333]" />
                <span title="#111111 (Surface)" className="h-4 w-4 rounded-full bg-[#111111] border border-[#333333]" />
                <span title="#EFFF00 (Neon Yellow)" className="h-4 w-4 rounded-full bg-[#EFFF00]" />
                <span title="#F5F5F5 (Text)" className="h-4 w-4 rounded-full bg-[#F5F5F5] border border-[#D4D4D4]" />
                <span className="text-[10px] text-cv-fg-2 ml-1 font-mono">Pitch Black</span>
              </div>
            </div>

            {/* Card 3: System Default */}
            <div
              role="radio"
              tabIndex={0}
              aria-checked={theme === "system"}
              onClick={() => setTheme("system")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setTheme("system")}
              className={`relative rounded-xl border p-4 cursor-pointer transition text-left flex flex-col justify-between ${
                theme === "system"
                  ? "bg-cv-surface border-cv-accent-line ring-2 ring-cv-accent-line/20 shadow-xs"
                  : "bg-cv-surface border-cv-line hover:border-cv-accent-line/50 hover:bg-cv-inset"
              }`}
            >
              <div>
                {/* Visual Preview Illustration: Split System Mode */}
                <div className="w-full h-28 rounded-lg border border-cv-line flex overflow-hidden relative shadow-inner mb-3">
                  {/* Left half: Light */}
                  <div className="w-1/2 h-full bg-[#FFFFFF] p-2 flex flex-col justify-between border-r border-[#E5E5E5]">
                    <span className="h-2 w-2 rounded-full bg-[#EFFF00] ring-1 ring-[#8A9300]/40" />
                    <div className="h-3 w-full rounded bg-[#FAFAFA] border border-[#E5E5E5]" />
                    <div className="h-4 w-full rounded bg-[#FAFAFA] border border-[#E5E5E5]" />
                  </div>
                  {/* Right half: Dark */}
                  <div className="w-1/2 h-full bg-[#050505] p-2 flex flex-col justify-between">
                    <span className="h-2 w-2 rounded-full bg-[#EFFF00] ml-auto" />
                    <div className="h-3 w-full rounded bg-[#111111] border border-[#262626]" />
                    <div className="h-4 w-full rounded bg-[#111111] border border-[#262626]" />
                  </div>
                  {/* Center auto sync badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="p-1 rounded-full bg-cv-surface border border-cv-line shadow-sm">
                      <Laptop className="h-3 w-3 text-cv-accent-ink" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Laptop className="h-4 w-4 text-cv-accent-ink" />
                    <span className="text-sm font-semibold text-cv-fg">System</span>
                  </div>
                  {theme === "system" && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
                      <Check className="h-3 w-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-cv-fg-2 mt-1">
                  Automatically match your device appearance preference in real time.
                </p>
              </div>

              {/* Detected System Status */}
              <div className="mt-4 pt-3 border-t border-cv-line flex items-center justify-between">
                <span className="text-[10px] text-cv-fg-2">Detected System:</span>
                <span className="text-[10px] font-mono font-medium text-cv-fg flex items-center space-x-1">
                  {systemIsDark ? (
                    <>
                      <Moon className="h-3 w-3 text-cv-accent-ink" />
                      <span>Dark Theme</span>
                    </>
                  ) : (
                    <>
                      <Sun className="h-3 w-3 text-cv-accent-ink" />
                      <span>Light Theme</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Theme Specification Ledger */}
          <div className="bg-cv-surface border border-cv-line rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-cv-line">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-cv-accent-ink" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cv-fg">
                  Active Design System State
                </h3>
              </div>
              <span className="text-[11px] font-mono text-cv-fg-2">
                Synchronized &bull; Zero Reload Required
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
              <div>
                <span className="text-[10px] text-cv-fg-2 uppercase font-mono block">Active Mode</span>
                <span className="text-xs font-semibold text-cv-fg mt-0.5 block capitalize">
                  {resolvedTheme} Mode
                </span>
              </div>
              <div>
                <span className="text-[10px] text-cv-fg-2 uppercase font-mono block">Selection Source</span>
                <span className="text-xs font-semibold text-cv-fg mt-0.5 block">
                  {theme === "system" ? "Device OS Sync" : "User Explicit"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-cv-fg-2 uppercase font-mono block">Brand Accent</span>
                <span className="text-xs font-mono font-semibold text-cv-accent-ink mt-0.5 block">
                  #EFFF00
                </span>
              </div>
              <div>
                <span className="text-[10px] text-cv-fg-2 uppercase font-mono block">Base Canvas</span>
                <span className="text-xs font-mono font-semibold text-cv-fg mt-0.5 block">
                  {resolvedTheme === "dark" ? "#050505" : "#FFFFFF"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2: GENERAL WORKSPACE SETTINGS */}
      {/* ==================================================================== */}
      {activeTab === "general" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-cv-fg">General Preferences</h2>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              Configure default demo student contexts, composer behavior, and inspector panels.
            </p>
          </div>

          <div className="bg-cv-surface border border-cv-line rounded-xl divide-y divide-cv-line shadow-xs">
            {/* Experience Mode (Information Presentation) */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-cv-fg block">
                  Information Presentation Mode
                </span>
                <span className="text-xs text-cv-fg-2 block mt-0.5">
                  Choose between student-friendly language and advanced developer diagnostics.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setExperienceMode("simple")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    experienceMode === "simple"
                      ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink font-semibold"
                      : "bg-cv-inset border-cv-line text-cv-fg-2 hover:bg-cv-raised"
                  }`}
                >
                  Simple View (Students)
                </button>
                <button
                  type="button"
                  onClick={() => setExperienceMode("advanced")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    experienceMode === "advanced"
                      ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink font-semibold"
                      : "bg-cv-inset border-cv-line text-cv-fg-2 hover:bg-cv-raised"
                  }`}
                >
                  Advanced View (Developers)
                </button>
              </div>
            </div>

            {/* Student Context Preference */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-cv-fg block">
                  Default Demo Student Context
                </span>
                <span className="text-xs text-cv-fg-2 block mt-0.5">
                  Pre-selects student profile when launching new natural language requests.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectStudentId("S001")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    selectedStudentId === "S001"
                      ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink font-semibold"
                      : "bg-cv-inset border-cv-line text-cv-fg-2 hover:bg-cv-raised"
                  }`}
                >
                  Alice Sharma (S001 &bull; 75%)
                </button>
                <button
                  type="button"
                  onClick={() => onSelectStudentId("S002")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    selectedStudentId === "S002"
                      ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink font-semibold"
                      : "bg-cv-inset border-cv-line text-cv-fg-2 hover:bg-cv-raised"
                  }`}
                >
                  Bob Verma (S002 &bull; 50%)
                </button>
              </div>
            </div>

            {/* Request Details Visibility */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-cv-fg block">
                  Request Details Section
                </span>
                <span className="text-xs text-cv-fg-2 block mt-0.5">
                  Show detailed step metrics, progress indicators, and activity shortcuts in the sidebar.
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleInspector}
                role="switch"
                aria-checked={inspectorOpen}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  inspectorOpen ? "bg-cv-accent" : "bg-cv-line-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                    inspectorOpen ? "translate-x-5 bg-cv-on-accent" : "translate-x-0 bg-white"
                  }`}
                />
              </button>
            </div>

            {/* Keyboard Send Behavior */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-cv-fg block">
                  Quick Dispatch Shortcut
                </span>
                <span className="text-xs text-cv-fg-2 block mt-0.5">
                  {enterToSend
                    ? "Pressing Enter immediately dispatches goals (Shift+Enter for newline)."
                    : "Pressing Ctrl+Enter dispatches goals (Enter inserts a regular newline)."}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleToggleEnterToSend(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    !enterToSend
                      ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink font-semibold"
                      : "bg-cv-inset border-cv-line text-cv-fg-2"
                  }`}
                >
                  Ctrl+Enter (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleEnterToSend(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    enterToSend
                      ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink font-semibold"
                      : "bg-cv-inset border-cv-line text-cv-fg-2"
                  }`}
                >
                  Enter to Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 3: ACCESSIBILITY SETTINGS */}
      {/* ==================================================================== */}
      {activeTab === "accessibility" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-cv-fg">Accessibility Preferences</h2>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              Customize motion, animations, and surface contrast settings for comfort and readability.
            </p>
          </div>

          <div className="bg-cv-surface border border-cv-line rounded-xl divide-y divide-cv-line shadow-xs">
            {/* Reduced Motion Toggle */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-cv-fg">
                    Reduced Motion
                  </span>
                  {reducedMotion && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cv-accent-soft text-cv-accent-ink">
                      Enabled
                    </span>
                  )}
                </div>
                <span className="text-xs text-cv-fg-2 block">
                  Disables background transitions, spin animations, and pulsing indicator effects across all views.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReducedMotion(!reducedMotion)}
                role="switch"
                aria-checked={reducedMotion}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  reducedMotion ? "bg-cv-accent" : "bg-cv-line-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                    reducedMotion ? "translate-x-5 bg-cv-on-accent" : "translate-x-0 bg-white"
                  }`}
                />
              </button>
            </div>

            {/* High Contrast Toggle */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-cv-fg">
                    Enhanced Contrast Surface Borders
                  </span>
                  {highContrast && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cv-accent-soft text-cv-accent-ink">
                      Enabled
                    </span>
                  )}
                </div>
                <span className="text-xs text-cv-fg-2 block">
                  Increases border opacity and division line contrast between workspace surfaces, cards, and panels.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHighContrast(!highContrast)}
                role="switch"
                aria-checked={highContrast}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  highContrast ? "bg-cv-accent" : "bg-cv-line-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                    highContrast ? "translate-x-5 bg-cv-on-accent" : "translate-x-0 bg-white"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 4: ABOUT CAMPVION */}
      {/* ==================================================================== */}
      {activeTab === "about" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-cv-fg">About CampVion</h2>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              Intelligent Campus Operations &bull; Autonomous Agentic AI Assistant for Multi-Step Campus Service Workflows
            </p>
          </div>

          <div className="bg-cv-surface border border-cv-line rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center space-x-3 pb-4 border-b border-cv-line">
              <div className="h-12 w-12 rounded-xl campvion-emblem-surface p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                <Image
                  src="/brand/campvion-symbol.png"
                  alt="CampVion Logo"
                  width={36}
                  height={36}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-cv-fg">CampVion Enterprise</h3>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-cv-raised text-cv-fg-2">
                    {health?.version ? `v${health.version.replace(/^v/, "")}` : "v0.1.0"}
                  </span>
                </div>
                <p className="text-xs text-cv-fg-2">
                  Autonomous Agentic AI Platform with Deterministic Topological Execution
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-cv-inset border border-cv-line">
                <div className="flex items-center space-x-2 text-cv-fg font-semibold mb-1">
                  <Zap className="h-3.5 w-3.5 text-cv-accent-ink" />
                  <span>Planning Architecture</span>
                </div>
                <p className="text-cv-fg-2">
                  Deterministic Topological DAG with dependency resolution, autonomous tool orchestration, and bounded self-healing retries (Max 3 replans).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-cv-inset border border-cv-line">
                <div className="flex items-center space-x-2 text-cv-fg font-semibold mb-1">
                  <Shield className="h-3.5 w-3.5 text-cv-success" />
                  <span>Human Safety Gate</span>
                </div>
                <p className="text-cv-fg-2">
                  Real-time policy guardrail requiring human confirmation for high-consequence campus service submissions (e.g. Leave Applications).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-cv-inset border border-cv-line">
                <div className="flex items-center space-x-2 text-cv-fg font-semibold mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cv-accent-ink" />
                  <span>Observability &amp; Traces</span>
                </div>
                <p className="text-cv-fg-2">
                  Monotonic SQLite audit ledger capturing every understanding, planning, execution, and replanning step with full JSON payloads.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-cv-inset border border-cv-line">
                <div className="flex items-center space-x-2 text-cv-fg font-semibold mb-1">
                  <RefreshCw className="h-3.5 w-3.5 text-cv-accent-ink" />
                  <span>Backend Connectivity</span>
                </div>
                <p className="text-cv-fg-2">
                  FastAPI service active at <span className="font-mono text-[11px] text-cv-fg">{apiBaseUrl}</span>.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-cv-line flex items-center justify-between">
              <span className="text-[11px] text-cv-fg-2">
                CampVion Operations Console &bull; Production Enterprise SaaS
              </span>
              <a
                href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cv-accent-soft text-cv-accent-ink hover:bg-cv-accent hover:text-cv-on-accent transition cursor-pointer"
              >
                <span>Interactive Swagger API Docs</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
