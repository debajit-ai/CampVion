"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Loader2,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import {
  BuildingId,
  CAMPUS_BUILDINGS,
  PROMPT_PRESETS,
  PromptPreset,
  ReasoningStep,
  TraceStage,
} from "./campusData";
import { ACCENT_3D } from "./theme";

function getStepSemanticStyle(
  label: string,
  done: boolean,
  active: boolean,
  isNightMode: boolean
) {
  const lower = label.toLowerCase();
  if (lower.includes("policy")) {
    return {
      isApproval: false,
      badgeBg:
        done || active
          ? "bg-[#34D399] text-[#05070F]"
          : "bg-slate-700/40 text-slate-400",
      textClass:
        done || active
          ? isNightMode
            ? "text-[#34D399]"
            : "text-[#047857]"
          : "",
      rowBorder: active
        ? "border-[#34D399]/50"
        : done
        ? "border-emerald-500/25"
        : "",
    };
  }
  if (lower.includes("approval")) {
    return {
      isApproval: true,
      badgeBg:
        done || active
          ? "bg-[#FBBF24] text-[#05070F]"
          : "bg-slate-700/40 text-slate-400",
      textClass:
        done || active
          ? isNightMode
            ? "text-[#FBBF24]"
            : "text-[#B45309]"
          : "",
      rowBorder: active
        ? "border-[#FBBF24]/55"
        : done
        ? "border-amber-500/25"
        : "",
    };
  }
  if (lower.includes("executed")) {
    return {
      isApproval: false,
      badgeBg:
        done || active
          ? "bg-[#38BDF8] text-[#05070F]"
          : "bg-slate-700/40 text-slate-400",
      textClass:
        done || active
          ? isNightMode
            ? "text-[#38BDF8]"
            : "text-[#0E7490]"
          : "",
      rowBorder: active
        ? "border-[#38BDF8]/55"
        : done
        ? "border-sky-400/25"
        : "",
    };
  }
  return {
    isApproval: false,
    badgeBg:
      done || active
        ? "bg-[#38BDF8] text-[#05070F]"
        : "bg-slate-700/40 text-slate-400",
    textClass: active
      ? isNightMode
        ? "text-[#38BDF8]"
        : "text-[#0E7490]"
      : "",
    rowBorder: active ? "border-[#38BDF8]/50" : "",
  };
}

function getStageFromStepLabel(label: string | undefined): TraceStage {
  if (!label) return "idle";
  const lower = label.toLowerCase();
  if (lower.includes("policy")) return "policy";
  if (lower.includes("approval")) return "approval";
  if (lower.includes("executed")) return "executed";
  return "parsing";
}

