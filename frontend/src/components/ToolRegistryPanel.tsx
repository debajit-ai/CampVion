"use client";

import React, { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  ExternalLink,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
  Wrench,
  XCircle,
} from "lucide-react";
import { AgentState, HealthResponse, ToolSchema, TraceItem } from "../types/api";
import { useTheme } from "../context/ThemeContext";
import { getFriendlyToolName } from "../utils/language";

interface ToolRegistryPanelProps {
  tools: ToolSchema[];
  state: AgentState | null;
  traces: TraceItem[];
  health: HealthResponse | null;
  healthLoading: boolean;
  healthLatencyMs: number | null;
  apiBaseUrl: string;
  onRefreshHealth: () => void;
  onInspectToolInTrace?: (toolName: string) => void;
}

export function ToolRegistryPanel({
  tools,
  state,
  traces,
  health,
  healthLoading,
  healthLatencyMs,
  apiBaseUrl,
  onRefreshHealth,
  onInspectToolInTrace,
}: ToolRegistryPanelProps) {
  const { experienceMode } = useTheme();
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const isOnline = health?.status === "healthy";

  // Build map of tool usage in active workflow
  const selectedToolEntries = Object.entries(state?.selected_tools || {});
  const executedToolsMap = new Map<
    string,
    { taskIds: string[]; status: "COMPLETED" | "FAILED" | "PENDING" }
  >();

  for (const [taskId, toolName] of selectedToolEntries) {
    const isCompleted = state?.completed_tasks.includes(taskId);
    const isFailed = state?.failed_tasks.includes(taskId);
    const status = isCompleted ? "COMPLETED" : isFailed ? "FAILED" : "PENDING";

    const existing = executedToolsMap.get(toolName);
    if (existing) {
      existing.taskIds.push(taskId);
      if (status === "FAILED") existing.status = "FAILED";
      else if (status === "COMPLETED" && existing.status !== "FAILED") {
        existing.status = "COMPLETED";
      }
    } else {
      executedToolsMap.set(toolName, { taskIds: [taskId], status });
    }
  }

  const categories = [
    "ALL",
    ...Array.from(new Set(tools.map((t) => t.category))),
  ];

  const filteredTools = tools.filter(
    (t) => categoryFilter === "ALL" || t.category === categoryFilter
  );

  return (
    <div className="bg-cv-surface border border-cv-line rounded-2xl p-5 space-y-5 shadow-xs select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-cv-line">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-cv-fg">
                {experienceMode === "simple" ? (
                  <>Campus <span className="text-cv-accent-ink">Services</span> &amp; Capabilities</>
                ) : (
                  <>Tool Registry &amp; <span className="text-cv-accent-ink">System Status</span></>
                )}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-raised border border-cv-line text-cv-fg-2">
                {tools.length} {experienceMode === "simple" ? "Campus Services" : "Registered Tools"}
              </span>
              {executedToolsMap.size > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-success-soft border border-cv-success-line text-cv-success">
                  {executedToolsMap.size} Used in Current Request
                </span>
              )}
            </div>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              {experienceMode === "simple"
                ? "The university services and systems CampVion coordinates to complete student workflows"
                : "Deterministic campus tool schemas, policy governance gates, and backend connectivity status"}
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center bg-cv-inset p-1 rounded-lg border border-cv-line text-xs font-mono overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded uppercase transition cursor-pointer ${
                categoryFilter === cat
                  ? "bg-cv-accent-soft text-cv-accent-ink font-semibold"
                  : "text-cv-fg-2 hover:text-cv-fg"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* System Status & Backend Connectivity Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl bg-cv-inset border border-cv-line flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl border ${
                isOnline
                  ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                  : "bg-cv-error-soft border-cv-error-line text-cv-error"
              }`}
            >
              {isOnline ? (
                <Server className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
                Backend Connectivity
              </span>
              <span className="text-xs font-semibold text-cv-fg">
                {isOnline
                  ? `${(health?.service || "CampVion Backend").replace(/AXORA/gi, "CampVion")} (${health?.status})`
                  : "Unreachable / Offline"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshHealth}
            disabled={healthLoading}
            className="p-1.5 rounded-lg bg-cv-surface border border-cv-line text-cv-fg-2 hover:text-cv-accent-ink transition cursor-pointer"
            title="Refresh backend status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? "animate-spin text-cv-accent-ink" : ""}`} />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-cv-inset border border-cv-line flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink shrink-0">
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
                API Endpoint &amp; Ping
              </span>
              <span className="text-xs font-mono text-cv-fg truncate block">
                {apiBaseUrl}
              </span>
            </div>
          </div>
          {typeof healthLatencyMs === "number" && healthLatencyMs >= 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-cv-success-soft border border-cv-success-line text-cv-success shrink-0">
              {healthLatencyMs}ms
            </span>
          )}
        </div>

        <div className="p-4 rounded-xl bg-cv-inset border border-cv-line flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cv-raised border border-cv-line text-cv-fg">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
                OpenAPI Specification
              </span>
              <span className="text-xs font-medium text-cv-fg">
                FastAPI Swagger Docs ({health?.version || "0.1.0"})
              </span>
            </div>
          </div>
          <a
            href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cv-surface border border-cv-line hover:bg-cv-inset text-xs font-medium text-cv-fg hover:text-cv-accent-ink transition shadow-xs"
          >
            <span>Open</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Registered Tools Grid */}
      {filteredTools.length === 0 ? (
        <div className="py-8 text-center text-xs text-cv-fg-2">
          No registered tools loaded. Ensure the backend service is online.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTools.map((tool) => {
            const executionInfo = executedToolsMap.get(tool.name);
            const isExecuted = Boolean(executionInfo);
            const isExpanded = expandedTool === tool.name;

            // Count trace references for this tool
            const toolTraceCount = traces.filter(
              (t) =>
                t.output_data === tool.name ||
                (t.event_type.startsWith("TOOL") &&
                  (t.input_data?.includes(tool.name) || t.output_data?.includes(tool.name)))
            ).length;

            return (
              <div
                key={tool.name}
                className={`rounded-xl border transition-all ${
                  isExecuted
                    ? executionInfo?.status === "FAILED"
                      ? "bg-cv-error-soft/35 border-cv-error-line"
                      : "bg-cv-success-soft/35 border-cv-success-line"
                    : "bg-cv-inset border-cv-line"
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedTool(isExpanded ? null : tool.name);
                    }
                  }}
                  className="p-4 flex items-start justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-semibold text-xs text-cv-fg">
                        {experienceMode === "simple" ? getFriendlyToolName(tool.name) : tool.name}
                      </span>
                      {experienceMode === "simple" && (
                        <span className="font-mono text-[10px] text-cv-fg-2 px-1.5 py-0.2 rounded bg-cv-surface border border-cv-line">
                          {tool.name}
                        </span>
                      )}
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cv-raised text-cv-fg-2">
                        {tool.category}
                      </span>
                      {tool.requires_human_approval ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
                          <ShieldAlert className="h-2.5 w-2.5" />
                          <span>Approval Required</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-cv-success-soft border border-cv-success-line text-cv-success">
                          <ShieldCheck className="h-2.5 w-2.5 text-cv-success" />
                          <span>{experienceMode === "simple" ? "Automated" : "Autonomous"}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-cv-fg-2 mt-1.5 leading-relaxed">{tool.description}</p>

                    {/* Registered vs Executed status row */}
                    <div className="mt-2.5 flex items-center flex-wrap gap-2 text-[10px]">
                      {isExecuted ? (
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border font-medium ${
                            executionInfo?.status === "FAILED"
                              ? "bg-cv-error-soft border-cv-error-line text-cv-error"
                              : "bg-cv-success-soft border-cv-success-line text-cv-success"
                          }`}
                        >
                          {executionInfo?.status === "FAILED" ? (
                            <XCircle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          <span>
                            Executed in Active Run (Task{" "}
                            {executionInfo?.taskIds.join(", ")}) &bull;{" "}
                            {executionInfo?.status}
                          </span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2">
                          Registered Catalog Tool (Idle in Current Run)
                        </span>
                      )}

                      {toolTraceCount > 0 && (
                        <span className="text-cv-fg-2">
                          {toolTraceCount} trace event(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 text-cv-fg-2 shrink-0 mt-0.5">
                    <Code2 className="h-3.5 w-3.5" />
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </div>

                {/* Expanded Schema Inspector */}
                {isExpanded && (
                  <div className="px-4 pb-3.5 pt-2.5 border-t border-cv-line bg-cv-surface text-xs font-mono space-y-2 rounded-b-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-cv-fg-2">
                        JSON Input Schema Contract:
                      </span>
                      {isExecuted && onInspectToolInTrace && (
                        <button
                          type="button"
                          onClick={() => onInspectToolInTrace(tool.name)}
                          className="text-[11px] text-cv-accent-ink hover:underline cursor-pointer"
                        >
                          Filter Trace by {tool.name} &rarr;
                        </button>
                      )}
                    </div>
                    <pre className="p-2.5 rounded bg-cv-inset border border-cv-line text-[11px] text-cv-fg overflow-x-auto">
                      {JSON.stringify(tool.input_schema, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
