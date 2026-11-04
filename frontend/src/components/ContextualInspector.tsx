"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  Terminal,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  AgentResult,
  AgentState,
  Task,
  ToolSchema,
  WorkspaceSection,
} from "../types/api";

interface ContextualInspectorProps {
  isOpen: boolean;
  onToggle: () => void;
  state: AgentState | null;
  result: AgentResult | null;
  tasks: Task[];
  tools: ToolSchema[];
  activeRequestId: number | null;
  onNavigateToSection: (section: WorkspaceSection) => void;
  onInspectToolInTrace?: (toolName: string) => void;
}

export function ContextualInspector({
  isOpen,
  onToggle,
  state,
  result,
  tasks,
  tools,
  activeRequestId,
  onNavigateToSection,
  onInspectToolInTrace,
}: ContextualInspectorProps) {
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Open Contextual Inspector"
        className="fixed right-3 top-20 z-40 p-2 rounded-xl bg-cv-surface border border-cv-line hover:border-cv-accent-line/50 text-cv-fg-2 hover:text-cv-accent-ink shadow-md transition cursor-pointer hidden lg:flex items-center space-x-1.5 text-xs font-mono"
        title="Open Contextual Inspector Panel"
      >
        <PanelRightOpen className="h-4 w-4" />
        <span className="hidden xl:inline">Inspect</span>
      </button>
    );
  }

  const planTasks = state?.plan && state.plan.length > 0 ? state.plan : tasks;
  const completedCount = state?.completed_tasks.length ?? result?.completed_tasks.length ?? 0;
  const totalTasks = planTasks.length || 6;
  const replanCount = state?.replanning_count ?? result?.replanning_count ?? 0;
  const workflowStatus = state?.current_status || result?.status || "IDLE";
  const selectedTools = state?.selected_tools || {};
  const toolResults = state?.tool_results || {};

  const currentTask = selectedTaskKey
    ? planTasks.find((t) => t.task_id === selectedTaskKey)
    : planTasks[0];

  return (
    <aside
      aria-label="CampVion Contextual Inspector"
      className="w-80 xl:w-96 h-full bg-cv-surface border-l border-cv-line flex flex-col shrink-0 select-none overflow-hidden z-30"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-cv-line bg-cv-inset">
        <div className="flex items-center space-x-2">
          <Cpu className="h-4 w-4 text-cv-accent-ink" />
          <h2 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
            Contextual <span className="text-cv-accent-ink">Inspector</span>
          </h2>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-label="Close Contextual Inspector"
          className="p-1.5 rounded-lg text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent hover:border-cv-line transition cursor-pointer"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status Metrics Card */}
        <div className="p-4 rounded-xl bg-cv-inset border border-cv-line space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-cv-fg-2">
              Workflow Status
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded border uppercase ${
                workflowStatus === "COMPLETED"
                  ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                  : workflowStatus === "WAITING_FOR_HUMAN"
                  ? "bg-cv-warning-soft border-cv-warning-line text-cv-warning animate-pulse"
                  : workflowStatus === "FAILED"
                  ? "bg-cv-error-soft border-cv-error-line text-cv-error"
                  : "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink"
              }`}
            >
              {workflowStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-cv-surface border border-cv-line">
              <span className="text-[10px] text-cv-fg-2 block">Request ID</span>
              <span className="text-sm font-semibold text-cv-fg">
                {activeRequestId ? `#${activeRequestId}` : "Idle"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-cv-surface border border-cv-line">
              <span className="text-[10px] text-cv-fg-2 block">Replans</span>
              <span className="text-sm font-semibold text-cv-accent-ink">
                {replanCount} / 3 max
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-cv-fg-2">Task Progression</span>
              <span className="text-cv-fg font-semibold">
                {completedCount}/{totalTasks}
              </span>
            </div>
            <div className="h-2 w-full bg-cv-line rounded-full overflow-hidden">
              <div
                className="h-full bg-cv-accent transition-all duration-300 rounded-full"
                style={{
                  width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Task Progression Sequence */}
        {planTasks.length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2 block mb-2">
              DAG Task Sequence ({planTasks.length})
            </span>
            <div className="space-y-1.5">
              {planTasks.map((t) => {
                const isSelected = (currentTask?.task_id || planTasks[0].task_id) === t.task_id;
                const isDone = state?.completed_tasks.includes(t.task_id);
                const isFail = state?.failed_tasks.includes(t.task_id);

                return (
                  <button
                    key={t.task_id}
                    type="button"
                    onClick={() => setSelectedTaskKey(t.task_id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-cv-accent-soft border-cv-accent-line/50 text-cv-fg font-semibold"
                        : "bg-cv-surface hover:bg-cv-inset border-cv-line text-cv-fg-2"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-cv-success shrink-0" />
                      ) : isFail ? (
                        <XCircle className="h-3.5 w-3.5 text-cv-error shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-cv-fg-2 shrink-0" />
                      )}
                      <span className="truncate">{t.task_id}: {t.description}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cv-raised text-cv-fg-2 shrink-0">
                      {selectedTools[t.task_id] || t.candidate_tools[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Task Details & Output Inspection */}
        {currentTask && (
          <div className="p-4 rounded-xl bg-cv-inset border border-cv-line space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between pb-1.5 border-b border-cv-line">
              <span className="text-[10px] font-semibold text-cv-accent-ink">
                Task Inspection: {currentTask.task_id}
              </span>
              {currentTask.requires_human_approval && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
                  Governed
                </span>
              )}
            </div>
            <p className="text-[11px] text-cv-fg font-sans">
              {currentTask.description}
            </p>

            {toolResults[currentTask.task_id] !== undefined ? (
              <div>
                <span className="text-[10px] text-cv-fg-2 uppercase block mb-1">
                  Tool Output Payload:
                </span>
                <pre className="p-2.5 rounded bg-cv-surface border border-cv-line text-[10px] text-cv-fg max-h-36 overflow-y-auto">
                  {JSON.stringify(toolResults[currentTask.task_id], null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-[10px] text-cv-fg-2 italic">
                Payload pending or not executed yet.
              </p>
            )}

            {onInspectToolInTrace && (
              <button
                type="button"
                onClick={() =>
                  onInspectToolInTrace(
                    selectedTools[currentTask.task_id] || currentTask.candidate_tools[0]
                  )
                }
                className="w-full pt-1 text-[11px] text-cv-accent-ink hover:underline flex items-center justify-between cursor-pointer"
              >
                <span>Find in Decision Trace Log</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Quick Navigations */}
        <div className="space-y-1.5 pt-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2 block mb-1">
            Deep Workspaces
          </span>
          <button
            type="button"
            onClick={() => onNavigateToSection("observability")}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-cv-surface hover:bg-cv-inset border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Terminal className="h-3.5 w-3.5 text-cv-accent-ink" />
              <span>Full Decision Traces</span>
            </div>
            <ArrowRight className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateToSection("evaluation")}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-cv-surface hover:bg-cv-inset border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-3.5 w-3.5 text-cv-success" />
              <span>Reliability Telemetry</span>
            </div>
            <ArrowRight className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateToSection("registry")}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-cv-surface hover:bg-cv-inset border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Wrench className="h-3.5 w-3.5 text-cv-accent-ink" />
              <span>Tool Registry ({tools.length})</span>
            </div>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </aside>
  );
}