function ExecutionTrace({
  steps,
  isNightMode,
  onTraceStageChange,
}: {
  steps: ReasoningStep[];
  isNightMode: boolean;
  onTraceStageChange?: (stage: TraceStage) => void;
}) {
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    const emitStageForIndex = (completedCount: number) => {
      if (completedCount >= steps.length) {
        onTraceStageChange?.("executed");
      } else {
        const activeStep = steps[completedCount];
        onTraceStageChange?.(getStageFromStepLabel(activeStep?.label));
      }
    };

    const timers = [
      window.setTimeout(() => emitStageForIndex(0), 0),
      window.setTimeout(() => {
        setCompletedSteps(1);
        emitStageForIndex(1);
      }, 320),
      window.setTimeout(() => {
        setCompletedSteps(2);
        emitStageForIndex(2);
      }, 680),
      window.setTimeout(() => {
        setCompletedSteps(3);
        emitStageForIndex(3);
      }, 1060),
      window.setTimeout(() => {
        setCompletedSteps(4);
        emitStageForIndex(4);
      }, 1460),
      window.setTimeout(() => {
        setCompletedSteps(5);
        emitStageForIndex(5);
      }, 1880),
    ];

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      onTraceStageChange?.("idle");
    };
  }, [steps, onTraceStageChange]);

  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span
          className={`text-[9px] font-mono font-bold uppercase tracking-wider block ${
            isNightMode ? "text-[#B6C0D8]" : "text-slate-600"
          }`}
        >
          Agent Execution Trace
        </span>
        {completedSteps < steps.length && (
          <span
            className={`inline-flex items-center space-x-1 text-[9px] font-mono font-bold ${
              isNightMode ? "text-[#38BDF8]" : "text-[#0E7490]"
            }`}
          >
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            <span>Running</span>
          </span>
        )}
      </div>
      {steps.map((step, idx) => {
        const done = completedSteps > idx;
        const active = completedSteps === idx;
        const sem = getStepSemanticStyle(step.label, done, active, isNightMode);
        return (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: done || active ? 1 : 0.4, x: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-[10px] font-mono border transition-colors ${
              done || active
                ? isNightMode
                  ? `bg-[#05070F]/85 text-[#F5F7FF] ${
                      sem.rowBorder || "border-white/10"
                    }`
                  : `bg-white text-slate-900 ${
                      sem.rowBorder || "border-slate-200/80"
                    }`
                : isNightMode
                ? "bg-[#0B1020]/50 border-white/5 text-[#8B95B0]"
                : "bg-slate-50/70 border-slate-200/50 text-slate-400"
            }`}
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="relative h-4 w-4 shrink-0 inline-flex items-center justify-center">
                {sem.isApproval && active && (
                  <span className="absolute -inset-0.5 rounded-full border border-[#FBBF24] animate-ping opacity-60" />
                )}
                <span
                  className={`relative h-4 w-4 rounded-full flex items-center justify-center transition-colors ${
                    done || active
                      ? sem.badgeBg
                      : isNightMode
                      ? "bg-white/10 text-[#8B95B0]"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {active ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <Check className="h-2.5 w-2.5" />
                  )}
                </span>
              </span>
              <span className={`font-bold truncate ${sem.textClass}`}>
                {step.label}
              </span>
            </div>
            <span
              className={`text-[9px] truncate max-w-[140px] ${
                isNightMode ? "text-[#B6C0D8]" : "text-slate-600"
              }`}
            >
              {active ? "Verifying..." : step.detail}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

interface PromptSandboxHUDProps {
  selectedId: BuildingId | null;
  hoveredId: BuildingId | null;
  activePresetId: string | null;
  isNightMode: boolean;
  onToggleNightMode: () => void;
  onSelectBuilding: (id: BuildingId) => void;
  onHoverBuilding: (id: BuildingId | null) => void;
  onClearSelection: () => void;
  onTraceStageChange?: (stage: TraceStage) => void;
  getLabelRef: (id: string) => (el: HTMLElement | null) => void;
}

export function PromptSandboxHUD({
  selectedId,
  hoveredId,
  activePresetId,
  isNightMode,
  onToggleNightMode,
  onSelectBuilding,
  onHoverBuilding,
  onClearSelection,
  onTraceStageChange,
  getLabelRef,
}: PromptSandboxHUDProps) {
  const inspectId = selectedId || hoveredId;
  const inspectedBuilding =
    CAMPUS_BUILDINGS.find((b) => b.id === inspectId) || null;
  const isLockedSelection = Boolean(selectedId);

  return (
    <>
      {/* ===================================================================
          PROJECTED 3D->2D ARCHITECTURAL LABELS
         =================================================================== */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {/* Policy Core Label */}
        <div
          ref={getLabelRef("policy-core")}
          style={{
            opacity: 0,
            left: 0,
            top: 0,
            willChange: "transform, opacity",
          }}
          className={`absolute px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-opacity duration-200 ${
            isNightMode
              ? "bg-[#0B1020]/78 text-[#38BDF8] border-white/10"
              : "bg-white/90 text-[#0E7490] border-slate-200 shadow-xs"
          }`}
        >
          Policy Core
        </div>

        {/* 4 Campus Building Clickable & Hoverable Badges */}
        {CAMPUS_BUILDINGS.map((spec) => {
          const isActive = selectedId === spec.id || hoveredId === spec.id;
          return (
            <button
              key={spec.id}
              ref={getLabelRef(spec.id)}
              type="button"
              onClick={() => onSelectBuilding(spec.id)}
              onMouseEnter={() => onHoverBuilding(spec.id)}
              onMouseLeave={() => onHoverBuilding(null)}
              style={{
                opacity: 0,
                left: 0,
                top: 0,
                willChange: "transform, opacity",
              }}
              className={`absolute px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-200 cursor-pointer border backdrop-blur-md flex items-center space-x-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-1 ${
                isActive
                  ? isNightMode
                    ? "bg-[#0E7490] text-white border-[#38BDF8]/60 shadow-[0_6px_18px_rgba(56,189,248,0.22)]"
                    : "bg-[#0E7490] text-white border-[#0E7490] shadow-sm"
                  : isNightMode
                  ? "bg-[#0B1020]/75 text-[#E2E8F0] border-white/10 hover:border-[#38BDF8]/60"
                  : "bg-white/90 text-[#0F172A] border-slate-300 hover:border-[#0284C7] shadow-xs"
              }`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: isActive ? "#FFFFFF" : ACCENT_3D,
                }}
              />
              <span>{spec.shortTag}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================
          CAMPUS CANVAS HUD CONTROLS (SCOPED STRICTLY INSIDE CANVAS ZONE)
         =================================================================== */}
      <div className="pointer-events-none absolute top-3 right-3 sm:top-4 sm:right-5 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleNightMode}
          aria-label={
            isNightMode
              ? "Switch 3D scene to Studio Light"
              : "Switch 3D scene to Obsidian Dark"
          }
          className={`pointer-events-auto inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold backdrop-blur-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
            isNightMode
              ? "bg-[#0B1020]/75 border-white/10 text-[#F5F7FF] hover:border-[#38BDF8]/50"
              : "bg-white/90 border-slate-200 text-[#0F172A] hover:border-sky-500 shadow-xs"
          }`}
        >
          {isNightMode ? (
            <>
              <Sun className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span>Studio Light</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-[#0E7490]" />
              <span>Obsidian Dark</span>
            </>
          )}
        </button>
      </div>

      {/* Live Inspection Card Scoped Strictly Inside Right/Bottom Canvas Zone */}
      <div className="pointer-events-none absolute top-12 sm:top-4 left-3 right-3 sm:right-auto sm:left-5 z-30 flex flex-col items-start gap-2.5 max-h-[calc(100%-3.25rem)] sm:max-h-[calc(100%-2rem)] overflow-y-auto">
        <AnimatePresence mode="wait">
          {inspectedBuilding && (
            <motion.div
              key={`${inspectedBuilding.id}-${isLockedSelection ? "locked" : "hover"}`}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className={`pointer-events-auto w-full sm:w-[325px] max-w-[335px] rounded-2xl p-3.5 backdrop-blur-xl border transition-colors ${
                isNightMode
                  ? "bg-[#0B1020]/84 border-white/10 text-[#F5F7FF] shadow-[0_18px_42px_rgba(2,4,10,0.6)]"
                  : "bg-white/95 border-slate-200 text-[#0F172A] shadow-xl"
              }`}
            >
              <div
                className={`flex items-start justify-between gap-2 pb-2.5 border-b ${
                  isNightMode ? "border-white/10" : "border-slate-200/80"
                }`}
              >
                <div className="min-w-0">
                  <div
                    className={`flex items-center space-x-1.5 text-[10px] font-mono font-extrabold ${
                      isNightMode ? "text-[#38BDF8]" : "text-[#0E7490]"
                    }`}
                  >
                    <span>{inspectedBuilding.policyCode}</span>
                    <span>&middot;</span>
                    <span className="truncate">{inspectedBuilding.name}</span>
                  </div>
                  <p
                    className={`text-[10px] font-medium mt-0.5 truncate ${
                      isNightMode ? "text-[#B6C0D8]" : "text-slate-600"
                    }`}
                  >
                    {inspectedBuilding.authority}
                  </p>
                </div>
                {isLockedSelection && (
                  <button
                    type="button"
                    onClick={onClearSelection}
                    aria-label="Close inspection card"
                    className={`p-1 rounded-lg transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                      isNightMode
                        ? "hover:bg-white/10 text-[#B6C0D8] hover:text-white"
                        : "hover:bg-slate-100 text-slate-600 hover:text-sky-700"
                    }`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div
                className={`mt-2.5 px-2.5 py-2 rounded-xl border flex items-center space-x-2 ${
                  isNightMode
                    ? "bg-white/[0.04] border-white/10 text-[#F5F7FF]"
                    : "bg-sky-50/80 border-sky-200/80 text-[#0E7490]"
                }`}
              >
                <Loader2
                  className={`h-3.5 w-3.5 shrink-0 animate-spin ${
                    isNightMode ? "text-[#38BDF8]" : "text-[#0E7490]"
                  }`}
                />
                <span className="text-[11px] font-mono font-bold truncate">
                  {inspectedBuilding.liveAction}
                </span>
              </div>

              {isLockedSelection ? (
                <ExecutionTrace
                  key={`${selectedId}-${activePresetId ?? "none"}`}
                  steps={inspectedBuilding.pipelineSteps}
                  isNightMode={isNightMode}
                  onTraceStageChange={onTraceStageChange}
                />
              ) : (
                <div
                  className={`mt-2.5 flex items-center justify-between text-[10px] font-mono ${
                    isNightMode ? "text-[#B6C0D8]" : "text-slate-600"
                  }`}
                >
                  <span
                    className={`flex items-center space-x-1 font-bold ${
                      isNightMode ? "text-[#34D399]" : "text-[#047857]"
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{inspectedBuilding.statusHeadline}</span>
                  </span>
                  <span
                    className={`font-semibold ${
                      isNightMode ? "text-[#38BDF8]" : "text-[#0E7490]"
                    }`}
                  >
                    Click to trace
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

interface PromptCommandBarProps {
  selectedId: BuildingId | null;
  activePresetId: string | null;
  isNightMode: boolean;
  onRunPreset: (preset: PromptPreset) => void;
  onClearSelection: () => void;
}

export function PromptCommandBar({
  selectedId,
  activePresetId,
  isNightMode,
  onRunPreset,
  onClearSelection,
}: PromptCommandBarProps) {
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handlePillKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const count = PROMPT_PRESETS.length;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      pillRefs.current[(index + 1) % count]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      pillRefs.current[(index - 1 + count) % count]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      pillRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      pillRefs.current[count - 1]?.focus();
    }
  };

  return (
    <div
      className={`w-full rounded-2xl p-2.5 sm:px-4 sm:py-2.5 backdrop-blur-xl border transition-all duration-500 ${
        isNightMode
          ? "bg-[#0B1020]/75 border-white/[0.08]"
          : "bg-white/94 border-slate-200/90 shadow-sm"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between lg:justify-start space-x-2.5 px-1 shrink-0">
          <div className="flex items-center space-x-1.5">
            <Sparkles
              className={`h-3.5 w-3.5 ${
                isNightMode ? "text-[#38BDF8]" : "text-[#0E7490]"
              }`}
            />
            <span
              className={`text-[10px] font-mono font-extrabold uppercase tracking-wider whitespace-nowrap ${
                isNightMode ? "text-[#F5F7FF]" : "text-slate-800"
              }`}
            >
              Prompt-To-3D
            </span>
          </div>

          <button
            type="button"
            onClick={onClearSelection}
            className={`lg:hidden inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-1 ${
              isNightMode
                ? "bg-white/5 border-white/10 text-[#F5F7FF] hover:border-[#38BDF8]"
                : "bg-sky-50 border-sky-200 text-[#0E7490]"
            }`}
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset View</span>
          </button>
        </div>

        <div
          role="group"
          aria-label="Prompt-to-3D Command Presets"
          className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end"
        >
          {PROMPT_PRESETS.map((preset, idx) => {
            const isActive =
              activePresetId === preset.id ||
              (selectedId === preset.targetBuilding && !activePresetId);
            return (
              <button
                key={preset.id}
                ref={(el) => {
                  pillRefs.current[idx] = el;
                }}
                type="button"
                aria-pressed={isActive}
                onKeyDown={(e) => handlePillKeyDown(e, idx)}
                onClick={() => onRunPreset(preset)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center space-x-1.5 border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-1 ${
                  isNightMode
                    ? "focus-visible:ring-offset-[#0B1020]"
                    : "focus-visible:ring-offset-white"
                } ${
                  isActive
                    ? "bg-[#0E7490] text-white border-[#38BDF8]/50"
                    : isNightMode
                    ? "bg-[#05070F]/70 hover:bg-white/[0.07] text-[#F5F7FF] border-white/[0.08] hover:border-[#38BDF8]/45"
                    : "bg-white hover:bg-sky-50/70 text-[#0F172A] border-slate-300 hover:border-sky-500"
                }`}
              >
                <ShieldCheck
                  className={`h-3 w-3 shrink-0 ${
                    isActive
                      ? "text-white"
                      : isNightMode
                      ? "text-[#38BDF8]"
                      : "text-[#0E7490]"
                  }`}
                />
                <span>&ldquo;{preset.label}&rdquo;</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onClearSelection}
            className={`hidden lg:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold border transition cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-1 ${
              isNightMode
                ? "focus-visible:ring-offset-[#0B1020] bg-[#05070F]/70 border-white/[0.08] text-[#B6C0D8] hover:border-[#38BDF8]/50 hover:text-white"
                : "focus-visible:ring-offset-white bg-white hover:bg-sky-50/70 text-slate-700 hover:text-[#0E7490] border-slate-300"
            }`}
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Campus View</span>
          </button>
        </div>
      </div>
    </div>
  );
}
