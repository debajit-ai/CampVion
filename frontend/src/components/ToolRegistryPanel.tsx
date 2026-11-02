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
    <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-2xl p-5 space-y-5 shadow-xs select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E8E2D9]">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43]">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-[#26231F]">
                Tool Registry &amp; <span className="text-[#C66A43]">System Status</span>
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F0ECE5] border border-[#E8E2D9] text-[#77716A]">
                {tools.length} Registered Tools
              </span>
              {executedToolsMap.size > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EAF4EE] border border-[#C8E3D4] text-[#287A53]">
                  {executedToolsMap.size} Executed in Active Run
                </span>
              )}
            </div>
            <p className="text-xs text-[#77716A] mt-0.5">
              Deterministic campus tool schemas, policy governance gates, and backend connectivity status
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center bg-[#FAF7F2] p-1 rounded-lg border border-[#E8E2D9] text-xs font-mono overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded uppercase transition cursor-pointer ${
                categoryFilter === cat
                  ? "bg-[#F5E7DE] text-[#C66A43] font-semibold"
                  : "text-[#77716A] hover:text-[#26231F]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* System Status & Backend Connectivity Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl border ${
                isOnline
                  ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
                  : "bg-[#FBEDED] border-[#F3CBC7] text-[#C44E45]"
              }`}
            >
              {isOnline ? (
                <Server className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#77716A] block">
                Backend Connectivity
              </span>
              <span className="text-xs font-semibold text-[#26231F]">
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
            className="p-1.5 rounded-lg bg-[#FFFFFF] border border-[#E8E2D9] text-[#77716A] hover:text-[#C66A43] transition cursor-pointer"
            title="Refresh backend status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? "animate-spin text-[#C66A43]" : ""}`} />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43] shrink-0">
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold text-[#77716A] block">
                API Endpoint &amp; Ping
              </span>
              <span className="text-xs font-mono text-[#26231F] truncate block">
                {apiBaseUrl}
              </span>
            </div>
          </div>
          {typeof healthLatencyMs === "number" && healthLatencyMs >= 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#EAF4EE] border border-[#C8E3D4] text-[#287A53] shrink-0">
              {healthLatencyMs}ms
            </span>
          )}
        </div>

        <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#F0ECE5] border border-[#E8E2D9] text-[#26231F]">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#77716A] block">
                OpenAPI Specification
              </span>
              <span className="text-xs font-medium text-[#26231F]">
                FastAPI Swagger Docs ({health?.version || "0.1.0"})
              </span>
            </div>
          </div>
          <a
            href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E8E2D9] hover:bg-[#FAF7F2] text-xs font-medium text-[#26231F] hover:text-[#C66A43] transition shadow-xs"
          >
            <span>Open</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Registered Tools Grid */}
      {filteredTools.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#77716A]">
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
                      ? "bg-[#FBEDED]/35 border-[#F3CBC7]"
                      : "bg-[#EAF4EE]/35 border-[#C8E3D4]"
                    : "bg-[#FAF7F2] border-[#E8E2D9]"
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
                      <span className="font-mono text-xs font-semibold text-[#26231F]">
                        {tool.name}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#F0ECE5] text-[#77716A]">
                        {tool.category}
                      </span>
                      {tool.requires_human_approval ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932]">
                          <ShieldAlert className="h-2.5 w-2.5" />
                          <span>Human Approval Gate</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#EAF4EE] border border-[#C8E3D4] text-[#287A53]">
                          <ShieldCheck className="h-2.5 w-2.5 text-[#287A53]" />
                          <span>Autonomous</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#77716A] mt-1.5 leading-relaxed">{tool.description}</p>

                    {/* Registered vs Executed status row */}
                    <div className="mt-2.5 flex items-center flex-wrap gap-2 text-[10px]">
                      {isExecuted ? (
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border font-medium ${
                            executionInfo?.status === "FAILED"
                              ? "bg-[#FBEDED] border-[#F3CBC7] text-[#C44E45]"
                              : "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
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
                        <span className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[#77716A]">
                          Registered Catalog Tool (Idle in Current Run)
                        </span>
                      )}

                      {toolTraceCount > 0 && (
                        <span className="text-[#77716A]">
                          {toolTraceCount} trace event(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 text-[#77716A] shrink-0 mt-0.5">
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
                  <div className="px-4 pb-3.5 pt-2.5 border-t border-[#E8E2D9] bg-[#FFFFFF] text-xs font-mono space-y-2 rounded-b-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-[#77716A]">
                        JSON Input Schema Contract:
                      </span>
                      {isExecuted && onInspectToolInTrace && (
                        <button
                          type="button"
                          onClick={() => onInspectToolInTrace(tool.name)}
                          className="text-[11px] text-[#C66A43] hover:underline cursor-pointer"
                        >
                          Filter Trace by {tool.name} &rarr;
                        </button>
                      )}
                    </div>
                    <pre className="p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2D9] text-[11px] text-[#26231F] overflow-x-auto">
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
