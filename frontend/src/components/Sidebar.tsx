"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  ExternalLink,
  Layers,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Terminal,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  AgentResult,
  AgentState,
  HealthResponse,
  Task,
  ToolSchema,
  UserProfile,
  WorkflowSessionSummary,
  WorkspaceSection,
} from "../types/api";
import { useTheme } from "../context/ThemeContext";
import {
  getFriendlyTaskTitle,
  getFriendlyToolName,
  getFriendlyWorkflowStatus,
} from "../utils/language";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  recentRequestIds: number[];
  activeRequestId: number | null;
  sessionSummaries: Record<number, WorkflowSessionSummary>;
  onSelectRequestId: (id: number) => void;
  onNewRequest: () => void;
  health: HealthResponse | null;
  healthLoading: boolean;
  healthLatencyMs: number | null;
  onRefreshHealth: () => void;
  apiBaseUrl: string;
  state: AgentState | null;
  result: AgentResult | null;
  tasks: Task[];
  tools: ToolSchema[];
  onInspectToolInTrace?: (toolName: string) => void;
  user?: UserProfile | null;
  onLogout?: () => void;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  activeSection,
  onSelectSection,
  recentRequestIds,
  activeRequestId,
  sessionSummaries,
  onSelectRequestId,
  onNewRequest,
  health,
  healthLoading,
  healthLatencyMs,
  onRefreshHealth,
  apiBaseUrl,
  state,
  result,
  tasks,
  tools,
  onInspectToolInTrace,
  user,
  onLogout,
}: SidebarProps) {
  const { experienceMode } = useTheme();
  const isOnline = health?.status === "healthy";
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);

  // Inspector derived values
  const planTasks = state?.plan && state.plan.length > 0 ? state.plan : tasks;
  const completedCount = state?.completed_tasks.length ?? result?.completed_tasks.length ?? 0;
  const totalTasks = planTasks.length || 6;
  const replanCount = state?.replanning_count ?? result?.replanning_count ?? 0;
  const workflowStatus = state?.current_status || result?.status || "IDLE";
  const selectedTools = state?.selected_tools || {};

  const currentTask = selectedTaskKey
    ? planTasks.find((t) => t.task_id === selectedTaskKey)
    : planTasks[0];

  const friendlyStatus = getFriendlyWorkflowStatus(workflowStatus, experienceMode);

  const navItems = [
    {
      id: "chat" as WorkspaceSection,
      label: experienceMode === "simple" ? "Campus Assistant" : "Conversational Assistant",
      shortLabel: "Assistant",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: "workspace" as WorkspaceSection,
      label: experienceMode === "simple" ? "Request Progress" : "Workflow Pipeline (DAG)",
      shortLabel: "Progress",
      icon: <Layers className="h-4 w-4" />,
    },
    {
      id: "observability" as WorkspaceSection,
      label: experienceMode === "simple" ? "Activity History" : "Decision Traces & Logs",
      shortLabel: "Activity",
      icon: <Terminal className="h-4 w-4" />,
    },
    {
      id: "evaluation" as WorkspaceSection,
      label: experienceMode === "simple" ? "System Performance" : "Evaluation & Reliability",
      shortLabel: "Performance",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      id: "registry" as WorkspaceSection,
      label: experienceMode === "simple" ? "Campus Services" : "Tool Registry & Schemas",
      shortLabel: "Services",
      icon: <Wrench className="h-4 w-4" />,
    },
  ];

  return (
    <aside
      aria-label="CampVion Navigation Sidebar"
      className={`relative flex flex-col h-full bg-cv-sidebar border-r border-cv-line transition-all duration-300 ease-in-out shrink-0 z-30 select-none ${
        isCollapsed ? "w-16" : "w-64 sm:w-72 lg:w-80"
      }`}
    >
      {/* 1. CampVion Branding & Logo Header */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-cv-line shrink-0">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="relative h-9 w-9 rounded-xl campvion-emblem-surface p-1 flex items-center justify-center shrink-0 shadow-2xs">
            <Image
              src="/brand/campvion-symbol.png"
              alt="CampVion Emblem"
              width={26}
              height={26}
              className="h-full w-full object-contain"
            />
            <span
              className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${
                isOnline ? "bg-cv-success-solid" : "bg-cv-error-solid"
              }`}
            />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-semibold tracking-tight text-cv-fg">
                  Camp<span className="text-cv-accent-ink">Vion</span>
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-cv-raised text-cv-fg-2">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-cv-fg-2 truncate">
                Campus Operations AI
              </p>
            </div>
          )}
        </div>

        {/* Collapse / Expand Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-lg text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent hover:border-cv-line transition cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* 2. New Request Button */}
      <div className="p-3 border-b border-cv-line shrink-0">
        <button
          type="button"
          onClick={onNewRequest}
          className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent border border-transparent shadow-xs transition cursor-pointer group ${
            isCollapsed ? "px-0" : ""
          }`}
          title="Start New Request"
        >
          <Plus className="h-4 w-4 text-cv-on-accent group-hover:scale-110 transition-transform" />
          {!isCollapsed && <span>New Request</span>}
        </button>
      </div>

      {/* Scrollable Center Body: Workspaces + Recent Sessions + Contextual Inspector */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* 3. Workspaces Navigation */}
        <nav aria-label="Workspace Views" className="space-y-1">
          {!isCollapsed && (
            <span className="px-2.5 text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2 block mb-1">
              Workspaces
            </span>
          )}
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`relative w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-cv-accent-soft text-cv-fg border border-cv-accent-soft-line font-semibold"
                    : "text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
                title={item.label}
              >
                <div
                  className={`shrink-0 ${
                    isActive ? "text-cv-accent-ink" : "text-cv-fg-2"
                  }`}
                >
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {/* Neon active indicator */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-cv-accent transition-all duration-200 ${
                    isActive ? "h-5 opacity-100" : "h-0 opacity-0"
                  }`}
                />
              </button>
            );
          })}

          {/* Developer API Docs Link */}
          <a
            href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent transition ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
            title="Interactive Developer API Documentation"
          >
            <ExternalLink className="h-4 w-4 shrink-0 text-cv-accent-ink" />
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Developer API Docs</span>
                <span className="text-[9px] font-mono text-cv-fg-2">API</span>
              </div>
            )}
          </a>
        </nav>

        {/* 4. Recent Requests (formerly Recent Sessions) */}
        <div className="border-t border-cv-line pt-3">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2.5 mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2">
                Recent Requests
              </span>
              <span className="text-[10px] font-mono text-cv-fg-2">
                {recentRequestIds.length}
              </span>
            </div>
          )}

          {recentRequestIds.length === 0 ? (
            !isCollapsed && (
              <p className="px-2.5 py-3 text-xs text-cv-fg-2 text-center italic">
                No recent requests yet. Submit a request above to get started.
              </p>
            )
          ) : (
            <div className="space-y-1">
              {recentRequestIds.map((id) => {
                const summary = sessionSummaries[id];
                const isSelected = activeRequestId === id;
                const status = summary?.status || "IDLE";

                const badgeColor =
                  status === "COMPLETED"
                    ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                    : status === "WAITING_FOR_HUMAN"
                    ? "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
                    : status === "FAILED"
                    ? "bg-cv-error-soft border-cv-error-line text-cv-error"
                    : "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink";

                if (isCollapsed) {
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        onSelectRequestId(id);
                        if (activeSection !== "chat") onSelectSection("chat");
                      }}
                      className={`w-full py-1.5 flex items-center justify-center rounded transition border cursor-pointer ${
                        isSelected
                          ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink font-semibold"
                          : "bg-cv-surface hover:bg-cv-raised border-cv-line text-cv-fg-2"
                      }`}
                      title={`Request #${id} - ${summary?.goal || "Session"}`}
                    >
                      <span className="text-[10px] font-mono">#{id}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onSelectRequestId(id);
                      if (activeSection !== "chat") onSelectSection("chat");
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer group ${
                      isSelected
                        ? "bg-cv-accent-soft/70 border-cv-accent-line/40 shadow-xs"
                        : "bg-cv-surface hover:bg-cv-raised border-cv-line"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-cv-fg group-hover:text-cv-accent-ink transition-colors">
                        Request #{id}
                      </span>
                      <span
                        className={`text-[9px] font-medium px-1.5 py-0.5 rounded border uppercase ${badgeColor}`}
                      >
                        {status === "WAITING_FOR_HUMAN"
                          ? "APPROVAL REQUIRED"
                          : status === "COMPLETED"
                          ? "COMPLETED"
                          : status === "FAILED"
                          ? "FAILED"
                          : "READY"}
                      </span>
                    </div>
                    <p className="text-xs text-cv-fg-2 line-clamp-1">
                      {summary?.goal || `Request #${id}`}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-cv-fg-2 mt-1.5 pt-1 border-t border-cv-line">
                      <span>{summary?.student_id || "Student"}</span>
                      <span>
                        {summary?.completed_count ?? 0}/{summary?.total_tasks ?? 6}{" "}
                        {experienceMode === "simple" ? "steps" : "tasks"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Integrated Request Details (formerly Contextual Inspector) */}
        <div className="border-t border-cv-line pt-3">
          {isCollapsed ? (
            <div className="flex flex-col items-center space-y-2 py-1">
              <button
                type="button"
                onClick={onToggleCollapse}
                title={`Request Details: ${friendlyStatus.label} (${activeRequestId ? `#${activeRequestId}` : "Ready"})`}
                className="p-2 rounded-lg bg-cv-inset border border-cv-line hover:border-cv-accent-line/50 text-cv-accent-ink cursor-pointer"
              >
                <Cpu className="h-4 w-4" />
              </button>
              <span
                className={`h-2 w-2 rounded-full ${
                  workflowStatus === "COMPLETED"
                    ? "bg-cv-success-solid"
                    : workflowStatus === "WAITING_FOR_HUMAN"
                    ? "bg-cv-warning-solid animate-pulse"
                    : workflowStatus === "FAILED"
                    ? "bg-cv-error-solid"
                    : "bg-cv-accent"
                }`}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2.5">
                <div className="flex items-center space-x-2">
                  <Cpu className="h-4 w-4 text-cv-accent-ink" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2">
                    {experienceMode === "simple" ? "Request Details" : "Contextual Inspector"}
                  </span>
                </div>
                {activeRequestId && (
                  <span className="text-[10px] font-mono text-cv-accent-ink font-semibold">
                    Request #{activeRequestId}
                  </span>
                )}
              </div>

              {/* Status Metrics Card */}
              <div className="p-3 rounded-xl bg-cv-inset border border-cv-line space-y-2.5 shadow-2xs">
                {/* Workflow Status */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-cv-fg-2">Status</span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border uppercase font-mono ${friendlyStatus.badgeClass}`}
                  >
                    {friendlyStatus.label}
                  </span>
                </div>

                {/* Request ID & Recovery / Replans Counter */}
                <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-cv-surface border border-cv-line">
                    <span className="text-[9px] text-cv-fg-2 block">Request ID</span>
                    <span className="text-xs font-semibold text-cv-fg">
                      {activeRequestId ? `#${activeRequestId}` : "Ready"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-cv-surface border border-cv-line">
                    <span className="text-[9px] text-cv-fg-2 block">
                      {experienceMode === "simple" ? "Auto-Recovery" : "Replans"}
                    </span>
                    <span className="text-xs font-semibold text-cv-accent-ink">
                      {experienceMode === "simple"
                        ? replanCount > 0
                          ? `${replanCount} recovered`
                          : "Automatic"
                        : `${replanCount} / 3 max`}
                    </span>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1 text-cv-fg-2">
                    <span>{experienceMode === "simple" ? "Steps Completed" : "Task Progression"}</span>
                    <span className="text-cv-fg font-semibold">
                      {completedCount}/{totalTasks}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-cv-line rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        workflowStatus === "FAILED"
                          ? "bg-cv-error-solid"
                          : workflowStatus === "COMPLETED"
                          ? "bg-cv-success-solid"
                          : "bg-cv-accent"
                      }`}
                      style={{
                        width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Task Sequence List (if plan exists) */}
              {planTasks.length > 0 && activeRequestId && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2 px-2.5 block">
                    {experienceMode === "simple" ? "Request Steps" : "Task Sequence"} ({planTasks.length})
                  </span>
                  <div className="space-y-1">
                    {planTasks.map((t) => {
                      const isSelected = (currentTask?.task_id || planTasks[0].task_id) === t.task_id;
                      const isDone = state?.completed_tasks.includes(t.task_id);
                      const isFail = state?.failed_tasks.includes(t.task_id);
                      const friendlyTitle = getFriendlyTaskTitle(t.task_id, t.description);
                      const toolRaw = selectedTools[t.task_id] || t.candidate_tools[0];
                      const friendlyTool = getFriendlyToolName(toolRaw);

                      return (
                        <button
                          key={t.task_id}
                          type="button"
                          onClick={() => setSelectedTaskKey(t.task_id)}
                          className={`w-full text-left p-2 rounded-lg border text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? "bg-cv-accent-soft border-cv-accent-line/50 text-cv-fg font-semibold"
                              : "bg-cv-surface hover:bg-cv-inset border-cv-line text-cv-fg-2"
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 min-w-0">
                            {isDone ? (
                              <CheckCircle2 className="h-3 w-3 text-cv-success shrink-0" />
                            ) : isFail ? (
                              <XCircle className="h-3 w-3 text-cv-error shrink-0" />
                            ) : (
                              <Clock className="h-3 w-3 text-cv-fg-2 shrink-0" />
                            )}
                            <span className="truncate text-[11px]">
                              {experienceMode === "simple" ? friendlyTitle : `${t.task_id}: ${t.description}`}
                            </span>
                          </div>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cv-raised text-cv-fg-2 shrink-0 truncate max-w-[80px]">
                            {experienceMode === "simple" ? friendlyTool : toolRaw}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {currentTask && (
                    <div className="mt-2 p-2 rounded-lg bg-cv-inset border border-cv-line space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between pb-1 border-b border-cv-line">
                        <span className="text-[10px] font-semibold text-cv-accent-ink">
                          {experienceMode === "simple" ? "Step Details" : `Task: ${currentTask.task_id}`}
                        </span>
                        {currentTask.requires_human_approval && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
                            Approval Required
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-cv-fg font-sans line-clamp-2">
                        {experienceMode === "simple"
                          ? getFriendlyTaskTitle(currentTask.task_id, currentTask.description)
                          : currentTask.description}
                      </p>
                      {onInspectToolInTrace && (
                        <button
                          type="button"
                          onClick={() =>
                            onInspectToolInTrace(
                              selectedTools[currentTask.task_id] || currentTask.candidate_tools[0]
                            )
                          }
                          className="w-full pt-1 text-[10px] text-cv-accent-ink hover:underline flex items-center justify-between cursor-pointer"
                        >
                          <span>
                            {experienceMode === "simple"
                              ? "View in Activity History"
                              : "Find in Decision Trace Log"}
                          </span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Deep Workspaces Shortcuts */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-cv-fg-2 px-2.5 block mb-1">
                  {experienceMode === "simple" ? "Explore Workspaces" : "Deep Workspaces"}
                </span>

                <button
                  type="button"
                  onClick={() => onSelectSection("observability")}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-cv-surface hover:bg-cv-inset border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg transition cursor-pointer group"
                  title="Open Full Activity History"
                >
                  <div className="flex items-center space-x-2">
                    <Terminal className="h-3.5 w-3.5 text-cv-accent-ink group-hover:scale-110 transition-transform" />
                    <span className="text-[11px]">
                      {experienceMode === "simple" ? "Activity History" : "Full Decision Traces"}
                    </span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-cv-fg-2" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection("evaluation")}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-cv-surface hover:bg-cv-inset border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg transition cursor-pointer group"
                  title="Open System Performance & Reliability"
                >
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-3.5 w-3.5 text-cv-success group-hover:scale-110 transition-transform" />
                    <span className="text-[11px]">
                      {experienceMode === "simple" ? "System Performance" : "Reliability Telemetry"}
                    </span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-cv-fg-2" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSection("registry")}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-cv-surface hover:bg-cv-inset border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg transition cursor-pointer group"
                  title="Open Campus Services Directory"
                >
                  <div className="flex items-center space-x-2">
                    <Wrench className="h-3.5 w-3.5 text-cv-accent-ink group-hover:scale-110 transition-transform" />
                    <span className="text-[11px]">
                      {experienceMode === "simple" ? "Campus Services" : "Tool Registry"}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cv-raised text-cv-fg-2">
                    {tools.length} {experienceMode === "simple" ? "services" : "tools"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Bottom Utility Section: Account + Settings + API Docs + Backend Status */}
      <div className="border-t border-cv-line shrink-0 bg-cv-surface">
        {user && (
          <div className="px-2.5 pt-2.5 pb-1">
            <div
              className={`flex items-center justify-between gap-2 p-2 rounded-lg bg-cv-inset border border-cv-line ${
                isCollapsed ? "justify-center" : ""
              }`}
              title={`${user.full_name} (${user.email}) — Role: ${user.role}`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-cv-accent-soft border border-cv-accent-soft-line flex items-center justify-center shrink-0 text-cv-accent-ink">
                  <User className="h-3.5 w-3.5" />
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold text-cv-fg truncate">
                        {user.full_name}
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
                        {user.role}
                      </span>
                    </div>
                    <span className="text-[10px] text-cv-fg-2 block truncate">
                      {user.email}
                    </span>
                  </div>
                )}
              </div>

              {onLogout && !isCollapsed && (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Sign Out"
                  title="Sign out of CampVion"
                  className="p-1.5 rounded-lg text-cv-fg-2 hover:text-cv-error hover:bg-cv-error-soft transition cursor-pointer shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-2 space-y-1">
          <button
            type="button"
            onClick={() => onSelectSection("settings")}
            title="Settings & Appearance"
            aria-label="Settings"
            aria-current={activeSection === "settings" ? "page" : undefined}
            className={`w-full flex items-center ${
              isCollapsed ? "justify-center px-2" : "space-x-3 px-3"
            } py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeSection === "settings"
                ? "bg-cv-accent-soft text-cv-accent-ink border border-cv-accent-soft-line font-semibold"
                : "text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0 text-cv-accent-ink" />
            {!isCollapsed && <span>Settings</span>}
          </button>

          <a
            href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            title="Interactive Developer API Documentation"
            className={`w-full flex items-center ${
              isCollapsed ? "justify-center px-2" : "space-x-3 px-3"
            } py-1.5 rounded-lg text-xs text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised transition`}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Developer API Docs</span>}
          </a>
        </div>

        {/* Backend Connection Status */}
        <div className="p-2.5 pt-0">
          <div
            className={`flex items-center justify-between gap-2 p-2 rounded-lg bg-cv-raised border border-cv-line ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <span
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  isOnline ? "bg-cv-success-solid" : "bg-cv-error-solid"
                }`}
              />
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-medium text-cv-fg truncate">
                      {isOnline ? "Backend Online" : "Backend Offline"}
                    </span>
                    {healthLatencyMs !== null && (
                      <span className="text-[9px] font-mono text-cv-fg-2">
                        {healthLatencyMs}ms
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-cv-fg-2 block truncate">
                    FastAPI &bull; SQLite
                  </span>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                type="button"
                onClick={onRefreshHealth}
                disabled={healthLoading}
                aria-label="Refresh Backend Connection"
                className="p-1 rounded text-cv-fg-2 hover:text-cv-accent-ink hover:bg-cv-surface transition cursor-pointer disabled:opacity-50"
                title="Ping Backend API"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    healthLoading ? "animate-spin text-cv-accent-ink" : ""
                  }`}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
