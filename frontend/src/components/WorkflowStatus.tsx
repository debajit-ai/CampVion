"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  GitBranch,
  Layers,
  RotateCcw,
  ShieldAlert,
  Wrench,
  XCircle,
} from "lucide-react";
import { AgentResult, AgentState, Task } from "../types/api";

interface WorkflowStatusProps {
  state: AgentState | null;
  result: AgentResult | null;
  tasks: Task[];
  onInspectToolInTrace?: (toolName: string) => void;
}

export function WorkflowStatus({
  state,
  result,
  tasks,
  onInspectToolInTrace,
}: WorkflowStatusProps) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  if (!state && !result && tasks.length === 0) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center shadow-xs">
        <div className="p-3.5 w-14 h-14 rounded-2xl bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43] mx-auto mb-4 flex items-center justify-center shadow-xs">
          <Layers className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-[#26231F] tracking-tight">
          No Active <span className="text-[#C66A43]">Workflow</span>
        </h3>
        <p className="text-xs text-[#77716A] mt-1.5 max-w-md mx-auto leading-relaxed">
          Dispatch a campus service goal from the composer to observe deterministic goal normalization, topological dependency planning, autonomous tool orchestration, and human governance gates.
        </p>

        {/* Architecture Preview Pipeline */}
        <div className="mt-6 pt-5 border-t border-[#E8E2D9] w-full max-w-lg">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#77716A] block mb-2.5">
            Autonomous Execution Architecture
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[10px] font-mono">
            {[
              "1. Normalize",
              "2. Decompose",
              "3. Plan DAG",
              "4. Execute",
              "5. Observe",
              "6. Govern",
            ].map((step) => (
              <div
                key={step}
                className="px-2 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9] text-[#77716A] truncate"
              >
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
      pendingSet.has(task.task_id) &&
      state?.pending_tasks[0] === task.task_id
    ) {
      return "EXECUTING";
    }
    return "PENDING";
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-2xl p-5 shadow-xs select-none">
      {/* Workflow Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E8E2D9]">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43]">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold tracking-tight text-[#26231F]">
                Plan Execution <span className="text-[#C66A43]">Pipeline</span>
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F0ECE5] text-[#77716A]">
                Topologically Sorted
              </span>
            </div>
            <p className="text-xs text-[#77716A] mt-0.5">
              Autonomous execution loop respecting task dependency graph
            </p>
          </div>
        </div>

        {/* Normalized Goal Info */}
        {state?.normalized_goal && (
          <div className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
            <span className="text-[#77716A] text-[11px]">GOAL TYPE:</span>
            <span className="px-2 py-0.5 rounded bg-[#F5E7DE] border border-[#E8CFC1] text-[#C66A43] font-semibold">
              {state.normalized_goal.goal_type}
            </span>
            {Boolean(state.normalized_goal.parameters?.days) && (
              <span className="px-2 py-0.5 rounded bg-[#F0ECE5] border border-[#E8E2D9] text-[#26231F]">
                {String(state.normalized_goal.parameters.days)} day(s)
              </span>
            )}
            {Boolean(state.normalized_goal.parameters?.reason) && (
              <span className="px-2 py-0.5 rounded bg-[#F0ECE5] border border-[#E8E2D9] text-[#26231F] max-w-[180px] truncate">
                {String(state.normalized_goal.parameters.reason)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Final message alert if completed, waiting, or failed */}
      {finalMessage && (
        <div
          className={`mt-4 p-3.5 rounded-xl text-xs border flex items-start justify-between gap-3 ${
            workflowStatus === "COMPLETED"
              ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
              : workflowStatus === "FAILED"
              ? "bg-[#FBEDED] border-[#F3CBC7] text-[#C44E45]"
              : "bg-[#FBF3E8] border-[#F0D9BC] text-[#B77932]"
          }`}
        >
          <div className="flex items-start space-x-2.5 min-w-0">
            {workflowStatus === "COMPLETED" ? (
              <CheckCircle2 className="h-4 w-4 text-[#287A53] shrink-0 mt-0.5" />
            ) : workflowStatus === "FAILED" ? (
              <XCircle className="h-4 w-4 text-[#C44E45] shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-[#B77932] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <span className="font-semibold block uppercase tracking-wider text-[10px]">
                Final Status Message
              </span>
              <p className="mt-0.5 text-xs text-[#26231F] break-words">{finalMessage}</p>
            </div>
          </div>

          {result?.execution_time !== undefined && result.execution_time > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[#77716A] shrink-0">
              {result.execution_time}s
            </span>
          )}
        </div>
      )}

      {/* Task DAG Cards */}
      <div className="mt-4 space-y-2.5">
        {planTasks.map((task, idx) => {
          const visualState = getTaskVisualState(task);
          const isExpanded = expandedTask === task.task_id;
          const assignedTool = selectedTools[task.task_id] || task.candidate_tools[0];
          const taskResult = toolResults[task.task_id];
          const taskObservations = observations.filter((o) => o.task_id === task.task_id);
          const hadRecoverableFailure = taskObservations.some(
            (o) => o.observation === "RECOVERABLE_FAILURE"
          );
          const isBlockedByUpstreamFailure =
            workflowStatus === "FAILED" && visualState === "PENDING";

          return (
            <div
              key={task.task_id}
              className={`rounded-xl border transition-all ${
                visualState === "COMPLETED"
                  ? "bg-[#EAF4EE]/30 border-[#C8E3D4]"
                  : visualState === "EXECUTING"
                  ? "bg-[#F5E7DE]/40 border-[#C66A43]/50 shadow-xs"
                  : visualState === "WAITING_FOR_HUMAN"
                  ? "bg-[#FBF3E8]/40 border-[#F0D9BC] shadow-xs"
                  : visualState === "FAILED"
                  ? "bg-[#FBEDED]/40 border-[#F3CBC7]"
                  : "bg-[#FAF7F2] border-[#E8E2D9]"
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedTask(isExpanded ? null : task.task_id);
                  }
                }}
                className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                {/* Left: Index, Icon, Description & Metadata */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-[#FFFFFF] border border-[#E8E2D9] text-[11px] font-mono text-[#26231F] font-semibold shrink-0">
                    {idx + 1}
                  </div>

                  {visualState === "COMPLETED" && (
                    <CheckCircle2 className="h-4 w-4 text-[#287A53] shrink-0" />
                  )}
                  {visualState === "EXECUTING" && (
                    <div className="h-4 w-4 rounded-full border-2 border-[#C66A43] border-t-transparent animate-spin shrink-0" />
                  )}
                  {visualState === "WAITING_FOR_HUMAN" && (
                    <ShieldAlert className="h-4 w-4 text-[#B77932] animate-pulse shrink-0" />
                  )}
                  {visualState === "FAILED" && (
                    <XCircle className="h-4 w-4 text-[#C44E45] shrink-0" />
                  )}
                  {visualState === "PENDING" && (
                    <Clock className="h-4 w-4 text-[#9E978E] shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-mono text-xs font-semibold text-[#26231F] px-1.5 py-0.2 rounded bg-[#FFFFFF] border border-[#E8E2D9]">
                        {task.task_id}
                      </span>
                      <span className="text-xs font-medium text-[#26231F] truncate">
                        {task.description}
                      </span>
                      {hadRecoverableFailure && visualState === "COMPLETED" && (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EAF4EE] border border-[#C8E3D4] text-[#287A53]">
                          <RotateCcw className="h-2.5 w-2.5" />
                          <span>Self-Healed</span>
                        </span>
                      )}
                      {hadRecoverableFailure && visualState === "FAILED" && (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FBEDED] border border-[#F3CBC7] text-[#C44E45]">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          <span>Retries Exhausted ({taskObservations.length} attempts)</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata tags */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] font-mono text-[#77716A]">
                      {assignedTool && (
                        <span className="flex items-center space-x-1 text-[#C66A43]">
                          <Wrench className="h-3 w-3" />
                          <span>{assignedTool}</span>
                        </span>
                      )}
                      {task.dependencies.length > 0 ? (
                        <span className="flex items-center space-x-1 text-[#77716A]">
                          <GitBranch className="h-3 w-3" />
                          <span>deps: [{task.dependencies.join(", ")}]</span>
                        </span>
                      ) : (
                        <span className="text-[#9E978E]">root node</span>
                      )}
                      {task.requires_human_approval && (
                        <span className="text-[#B77932] font-semibold">
                          Requires Approval
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status Pill & Caret */}
                <div className="flex items-center space-x-2 shrink-0">
                  {isBlockedByUpstreamFailure && (
                    <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F0ECE5] border border-[#E8E2D9] text-[#77716A]">
                      HALTED UPSTREAM
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border uppercase ${
                      visualState === "COMPLETED"
                        ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
                        : visualState === "EXECUTING"
                        ? "bg-[#F5E7DE] border-[#C66A43]/40 text-[#C66A43] animate-pulse"
                        : visualState === "WAITING_FOR_HUMAN"
                        ? "bg-[#FBF3E8] border-[#F0D9BC] text-[#B77932] font-semibold"
                        : visualState === "FAILED"
                        ? "bg-[#FBEDED] border-[#F3CBC7] text-[#C44E45]"
                        : "bg-[#FFFFFF] border-[#E8E2D9] text-[#77716A]"
                    }`}
                  >
                    {visualState}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-[#77716A]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[#77716A]" />
                  )}
                </div>
              </div>

              {/* Collapsible details / tool result payload */}
              {isExpanded && (
                <div className="px-4 pb-3.5 pt-2.5 border-t border-[#E8E2D9] text-xs font-mono space-y-2.5 bg-[#FFFFFF] rounded-b-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[#77716A] text-[11px]">
                    <span>CANDIDATE TOOLS: {task.candidate_tools.join(", ")}</span>
                    <div className="flex items-center space-x-3">
                      <span>
                        HUMAN APPROVAL GATE: {task.requires_human_approval ? "YES" : "NO"}
                      </span>
                      {assignedTool && onInspectToolInTrace && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectToolInTrace(assignedTool);
                          }}
                          className="inline-flex items-center space-x-1 text-[#C66A43] hover:underline transition cursor-pointer"
                        >
                          <span>Inspect in Trace</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Observation History for this task */}
                  {taskObservations.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-[#77716A] uppercase">
                        OBSERVER OUTCOMES:
                      </span>
                      {taskObservations.map((obs, oIdx) => (
                        <span
                          key={oIdx}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            obs.observation === "SUCCESS"
                              ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
                              : obs.observation === "RECOVERABLE_FAILURE"
                              ? "bg-[#F5E7DE] border-[#E8CFC1] text-[#C66A43]"
                              : "bg-[#FBEDED] border-[#F3CBC7] text-[#C44E45]"
                          }`}
                        >
                          Attempt #{oIdx + 1}: {obs.observation}
                        </span>
                      ))}
                    </div>
                  )}

                  {taskResult ? (
                    <div>
                      <span className="text-[#77716A] text-[10px] uppercase block mb-1">
                        Execution Result Payload:
                      </span>
                      <pre className="p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2D9] text-[11px] text-[#26231F] overflow-x-auto">
                        {JSON.stringify(taskResult, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#77716A] italic">
                      {isBlockedByUpstreamFailure
                        ? "Execution skipped — workflow terminated due to an upstream failure or rejection."
                        : visualState === "PENDING"
                        ? "Awaiting execution in dependency sequence."
                        : "No payload recorded yet."}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
