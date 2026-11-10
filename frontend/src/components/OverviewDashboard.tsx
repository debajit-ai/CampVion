"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  Wrench,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  AgentResult,
  AgentState,
  PendingApprovalItem,
  ToolSchema,
  UserProfile,
  WorkflowSessionSummary,
  WorkflowStatus,
  WorkspaceSection,
} from "../types/api";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/api";

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
  user?: UserProfile | null;
  onApproveWorkflow?: (requestId: number) => Promise<void>;
  onRejectWorkflow?: (requestId: number) => Promise<void>;
  onRefreshPendingApprovals?: () => void;
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
  user,
  onApproveWorkflow,
  onRejectWorkflow,
  onRefreshPendingApprovals,
}: OverviewDashboardProps) {
  const { experienceMode } = useTheme();
  const { user: authUser } = useAuth();
  const effectiveUser = user || authUser;
  const roleStr = (effectiveUser?.role || "").toLowerCase();
  const isAdmin = roleStr === "administrator" || roleStr === "system_administrator";

  const [lookupIdInput, setLookupIdInput] = useState<string>("");

  // Pending Approvals Queue State for Administrators
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState<boolean>(false);
  const [approvalActionId, setApprovalActionId] = useState<number | null>(null);
  const [approvalsFilter, setApprovalsFilter] = useState<string>("");
  const [displayLimit, setDisplayLimit] = useState<number>(6);
  const [actionNotification, setActionNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setApprovalsLoading(true);
      const items = await apiClient.listPendingApprovals();
      setPendingApprovals(items);
      if (onRefreshPendingApprovals) {
        onRefreshPendingApprovals();
      }
    } catch (err: unknown) {
      console.error("Failed to fetch pending approvals:", err);
    } finally {
      setApprovalsLoading(false);
    }
  }, [isAdmin, onRefreshPendingApprovals]);

  useEffect(() => {
    if (isAdmin) {
      fetchApprovals();
    }
  }, [isAdmin, fetchApprovals]);

  const handleApproveItem = async (requestId: number) => {
    try {
      setApprovalActionId(requestId);
      if (onApproveWorkflow) {
        await onApproveWorkflow(requestId);
      } else {
        await apiClient.approveWorkflow(requestId);
      }
      setActionNotification({
        message: `Request #REQ-${requestId} approved! Autonomous DAG workflow resumed to completion.`,
        type: "success",
      });
      setPendingApprovals((prev) => prev.filter((item) => item.request_id !== requestId));
      onSelectRequestId(requestId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setActionNotification({ message: msg, type: "error" });
    } finally {
      setApprovalActionId(null);
    }
  };

  const handleRejectItem = async (requestId: number) => {
    try {
      setApprovalActionId(requestId);
      if (onRejectWorkflow) {
        await onRejectWorkflow(requestId);
      } else {
        await apiClient.rejectWorkflow(requestId);
      }
      setActionNotification({
        message: `Request #REQ-${requestId} rejected. Workflow terminated per human administrative decision.`,
        type: "error",
      });
      setPendingApprovals((prev) => prev.filter((item) => item.request_id !== requestId));
      onSelectRequestId(requestId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rejection failed";
      setActionNotification({ message: msg, type: "error" });
    } finally {
      setApprovalActionId(null);
    }
  };

  const filteredApprovals = useMemo(() => {
    if (!approvalsFilter.trim()) return pendingApprovals;
    const query = approvalsFilter.toLowerCase();
    return pendingApprovals.filter(
      (item) =>
        item.student_name.toLowerCase().includes(query) ||
        item.student_id.toLowerCase().includes(query) ||
        item.goal.toLowerCase().includes(query) ||
        String(item.request_id).includes(query) ||
        (item.assigned_approver && item.assigned_approver.toLowerCase().includes(query))
    );
  }, [pendingApprovals, approvalsFilter]);

  const displayedApprovals = useMemo(() => {
    return filteredApprovals.slice(0, displayLimit);
  }, [filteredApprovals, displayLimit]);

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

      {/* ========================================================================= */}
      {/* 🛡️ ADMINISTRATOR PENDING APPROVALS QUEUE (FRONT AND CENTER FOR ADMINS)     */}
      {/* ========================================================================= */}
      {isAdmin && (
        <div className="bg-cv-surface border-2 border-cv-warning-line/70 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cv-line">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-cv-warning-soft border border-cv-warning-line text-cv-warning shrink-0">
                <ShieldAlert className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h3 className="text-sm font-bold tracking-tight text-cv-fg font-sans uppercase">
                    Institutional Governance &amp; <span className="text-cv-accent-ink">Admin Approval Queue</span>
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
                    {pendingApprovals.length} PENDING
                  </span>
                </div>
                <p className="text-xs text-cv-fg-2 mt-0.5 font-sans">
                  Multi-step workflows paused at Human-in-the-Loop policy checkpoints awaiting administrative action.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={fetchApprovals}
                disabled={approvalsLoading}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cv-inset border border-cv-line hover:border-cv-accent-line text-xs font-mono text-cv-fg transition cursor-pointer disabled:opacity-50"
                title="Refresh approval queue from database"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${approvalsLoading ? "animate-spin text-cv-accent-ink" : ""}`} />
                <span>Refresh Queue</span>
              </button>
            </div>
          </div>

          {/* Search / Filter and Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="h-3.5 w-3.5 text-cv-fg-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={approvalsFilter}
                onChange={(e) => setApprovalsFilter(e.target.value)}
                placeholder="Filter by student name, ID, or goal keyword..."
                className="w-full pl-9 pr-7 py-1.5 rounded-lg bg-cv-inset border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
              />
              {approvalsFilter && (
                <button
                  type="button"
                  onClick={() => setApprovalsFilter("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cv-fg-3 hover:text-cv-fg text-xs"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <span className="text-[11px] font-mono text-cv-fg-2">
              Showing {displayedApprovals.length} of {filteredApprovals.length} request(s)
            </span>
          </div>

          {/* Notification feedback banner if any */}
          {actionNotification && (
            <div
              className={`px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between ${
                actionNotification.type === "success"
                  ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                  : "bg-cv-error-soft border-cv-error-line text-cv-error"
              }`}
            >
              <div className="flex items-center space-x-2">
                {actionNotification.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span className="font-medium">{actionNotification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNotification(null)}
                className="p-1 hover:opacity-75 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Queue List */}
          {approvalsLoading && pendingApprovals.length === 0 ? (
            <div className="p-8 text-center rounded-lg bg-cv-inset border border-cv-line">
              <Loader2 className="h-6 w-6 animate-spin text-cv-accent-ink mx-auto mb-2" />
              <p className="text-xs font-mono text-cv-fg-2">Querying database for pending student workflows...</p>
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="p-8 text-center rounded-lg bg-cv-inset border border-cv-line space-y-2">
              <ShieldCheck className="h-8 w-8 text-cv-success mx-auto" />
              <h4 className="text-xs font-bold font-mono uppercase text-cv-fg">Queue Clear</h4>
              <p className="text-xs text-cv-fg-2">
                {approvalsFilter
                  ? "No pending approvals match your search filter."
                  : "No campus service workflows are currently paused for human approval."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedApprovals.map((item) => {
                const isOperating = approvalActionId === item.request_id;
                return (
                  <div
                    key={item.request_id}
                    className="p-4 rounded-xl bg-cv-surface border border-cv-line hover:border-cv-accent-line/40 transition-all shadow-xs space-y-3"
                  >
                    {/* Top Row: Request ID, Status, Student info, Approver Role */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cv-raised border border-cv-line text-cv-fg">
                          #REQ-{item.request_id}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cv-warning-soft border border-cv-warning-line text-cv-warning flex items-center space-x-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-cv-warning-solid animate-pulse" />
                          <span>WAITING FOR HUMAN</span>
                        </span>
                        <span className="text-xs font-semibold text-cv-fg flex items-center space-x-1">
                          <User className="h-3.5 w-3.5 text-cv-accent-ink" />
                          <span>{item.student_name}</span>
                          <span className="text-[11px] font-mono text-cv-fg-2 font-normal">({item.student_id})</span>
                        </span>
                        {item.student_email && (
                          <span className="text-[11px] text-cv-fg-3 font-mono hidden md:inline">
                            &bull; {item.student_email}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cv-inset border border-cv-line text-cv-fg-2">
                          Approver: {item.assigned_approver || "Academic Administrator"}
                        </span>
                        {item.created_at && (
                          <span className="text-[10px] font-mono text-cv-fg-3 hidden lg:inline">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Student's Natural Language Request */}
                    <div className="p-3 rounded-lg bg-cv-inset border border-cv-line/60">
                      <div className="text-[11px] font-mono text-cv-fg-2 uppercase tracking-wide mb-1 flex items-center space-x-1">
                        <FileText className="h-3 w-3 text-cv-accent-ink" />
                        <span>Student Natural Language Goal:</span>
                      </div>
                      <p className="text-xs font-mono text-cv-fg font-medium">
                        &ldquo;{item.goal}&rdquo;
                      </p>
                    </div>

                    {/* Metadata Context Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded bg-cv-raised border border-cv-line">
                        <span className="text-cv-fg-3 block text-[9px] uppercase">Duration &amp; Type</span>
                        <span className="font-semibold text-cv-fg capitalize">
                          {item.days || 1} day(s) &bull; {item.category || "General"}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-cv-raised border border-cv-line">
                        <span className="text-cv-fg-3 block text-[9px] uppercase">Verified Attendance</span>
                        <span className="font-semibold text-cv-success">
                          {item.attendance_percentage !== null && item.attendance_percentage !== undefined
                            ? `${item.attendance_percentage.toFixed(1)}% (Eligible)`
                            : "Verified (≥75%)"}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-cv-raised border border-cv-line col-span-2">
                        <span className="text-cv-fg-3 block text-[9px] uppercase">Paused DAG Task</span>
                        <span className="font-semibold text-cv-warning truncate block">
                          {item.pending_task_description || "Create leave application (requires authorization)"}
                        </span>
                      </div>
                    </div>

                    {/* Actions Strip */}
                    <div className="pt-2 border-t border-cv-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRequestId(item.request_id);
                          if (onNavigateToSection) onNavigateToSection("workspace");
                        }}
                        className="inline-flex items-center space-x-1.5 text-xs font-mono text-cv-fg-2 hover:text-cv-accent-ink transition cursor-pointer"
                        title="View DAG plan and trace for this request"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect DAG &amp; Traces</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleRejectItem(item.request_id)}
                          disabled={isOperating || isLoading}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cv-surface hover:bg-cv-error-soft text-cv-fg hover:text-cv-error border border-cv-line hover:border-cv-error-line transition cursor-pointer disabled:opacity-40"
                          title="Reject request and terminate autonomous workflow"
                        >
                          <XCircle className="h-3.5 w-3.5 text-cv-error" />
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApproveItem(item.request_id)}
                          disabled={isOperating || isLoading}
                          className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-cv-success-solid hover:bg-cv-success-solid/90 text-white shadow-xs transition cursor-pointer disabled:opacity-40"
                          title="Approve request and resume DAG execution"
                        >
                          {isOperating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Resuming DAG...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Approve Workflow</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination / View More */}
              {filteredApprovals.length > 6 && (
                <div className="flex items-center justify-between pt-2 text-xs font-mono">
                  <span className="text-cv-fg-2">
                    Showing {Math.min(displayLimit, filteredApprovals.length)} of {filteredApprovals.length}
                  </span>
                  <div className="flex items-center space-x-2">
                    {displayLimit < filteredApprovals.length ? (
                      <button
                        type="button"
                        onClick={() => setDisplayLimit((prev) => prev + 10)}
                        className="px-3 py-1 rounded bg-cv-raised border border-cv-line hover:border-cv-accent-line text-cv-fg text-xs cursor-pointer"
                      >
                        Show More (+10)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDisplayLimit(6)}
                        className="px-3 py-1 rounded bg-cv-raised border border-cv-line hover:border-cv-accent-line text-cv-fg text-xs cursor-pointer"
                      >
                        Show Less
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
