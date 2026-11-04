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
import { useTheme } from "../context/ThemeContext";
import {
  getFriendlyTaskTitle,
  getFriendlyToolName,
  getFriendlyWorkflowStatus,
} from "../utils/language";

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
  const { experienceMode } = useTheme();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  if (!state && !result && tasks.length === 0) {
    return (
      <div className="bg-cv-surface border border-cv-line rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center shadow-xs">
        <div className="p-3.5 w-14 h-14 rounded-2xl bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink mx-auto mb-4 flex items-center justify-center shadow-xs">
          <Layers className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-cv-fg tracking-tight">
          No Active <span className="text-cv-accent-ink">Request</span>
        </h3>
        <p className="text-xs text-cv-fg-2 mt-1.5 max-w-md mx-auto leading-relaxed">
          {experienceMode === "simple"
            ? "Submit a request to see CampVion's step-by-step progress, service coordination, and secure approval checks."
            : "Dispatch a campus service goal from the composer to observe deterministic goal normalization, topological dependency planning, autonomous tool orchestration, and human governance gates."}
        </p>

        {/* Architecture Preview Pipeline */}
        <div className="mt-6 pt-5 border-t border-cv-line w-full max-w-lg">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2 block mb-2.5">
            {experienceMode === "simple" ? "How CampVion Completes Your Request" : "Autonomous Execution Architecture"}
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[10px] font-mono">
            {(experienceMode === "simple"
              ? [
                  "1. Understand",
                  "2. Check Rules",
                  "3. Plan Steps",
                  "4. Run Services",
                  "5. Review",
                  "6. Complete",
                ]
              : [
                  "1. Normalize",
                  "2. Decompose",
                  "3. Plan DAG",
                  "4. Execute",
                  "5. Observe",
                  "6. Govern",
                ]
            ).map((step) => (
              <div
                key={step}
                className="px-2 py-1.5 rounded-lg bg-cv-inset border border-cv-line text-cv-fg-2 truncate"
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
  const friendlyStatus = getFriendlyWorkflowStatus(workflowStatus, experienceMode);
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
    <div className="bg-cv-surface border border-cv-line rounded-2xl p-5 shadow-xs select-none">
      {/* Workflow Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-cv-line">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold tracking-tight text-cv-fg">
                {experienceMode === "simple" ? (
                  <>
                    Request <span className="text-cv-accent-ink">Progress</span>
                  </>
                ) : (
                  <>
                    Plan Execution <span className="text-cv-accent-ink">Pipeline</span>
                  </>
                )}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-raised text-cv-fg-2">
                {experienceMode === "simple" ? "Step-by-Step" : "Topologically Sorted"}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${friendlyStatus.badgeClass}`}>
                {friendlyStatus.label}
              </span>
            </div>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              {experienceMode === "simple"
                ? "Real-time execution status of your campus request"
                : "Autonomous execution loop respecting task dependency graph"}
            </p>
          </div>
        </div>

        {/* Normalized Goal Info */}
        {state?.normalized_goal && (
          <div className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
            <span className="text-cv-fg-2 text-[11px]">GOAL TYPE:</span>
            <span className="px-2 py-0.5 rounded bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink font-semibold">
              {state.normalized_goal.goal_type}
            </span>
            {Boolean(state.normalized_goal.parameters?.days) && (
              <span className="px-2 py-0.5 rounded bg-cv-raised border border-cv-line text-cv-fg">
                {String(state.normalized_goal.parameters.days)} day(s)
              </span>
            )}
            {Boolean(state.normalized_goal.parameters?.reason) && (
              <span className="px-2 py-0.5 rounded bg-cv-raised border border-cv-line text-cv-fg max-w-[180px] truncate">
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
              ? "bg-cv-success-soft border-cv-success-line text-cv-success"
              : workflowStatus === "FAILED"
              ? "bg-cv-error-soft border-cv-error-line text-cv-error"
              : "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
          }`}
        >
          <div className="flex items-start space-x-2.5 min-w-0">
            {workflowStatus === "COMPLETED" ? (
              <CheckCircle2 className="h-4 w-4 text-cv-success shrink-0 mt-0.5" />
            ) : workflowStatus === "FAILED" ? (
              <XCircle className="h-4 w-4 text-cv-error shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-cv-warning shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <span className="font-semibold block uppercase tracking-wider text-[10px]">
                Final Status Message
              </span>
              <p className="mt-0.5 text-xs text-cv-fg break-words">{finalMessage}</p>
            </div>
          </div>

          {result?.execution_time !== undefined && result.execution_time > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2 shrink-0">
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
                  ? "bg-cv-success-soft/30 border-cv-success-line"
                  : visualState === "EXECUTING"
                  ? "bg-cv-accent-soft/40 border-cv-accent-line/50 shadow-xs"
                  : visualState === "WAITING_FOR_HUMAN"
                  ? "bg-cv-warning-soft/40 border-cv-warning-line shadow-xs"
                  : visualState === "FAILED"
                  ? "bg-cv-error-soft/40 border-cv-error-line"
                  : "bg-cv-inset border-cv-line"
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
                  <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-cv-surface border border-cv-line text-[11px] font-mono text-cv-fg font-semibold shrink-0">
                    {idx + 1}
                  </div>

                  {visualState === "COMPLETED" && (
                    <CheckCircle2 className="h-4 w-4 text-cv-success shrink-0" />
                  )}
                  {visualState === "EXECUTING" && (
                    <div className="h-4 w-4 rounded-full border-2 border-cv-accent-line border-t-transparent animate-spin shrink-0" />
                  )}
                  {visualState === "WAITING_FOR_HUMAN" && (
                    <ShieldAlert className="h-4 w-4 text-cv-warning animate-pulse shrink-0" />
                  )}
                  {visualState === "FAILED" && (
                    <XCircle className="h-4 w-4 text-cv-error shrink-0" />
                  )}
                  {visualState === "PENDING" && (
                    <Clock className="h-4 w-4 text-cv-fg-3 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-mono text-xs font-semibold text-cv-fg px-1.5 py-0.2 rounded bg-cv-surface border border-cv-line">
                        {task.task_id}
                      </span>
                      <span className="text-xs font-medium text-cv-fg truncate">
                        {experienceMode === "simple"
                          ? getFriendlyTaskTitle(task.task_id, task.description)
                          : task.description}
                      </span>
                      {hadRecoverableFailure && visualState === "COMPLETED" && (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-cv-success-soft border border-cv-success-line text-cv-success">
                          <RotateCcw className="h-2.5 w-2.5" />
                          <span>{experienceMode === "simple" ? "Auto-Recovered" : "Self-Healed"}</span>
                        </span>
                      )}
                      {hadRecoverableFailure && visualState === "FAILED" && (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-cv-error-soft border border-cv-error-line text-cv-error">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          <span>
                            {experienceMode === "simple"
                              ? `Recovery Limit Reached (${taskObservations.length} attempts)`
                              : `Retries Exhausted (${taskObservations.length} attempts)`}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Metadata tags */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] font-mono text-cv-fg-2">
                      {assignedTool && (
                        <span className="flex items-center space-x-1 text-cv-accent-ink">
                          <Wrench className="h-3 w-3" />
                          <span>{experienceMode === "simple" ? getFriendlyToolName(assignedTool) : assignedTool}</span>
                        </span>
                      )}
                      {task.dependencies.length > 0 ? (
                        <span className="flex items-center space-x-1 text-cv-fg-2">
                          <GitBranch className="h-3 w-3" />
                          <span>
                            {experienceMode === "simple"
                              ? `Prerequisites: [${task.dependencies.join(", ")}]`
                              : `deps: [${task.dependencies.join(", ")}]`}
                          </span>
                        </span>
                      ) : (
                        <span className="text-cv-fg-3">{experienceMode === "simple" ? "First Step" : "root node"}</span>
                      )}
                      {task.requires_human_approval && (
                        <span className="text-cv-warning font-semibold">
                          Approval Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status Pill & Caret */}
                <div className="flex items-center space-x-2 shrink-0">
                  {isBlockedByUpstreamFailure && (
                    <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-cv-raised border border-cv-line text-cv-fg-2">
                      HALTED UPSTREAM
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border uppercase ${
                      visualState === "COMPLETED"
                        ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                        : visualState === "EXECUTING"
                        ? "bg-cv-accent-soft border-cv-accent-line/40 text-cv-accent-ink animate-pulse"
                        : visualState === "WAITING_FOR_HUMAN"
                        ? "bg-cv-warning-soft border-cv-warning-line text-cv-warning font-semibold"
                        : visualState === "FAILED"
                        ? "bg-cv-error-soft border-cv-error-line text-cv-error"
                        : "bg-cv-surface border-cv-line text-cv-fg-2"
                    }`}
                  >
                    {visualState}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-cv-fg-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-cv-fg-2" />
                  )}
                </div>
              </div>

              {/* Collapsible details / tool result payload */}
              {isExpanded && (
                <div className="px-4 pb-3.5 pt-2.5 border-t border-cv-line text-xs font-mono space-y-2.5 bg-cv-surface rounded-b-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-cv-fg-2 text-[11px]">
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
                          className="inline-flex items-center space-x-1 text-cv-accent-ink hover:underline transition cursor-pointer"
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
                      <span className="text-[10px] text-cv-fg-2 uppercase">
                        OBSERVER OUTCOMES:
                      </span>
                      {taskObservations.map((obs, oIdx) => (
                        <span
                          key={oIdx}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            obs.observation === "SUCCESS"
                              ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                              : obs.observation === "RECOVERABLE_FAILURE"
                              ? "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink"
                              : "bg-cv-error-soft border-cv-error-line text-cv-error"
                          }`}
                        >
                          Attempt #{oIdx + 1}: {obs.observation}
                        </span>
                      ))}
                    </div>
                  )}

                  {taskResult ? (
                    <div>
                      <span className="text-cv-fg-2 text-[10px] uppercase block mb-1">
                        Execution Result Payload:
                      </span>
                      <pre className="p-2.5 rounded bg-cv-inset border border-cv-line text-[11px] text-cv-fg overflow-x-auto">
                        {JSON.stringify(taskResult, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-[11px] text-cv-fg-2 italic">
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
