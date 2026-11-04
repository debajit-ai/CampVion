"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Wrench,
  Zap,
} from "lucide-react";
import {
  AgentResult,
  AgentState,
  ToolSchema,
  WorkflowSessionSummary,
  WorkflowStatus,
  WorkspaceSection,
} from "../types/api";
import { useTheme } from "../context/ThemeContext";

interface OverviewDashboardProps {
  state: AgentState | null;
  result: AgentResult | null;
  tools: ToolSchema[];
  recentRequestIds: number[];
  activeRequestId: number | null;
  onSelectRequestId: (id: number) => void;
  isLoading: boolean;
  sessionSummaries?: Record<number, WorkflowSessionSummary>;
  onRefreshActiveRequest?: () => void;
  onNavigateToSection?: (section: WorkspaceSection) => void;
  onFocusComposer?: () => void;
}

export function OverviewDashboard({
  state,
  result,
  tools,
  recentRequestIds,
  activeRequestId,
  onSelectRequestId,
  isLoading,
  sessionSummaries = {},
  onRefreshActiveRequest,
  onNavigateToSection,
  onFocusComposer,
}: OverviewDashboardProps) {
  const { experienceMode } = useTheme();
  const [lookupIdInput, setLookupIdInput] = useState<string>("");

  const currentStatus: WorkflowStatus = state?.current_status || result?.status || "IDLE";
  const completedCount = state?.completed_tasks.length ?? result?.completed_tasks.length ?? 0;
  const failedCount = state?.failed_tasks.length ?? result?.failed_tasks.length ?? 0;
  const totalTasks = state?.plan.length || 6;
  const replanCount = state?.replanning_count ?? result?.replanning_count ?? 0;
  const executionTime = result?.execution_time ?? 0;
  const invokedToolsCount = state ? Object.keys(state.selected_tools || {}).length : 0;

  const getStatusBadge = (status: WorkflowStatus) => {
    switch (status) {
      case "WAITING_FOR_HUMAN":
        return {
          bg: "bg-cv-warning-solid/10 border-cv-warning/30 text-cv-warning",
          icon: <ShieldAlert className="h-4 w-4 text-cv-warning animate-pulse" />,
          label: experienceMode === "simple" ? "Waiting for Your Approval" : "Waiting For Human Approval",
          dot: "bg-cv-warning-solid",
        };
      case "EXECUTING":
      case "UNDERSTANDING":
      case "PLANNING":
      case "OBSERVING":
        return {
          bg: "bg-cv-accent/10 border-cv-accent-line/30 text-cv-accent-ink",
          icon: <Activity className="h-4 w-4 text-cv-accent-ink animate-spin" />,
          label: experienceMode === "simple" ? "Processing Your Request" : status === "EXECUTING" ? "Autonomous Execution" : status,
          dot: "bg-cv-accent",
        };
      case "COMPLETED":
        return {
          bg: "bg-cv-success-solid/10 border-cv-success/30 text-cv-success",
          icon: <CheckCircle2 className="h-4 w-4 text-cv-success" />,
          label: experienceMode === "simple" ? "Request Completed Successfully" : "Goal Achieved Successfully",
          dot: "bg-cv-success-solid",
        };
      case "FAILED":
        return {
          bg: "bg-cv-error-solid/10 border-cv-error/30 text-cv-error",
          icon: <AlertTriangle className="h-4 w-4 text-cv-error" />,
          label: experienceMode === "simple" ? "Unable to Complete Request" : "Workflow Terminated / Failed",
          dot: "bg-cv-error-solid",
        };
      case "REPLANNING":
        return {
          bg: "bg-cv-accent/15 border-cv-accent-line/40 text-cv-accent-ink",
          icon: <RotateCcw className="h-4 w-4 text-cv-accent-ink animate-spin" />,
          label: experienceMode === "simple" ? "Trying Another Approach" : "Dynamic Replanning Active",
          dot: "bg-cv-accent",
        };
      default:
        return {
          bg: "bg-cv-raised border-cv-line text-cv-fg-2",
          icon: <Clock className="h-4 w-4 text-cv-fg-2" />,
          label: experienceMode === "simple" ? "Ready" : status,
          dot: "bg-cv-fg-3",
        };
    }
  };

  const statusBadge = getStatusBadge(currentStatus);

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(lookupIdInput.trim(), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      onSelectRequestId(parsed);
      setLookupIdInput("");
    }
  };

  const getSummaryDotColor = (status?: WorkflowStatus) => {
    if (status === "COMPLETED") return "bg-cv-success-solid";
    if (status === "WAITING_FOR_HUMAN") return "bg-cv-warning-solid";
    if (status === "FAILED") return "bg-cv-error-solid";
    return "bg-cv-accent";
  };

  return (
    <div className="space-y-4">
      {/* Top Context & Quick Command Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-cv-surface border border-cv-line shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusBadge.dot}`} />
          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-cv-fg">
                OPERATIONS <span className="text-cv-accent-ink">COMMAND</span>
              </span>
              <span className="text-cv-line-strong">&bull;</span>
              <span className="text-xs font-mono font-semibold text-cv-fg">
                {activeRequestId ? `Active Request #REQ-${activeRequestId}` : "System Standby — Ready for Goal Dispatch"}
              </span>
              {state?.student_id && (
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-cv-raised border border-cv-line text-cv-fg-2">
                  Student: {state.student_id}
                </span>
              )}
              {state?.normalized_goal?.goal_type && (
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-cv-accent-soft border border-cv-line text-cv-accent-ink">
                  {state.normalized_goal.goal_type}
                </span>
              )}
            </div>
            {state?.original_goal && (
              <p className="text-xs text-cv-fg-2 truncate mt-0.5 font-mono">
                Goal: &ldquo;{state.original_goal}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Right Controls: Lookup Request ID, Refresh, New Goal */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <form onSubmit={handleLookupSubmit} className="flex items-center">
            <div className="relative flex items-center">
              <Search className="h-3 w-3 text-cv-fg-3 absolute left-2.5 pointer-events-none" />
              <input
                type="number"
                min={1}
                value={lookupIdInput}
                onChange={(e) => setLookupIdInput(e.target.value)}
                placeholder="Load Req #"
                aria-label="Load workflow by request ID"
                className="w-28 pl-7 pr-2 py-1 rounded-l-md bg-cv-inset border border-cv-line text-xs font-mono text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
              />
              <button
                type="submit"
                disabled={isLoading || !lookupIdInput.trim()}
                className="px-2.5 py-1 rounded-r-md bg-cv-raised border border-l-0 border-cv-line hover:border-cv-accent-line text-xs font-mono text-cv-fg transition disabled:opacity-40 cursor-pointer"
              >
                Load
              </button>
            </div>
          </form>

          {activeRequestId && onRefreshActiveRequest && (
            <button
              type="button"
              onClick={onRefreshActiveRequest}
              disabled={isLoading}
              title="Refresh active workflow state and trace"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-cv-inset border border-cv-line hover:border-cv-accent-line text-xs font-mono text-cv-fg transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin text-cv-accent-ink" : ""}`} />
              <span>Sync</span>
            </button>
          )}

          {onFocusComposer && (
            <button
              type="button"
              onClick={onFocusComposer}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-cv-accent hover:bg-cv-accent-hover text-xs font-medium text-cv-on-accent shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Dispatch</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Core Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Current Status */}
        <div className="bg-cv-surface border border-cv-line rounded-xl p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-cv-fg mb-2.5">
            <span>
              {experienceMode === "simple" ? (
                <>REQUEST <span className="text-cv-accent-ink">STATUS</span></>
              ) : (
                <>WORKFLOW <span className="text-cv-accent-ink">STATE</span></>
              )}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-cv-inset border border-cv-line text-cv-fg-2 font-normal">
              {activeRequestId ? `Request #${activeRequestId}` : "Ready"}
            </span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <div
              className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-md text-xs font-medium border ${statusBadge.bg}`}
            >
              {statusBadge.icon}
              <span>{statusBadge.label}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-cv-line flex items-center justify-between text-[11px] font-mono text-cv-fg-2">
            <span>{experienceMode === "simple" ? "APPROVAL STATUS:" : "GOVERNANCE GATE:"}</span>
            <span
              className={
                state?.human_approval_status === "APPROVED"
                  ? "text-cv-success font-semibold"
                  : state?.human_approval_status === "PENDING"
                  ? "text-cv-warning font-semibold"
                  : state?.human_approval_status === "REJECTED"
                  ? "text-cv-error font-semibold"
                  : "text-cv-fg-3"
              }
            >
              {state?.human_approval_status === "PENDING"
                ? "Approval Needed"
                : state?.human_approval_status === "APPROVED"
                ? "Approved"
                : state?.human_approval_status === "REJECTED"
                ? "Rejected"
                : "None Required"}
            </span>
          </div>
        </div>

        {/* Metric 2: Completed Tasks */}
        <div className="bg-cv-surface border border-cv-line rounded-xl p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-cv-fg mb-2">
            <span>
              {experienceMode === "simple" ? (
                <>CURRENT <span className="text-cv-accent-ink">PROGRESS</span></>
              ) : (
                <>TASK <span className="text-cv-accent-ink">PROGRESSION</span></>
              )}
            </span>
            <Zap className="h-3.5 w-3.5 text-cv-accent-ink" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-cv-fg">{completedCount}</span>
              <span className="text-xs text-cv-fg-2 font-mono">
                / {totalTasks} {experienceMode === "simple" ? "steps" : "tasks"}
              </span>
            </div>
            {failedCount > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-cv-error-solid/10 border border-cv-error/30 text-cv-error">
                {failedCount} failed
              </span>
            )}
          </div>
          <div className="w-full bg-cv-raised rounded-full h-1.5 mt-3 overflow-hidden border border-cv-line">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                currentStatus === "FAILED"
                  ? "bg-gradient-to-r from-cv-accent to-cv-error-solid"
                  : currentStatus === "COMPLETED"
                  ? "bg-gradient-to-r from-cv-success-solid to-cv-success-solid"
                  : "bg-gradient-to-r from-cv-accent to-cv-accent"
              }`}
              style={{
                width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-cv-fg-2">
            <span>{completedCount} completed</span>
            <span>{state?.pending_tasks.length ?? 0} remaining</span>
          </div>
        </div>

        {/* Metric 3: Replanning & Retries */}
        <div className="bg-cv-surface border border-cv-line rounded-xl p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-cv-fg mb-2">
            <span>
              {experienceMode === "simple" ? (
                <>AUTOMATIC <span className="text-cv-accent-ink">RECOVERY</span></>
              ) : (
                <>REPLANNING <span className="text-cv-accent-ink">EVENTS</span></>
              )}
            </span>
            <RotateCcw className="h-3.5 w-3.5 text-cv-accent-ink" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-cv-fg">{replanCount}</span>
            <span className="text-xs text-cv-fg-2 font-mono">
              {experienceMode === "simple" ? "auto-recoveries" : "/ 3 max allowed"}
            </span>
          </div>
          <p className="text-[11px] text-cv-fg-2 mt-2.5 pt-2 border-t border-cv-line">
            {replanCount === 0
              ? experienceMode === "simple"
                ? "Direct execution path (0 errors)"
                : "Nominal path (0 recoveries needed)"
              : currentStatus === "FAILED" && replanCount >= 3
              ? `Bounded retry limit (${replanCount}/3) reached`
              : `${replanCount} temporary delay(s) automatically recovered`}
          </p>
        </div>

        {/* Metric 4: Registered Tools & Latency */}
        <div className="bg-cv-surface border border-cv-line rounded-xl p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-cv-fg mb-2">
            <span>
              {experienceMode === "simple" ? (
                <>CAMPUS <span className="text-cv-accent-ink">SERVICES</span></>
              ) : (
                <>TOOL REGISTRY &amp; <span className="text-cv-accent-ink">LATENCY</span></>
              )}
            </span>
            <Wrench className="h-3.5 w-3.5 text-cv-accent-ink" />
          </div>
          <div className="flex items-baseline space-x-3">
            <div>
              <span className="text-2xl font-bold font-mono text-cv-fg">{tools.length}</span>
              <span className="text-xs text-cv-fg-2 font-mono ml-1">tools</span>
            </div>
            {invokedToolsCount > 0 && (
              <div className="border-l border-cv-line pl-3">
                <span className="text-sm font-mono text-cv-success font-semibold">
                  {invokedToolsCount}
                </span>
                <span className="text-[10px] text-cv-fg-3 block font-mono">invoked</span>
              </div>
            )}
            {executionTime > 0 && (
              <div className="border-l border-cv-line pl-3">
                <span className="text-sm font-mono text-cv-accent-ink font-semibold">
                  {executionTime}s
                </span>
                <span className="text-[10px] text-cv-fg-3 block font-mono">runtime</span>
              </div>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-cv-line flex items-center justify-between gap-2">
            <p className="text-[11px] text-cv-fg-2 truncate font-mono">
              {tools.length > 0
                ? `${tools.map((t) => t.name).slice(0, 2).join(", ")} +${Math.max(0, tools.length - 2)} more`
                : "No tools loaded"}
            </p>
            {onNavigateToSection && (
              <button
                type="button"
                onClick={() => onNavigateToSection("registry")}
                className="inline-flex items-center space-x-0.5 text-[11px] font-mono text-cv-accent-ink hover:text-cv-accent-ink-hover shrink-0 cursor-pointer"
              >
                <span>Inspect</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent requests quick selector */}
      {recentRequestIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-cv-surface border border-cv-line text-xs font-mono overflow-x-auto shadow-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-cv-fg font-semibold shrink-0">
              SESSION <span className="text-cv-accent-ink">WORKFLOWS</span>:
            </span>
            <div className="flex items-center space-x-1.5">
              {recentRequestIds.map((id) => {
                const summary = sessionSummaries[id];
                const isSelected = activeRequestId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectRequestId(id)}
                    disabled={isLoading}
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition border cursor-pointer ${
                      isSelected
                        ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink font-semibold"
                        : "bg-cv-inset border-cv-line text-cv-fg-2 hover:text-cv-fg hover:border-cv-accent-line/50"
                    }`}
                  >
                    {summary && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${getSummaryDotColor(summary.status)}`}
                      />
                    )}
                    <span>Req #{id}</span>
                    {summary?.student_id && (
                      <span className="text-[10px] text-cv-fg-3">({summary.student_id})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <span className="text-[11px] text-cv-fg-3 hidden sm:inline shrink-0">
            Select a record to synchronize plan, governance &amp; trace
          </span>
        </div>
      )}
    </div>
  );
}
