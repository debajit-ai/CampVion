"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock,
  GitBranch,
  Layers,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import { AgentResult, AgentState, Task } from "../types/api";
import { HumanApprovalCenter } from "./HumanApprovalCenter";
import { PRESET_GOALS } from "./NewRequestPanel";
import { useTheme } from "../context/ThemeContext";
import {
  formatStudentFriendlyError,
  getFriendlyTaskTitle,
  getFriendlyToolName,
  getFriendlyWorkflowStatus,
} from "../utils/language";

interface ConversationFeedProps {
  state: AgentState | null;
  result: AgentResult | null;
  tasks: Task[];
  activeRequestId: number | null;
  isLoading: boolean;
  onApprove: (requestId: number) => Promise<void>;
  onReject: (requestId: number) => Promise<void>;
  onSelectPreset: (preset: (typeof PRESET_GOALS)[0]) => void;
  onInspectToolInTrace?: (toolName: string) => void;
}

export function ConversationFeed({
  state,
  result,
  tasks,
  activeRequestId,
  isLoading,
  onApprove,
  onReject,
  onSelectPreset,
  onInspectToolInTrace,
}: ConversationFeedProps) {
  const { experienceMode } = useTheme();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // If no workflow is active, show the welcoming conversational empty state
  if (!state && !result && tasks.length === 0 && !activeRequestId) {
    return (
      <div className="flex flex-col items-center p-6 text-center max-w-3xl mx-auto select-none my-auto">
        {/* Welcome Avatar & Headline */}
        <div className="relative mb-5">
          <div className="h-16 w-16 rounded-2xl campvion-emblem-surface p-2.5 flex items-center justify-center mx-auto shadow-sm">
            <Image
              src="/brand/campvion-symbol.png"
              alt="CampVion Emblem"
              width={48}
              height={48}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <span
            className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-cv-success-solid border-2 border-cv-surface"
            title="CampVion Intelligence Active"
          />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-cv-fg">
          Welcome to <span className="text-cv-accent-ink">CampVion</span>
        </h1>
        <p className="text-xs sm:text-sm text-cv-fg-2 max-w-lg mt-2 leading-relaxed">
          Your intelligent campus assistant. Tell us what you need, and CampVion will help you complete your university service requests step by step.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-8 text-left">
          {/* Card 1: Smart Request Planning */}
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line shadow-xs">
            <div className="p-2 rounded-lg bg-cv-accent-soft text-cv-accent-ink w-fit mb-2.5">
              <Layers className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-cv-fg">Smart Request Planning</h3>
            <p className="text-[11px] text-cv-fg-2 mt-1 leading-relaxed">
              Understands your request and organizes everything needed to complete it.
            </p>
          </div>

          {/* Card 2: Automatic Error Recovery */}
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line shadow-xs">
            <div className="p-2 rounded-lg bg-cv-raised text-cv-fg w-fit mb-2.5">
              <RotateCcw className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-cv-fg">Automatic Error Recovery</h3>
            <p className="text-[11px] text-cv-fg-2 mt-1 leading-relaxed">
              If something goes wrong, CampVion can try another approach and continue.
            </p>
          </div>

          {/* Card 3: Secure Approvals */}
          <div className="p-4 rounded-xl bg-cv-surface border border-cv-line shadow-xs">
            <div className="p-2 rounded-lg bg-cv-warning-soft text-cv-warning w-fit mb-2.5">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-cv-fg">Secure Approvals</h3>
            <p className="text-[11px] text-cv-fg-2 mt-1 leading-relaxed">
              Important actions require your approval before they are completed.
            </p>
          </div>
        </div>

        {/* Suggested Quick Starts */}
        <div className="w-full mt-8">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2 block mb-3 text-left">
            What Can I Help You With?
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {PRESET_GOALS.slice(0, 4).map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className="p-3.5 rounded-xl bg-cv-surface hover:bg-cv-inset border border-cv-line hover:border-cv-accent-line/50 transition text-left cursor-pointer group flex items-center justify-between shadow-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="text-xs font-semibold text-cv-fg group-hover:text-cv-accent-ink transition-colors truncate block">
                    {preset.label}
                  </span>
                  <p className="text-[11px] text-cv-fg-2 truncate mt-0.5">
                    {preset.goal}
                  </p>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cv-raised text-cv-fg-2 shrink-0">
                  {preset.studentId}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Active workflow session conversational feed
  const planTasks = state?.plan && state.plan.length > 0 ? state.plan : tasks;
  const completedSet = new Set(state?.completed_tasks || result?.completed_tasks || []);
  const failedSet = new Set(state?.failed_tasks || result?.failed_tasks || []);
  const pendingSet = new Set(state?.pending_tasks || []);
  const toolResults = state?.tool_results || {};
  const selectedTools = state?.selected_tools || {};
  const observations = state?.observations || [];
  const workflowStatus = state?.current_status || result?.status || "IDLE";
  const replanCount = state?.replanning_count ?? result?.replanning_count ?? 0;
  const friendlyStatus = getFriendlyWorkflowStatus(workflowStatus, experienceMode);

  const finalMessage =
    result?.final_message ||
    state?.final_result ||
    state?.error ||
    (workflowStatus === "WAITING_FOR_HUMAN" ? "Waiting for your approval" : null);

  const formattedOutcome = formatStudentFriendlyError(finalMessage, experienceMode);

  const normalizedGoal = state?.normalized_goal;
  const normalizedParams = normalizedGoal?.parameters || {};

  const getTaskVisualState = (task: Task) => {
    if (completedSet.has(task.task_id)) return "COMPLETED";
    if (failedSet.has(task.task_id)) return "FAILED";
    if (
      workflowStatus === "WAITING_FOR_HUMAN" &&
      task.requires_human_approval &&
      pendingSet.has(task.task_id)
    ) {
      return "WAITING_FOR_HUMAN";
    }
    if (
      workflowStatus === "EXECUTING" &&
      task.dependencies.every((dep) => completedSet.has(dep)) &&
      pendingSet.has(task.task_id)
    ) {
      return "EXECUTING";
    }
    return "PENDING";
  };

  return (
    <div className="px-3 sm:px-6 py-4 sm:py-6 pb-16 space-y-6 max-w-4xl mx-auto w-full">
      {/* 1. User Goal Speech Bubble */}
      <div className="flex items-start justify-end space-x-3">
        <div className="max-w-xl rounded-2xl rounded-tr-sm bg-cv-raised border border-cv-line p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-cv-line">
            <div className="flex items-center space-x-1.5">
              <User className="h-3.5 w-3.5 text-cv-accent-ink" />
              <span className="text-xs font-semibold text-cv-fg">
                Student Request
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cv-surface border border-cv-line text-cv-accent-ink">
                {state?.student_id || "Student"}
              </span>
            </div>
            {activeRequestId && (
              <span className="text-[10px] text-cv-fg-2">
                Request #{activeRequestId}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-cv-fg font-sans leading-relaxed">
            {state?.original_goal || result?.original_goal || "Processing campus service request..."}
          </p>
        </div>
      </div>

      {/* 2. Agent Planning Bubble */}
      <div className="flex items-start space-x-3">
        <div className="h-8 w-8 rounded-xl campvion-emblem-surface p-1 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <Image
            src="/brand/campvion-symbol.png"
            alt="CampVion Emblem"
            width={22}
            height={22}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="flex-1 max-w-3xl space-y-4">
          {/* Normalization & Plan Header Card */}
          <div className="rounded-2xl rounded-tl-sm bg-cv-surface border border-cv-line p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cv-fg">
                  CampVion <span className="text-cv-accent-ink">{experienceMode === "simple" ? "Assistant" : "Orchestrator"}</span>
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${friendlyStatus.badgeClass}`}>
                  {friendlyStatus.label}
                </span>
              </div>
              <span className="text-[10px] text-cv-fg-2">
                {experienceMode === "simple"
                  ? replanCount > 0
                    ? `Auto-Recovery: ${replanCount} replans`
                    : "Direct Execution"
                  : `Replans: ${replanCount}/3 max`}
              </span>
            </div>

            {/* Normalized Parameters Preview */}
            {normalizedGoal && (
              <div className="p-3 rounded-xl bg-cv-inset border border-cv-line text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-semibold text-cv-fg-2">
                    {experienceMode === "simple" ? "Request Summary" : `Goal Type: ${normalizedGoal.goal_type || "campus_request"}`}
                  </span>
                  <span className="text-[10px] font-medium text-cv-accent-ink">
                    {experienceMode === "simple" ? "Verified Parameters" : "Deterministic Parse"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono text-cv-fg">
                  {Object.entries(normalizedParams).map(([k, v]) => (
                    <div key={k} className="p-1.5 rounded bg-cv-surface border border-cv-line truncate">
                      <span className="text-cv-fg-2">{k}: </span>
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Human Approval Gate (Rendered directly in conversational feed when WAITING_FOR_HUMAN) */}
          {workflowStatus === "WAITING_FOR_HUMAN" && (
            <div className="animate-in fade-in duration-200">
              <HumanApprovalCenter
                state={state}
                onApprove={onApprove}
                onReject={onReject}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* 4. Interactive Task Execution Card */}
          <div className="rounded-2xl bg-cv-surface border border-cv-line p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-cv-line">
              <div className="flex items-center space-x-2">
                <GitBranch className="h-4 w-4 text-cv-accent-ink" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
                  {experienceMode === "simple" ? "Request Steps" : "Topological Execution Pipeline"}
                </h3>
              </div>
              <span className="text-[10px] text-cv-fg-2">
                {experienceMode === "simple"
                  ? `${completedSet.size}/${planTasks.length} steps completed`
                  : `${completedSet.size}/${planTasks.length} tasks resolved`}
              </span>
            </div>

            <div className="space-y-2">
              {planTasks.map((task) => {
                const visualState = getTaskVisualState(task);
                const assignedTool =
                  selectedTools[task.task_id] || task.candidate_tools[0] || "unassigned";
                const isExpanded = expandedTask === task.task_id;
                const toolOutput = toolResults[task.task_id];
                const obs = observations.find((o) => o.task_id === task.task_id);
                const friendlyTitle = getFriendlyTaskTitle(task.task_id, task.description);
                const friendlyTool = getFriendlyToolName(assignedTool);

                return (
                  <div
                    key={task.task_id}
                    className="rounded-xl bg-cv-inset border border-cv-line overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                      className="w-full text-left p-3 flex items-center justify-between gap-3 hover:bg-cv-raised transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {/* Status Icon */}
                        {visualState === "COMPLETED" && (
                          <CheckCircle2 className="h-4 w-4 text-cv-success shrink-0" />
                        )}
                        {visualState === "FAILED" && (
                          <XCircle className="h-4 w-4 text-cv-error shrink-0" />
                        )}
                        {visualState === "WAITING_FOR_HUMAN" && (
                          <ShieldAlert className="h-4 w-4 text-cv-warning shrink-0 animate-pulse" />
                        )}
                        {visualState === "EXECUTING" && (
                          <Activity className="h-4 w-4 text-cv-accent-ink shrink-0 animate-spin" />
                        )}
                        {visualState === "PENDING" && (
                          <Clock className="h-4 w-4 text-cv-fg-2 shrink-0" />
                        )}

                        <span className="text-[10px] font-mono text-cv-fg-2 shrink-0">
                          {task.task_id}
                        </span>

                        <span className="text-xs font-semibold text-cv-fg truncate">
                          {experienceMode === "simple" ? friendlyTitle : task.description}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2 truncate max-w-[140px]">
                          {experienceMode === "simple" ? friendlyTool : assignedTool}
                        </span>
                        {task.requires_human_approval && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
                            APPROVAL REQUIRED
                          </span>
                        )}
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-cv-fg-2 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {/* Expandable Task Detail */}
                    {isExpanded && (
                      <div className="p-3.5 border-t border-cv-line bg-cv-surface text-xs font-mono space-y-2.5">
                        {task.dependencies.length > 0 && (
                          <div>
                            <span className="text-[10px] text-cv-fg-2 uppercase block mb-1">
                              {experienceMode === "simple" ? "Prerequisites:" : "Prerequisite Tasks:"}
                            </span>
                            <div className="flex gap-1.5">
                              {task.dependencies.map((dep) => (
                                <span
                                  key={dep}
                                  className="px-1.5 py-0.5 rounded bg-cv-raised border border-cv-line text-[10px] text-cv-fg-2"
                                >
                                  {dep}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {obs && (
                          <div>
                            <span className="text-[10px] text-cv-fg-2 uppercase block mb-1">
                              {experienceMode === "simple" ? "Execution Note:" : "Agent Observation:"}
                            </span>
                            <div className="p-2.5 rounded bg-cv-inset border border-cv-line text-cv-fg text-[11px] leading-relaxed">
                              {obs.observation}
                            </div>
                          </div>
                        )}

                        {toolOutput !== undefined && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-cv-fg-2 uppercase">
                                {experienceMode === "simple" ? "Service Result:" : "Tool Output Payload:"}
                              </span>
                              {onInspectToolInTrace && (
                                <button
                                  type="button"
                                  onClick={() => onInspectToolInTrace(assignedTool)}
                                  className="text-[10px] text-cv-accent-ink hover:underline"
                                >
                                  {experienceMode === "simple"
                                    ? "View in Activity History &rarr;"
                                    : "Inspect in Trace &rarr;"}
                                </button>
                              )}
                            </div>
                            <pre className="p-2.5 rounded bg-cv-inset border border-cv-line text-[10px] text-cv-fg overflow-x-auto">
                              {JSON.stringify(toolOutput, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Final Outcome / Resolution Card */}
          {finalMessage && (
            <div
              className={`rounded-2xl p-4 border text-xs sm:text-sm font-sans leading-relaxed shadow-xs ${
                workflowStatus === "COMPLETED"
                  ? "bg-cv-success-soft border-cv-success-line text-cv-fg"
                  : workflowStatus === "FAILED"
                  ? "bg-cv-error-soft border-cv-error-line text-cv-fg"
                  : "bg-cv-surface border-cv-line text-cv-fg"
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-current/15 text-[11px]">
                <div className="flex items-center space-x-1.5 font-semibold">
                  {workflowStatus === "COMPLETED" ? (
                    <CheckCircle2 className="h-4 w-4 text-cv-success" />
                  ) : workflowStatus === "FAILED" ? (
                    <XCircle className="h-4 w-4 text-cv-error" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-cv-accent-ink" />
                  )}
                  <span>
                    {workflowStatus === "COMPLETED"
                      ? experienceMode === "simple"
                        ? "Request Completed Successfully"
                        : "Workflow Successfully Finalized"
                      : workflowStatus === "FAILED"
                      ? experienceMode === "simple"
                        ? "Unable to Complete Request"
                        : "Workflow Terminated with Policy / System Halt"
                      : "Execution Status"}
                  </span>
                </div>
                {result?.execution_time !== undefined && (
                  <span className="text-cv-fg-2 font-mono">
                    {experienceMode === "simple"
                      ? `${result.execution_time.toFixed(1)}s`
                      : `Latency: ${result.execution_time.toFixed(2)}s`}
                  </span>
                )}
              </div>
              <p className="mt-1 leading-relaxed">{formattedOutcome.message}</p>

              {/* Expandable Technical Diagnostic for Developers if in Simple Mode */}
              {formattedOutcome.technical && experienceMode === "simple" && formattedOutcome.technical !== formattedOutcome.message && (
                <details className="mt-3 pt-2 border-t border-current/15 text-[11px] text-cv-fg-2">
                  <summary className="cursor-pointer hover:underline text-cv-fg-2">
                    Show technical details (for administrators &amp; developers)
                  </summary>
                  <pre className="mt-1.5 p-2 rounded bg-cv-surface/80 border border-cv-line font-mono text-[10px] overflow-x-auto text-cv-fg">
                    {formattedOutcome.technical}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
