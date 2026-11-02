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
        className="fixed right-3 top-20 z-40 p-2 rounded-xl bg-[#FFFFFF] border border-[#E8E2D9] hover:border-[#C66A43]/50 text-[#77716A] hover:text-[#C66A43] shadow-md transition cursor-pointer hidden lg:flex items-center space-x-1.5 text-xs font-mono"
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
      className="w-80 xl:w-96 h-full bg-[#FFFFFF] border-l border-[#E8E2D9] flex flex-col shrink-0 select-none overflow-hidden z-30"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#E8E2D9] bg-[#FAF7F2]">
        <div className="flex items-center space-x-2">
          <Cpu className="h-4 w-4 text-[#C66A43]" />
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#26231F]">
            Contextual <span className="text-[#C66A43]">Inspector</span>
          </h2>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-label="Close Contextual Inspector"
          className="p-1.5 rounded-lg text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] border border-transparent hover:border-[#E8E2D9] transition cursor-pointer"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status Metrics Card */}
        <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-[#77716A]">
              Workflow Status
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded border uppercase ${
                workflowStatus === "COMPLETED"
                  ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
                  : workflowStatus === "WAITING_FOR_HUMAN"
                  ? "bg-[#FBF3E8] border-[#F0D9BC] text-[#B77932] animate-pulse"
                  : workflowStatus === "FAILED"
                  ? "bg-[#FBEDED] border-[#F3CBC7] text-[#C44E45]"
                  : "bg-[#F5E7DE] border-[#E8CFC1] text-[#C66A43]"
              }`}
            >
              {workflowStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E8E2D9]">
              <span className="text-[10px] text-[#77716A] block">Request ID</span>
              <span className="text-sm font-semibold text-[#26231F]">
                {activeRequestId ? `#${activeRequestId}` : "Idle"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E8E2D9]">
              <span className="text-[10px] text-[#77716A] block">Replans</span>
              <span className="text-sm font-semibold text-[#C66A43]">
                {replanCount} / 3 max
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-[#77716A]">Task Progression</span>
              <span className="text-[#26231F] font-semibold">
                {completedCount}/{totalTasks}
              </span>
            </div>
            <div className="h-2 w-full bg-[#E8E2D9] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C66A43] transition-all duration-300 rounded-full"
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
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#77716A] block mb-2">
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
                        ? "bg-[#F5E7DE] border-[#C66A43]/50 text-[#26231F] font-semibold"
                        : "bg-[#FFFFFF] hover:bg-[#FAF7F2] border-[#E8E2D9] text-[#77716A]"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#287A53] shrink-0" />
                      ) : isFail ? (
                        <XCircle className="h-3.5 w-3.5 text-[#C44E45] shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-[#77716A] shrink-0" />
                      )}
                      <span className="truncate">{t.task_id}: {t.description}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#F0ECE5] text-[#77716A] shrink-0">
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
          <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#E8E2D9]">
              <span className="text-[10px] font-semibold text-[#C66A43]">
                Task Inspection: {currentTask.task_id}
              </span>
              {currentTask.requires_human_approval && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932]">
                  Governed
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#26231F] font-sans">
              {currentTask.description}
            </p>

            {toolResults[currentTask.task_id] !== undefined ? (
              <div>
                <span className="text-[10px] text-[#77716A] uppercase block mb-1">
                  Tool Output Payload:
                </span>
                <pre className="p-2.5 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[10px] text-[#26231F] max-h-36 overflow-y-auto">
                  {JSON.stringify(toolResults[currentTask.task_id], null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-[10px] text-[#77716A] italic">
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
                className="w-full pt-1 text-[11px] text-[#C66A43] hover:underline flex items-center justify-between cursor-pointer"
              >
                <span>Find in Decision Trace Log</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Quick Navigations */}
        <div className="space-y-1.5 pt-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#77716A] block mb-1">
            Deep Workspaces
          </span>
          <button
            type="button"
            onClick={() => onNavigateToSection("observability")}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E8E2D9] text-xs text-[#77716A] hover:text-[#26231F] transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Terminal className="h-3.5 w-3.5 text-[#C66A43]" />
              <span>Full Decision Traces</span>
            </div>
            <ArrowRight className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateToSection("evaluation")}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E8E2D9] text-xs text-[#77716A] hover:text-[#26231F] transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-3.5 w-3.5 text-[#287A53]" />
              <span>Reliability Telemetry</span>
            </div>
            <ArrowRight className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateToSection("registry")}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E8E2D9] text-xs text-[#77716A] hover:text-[#26231F] transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Wrench className="h-3.5 w-3.5 text-[#C66A43]" />
              <span>Tool Registry ({tools.length})</span>
            </div>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </aside>
  );
}
