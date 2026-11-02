"use client";

import React, { useState } from "react";
import {
  Activity,
  Bot,
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
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // If no workflow is active, show the welcoming conversational empty state
  if (!state && !result && tasks.length === 0 && !activeRequestId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto select-none">
        {/* Welcome Avatar & Headline */}
        <div className="relative mb-5">
          <div className="h-16 w-16 rounded-2xl bg-[#F5E7DE] border border-[#E8CFC1] flex items-center justify-center mx-auto shadow-xs">
            <Bot className="h-8 w-8 text-[#C66A43]" />
          </div>
          <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#287A53] border-2 border-[#FFFFFF]" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#26231F]">
          Welcome to <span className="text-[#C66A43]">CampVion</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#77716A] max-w-lg mt-2 leading-relaxed">
          Intelligent campus operations powered by autonomous agentic AI. Formulate campus service requests in natural language to observe deterministic DAG planning, automated tool orchestration, and human governance.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-8 text-left">
          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E8E2D9] shadow-xs">
            <div className="p-2 rounded-lg bg-[#F5E7DE] text-[#C66A43] w-fit mb-2.5">
              <Layers className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#26231F]">Deterministic DAG</h3>
            <p className="text-[11px] text-[#77716A] mt-1 leading-relaxed">
              Decomposes requests into a prerequisite-enforced topological graph.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E8E2D9] shadow-xs">
            <div className="p-2 rounded-lg bg-[#F0ECE5] text-[#26231F] w-fit mb-2.5">
              <RotateCcw className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#26231F]">Self-Healing Loop</h3>
            <p className="text-[11px] text-[#77716A] mt-1 leading-relaxed">
              Detects transient runtime failures and autonomously replans up to 3 bounded retries.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E8E2D9] shadow-xs">
            <div className="p-2 rounded-lg bg-[#FBF3E8] text-[#B77932] w-fit mb-2.5">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#26231F]">Human-in-the-Loop</h3>
            <p className="text-[11px] text-[#77716A] mt-1 leading-relaxed">
              Enforces authorization gates for consequential actions before database commits.
            </p>
          </div>
        </div>

        {/* Suggested Quick Starts */}
        <div className="w-full mt-8">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#77716A] block mb-3 text-left">
            Suggested Workflow Starters
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {PRESET_GOALS.slice(0, 4).map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className="p-3.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#C66A43]/50 transition text-left cursor-pointer group flex items-center justify-between shadow-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="text-xs font-semibold text-[#26231F] group-hover:text-[#C66A43] transition-colors truncate block">
                    {preset.label}
                  </span>
                  <p className="text-[11px] text-[#77716A] truncate mt-0.5">
                    {preset.goal}
                  </p>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F0ECE5] text-[#77716A] shrink-0">
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
  const finalMessage =
    result?.final_message ||
    state?.final_result ||
    state?.error ||
    (workflowStatus === "WAITING_FOR_HUMAN" ? "Waiting for human approval" : null);

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
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 max-w-4xl mx-auto w-full">
      {/* 1. User Goal Speech Bubble */}
      <div className="flex items-start justify-end space-x-3">
        <div className="max-w-xl rounded-2xl rounded-tr-sm bg-[#F0ECE5] border border-[#E8E2D9] p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-[#E8E2D9]">
            <div className="flex items-center space-x-1.5">
              <User className="h-3.5 w-3.5 text-[#C66A43]" />
              <span className="text-xs font-semibold text-[#26231F]">
                Student Request
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[#C66A43]">
                {state?.student_id || "Student"}
              </span>
            </div>
            {activeRequestId && (
              <span className="text-[10px] text-[#77716A]">
                Workflow #{activeRequestId}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#26231F] font-sans leading-relaxed">
            {state?.original_goal || result?.original_goal || "Processing campus service request..."}
          </p>
        </div>
      </div>

      {/* 2. Agent Planning & Goal Normalization Bubble */}
      <div className="flex items-start space-x-3">
        <div className="h-8 w-8 rounded-xl bg-[#F5E7DE] border border-[#E8CFC1] flex items-center justify-center shrink-0 mt-0.5 text-[#C66A43]">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1 max-w-3xl space-y-4">
          {/* Normalization & Plan Header Card */}
          <div className="rounded-2xl rounded-tl-sm bg-[#FFFFFF] border border-[#E8E2D9] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#26231F]">
                  CampVion <span className="text-[#C66A43]">Orchestrator</span>
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#F0ECE5] text-[#77716A]">
                  Status: {workflowStatus}
                </span>
              </div>
              <span className="text-[10px] text-[#77716A]">
                Replans: {state?.replanning_count ?? result?.replanning_count ?? 0}/3 max
              </span>
            </div>

            {/* Normalized Parameters Preview */}
            {normalizedGoal && (
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-semibold text-[#77716A]">
                    Goal Type: {normalizedGoal.goal_type || "campus_request"}
                  </span>
                  <span className="text-[10px] font-medium text-[#C66A43]">
                    Deterministic Parse
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono text-[#26231F]">
                  {Object.entries(normalizedParams).map(([k, v]) => (
                    <div key={k} className="p-1.5 rounded bg-[#FFFFFF] border border-[#E8E2D9] truncate">
                      <span className="text-[#77716A]">{k}: </span>
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

          {/* 4. Interactive Topological Task DAG Execution Card */}
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#E8E2D9] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D9]">
              <div className="flex items-center space-x-2">
                <GitBranch className="h-4 w-4 text-[#C66A43]" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#26231F]">
                  Topological Execution Pipeline
                </h3>
              </div>
              <span className="text-[10px] text-[#77716A]">
                {completedSet.size}/{planTasks.length} tasks resolved
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

                return (
                  <div
                    key={task.task_id}
                    className="rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                      className="w-full text-left p-3 flex items-center justify-between gap-3 hover:bg-[#F0ECE5] transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {/* Status Icon */}
                        {visualState === "COMPLETED" && (
                          <CheckCircle2 className="h-4 w-4 text-[#287A53] shrink-0" />
                        )}
                        {visualState === "FAILED" && (
                          <XCircle className="h-4 w-4 text-[#C44E45] shrink-0" />
                        )}
                        {visualState === "WAITING_FOR_HUMAN" && (
                          <ShieldAlert className="h-4 w-4 text-[#B77932] shrink-0 animate-pulse" />
                        )}
                        {visualState === "EXECUTING" && (
                          <Activity className="h-4 w-4 text-[#C66A43] shrink-0 animate-spin" />
                        )}
                        {visualState === "PENDING" && (
                          <Clock className="h-4 w-4 text-[#77716A] shrink-0" />
                        )}

                        <span className="text-[10px] font-mono text-[#77716A] shrink-0">
                          {task.task_id}
                        </span>

                        <span className="text-xs font-semibold text-[#26231F] truncate">
                          {task.description}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[#77716A]">
                          {assignedTool}
                        </span>
                        {task.requires_human_approval && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932]">
                            APPROVAL
                          </span>
                        )}
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-[#77716A] transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {/* Expandable Task Detail */}
                    {isExpanded && (
                      <div className="p-3.5 border-t border-[#E8E2D9] bg-[#FFFFFF] text-xs font-mono space-y-2.5">
                        {task.dependencies.length > 0 && (
                          <div>
                            <span className="text-[10px] text-[#77716A] uppercase block mb-1">
                              Prerequisite Tasks:
                            </span>
                            <div className="flex gap-1.5">
                              {task.dependencies.map((dep) => (
                                <span
                                  key={dep}
                                  className="px-1.5 py-0.5 rounded bg-[#F0ECE5] border border-[#E8E2D9] text-[10px] text-[#77716A]"
                                >
                                  {dep}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {obs && (
                          <div>
                            <span className="text-[10px] text-[#77716A] uppercase block mb-1">
                              Agent Observation:
                            </span>
                            <div className="p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2D9] text-[#26231F] text-[11px] leading-relaxed">
                              {obs.observation}
                            </div>
                          </div>
                        )}

                        {toolOutput !== undefined && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-[#77716A] uppercase">
                                Tool Output Payload:
                              </span>
                              {onInspectToolInTrace && (
                                <button
                                  type="button"
                                  onClick={() => onInspectToolInTrace(assignedTool)}
                                  className="text-[10px] text-[#C66A43] hover:underline"
                                >
                                  Inspect in Trace &rarr;
                                </button>
                              )}
                            </div>
                            <pre className="p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2D9] text-[10px] text-[#26231F] overflow-x-auto">
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
                  ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#26231F]"
                  : workflowStatus === "FAILED"
                  ? "bg-[#FBEDED] border-[#F3CBC7] text-[#26231F]"
                  : "bg-[#FFFFFF] border-[#E8E2D9] text-[#26231F]"
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-current/15 text-[11px]">
                <div className="flex items-center space-x-1.5 font-semibold">
                  {workflowStatus === "COMPLETED" ? (
                    <CheckCircle2 className="h-4 w-4 text-[#287A53]" />
                  ) : workflowStatus === "FAILED" ? (
                    <XCircle className="h-4 w-4 text-[#C44E45]" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-[#C66A43]" />
                  )}
                  <span>
                    {workflowStatus === "COMPLETED"
                      ? "Workflow Successfully Finalized"
                      : workflowStatus === "FAILED"
                      ? "Workflow Terminated with Policy / System Halt"
                      : "Execution Status"}
                  </span>
                </div>
                {result?.execution_time !== undefined && (
                  <span className="text-[#77716A] font-mono">
                    Latency: {result.execution_time.toFixed(2)}s
                  </span>
                )}
              </div>
              <p className="mt-1 leading-relaxed">{finalMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
