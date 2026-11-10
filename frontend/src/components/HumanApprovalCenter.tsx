"use client";

import React from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { AgentState } from "../types/api";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

interface HumanApprovalCenterProps {
  state: AgentState | null;
  onApprove: (requestId: number) => Promise<void>;
  onReject: (requestId: number) => Promise<void>;
  isLoading: boolean;
}

export function HumanApprovalCenter({
  state,
  onApprove,
  onReject,
  isLoading,
}: HumanApprovalCenterProps) {
  const { experienceMode } = useTheme();
  const { user } = useAuth();

  const isAuthorizedApprover =
    user?.role === "administrator" ||
    user?.role === "system_administrator" ||
    user?.role === "faculty";

  // CRITICAL REQUIREMENT: Never display approval controls for a workflow that is not awaiting human approval
  if (
    !state ||
    state.current_status !== "WAITING_FOR_HUMAN" ||
    state.human_approval_status !== "PENDING"
  ) {
    return null;
  }

  const requestId = state.request_id;
  const normalizedParams = state.normalized_goal?.parameters || {};
  const reason = String(normalizedParams.reason || "personal leave");
  const days = String(normalizedParams.days || 1);

  const pendingTaskId = state.pending_tasks[0] || "t5";
  const pendingTask = state.plan.find((t) => t.task_id === pendingTaskId);
  const pendingTool =
    pendingTask?.candidate_tools[0] || "create_leave_application";

  const eligibilityPayload = state.tool_results?.["t4"] as
    | { eligible?: boolean; reason?: string }
    | undefined;

  return (
    <div className="rounded-2xl border border-cv-warning-line bg-cv-inset p-5 shadow-xs relative overflow-hidden select-none">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-cv-warning-line">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
            <ShieldAlert className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-sm font-bold tracking-tight text-cv-fg">
                {isAuthorizedApprover ? (
                  experienceMode === "simple" ? (
                    <>
                      Your Approval is <span className="text-cv-accent-ink">Required</span>
                    </>
                  ) : (
                    <>
                      Human-in-the-Loop <span className="text-cv-accent-ink">Approval Required</span>
                    </>
                  )
                ) : experienceMode === "simple" ? (
                  <>
                    Institutional Review <span className="text-cv-accent-ink">in Progress</span>
                  </>
                ) : (
                  <>
                    Institutional Gate <span className="text-cv-accent-ink">Awaiting Review</span>
                  </>
                )}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-cv-warning-soft border border-cv-warning-line text-cv-warning flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cv-warning animate-ping mr-1" />
                {isAuthorizedApprover
                  ? experienceMode === "simple"
                    ? "Needs Your Review"
                    : "Action Paused (Awaiting Admin)"
                  : "Awaiting Warden / Admin Review"}
              </span>
            </div>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              {isAuthorizedApprover
                ? experienceMode === "simple"
                  ? "Please review and authorize this student request to proceed with official submission."
                  : "The autonomous agent paused before executing a consequential campus administrative action. Administrative review required."
                : experienceMode === "simple"
                ? "Your leave request is queued and currently awaiting official authorization from the Warden / Faculty Advisor."
                : "Execution has halted before the consequential database write (`create_leave_application`). Paused for Warden / Administrator review."}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-cv-surface border border-cv-line text-cv-fg-2 shrink-0">
          Request #{requestId}
        </span>
      </div>

      {/* Action Details Card */}
      <div className="mt-4 p-4 rounded-xl bg-cv-surface border border-cv-line space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-cv-fg-2">
            {experienceMode === "simple" ? "STUDENT CONTEXT:" : "TARGET CONTEXT:"}
          </span>
          <span className="text-cv-accent-ink font-semibold flex items-center space-x-1.5">
            <User className="h-3.5 w-3.5" />
            <span>Student: {state.student_id}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-cv-inset border border-cv-line">
            <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
              {experienceMode === "simple" ? "Action to be Submitted" : "Consequential Task"}
            </span>
            <span className="text-xs font-semibold text-cv-fg mt-0.5 block">
              {experienceMode === "simple"
                ? "Submit Official Leave Application"
                : `Task ${pendingTask?.task_id || "t5"}: ${pendingTask?.description || "Create Leave Application"}`}
            </span>
            <span className="text-[11px] text-cv-fg-2 block mt-0.5 font-mono">
              {experienceMode === "simple"
                ? "Campus Service: Leave Administration"
                : <>Tool: <code className="text-cv-accent-ink">{pendingTool}</code></>}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-cv-inset border border-cv-line">
            <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
              {experienceMode === "simple" ? "Request Parameters" : "Normalized Parameters"}
            </span>
            <span className="text-xs font-medium text-cv-fg mt-0.5 block truncate">
              Reason: &ldquo;{reason}&rdquo;
            </span>
            <span className="text-[11px] text-cv-fg-2 block mt-0.5 font-mono">
              Duration: {days} day(s)
            </span>
          </div>
        </div>

        {/* Verification Checkmarks */}
        <div className="pt-2 text-xs text-cv-success space-y-1.5 font-sans">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              {experienceMode === "simple"
                ? "Student profile verified and active"
                : "Pre-condition 1: Student profile verified (`get_student_profile`)"}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              {experienceMode === "simple"
                ? `Attendance requirement satisfied (≥ 75%${eligibilityPayload?.reason ? ` — ${eligibilityPayload.reason}` : ""})`
                : `Pre-condition 2: Attendance threshold satisfied (\`>= 75%\`${eligibilityPayload?.reason ? ` — ${eligibilityPayload.reason}` : ""})`}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              {experienceMode === "simple"
                ? "University leave policy retrieved & validated"
                : "Pre-condition 3: Institutional leave policy retrieved (`get_leave_policy`)"}
            </span>
          </div>
        </div>
      </div>

      {/* Institutional Gate Notice Box */}
      <div className="mt-3 flex items-start space-x-2.5 text-xs text-cv-warning bg-cv-warning-soft p-3 rounded-xl border border-cv-warning-line">
        <AlertTriangle className="h-4 w-4 shrink-0 text-cv-warning mt-0.5" />
        <div className="text-xs leading-relaxed text-cv-fg">
          {isAuthorizedApprover ? (
            <p>
              {experienceMode === "simple"
                ? "Approving will officially submit this leave application to the university administration. Rejecting will cancel this request safely."
                : "Authorizing grants execution rights to submit the official campus leave application. Rejecting will terminate the workflow safely with an audit trail."}
            </p>
          ) : (
            <div>
              <p className="font-semibold text-cv-warning">
                Institutional Safety Gate: Awaiting Administrator / Warden Approval
              </p>
              <p className="text-cv-fg-2 mt-0.5">
                Students cannot self-approve official leave records. This request has paused at the Institutional Gate and is currently in the Admin Review Queue. You may withdraw this request at any time prior to approval.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Decision Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-cv-warning-line">
        {!isAuthorizedApprover ? (
          <>
            <div className="flex items-center space-x-2 text-xs text-cv-warning font-medium">
              <Clock className="h-3.5 w-3.5 animate-pulse" />
              <span>Awaiting Warden / Administrator Review</span>
            </div>

            <button
              type="button"
              onClick={() => onReject(requestId)}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-cv-error-soft hover:bg-cv-error-line text-cv-error border border-cv-error-line transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5 text-cv-error" />
              )}
              <span>{experienceMode === "simple" ? "Withdraw Request" : "Cancel Request"}</span>
            </button>
          </>
        ) : (
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => onReject(requestId)}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-cv-error-soft hover:bg-cv-error-line text-cv-error border border-cv-error-line transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5 text-cv-error" />
              )}
              <span>{experienceMode === "simple" ? "Reject Request" : "Reject Workflow"}</span>
            </button>

            <button
              type="button"
              onClick={() => onApprove(requestId)}
              disabled={isLoading}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold bg-cv-success-solid hover:bg-cv-success-solid-hover text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authorizing Application...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>
                    {experienceMode === "simple"
                      ? "Authorize & Submit Application"
                      : "Authorize & Continue Execution"}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
