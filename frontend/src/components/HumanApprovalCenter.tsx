"use client";

import React from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { AgentState } from "../types/api";

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
    <div className="rounded-2xl border border-[#F0D9BC] bg-[#FFF9F2] p-5 shadow-xs relative overflow-hidden select-none">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#F0D9BC]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932]">
            <ShieldAlert className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-sm font-bold tracking-tight text-[#26231F]">
                Human-in-the-Loop <span className="text-[#C66A43]">Approval Required</span>
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932]">
                Action Paused
              </span>
            </div>
            <p className="text-xs text-[#77716A] mt-0.5">
              The autonomous agent paused before executing a consequential campus administrative action.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[#77716A] shrink-0">
          Req #{requestId}
        </span>
      </div>

      {/* Action Details Card */}
      <div className="mt-4 p-4 rounded-xl bg-[#FFFFFF] border border-[#E8E2D9] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[#77716A]">TARGET CONTEXT:</span>
          <span className="text-[#C66A43] font-semibold flex items-center space-x-1.5">
            <User className="h-3.5 w-3.5" />
            <span>Student: {state.student_id}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9]">
            <span className="text-[10px] uppercase font-semibold text-[#77716A] block">
              Consequential Task
            </span>
            <span className="text-xs font-semibold text-[#26231F] mt-0.5 block">
              Task {pendingTask?.task_id || "t5"}:{" "}
              {pendingTask?.description || "Create Leave Application"}
            </span>
            <span className="text-[11px] text-[#77716A] block mt-0.5 font-mono">
              Tool: <code className="text-[#C66A43]">{pendingTool}</code>
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9]">
            <span className="text-[10px] uppercase font-semibold text-[#77716A] block">
              Normalized Parameters
            </span>
            <span className="text-xs font-medium text-[#26231F] mt-0.5 block truncate">
              Reason: &ldquo;{reason}&rdquo;
            </span>
            <span className="text-[11px] text-[#77716A] block mt-0.5 font-mono">
              Duration: {days} day(s)
            </span>
          </div>
        </div>

        {/* Verification Checkmarks */}
        <div className="pt-2 text-xs text-[#287A53] space-y-1.5 font-sans">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Pre-condition 1: Student profile verified (`get_student_profile`)</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              Pre-condition 2: Attendance threshold satisfied (`&gt;= 75%`
              {eligibilityPayload?.reason ? ` — ${eligibilityPayload.reason}` : ""})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Pre-condition 3: Institutional leave policy retrieved (`get_leave_policy`)</span>
          </div>
        </div>
      </div>

      {/* Caution message */}
      <div className="mt-3 flex items-start space-x-2.5 text-xs text-[#B77932] bg-[#FBF3E8] p-3 rounded-xl border border-[#F0D9BC]">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#B77932] mt-0.5" />
        <p className="text-xs leading-relaxed text-[#26231F]">
          Authorizing grants execution rights to submit the official campus leave application. Rejecting will terminate the workflow safely with an audit trail.
        </p>
      </div>

      {/* Decision Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#F0D9BC]">
        <button
          type="button"
          onClick={() => onReject(requestId)}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-[#FBEDED] hover:bg-[#F3CBC7] text-[#C44E45] border border-[#F3CBC7] transition disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5 text-[#C44E45]" />
          )}
          <span>Reject Workflow</span>
        </button>

        <button
          type="button"
          onClick={() => onApprove(requestId)}
          disabled={isLoading}
          className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold bg-[#287A53] hover:bg-[#206343] text-[#FFFFFF] shadow-sm transition disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Resuming Agent...</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>Authorize &amp; Continue Execution</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
