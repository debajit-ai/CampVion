"use client";

import React, { useState, useEffect } from "react";
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
  } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  const [enterToSend, setEnterToSend] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedEnter = localStorage.getItem("campvion_enter_to_send");
        if (savedEnter !== null) return savedEnter === "true";
      } catch {
        // safe fallback
      }
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleToggleEnterToSend = (enabled: boolean) => {
    setEnterToSend(enabled);
    try {
      localStorage.setItem("campvion_enter_to_send", String(enabled));
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
      <div className="pb-4 border-b border-[#E8E2D9]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43]">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#26231F]">Settings</h1>
            <p className="text-xs text-[#77716A] mt-0.5">
              Manage your CampVion experience, interface appearance, and platform preferences.
            </p>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center space-x-1.5 mt-6 border-b border-[#E8E2D9] overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-lg text-xs font-medium transition cursor-pointer border-b-2 whitespace-nowrap ${
                  isActive
                    ? "border-[#C66A43] text-[#C66A43] bg-[#FFFFFF] font-semibold"
                    : "border-transparent text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5]"
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
            <h2 className="text-sm font-semibold text-[#26231F]">Interface Theme</h2>
            <p className="text-xs text-[#77716A] mt-0.5">
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
                  ? "bg-[#FFFFFF] border-[#C66A43] ring-2 ring-[#C66A43]/20 shadow-xs"
                  : "bg-[#FFFFFF] border-[#E8E2D9] hover:border-[#C66A43]/50 hover:bg-[#FAF7F2]"
              }`}
            >
              <div>
                {/* Visual Preview Illustration: Light Mode */}
                <div className="w-full h-28 rounded-lg bg-[#F5F2EB] border border-[#E8E2D9] p-2 flex flex-col justify-between overflow-hidden relative shadow-inner mb-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E8E2D9]">
                    <div className="flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-[#C66A43]" />
                      <span className="h-1.5 w-10 rounded bg-[#26231F]/30" />
                    </div>
                    <span className="h-1.5 w-6 rounded bg-[#287A53]/40" />
                  </div>
                  <div className="space-y-1.5 py-1">
                    <div className="h-4 w-3/4 rounded bg-[#FFFFFF] border border-[#E8E2D9] shadow-2xs" />
                    <div className="h-3 w-1/2 rounded bg-[#F0ECE5]" />
                  </div>
                  <div className="h-5 w-full rounded bg-[#FFFFFF] border border-[#E8E2D9] flex items-center justify-between px-1.5">
                    <span className="h-1.5 w-12 rounded bg-[#77716A]/40" />
                    <span className="h-3 w-8 rounded bg-[#C66A43]" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sun className="h-4 w-4 text-[#C66A43]" />
                    <span className="text-sm font-semibold text-[#26231F]">Light</span>
                  </div>
                  {theme === "light" && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43]">
                      <Check className="h-3 w-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#77716A] mt-1">
                  A bright, warm, comfortable workspace with soft ivory and graphite.
                </p>
              </div>

              {/* Palette tokens preview */}
              <div className="mt-4 pt-3 border-t border-[#E8E2D9] flex items-center space-x-1.5">
                <span title="#F5F2EB (Canvas)" className="h-4 w-4 rounded-full bg-[#F5F2EB] border border-[#E8E2D9]" />
                <span title="#FFFFFF (Surface)" className="h-4 w-4 rounded-full bg-[#FFFFFF] border border-[#E8E2D9]" />
                <span title="#C66A43 (Burnt Amber)" className="h-4 w-4 rounded-full bg-[#C66A43]" />
                <span title="#26231F (Graphite)" className="h-4 w-4 rounded-full bg-[#26231F]" />
                <span className="text-[10px] text-[#77716A] ml-1 font-mono">Warm Ivory</span>
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
                  ? "bg-[#FFFFFF] border-[#C66A43] ring-2 ring-[#C66A43]/20 shadow-xs"
                  : "bg-[#FFFFFF] border-[#E8E2D9] hover:border-[#C66A43]/50 hover:bg-[#FAF7F2]"
              }`}
            >
              <div>
                {/* Visual Preview Illustration: Dark Mode */}
                <div className="w-full h-28 rounded-lg bg-[#141413] border border-[#37342F] p-2 flex flex-col justify-between overflow-hidden relative shadow-inner mb-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#37342F]">
                    <div className="flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-[#D9825B]" />
                      <span className="h-1.5 w-10 rounded bg-[#F2F0EA]/30" />
                    </div>
                    <span className="h-1.5 w-6 rounded bg-[#34A870]/40" />
                  </div>
                  <div className="space-y-1.5 py-1">
                    <div className="h-4 w-3/4 rounded bg-[#1D1C1A] border border-[#37342F]" />
                    <div className="h-3 w-1/2 rounded bg-[#252421]" />
                  </div>
                  <div className="h-5 w-full rounded bg-[#1D1C1A] border border-[#37342F] flex items-center justify-between px-1.5">
                    <span className="h-1.5 w-12 rounded bg-[#AAA59C]/40" />
                    <span className="h-3 w-8 rounded bg-[#D9825B]" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Moon className="h-4 w-4 text-[#C66A43]" />
                    <span className="text-sm font-semibold text-[#26231F]">Dark</span>
                  </div>
                  {theme === "dark" && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43]">
                      <Check className="h-3 w-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#77716A] mt-1">
                  A refined, low-light workspace with warm charcoal and soft ivory.
                </p>
              </div>

              {/* Palette tokens preview */}
              <div className="mt-4 pt-3 border-t border-[#E8E2D9] flex items-center space-x-1.5">
                <span title="#141413 (Canvas)" className="h-4 w-4 rounded-full bg-[#141413] border border-[#37342F]" />
                <span title="#1D1C1A (Surface)" className="h-4 w-4 rounded-full bg-[#1D1C1A] border border-[#37342F]" />
                <span title="#D9825B (Soft Amber)" className="h-4 w-4 rounded-full bg-[#D9825B]" />
                <span title="#F2F0EA (Soft Ivory)" className="h-4 w-4 rounded-full bg-[#F2F0EA]" />
                <span className="text-[10px] text-[#77716A] ml-1 font-mono">Warm Charcoal</span>
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
                  ? "bg-[#FFFFFF] border-[#C66A43] ring-2 ring-[#C66A43]/20 shadow-xs"
                  : "bg-[#FFFFFF] border-[#E8E2D9] hover:border-[#C66A43]/50 hover:bg-[#FAF7F2]"
              }`}
            >
              <div>
                {/* Visual Preview Illustration: Split System Mode */}
                <div className="w-full h-28 rounded-lg border border-[#E8E2D9] flex overflow-hidden relative shadow-inner mb-3">
                  {/* Left half: Light */}
                  <div className="w-1/2 h-full bg-[#F5F2EB] p-2 flex flex-col justify-between border-r border-[#E8E2D9]">
                    <span className="h-2 w-2 rounded-full bg-[#C66A43]" />
                    <div className="h-3 w-full rounded bg-[#FFFFFF] border border-[#E8E2D9]" />
                    <div className="h-4 w-full rounded bg-[#FFFFFF] border border-[#E8E2D9]" />
                  </div>
                  {/* Right half: Dark */}
                  <div className="w-1/2 h-full bg-[#141413] p-2 flex flex-col justify-between">
                    <span className="h-2 w-2 rounded-full bg-[#D9825B] ml-auto" />
                    <div className="h-3 w-full rounded bg-[#1D1C1A] border border-[#37342F]" />
                    <div className="h-4 w-full rounded bg-[#1D1C1A] border border-[#37342F]" />
                  </div>
                  {/* Center auto sync badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="p-1 rounded-full bg-[#FFFFFF] border border-[#E8E2D9] shadow-sm">
                      <Laptop className="h-3 w-3 text-[#C66A43]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Laptop className="h-4 w-4 text-[#C66A43]" />
                    <span className="text-sm font-semibold text-[#26231F]">System</span>
                  </div>
                  {theme === "system" && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43]">
                      <Check className="h-3 w-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#77716A] mt-1">
                  Automatically match your device appearance preference in real time.
                </p>
              </div>

              {/* Detected System Status */}
              <div className="mt-4 pt-3 border-t border-[#E8E2D9] flex items-center justify-between">
                <span className="text-[10px] text-[#77716A]">Detected System:</span>
                <span className="text-[10px] font-mono font-medium text-[#26231F] flex items-center space-x-1">
                  {systemIsDark ? (
                    <>
                      <Moon className="h-3 w-3 text-[#D9825B]" />
                      <span>Dark Theme</span>
                    </>
                  ) : (
                    <>
                      <Sun className="h-3 w-3 text-[#C66A43]" />
                      <span>Light Theme</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Theme Specification Ledger */}
          <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D9]">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-[#C66A43]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#26231F]">
                  Active Design System State
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#77716A]">
                Synchronized &bull; Zero Reload Required
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
              <div>
                <span className="text-[10px] text-[#77716A] uppercase font-mono block">Active Mode</span>
                <span className="text-xs font-semibold text-[#26231F] mt-0.5 block capitalize">
                  {resolvedTheme} Mode
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#77716A] uppercase font-mono block">Selection Source</span>
                <span className="text-xs font-semibold text-[#26231F] mt-0.5 block">
                  {theme === "system" ? "Device OS Sync" : "User Explicit"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#77716A] uppercase font-mono block">Brand Accent</span>
                <span className="text-xs font-mono font-semibold text-[#C66A43] mt-0.5 block">
                  {resolvedTheme === "dark" ? "#D9825B" : "#C66A43"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#77716A] uppercase font-mono block">Base Canvas</span>
                <span className="text-xs font-mono font-semibold text-[#26231F] mt-0.5 block">
                  {resolvedTheme === "dark" ? "#141413" : "#F5F2EB"}
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
            <h2 className="text-sm font-semibold text-[#26231F]">General Preferences</h2>
            <p className="text-xs text-[#77716A] mt-0.5">
              Configure default demo student contexts, composer behavior, and inspector panels.
            </p>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl divide-y divide-[#E8E2D9] shadow-xs">
            {/* Student Context Preference */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-[#26231F] block">
                  Default Demo Student Context
                </span>
                <span className="text-xs text-[#77716A] block mt-0.5">
                  Pre-selects student profile when launching new natural language requests.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectStudentId("S001")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    selectedStudentId === "S001"
                      ? "bg-[#F5E7DE] border-[#C66A43] text-[#C66A43] font-semibold"
                      : "bg-[#FAF7F2] border-[#E8E2D9] text-[#77716A] hover:bg-[#F0ECE5]"
                  }`}
                >
                  Alice Sharma (S001 &bull; 75%)
                </button>
                <button
                  type="button"
                  onClick={() => onSelectStudentId("S002")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    selectedStudentId === "S002"
                      ? "bg-[#F5E7DE] border-[#C66A43] text-[#C66A43] font-semibold"
                      : "bg-[#FAF7F2] border-[#E8E2D9] text-[#77716A] hover:bg-[#F0ECE5]"
                  }`}
                >
                  Bob Verma (S002 &bull; 50%)
                </button>
              </div>
            </div>

            {/* Contextual Inspector Visibility */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-[#26231F] block">
                  Contextual Inspector Panel
                </span>
                <span className="text-xs text-[#77716A] block mt-0.5">
                  Keep the right-hand task metrics, DAG progression, and payload inspector open by default.
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleInspector}
                role="switch"
                aria-checked={inspectorOpen}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  inspectorOpen ? "bg-[#C66A43]" : "bg-[#DFD7CB]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    inspectorOpen ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Keyboard Send Behavior */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-[#26231F] block">
                  Quick Dispatch Shortcut
                </span>
                <span className="text-xs text-[#77716A] block mt-0.5">
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
                      ? "bg-[#F5E7DE] border-[#C66A43] text-[#C66A43] font-semibold"
                      : "bg-[#FAF7F2] border-[#E8E2D9] text-[#77716A]"
                  }`}
                >
                  Ctrl+Enter (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleEnterToSend(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    enterToSend
                      ? "bg-[#F5E7DE] border-[#C66A43] text-[#C66A43] font-semibold"
                      : "bg-[#FAF7F2] border-[#E8E2D9] text-[#77716A]"
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
            <h2 className="text-sm font-semibold text-[#26231F]">Accessibility Preferences</h2>
            <p className="text-xs text-[#77716A] mt-0.5">
              Customize motion, animations, and surface contrast settings for comfort and readability.
            </p>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl divide-y divide-[#E8E2D9] shadow-xs">
            {/* Reduced Motion Toggle */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-[#26231F]">
                    Reduced Motion
                  </span>
                  {reducedMotion && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#F5E7DE] text-[#C66A43]">
                      Enabled
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#77716A] block">
                  Disables background transitions, spin animations, and pulsing indicator effects across all views.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReducedMotion(!reducedMotion)}
                role="switch"
                aria-checked={reducedMotion}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  reducedMotion ? "bg-[#C66A43]" : "bg-[#DFD7CB]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    reducedMotion ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* High Contrast Toggle */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-[#26231F]">
                    Enhanced Contrast Surface Borders
                  </span>
                  {highContrast && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#F5E7DE] text-[#C66A43]">
                      Enabled
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#77716A] block">
                  Increases border opacity and division line contrast between workspace surfaces, cards, and panels.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHighContrast(!highContrast)}
                role="switch"
                aria-checked={highContrast}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  highContrast ? "bg-[#C66A43]" : "bg-[#DFD7CB]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    highContrast ? "translate-x-5" : "translate-x-0"
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
            <h2 className="text-sm font-semibold text-[#26231F]">About CampVion</h2>
            <p className="text-xs text-[#77716A] mt-0.5">
              Intelligent Campus Operations &bull; Autonomous Agentic AI Assistant for Multi-Step Campus Service Workflows
            </p>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center space-x-3 pb-4 border-b border-[#E8E2D9]">
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
                  <h3 className="text-base font-bold text-[#26231F]">CampVion Enterprise</h3>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#F0ECE5] text-[#77716A]">
                    {health?.version ? `v${health.version.replace(/^v/, "")}` : "v0.1.0"}
                  </span>
                </div>
                <p className="text-xs text-[#77716A]">
                  Autonomous Agentic AI Platform with Deterministic Topological Execution
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9]">
                <div className="flex items-center space-x-2 text-[#26231F] font-semibold mb-1">
                  <Zap className="h-3.5 w-3.5 text-[#C66A43]" />
                  <span>Planning Architecture</span>
                </div>
                <p className="text-[#77716A]">
                  Deterministic Topological DAG with dependency resolution, autonomous tool orchestration, and bounded self-healing retries (Max 3 replans).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9]">
                <div className="flex items-center space-x-2 text-[#26231F] font-semibold mb-1">
                  <Shield className="h-3.5 w-3.5 text-[#287A53]" />
                  <span>Human Safety Gate</span>
                </div>
                <p className="text-[#77716A]">
                  Real-time policy guardrail requiring human confirmation for high-consequence campus service submissions (e.g. Leave Applications).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9]">
                <div className="flex items-center space-x-2 text-[#26231F] font-semibold mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#C66A43]" />
                  <span>Observability &amp; Traces</span>
                </div>
                <p className="text-[#77716A]">
                  Monotonic SQLite audit ledger capturing every understanding, planning, execution, and replanning step with full JSON payloads.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9]">
                <div className="flex items-center space-x-2 text-[#26231F] font-semibold mb-1">
                  <RefreshCw className="h-3.5 w-3.5 text-[#C66A43]" />
                  <span>Backend Connectivity</span>
                </div>
                <p className="text-[#77716A]">
                  FastAPI service active at <span className="font-mono text-[11px] text-[#26231F]">{apiBaseUrl}</span>.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E2D9] flex items-center justify-between">
              <span className="text-[11px] text-[#77716A]">
                CampVion Operations Console &bull; Production Enterprise SaaS
              </span>
              <a
                href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F5E7DE] text-[#C66A43] hover:bg-[#C66A43] hover:text-white transition cursor-pointer"
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
