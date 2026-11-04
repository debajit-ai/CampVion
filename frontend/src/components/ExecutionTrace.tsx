"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  Search,
  Terminal,
  X,
} from "lucide-react";
import { TraceItem } from "../types/api";
import { useTheme } from "../context/ThemeContext";

interface ExecutionTraceProps {
  traces: TraceItem[];
  requestId: number | null;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
}

export function ExecutionTrace({
  traces,
  requestId,
  searchQuery: controlledSearch,
  onSearchQueryChange,
}: ExecutionTraceProps) {
  const { experienceMode } = useTheme();
  const isSimple = experienceMode === "simple";
  const [filter, setFilter] = useState<string>("ALL");
  const [localSearch, setLocalSearch] = useState<string>("");
  const [expandedTraceIds, setExpandedTraceIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const searchQuery = controlledSearch !== undefined ? controlledSearch : localSearch;
  const setSearchQuery = (val: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    } else {
      setLocalSearch(val);
    }
  };

  const filteredTraces = traces.filter((t) => {
    // Category filter
    let matchesCategory = true;
    if (filter === "TOOLS") {
      matchesCategory =
        t.event_type.startsWith("TOOL") ||
        t.component === "executor" ||
        t.component === "tool_selector";
    } else if (filter === "PLANNING") {
      matchesCategory =
        t.event_type.includes("GOAL") ||
        t.event_type.includes("PLAN") ||
        t.component === "planner" ||
        t.component === "decomposer";
    } else if (filter === "HUMAN") {
      matchesCategory = t.event_type.includes("HUMAN");
    } else if (filter === "RECOVERY") {
      matchesCategory =
        t.event_type.includes("REPLAN") ||
        t.component === "replanner" ||
        t.output_data === "RECOVERABLE_FAILURE";
    } else if (filter === "ERRORS") {
      matchesCategory =
        t.status === "failure" ||
        Boolean(t.error_message) ||
        t.event_type.includes("FAIL");
    }

    if (!matchesCategory) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay = [
        t.event_type,
        t.component,
        t.action,
        t.status,
        t.input_data || "",
        t.output_data || "",
        t.error_message || "",
        `#${t.step_number}`,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    }

    return true;
  });

  const toggleTraceExpand = (id: number) => {
    setExpandedTraceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allExpanded =
    filteredTraces.length > 0 &&
    filteredTraces.every((t) => expandedTraceIds.has(t.id));

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedTraceIds(new Set());
    } else {
      setExpandedTraceIds(new Set(filteredTraces.map((t) => t.id)));
    }
  };

  const handleCopyJson = (trace: TraceItem) => {
    const jsonStr = JSON.stringify(trace, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedId(trace.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportAll = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(traces, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `campvion-trace-req-${requestId || "latest"}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getEventBadgeColor = (eventType: string, status: string) => {
    if (status === "failure" || eventType.includes("FAILED")) {
      return "bg-cv-error-soft border-cv-error-line text-cv-error";
    }
    if (eventType.includes("HUMAN")) {
      return "bg-cv-warning-soft border-cv-warning-line text-cv-warning";
    }
    if (eventType.includes("REPLAN") || eventType.startsWith("TOOL")) {
      return "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink";
    }
    if (eventType.includes("PLAN") || eventType.includes("GOAL")) {
      return "bg-cv-raised border-cv-line text-cv-fg";
    }
    return "bg-cv-success-soft border-cv-success-line text-cv-success";
  };

  const formatJson = (jsonString: string | null | undefined) => {
    if (!jsonString) return null;
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  const getInlinePreview = (trace: TraceItem): string | null => {
    if (trace.error_message) return null;
    if (trace.event_type === "TOOL_SELECTED" && trace.output_data) {
      return `tool: ${trace.output_data}`;
    }
    if (trace.event_type === "OBSERVATION_RECEIVED" && trace.output_data) {
      return `outcome: ${trace.output_data}`;
    }
    if (trace.event_type === "GOAL_RECEIVED" && trace.input_data) {
      return trace.input_data;
    }
    return null;
  };

  return (
    <div className="bg-cv-surface border border-cv-line rounded-2xl p-5 shadow-xs select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-cv-line">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-cv-fg">
                {isSimple ? (
                  <>Activity <span className="text-cv-accent-ink">History</span></>
                ) : (
                  <>Decision <span className="text-cv-accent-ink">Trace</span> Audit Log</>
                )}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-success-soft border border-cv-success-line text-cv-success">
                {isSimple ? `${traces.length} actions recorded` : `Chronological (${traces.length} steps)`}
              </span>
              {requestId && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-raised border border-cv-line text-cv-fg-2">
                  #REQ-{requestId}
                </span>
              )}
            </div>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              {isSimple
                ? "Step-by-step record of actions taken for your request"
                : "Complete verifiable log of agent reasoning, tool payloads, and observations"}
            </p>
          </div>
        </div>

        {/* Filter chips, Search & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search input */}
          <div className="relative flex items-center">
            <Search className="h-3.5 w-3.5 text-cv-fg-2 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isSimple ? "Search activity..." : "Filter trace..."}
              aria-label={isSimple ? "Search activity history" : "Filter execution trace"}
              className="w-36 sm:w-44 pl-7 pr-6 py-1.5 rounded-lg bg-cv-inset border border-cv-line text-xs font-mono text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear trace filter"
                className="absolute right-2 text-cv-fg-2 hover:text-cv-fg cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Category filter pills */}
          <div className="flex items-center bg-cv-inset p-1 rounded-lg border border-cv-line text-xs font-mono overflow-x-auto">
            {[
              { id: "ALL", label: isSimple ? "All" : "ALL" },
              { id: "TOOLS", label: isSimple ? "Services" : "TOOLS" },
              { id: "PLANNING", label: isSimple ? "Planning" : "PLANNING" },
              { id: "HUMAN", label: isSimple ? "Approvals" : "HUMAN" },
              { id: "RECOVERY", label: isSimple ? "Auto-Recovery" : "RECOVERY" },
              { id: "ERRORS", label: isSimple ? "Issues" : "ERRORS" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilter(cat.id)}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  filter === cat.id
                    ? "bg-cv-accent-soft text-cv-accent-ink font-semibold"
                    : "text-cv-fg-2 hover:text-cv-fg"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {traces.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleToggleExpandAll}
                title={allExpanded ? "Collapse all trace steps" : "Expand all trace steps"}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-cv-surface border border-cv-line hover:bg-cv-inset text-xs font-mono text-cv-fg-2 hover:text-cv-fg transition cursor-pointer"
              >
                {allExpanded ? (
                  <>
                    <Minimize2 className="h-3 w-3" />
                    <span className="hidden md:inline">Collapse</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3 w-3" />
                    <span className="hidden md:inline">Expand All</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportAll}
                title="Download Trace JSON"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-cv-surface border border-cv-line hover:bg-cv-inset text-xs font-mono text-cv-accent-ink transition cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Traces List */}
      {traces.length === 0 ? (
        <div className="py-12 text-center text-cv-fg-2">
          <Clock className="h-8 w-8 mx-auto mb-2.5 text-cv-fg-3" />
          <p className="text-xs font-mono text-cv-fg">
            {isSimple
              ? "No activity recorded yet for this session."
              : "No traces recorded yet for this session."}
          </p>
          <p className="text-[11px] text-cv-fg-2 mt-1">
            {isSimple
              ? "Submit a request to see actions taken in real time."
              : "Launch a workflow to stream chronological execution events in real time."}
          </p>
        </div>
      ) : filteredTraces.length === 0 ? (
        <div className="py-10 text-center text-cv-fg-2">
          <p className="text-xs font-mono text-cv-fg">
            No trace events match filter &ldquo;{filter}&rdquo;
            {searchQuery ? ` and query "${searchQuery}"` : ""}.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter("ALL");
              setSearchQuery("");
            }}
            className="mt-2 px-3 py-1 rounded bg-cv-inset border border-cv-line text-xs font-mono text-cv-accent-ink hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filteredTraces.map((trace) => {
            const isExpanded = expandedTraceIds.has(trace.id);
            const formattedInput = formatJson(trace.input_data);
            const formattedOutput = formatJson(trace.output_data);
            const badgeColor = getEventBadgeColor(trace.event_type, trace.status);
            const inlinePreview = getInlinePreview(trace);

            return (
              <div
                key={trace.id}
                className="rounded-xl border border-cv-line bg-cv-inset hover:border-cv-accent-line/40 transition overflow-hidden"
              >
                {/* Trace header row */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleTraceExpand(trace.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleTraceExpand(trace.id);
                    }
                  }}
                  className="p-3 flex items-center justify-between gap-2 cursor-pointer select-none text-xs font-mono"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="text-[11px] font-bold text-cv-fg bg-cv-surface border border-cv-line px-1.5 py-0.5 rounded shrink-0">
                      #{trace.step_number}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeColor} shrink-0`}
                    >
                      {trace.event_type}
                    </span>

                    <span className="text-[10px] text-cv-fg-2 px-1.5 py-0.5 rounded bg-cv-surface border border-cv-line shrink-0">
                      {trace.component} &rsaquo; {trace.action}
                    </span>

                    {trace.error_message && (
                      <span className="text-[11px] text-cv-error font-sans truncate">
                        &mdash; {trace.error_message}
                      </span>
                    )}

                    {inlinePreview && (
                      <span className="text-[11px] text-cv-fg-2 truncate hidden lg:inline font-sans">
                        &mdash; {inlinePreview}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        trace.status === "success"
                          ? "text-cv-success bg-cv-success-soft border-cv-success-line"
                          : trace.status === "failure"
                          ? "text-cv-error bg-cv-error-soft border-cv-error-line"
                          : "text-cv-warning bg-cv-warning-soft border-cv-warning-line"
                      }`}
                    >
                      {trace.status}
                    </span>
                    <span className="text-[10px] text-cv-fg-2 hidden md:inline">
                      {new Date(trace.timestamp).toLocaleTimeString()}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-cv-fg-2" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-cv-fg-2" />
                    )}
                  </div>
                </div>

                {/* Expanded Trace Inspector */}
                {isExpanded && (
                  <div className="px-4 pb-3.5 pt-2.5 border-t border-cv-line bg-cv-surface text-xs font-mono space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-cv-fg-2 text-[11px]">
                      <span>TIMESTAMP: {trace.timestamp}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyJson(trace)}
                        className="flex items-center space-x-1 text-cv-accent-ink hover:underline transition cursor-pointer"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{copiedId === trace.id ? "Copied!" : "Copy Step JSON"}</span>
                      </button>
                    </div>

                    {trace.error_message && (
                      <div className="p-2.5 rounded bg-cv-error-soft border border-cv-error-line text-cv-error text-xs font-mono flex items-start space-x-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block uppercase text-[10px]">
                            Error Detail:
                          </span>
                          <p>{trace.error_message}</p>
                        </div>
                      </div>
                    )}

                    {formattedInput && (
                      <div>
                        <span className="text-cv-fg-2 text-[10px] uppercase font-bold block mb-1">
                          Input Arguments Payload:
                        </span>
                        <pre className="p-2.5 rounded bg-cv-inset border border-cv-line text-[11px] text-cv-fg overflow-x-auto">
                          {formattedInput}
                        </pre>
                      </div>
                    )}

                    {formattedOutput && (
                      <div>
                        <span className="text-cv-fg-2 text-[10px] uppercase font-bold block mb-1">
                          Output / Observation Payload:
                        </span>
                        <pre className="p-2.5 rounded bg-cv-inset border border-cv-line text-[11px] text-cv-success overflow-x-auto">
                          {formattedOutput}
                        </pre>
                      </div>
                    )}
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
