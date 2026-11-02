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
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");

  if (!isOpen) return null;

  const categories: { id: ToolCategory; label: string; count?: number }[] = [
    { id: "ALL", label: "All Capabilities" },
    { id: "CAMPUS_SERVICES", label: "Campus Services", count: tools.length || 7 },
    { id: "TESTING_PRESETS", label: "Testing Presets", count: PRESET_GOALS.length },
    { id: "AGENT_CAPABILITIES", label: "Agent Capabilities" },
    { id: "GOVERNANCE", label: "Governance Gate" },
    { id: "OBSERVABILITY", label: "Observability" },
    { id: "EVALUATION", label: "Evaluation" },
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26231F]/35 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-[#FFFFFF] border border-[#E8E2D9] shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-[#E8E2D9] flex items-center justify-between gap-4 bg-[#FAF7F2]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#F5E7DE] text-[#C66A43] border border-[#E8CFC1]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-[#26231F] tracking-tight">
                  CampVion <span className="text-[#C66A43]">Agentic Tools</span> &amp; Capabilities
                </h2>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#F0ECE5] text-[#77716A]">
                  Integrated Suite
                </span>
              </div>
              <p className="text-xs text-[#77716A] mt-0.5">
                Inspect campus tools, launch failure injection presets, or access governance &amp; telemetry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close tools menu"
            className="p-1.5 rounded-lg text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] border border-transparent hover:border-[#E8E2D9] transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Category Filter Navigation */}
        <div className="p-4 border-b border-[#E8E2D9] bg-[#FFFFFF] space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#77716A]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search tools, testing presets, capabilities..."
              className="w-full bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl pl-10 pr-4 py-2 text-xs text-[#26231F] placeholder-[#9E978E] focus:outline-none focus:border-[#C66A43] transition"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#77716A] hover:text-[#26231F]"
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
                      ? "bg-[#F5E7DE] text-[#C66A43] border border-[#E8CFC1] font-semibold"
                      : "text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] border border-transparent"
                  }`}
                >
                  <span>{cat.label}</span>
                  {cat.count !== undefined && (
                    <span className="text-[10px] font-mono px-1 rounded bg-[#F0ECE5] text-[#77716A]">
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
                  <Flame className="h-4 w-4 text-[#C66A43]" />
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-[#26231F]">
                    Developer Testing Presets &amp; Fault Injection Directives
                  </h3>
                </div>
                <span className="text-[10px] text-[#77716A]">
                  {filteredPresets.length} scenarios
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredPresets.map((preset, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#C66A43]/50 transition group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              preset.type === "nominal"
                                ? "bg-[#287A53]"
                                : preset.type === "recoverable"
                                ? "bg-[#C66A43]"
                                : preset.type === "ineligible"
                                ? "bg-[#B77932]"
                                : "bg-[#C44E45]"
                            }`}
                          />
                          <span className="text-xs font-semibold text-[#26231F] truncate">
                            {preset.label}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[#77716A] shrink-0">
                          {preset.studentId}
                        </span>
                      </div>
                      <p className="text-xs text-[#77716A] leading-relaxed mb-2.5">
                        {preset.description}
                      </p>
                      <div className="p-2 rounded bg-[#FFFFFF] border border-[#E8E2D9] font-mono text-[11px] text-[#26231F] truncate mb-3">
                        {preset.goal}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPreset(preset);
                        onClose();
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#FFFFFF] hover:bg-[#C66A43] text-[#26231F] hover:text-[#FFFFFF] border border-[#E8E2D9] hover:border-[#C66A43] transition cursor-pointer group/btn shadow-xs"
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
                  <Wrench className="h-4 w-4 text-[#C66A43]" />
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-[#26231F]">
                    Campus Services &amp; Registered Tools
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToSection("registry");
                    onClose();
                  }}
                  className="text-xs font-medium text-[#C66A43] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>Open Full Registry</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-xs font-mono font-semibold text-[#26231F] truncate">
                          {tool.name}
                        </span>
                        {tool.requires_human_approval && (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932] shrink-0">
                            GOVERNED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#77716A] line-clamp-2 leading-relaxed mb-3">
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
                        className="text-[11px] text-[#C66A43] hover:underline text-left flex items-center space-x-1 cursor-pointer"
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
                <Cpu className="h-4 w-4 text-[#C66A43]" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#26231F]">
                  Autonomous Agent Reasoning Pipeline
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agentPhases.map((phase, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-[#26231F]">
                        {phase.title}
                      </span>
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-[#F5E7DE] text-[#C66A43]">
                        {phase.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[#77716A] leading-relaxed">
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
                <ShieldCheck className="h-4 w-4 text-[#C66A43]" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#26231F]">
                  Governance &amp; Human-in-the-Loop Safeguards
                </h3>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932] shrink-0">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-[#26231F]">
                      Mandatory Consequential Gate
                    </h4>
                    <p className="text-xs text-[#77716A] leading-relaxed">
                      CampVion requires human authorization for high-impact actions like official leave submission. When triggered, the workflow transitions to <code>WAITING_FOR_HUMAN</code> until approved or rejected via the API.
                    </p>
                  </div>
                </div>
                {pendingApproval && (
                  <div className="p-3 rounded-lg bg-[#FBF3E8] border border-[#F0D9BC] flex items-center justify-between">
                    <span className="text-xs text-[#B77932] font-medium">
                      An active workflow is currently awaiting your review!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToSection("chat");
                        onClose();
                      }}
                      className="px-3 py-1 rounded text-xs font-semibold bg-[#C66A43] text-[#FFFFFF] hover:bg-[#AD5735]"
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
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Terminal className="h-4 w-4 text-[#C66A43]" />
                    <h4 className="text-xs font-semibold text-[#26231F]">
                      Decision Trace Audit Log
                    </h4>
                  </div>
                  <p className="text-xs text-[#77716A] leading-relaxed mb-4">
                    Inspect SQLite step-level logs, raw input/output payloads, tool timestamps, and execution status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToSection("observability");
                    onClose();
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium bg-[#FFFFFF] hover:bg-[#F5E7DE] text-[#26231F] hover:text-[#C66A43] border border-[#E8E2D9] transition cursor-pointer"
                >
                  <span>Open Observability Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-[#287A53]" />
                    <h4 className="text-xs font-semibold text-[#26231F]">
                      Empirical Evaluation &amp; Reliability
                    </h4>
                  </div>
                  <p className="text-xs text-[#77716A] leading-relaxed mb-4">
                    Review session history ledger, verify plan monotonic sequencing, and analyze failure recovery rates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToSection("evaluation");
                    onClose();
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium bg-[#FFFFFF] hover:bg-[#F5E7DE] text-[#26231F] hover:text-[#C66A43] border border-[#E8E2D9] transition cursor-pointer"
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
