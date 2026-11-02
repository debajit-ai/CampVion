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
          bg: "bg-[#B77932]/10 border-[#B77932]/30 text-[#B77932]",
          icon: <ShieldAlert className="h-4 w-4 text-[#B77932] animate-pulse" />,
          label: "Waiting For Human Approval",
          dot: "bg-[#B77932]",
        };
      case "EXECUTING":
      case "UNDERSTANDING":
      case "PLANNING":
      case "OBSERVING":
        return {
          bg: "bg-[#C66A43]/10 border-[#C66A43]/30 text-[#C66A43]",
          icon: <Activity className="h-4 w-4 text-[#C66A43] animate-spin" />,
          label: status === "EXECUTING" ? "Autonomous Execution" : status,
          dot: "bg-[#C66A43]",
        };
      case "COMPLETED":
        return {
          bg: "bg-[#287A53]/10 border-[#287A53]/30 text-[#287A53]",
          icon: <CheckCircle2 className="h-4 w-4 text-[#287A53]" />,
          label: "Goal Achieved Successfully",
          dot: "bg-[#287A53]",
        };
      case "FAILED":
        return {
          bg: "bg-[#C44E45]/10 border-[#C44E45]/30 text-[#C44E45]",
          icon: <AlertTriangle className="h-4 w-4 text-[#C44E45]" />,
          label: "Workflow Terminated / Failed",
          dot: "bg-[#C44E45]",
        };
      case "REPLANNING":
        return {
          bg: "bg-[#C66A43]/15 border-[#C66A43]/40 text-[#C66A43]",
          icon: <RotateCcw className="h-4 w-4 text-[#C66A43] animate-spin" />,
          label: "Dynamic Replanning Active",
          dot: "bg-[#C66A43]",
        };
      default:
        return {
          bg: "bg-[#F0ECE5] border-[#E8E2D9] text-[#77716A]",
          icon: <Clock className="h-4 w-4 text-[#77716A]" />,
          label: status,
          dot: "bg-[#A0988F]",
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
    if (status === "COMPLETED") return "bg-[#287A53]";
    if (status === "WAITING_FOR_HUMAN") return "bg-[#B77932]";
    if (status === "FAILED") return "bg-[#C44E45]";
    return "bg-[#C66A43]";
  };

  return (
    <div className="space-y-4">
      {/* Top Context & Quick Command Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#FFFFFF] border border-[#E8E2D9] shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusBadge.dot}`} />
          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#26231F]">
                OPERATIONS <span className="text-[#C66A43]">COMMAND</span>
              </span>
              <span className="text-[#DFD7CB]">&bull;</span>
              <span className="text-xs font-mono font-semibold text-[#26231F]">
                {activeRequestId ? `Active Request #REQ-${activeRequestId}` : "System Standby — Ready for Goal Dispatch"}
              </span>
              {state?.student_id && (
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#F0ECE5] border border-[#E8E2D9] text-[#77716A]">
                  Student: {state.student_id}
                </span>
              )}
              {state?.normalized_goal?.goal_type && (
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#F5E7DE] border border-[#E8E2D9] text-[#C66A43]">
                  {state.normalized_goal.goal_type}
                </span>
              )}
            </div>
            {state?.original_goal && (
              <p className="text-xs text-[#77716A] truncate mt-0.5 font-mono">
                Goal: &ldquo;{state.original_goal}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Right Controls: Lookup Request ID, Refresh, New Goal */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <form onSubmit={handleLookupSubmit} className="flex items-center">
            <div className="relative flex items-center">
              <Search className="h-3 w-3 text-[#A0988F] absolute left-2.5 pointer-events-none" />
              <input
                type="number"
                min={1}
                value={lookupIdInput}
                onChange={(e) => setLookupIdInput(e.target.value)}
                placeholder="Load Req #"
                aria-label="Load workflow by request ID"
                className="w-28 pl-7 pr-2 py-1 rounded-l-md bg-[#FAF7F2] border border-[#E8E2D9] text-xs font-mono text-[#26231F] placeholder-[#A0988F] focus:outline-none focus:border-[#C66A43]"
              />
              <button
                type="submit"
                disabled={isLoading || !lookupIdInput.trim()}
                className="px-2.5 py-1 rounded-r-md bg-[#F0ECE5] border border-l-0 border-[#E8E2D9] hover:border-[#C66A43] text-xs font-mono text-[#26231F] transition disabled:opacity-40 cursor-pointer"
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
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#C66A43] text-xs font-mono text-[#26231F] transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin text-[#C66A43]" : ""}`} />
              <span>Sync</span>
            </button>
          )}

          {onFocusComposer && (
            <button
              type="button"
              onClick={onFocusComposer}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-[#C66A43] hover:bg-[#AD5735] text-xs font-medium text-white shadow-xs transition cursor-pointer"
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
        <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#26231F] mb-2.5">
            <span>
              WORKFLOW <span className="text-[#C66A43]">STATE</span>
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#FAF7F2] border border-[#E8E2D9] text-[#77716A] font-normal">
              {activeRequestId ? `#REQ-${activeRequestId}` : "IDLE"}
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
          <div className="mt-3 pt-2.5 border-t border-[#E8E2D9] flex items-center justify-between text-[11px] font-mono text-[#77716A]">
            <span>GOVERNANCE GATE:</span>
            <span
              className={
                state?.human_approval_status === "APPROVED"
                  ? "text-[#287A53] font-semibold"
                  : state?.human_approval_status === "PENDING"
                  ? "text-[#B77932] font-semibold"
                  : state?.human_approval_status === "REJECTED"
                  ? "text-[#C44E45] font-semibold"
                  : "text-[#A0988F]"
              }
            >
              {state?.human_approval_status || "NONE"}
            </span>
          </div>
        </div>

        {/* Metric 2: Completed Tasks */}
        <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#26231F] mb-2">
            <span>
              TASK <span className="text-[#C66A43]">PROGRESSION</span>
            </span>
            <Zap className="h-3.5 w-3.5 text-[#C66A43]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-[#26231F]">{completedCount}</span>
              <span className="text-xs text-[#77716A] font-mono">/ {totalTasks} tasks</span>
            </div>
            {failedCount > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#C44E45]/10 border border-[#C44E45]/30 text-[#C44E45]">
                {failedCount} failed
              </span>
            )}
          </div>
          <div className="w-full bg-[#F0ECE5] rounded-full h-1.5 mt-3 overflow-hidden border border-[#E8E2D9]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                currentStatus === "FAILED"
                  ? "bg-gradient-to-r from-[#C66A43] to-[#C44E45]"
                  : currentStatus === "COMPLETED"
                  ? "bg-gradient-to-r from-[#287A53] to-[#34A870]"
                  : "bg-gradient-to-r from-[#C66A43] to-[#E0855C]"
              }`}
              style={{
                width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-[#77716A]">
            <span>{completedCount} completed</span>
            <span>{state?.pending_tasks.length ?? 0} pending</span>
          </div>
        </div>

        {/* Metric 3: Replanning & Retries */}
        <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#26231F] mb-2">
            <span>
              REPLANNING <span className="text-[#C66A43]">EVENTS</span>
            </span>
            <RotateCcw className="h-3.5 w-3.5 text-[#C66A43]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-[#26231F]">{replanCount}</span>
            <span className="text-xs text-[#77716A] font-mono">/ 3 max allowed</span>
          </div>
          <p className="text-[11px] text-[#77716A] mt-2.5 pt-2 border-t border-[#E8E2D9]">
            {replanCount === 0
              ? "Nominal path (0 recoveries needed)"
              : currentStatus === "FAILED" && replanCount >= 3
              ? `Bounded retry limit (${replanCount}/3) reached`
              : `${replanCount} transient failure(s) self-healed`}
          </p>
        </div>

        {/* Metric 4: Registered Tools & Latency */}
        <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#26231F] mb-2">
            <span>
              TOOL REGISTRY &amp; <span className="text-[#C66A43]">LATENCY</span>
            </span>
            <Wrench className="h-3.5 w-3.5 text-[#C66A43]" />
          </div>
          <div className="flex items-baseline space-x-3">
            <div>
              <span className="text-2xl font-bold font-mono text-[#26231F]">{tools.length}</span>
              <span className="text-xs text-[#77716A] font-mono ml-1">tools</span>
            </div>
            {invokedToolsCount > 0 && (
              <div className="border-l border-[#E8E2D9] pl-3">
                <span className="text-sm font-mono text-[#287A53] font-semibold">
                  {invokedToolsCount}
                </span>
                <span className="text-[10px] text-[#A0988F] block font-mono">invoked</span>
              </div>
            )}
            {executionTime > 0 && (
              <div className="border-l border-[#E8E2D9] pl-3">
                <span className="text-sm font-mono text-[#C66A43] font-semibold">
                  {executionTime}s
                </span>
                <span className="text-[10px] text-[#A0988F] block font-mono">runtime</span>
              </div>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#E8E2D9] flex items-center justify-between gap-2">
            <p className="text-[11px] text-[#77716A] truncate font-mono">
              {tools.length > 0
                ? `${tools.map((t) => t.name).slice(0, 2).join(", ")} +${Math.max(0, tools.length - 2)} more`
                : "No tools loaded"}
            </p>
            {onNavigateToSection && (
              <button
                type="button"
                onClick={() => onNavigateToSection("registry")}
                className="inline-flex items-center space-x-0.5 text-[11px] font-mono text-[#C66A43] hover:text-[#AD5735] shrink-0 cursor-pointer"
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
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-[#FFFFFF] border border-[#E8E2D9] text-xs font-mono overflow-x-auto shadow-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-[#26231F] font-semibold shrink-0">
              SESSION <span className="text-[#C66A43]">WORKFLOWS</span>:
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
                        ? "bg-[#F5E7DE] border-[#C66A43] text-[#C66A43] font-semibold"
                        : "bg-[#FAF7F2] border-[#E8E2D9] text-[#77716A] hover:text-[#26231F] hover:border-[#C66A43]/50"
                    }`}
                  >
                    {summary && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${getSummaryDotColor(summary.status)}`}
                      />
                    )}
                    <span>Req #{id}</span>
                    {summary?.student_id && (
                      <span className="text-[10px] text-[#A0988F]">({summary.student_id})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <span className="text-[11px] text-[#A0988F] hidden sm:inline shrink-0">
            Select a record to synchronize plan, governance &amp; trace
          </span>
        </div>
      )}
    </div>
  );
}
