"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Cpu,
  ExternalLink,
  Flame,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { ToolSchema, WorkspaceSection } from "../types/api";
import { PRESET_GOALS } from "./NewRequestPanel";
import { useTheme } from "../context/ThemeContext";

interface ToolsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolSchema[];
  onSelectPreset: (preset: (typeof PRESET_GOALS)[0]) => void;
  onNavigateToSection: (section: WorkspaceSection) => void;
  onInspectTool?: (toolName: string) => void;
  pendingApproval?: boolean;
}

type ToolCategory =
  | "ALL"
  | "CAMPUS_SERVICES"
  | "AGENT_CAPABILITIES"
  | "GOVERNANCE"
  | "TESTING_PRESETS"
  | "OBSERVABILITY"
  | "EVALUATION";

export function ToolsMenu({
  isOpen,
  onClose,
  tools,
  onSelectPreset,
  onNavigateToSection,
  onInspectTool,
  pendingApproval = false,
}: ToolsMenuProps) {
  const { experienceMode } = useTheme();
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");

  if (!isOpen) return null;

  const categories: { id: ToolCategory; label: string; count?: number }[] = [
    { id: "ALL", label: experienceMode === "simple" ? "All Options" : "All Capabilities" },
    { id: "CAMPUS_SERVICES", label: "Campus Services", count: tools.length || 7 },
    {
      id: "TESTING_PRESETS",
      label: experienceMode === "simple" ? "Sample Requests & Presets" : "Testing Presets",
      count: PRESET_GOALS.length,
    },
    {
      id: "AGENT_CAPABILITIES",
      label: experienceMode === "simple" ? "How CampVion Works" : "Agent Capabilities",
    },
    {
      id: "GOVERNANCE",
      label: experienceMode === "simple" ? "Approval Checks" : "Governance Gate",
    },
    {
      id: "OBSERVABILITY",
      label: experienceMode === "simple" ? "Activity History" : "Observability",
    },
    {
      id: "EVALUATION",
      label: experienceMode === "simple" ? "System Performance" : "Evaluation",
    },
  ];

  const agentPhases = [
    {
      title: "Goal Normalization",
      description: "Extracts canonical parameters (duration_days, reason, urgency) into structured JSON schema.",
      badge: "PHASE 1",
    },
    {
      title: "Task Decomposition",
      description: "Decomposes normalized user goal into granular single-responsibility tasks with strict input/output contracts.",
      badge: "PHASE 2",
    },
    {
      title: "Topological DAG Planning",
      description: "Constructs a deterministic Directed Acyclic Graph enforcing prerequisites before dependent execution.",
      badge: "PHASE 3",
    },
    {
      title: "Autonomous Tool Selection",
      description: "Dynamically binds candidate tools to planned tasks based on parameter requirements.",
      badge: "PHASE 4",
    },
    {
      title: "Execution Observation",
      description: "Monitors tool return status, validates responses, and flags anomalies or unexpected errors.",
      badge: "PHASE 5",
    },
    {
      title: "Dynamic Replanning & Recovery",
      description: "Autonomous self-healing replan loop up to 3 bounded retries for transient failure mitigation.",
      badge: "PHASE 6",
    },
  ];

  const filteredPresets = PRESET_GOALS.filter(
    (p) =>
      p.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.goal.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.description.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="CampVion Agentic Tools & Capabilities"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cv-overlay/35 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-cv-surface border border-cv-line shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-cv-line flex items-center justify-between gap-4 bg-cv-inset">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cv-accent-soft text-cv-accent-ink border border-cv-accent-soft-line">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-cv-fg tracking-tight">
                  CampVion{" "}
                  <span className="text-cv-accent-ink">
                    {experienceMode === "simple" ? "Request Options" : "Agentic Tools"}
                  </span>{" "}
                  &amp; {experienceMode === "simple" ? "Services" : "Capabilities"}
                </h2>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-cv-raised text-cv-fg-2">
                  Integrated Suite
                </span>
              </div>
              <p className="text-xs text-cv-fg-2 mt-0.5">
                {experienceMode === "simple"
                  ? "Explore available campus services, sample request starters, and automatic safety checks."
                  : "Inspect campus tools, launch failure injection presets, or access governance & telemetry."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close tools menu"
            className="p-1.5 rounded-lg text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent hover:border-cv-line transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Category Filter Navigation */}
        <div className="p-4 border-b border-cv-line bg-cv-surface space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cv-fg-2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search tools, testing presets, capabilities..."
              className="w-full bg-cv-inset border border-cv-line rounded-xl pl-10 pr-4 py-2 text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line transition"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cv-fg-2 hover:text-cv-fg"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            {categories.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
                    isSelected
                      ? "bg-cv-accent-soft text-cv-accent-ink border border-cv-accent-soft-line font-semibold"
                      : "text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent"
                  }`}
                >
                  <span>{cat.label}</span>
                  {cat.count !== undefined && (
                    <span className="text-[10px] font-mono px-1 rounded bg-cv-raised text-cv-fg-2">
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* CATEGORY: TESTING PRESETS */}
          {(activeCategory === "ALL" || activeCategory === "TESTING_PRESETS") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Flame className="h-4 w-4 text-cv-accent-ink" />
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
                    Developer Testing Presets &amp; Fault Injection Directives
                  </h3>
                </div>
                <span className="text-[10px] text-cv-fg-2">
                  {filteredPresets.length} scenarios
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredPresets.map((preset, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-cv-inset border border-cv-line hover:border-cv-accent-line/50 transition group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              preset.type === "nominal"
                                ? "bg-cv-success-solid"
                                : preset.type === "recoverable"
                                ? "bg-cv-accent"
                                : preset.type === "ineligible"
                                ? "bg-cv-warning-solid"
                                : "bg-cv-error-solid"
                            }`}
                          />
                          <span className="text-xs font-semibold text-cv-fg truncate">
                            {preset.label}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2 shrink-0">
                          {preset.studentId}
                        </span>
                      </div>
                      <p className="text-xs text-cv-fg-2 leading-relaxed mb-2.5">
                        {preset.description}
                      </p>
                      <div className="p-2 rounded bg-cv-surface border border-cv-line font-mono text-[11px] text-cv-fg truncate mb-3">
                        {preset.goal}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPreset(preset);
                        onClose();
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg text-xs font-semibold bg-cv-surface hover:bg-cv-accent text-cv-fg hover:text-cv-on-accent border border-cv-line hover:border-cv-accent-line transition cursor-pointer group/btn shadow-xs"
                    >
                      <span>Load &amp; Stage Preset</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CATEGORY: CAMPUS SERVICES */}
          {(activeCategory === "ALL" || activeCategory === "CAMPUS_SERVICES") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Wrench className="h-4 w-4 text-cv-accent-ink" />
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
                    Campus Services &amp; Registered Tools
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToSection("registry");
                    onClose();
                  }}
                  className="text-xs font-medium text-cv-accent-ink hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>Open Full Registry</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3.5 rounded-xl bg-cv-inset border border-cv-line flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-xs font-mono font-semibold text-cv-fg truncate">
                          {tool.name}
                        </span>
                        {tool.requires_human_approval && (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-cv-warning-soft border border-cv-warning-line text-cv-warning shrink-0">
                            GOVERNED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-cv-fg-2 line-clamp-2 leading-relaxed mb-3">
                        {tool.description}
                      </p>
                    </div>
                    {onInspectTool && (
                      <button
                        type="button"
                        onClick={() => {
                          onInspectTool(tool.name);
                          onClose();
                        }}
                        className="text-[11px] text-cv-accent-ink hover:underline text-left flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Inspect in Trace Log &rarr;</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CATEGORY: AGENT CAPABILITIES */}
          {(activeCategory === "ALL" || activeCategory === "AGENT_CAPABILITIES") && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Cpu className="h-4 w-4 text-cv-accent-ink" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
                  Autonomous Agent Reasoning Pipeline
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agentPhases.map((phase, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-cv-inset border border-cv-line"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-cv-fg">
                        {phase.title}
                      </span>
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-cv-accent-soft text-cv-accent-ink">
                        {phase.badge}
                      </span>
                    </div>
                    <p className="text-xs text-cv-fg-2 leading-relaxed">
                      {phase.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CATEGORY: GOVERNANCE & SAFETY */}
          {(activeCategory === "ALL" || activeCategory === "GOVERNANCE") && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-cv-accent-ink" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
                  Governance &amp; Human-in-the-Loop Safeguards
                </h3>
              </div>
              <div className="p-4 rounded-xl bg-cv-inset border border-cv-line space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-cv-warning-soft border border-cv-warning-line text-cv-warning shrink-0">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-cv-fg">
                      Mandatory Consequential Gate
                    </h4>
                    <p className="text-xs text-cv-fg-2 leading-relaxed">
                      CampVion requires human authorization for high-impact actions like official leave submission. When triggered, the workflow transitions to <code>WAITING_FOR_HUMAN</code> until approved or rejected via the API.
                    </p>
                  </div>
                </div>
                {pendingApproval && (
                  <div className="p-3 rounded-lg bg-cv-warning-soft border border-cv-warning-line flex items-center justify-between">
                    <span className="text-xs text-cv-warning font-medium">
                      An active workflow is currently awaiting your review!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToSection("chat");
                        onClose();
                      }}
                      className="px-3 py-1 rounded text-xs font-semibold bg-cv-accent text-cv-on-accent hover:bg-cv-accent-hover"
                    >
                      Review Approval &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CATEGORY: OBSERVABILITY & EVALUATION SHORTCUTS */}
          {(activeCategory === "ALL" ||
            activeCategory === "OBSERVABILITY" ||
            activeCategory === "EVALUATION") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-cv-inset border border-cv-line flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Terminal className="h-4 w-4 text-cv-accent-ink" />
                    <h4 className="text-xs font-semibold text-cv-fg">
                      Decision Trace Audit Log
                    </h4>
                  </div>
                  <p className="text-xs text-cv-fg-2 leading-relaxed mb-4">
                    Inspect SQLite step-level logs, raw input/output payloads, tool timestamps, and execution status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToSection("observability");
                    onClose();
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium bg-cv-surface hover:bg-cv-accent-soft text-cv-fg hover:text-cv-accent-ink border border-cv-line transition cursor-pointer"
                >
                  <span>Open Observability Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-cv-inset border border-cv-line flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-cv-success" />
                    <h4 className="text-xs font-semibold text-cv-fg">
                      Empirical Evaluation &amp; Reliability
                    </h4>
                  </div>
                  <p className="text-xs text-cv-fg-2 leading-relaxed mb-4">
                    Review session history ledger, verify plan monotonic sequencing, and analyze failure recovery rates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToSection("evaluation");
                    onClose();
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium bg-cv-surface hover:bg-cv-accent-soft text-cv-fg hover:text-cv-accent-ink border border-cv-line transition cursor-pointer"
                >
                  <span>Open Evaluation Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
