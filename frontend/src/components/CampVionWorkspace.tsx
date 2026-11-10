"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { Sidebar } from "./Sidebar";
import { ConversationFeed } from "./ConversationFeed";
import { AdvancedComposer } from "./AdvancedComposer";
import { ToolsMenu } from "./ToolsMenu";

import { OverviewDashboard } from "./OverviewDashboard";
import { WorkflowStatus } from "./WorkflowStatus";
import { HumanApprovalCenter } from "./HumanApprovalCenter";
import { ExecutionTrace } from "./ExecutionTrace";
import { EvaluationSection } from "./EvaluationSection";
import { ToolRegistryPanel } from "./ToolRegistryPanel";
import { SettingsView } from "./SettingsView";

import { apiClient } from "../lib/api";
import {
  AgentResult,
  AgentState,
  AttendanceRecord,
  ConversationSessionData,
  CourseRecord,
  HealthResponse,
  PendingApprovalItem,
  Student,
  Task,
  ToolSchema,
  TraceItem,
  WorkflowSessionSummary,
  WorkspaceSection,
} from "../types/api";
import { PRESET_GOALS } from "./NewRequestPanel";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

interface CampVionWorkspaceProps {
  initialSection?: WorkspaceSection;
}

export function CampVionWorkspace({ initialSection = "chat" }: CampVionWorkspaceProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout, preferredDisplayName } = useAuth();
  const { experienceMode, setExperienceMode } = useTheme();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceByStudent, setAttendanceByStudent] = useState<
    Record<string, AttendanceRecord[]>
  >({});
  const [coursesByStudent, setCoursesByStudent] = useState<
    Record<string, CourseRecord[]>
  >({});
  const [tools, setTools] = useState<ToolSchema[]>([]);

  // Workspace layout and view states
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(initialSection);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [toolsMenuOpen, setToolsMenuOpen] = useState<boolean>(false);

  // Workflow dispatch and execution states
  const [customStudentId, setSelectedStudentId] = useState<string | null>(null);
  const selectedStudentId = customStudentId || user?.student_id || "S001";
  const [goalText, setGoalText] = useState<string>("");
  const [conversation, setConversation] = useState<ConversationSessionData | null>(null);

  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [recentRequestIds, setRecentRequestIds] = useState<number[]>([]);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [traceSearchQuery, setTraceSearchQuery] = useState<string>("");

  const [resultsById, setResultsById] = useState<Record<number, AgentResult>>({});
  const [sessionSummaries, setSessionSummaries] = useState<
    Record<number, WorkflowSessionSummary>
  >({});

  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState<boolean>(false);

  const roleStr = (user?.role || "").toLowerCase();
  const isAdmin = roleStr === "administrator" || roleStr === "system_administrator";

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const traceSectionRef = useRef<HTMLElement | null>(null);

  // Enforce authenticated route guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Synchronize active student context with authenticated user's profile
  useEffect(() => {
    if (user?.student_id && (!customStudentId || customStudentId === "S001")) {
      setSelectedStudentId(user.student_id);
    }
  }, [user?.student_id, customStudentId]);

  // Global pending approvals fetcher for administrators
  const fetchPendingApprovals = useCallback(async () => {
    if (!user) return;
    const role = (user.role || "").toLowerCase();
    if (role === "administrator" || role === "system_administrator") {
      try {
        setApprovalsLoading(true);
        const list = await apiClient.listPendingApprovals();
        setPendingApprovals(list);
        if (list.length > 0) {
          setRecentRequestIds((prev) => {
            const idsToAdd = list.slice(0, 10).map((i) => i.request_id);
            const combined = Array.from(new Set([...idsToAdd, ...prev]));
            return combined.slice(0, 15);
          });
        }
      } catch (err: unknown) {
        console.error("Failed to load pending approvals:", err);
      } finally {
        setApprovalsLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  // When Administrator logs in, default view immediately to Operations Overview / Admin Queue
  useEffect(() => {
    if (user) {
      const role = (user.role || "").toLowerCase();
      if ((role === "administrator" || role === "system_administrator") && activeSection === "chat") {
        setActiveSection("unified");
      }
    }
  }, [user]);

  // Load initial backend dependencies, student attendance/courses, and tool schemas
  const loadInitialData = useCallback(async () => {
    setHealthLoading(true);
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      const [healthData, studentsData, toolsData] = await Promise.all([
        apiClient.checkHealth().catch(() => null),
        apiClient.listStudents().catch(() => []),
        apiClient.listTools().catch(() => []),
      ]);
      const elapsed = Math.max(
        1,
        Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0
        )
      );
      setHealth(healthData);
      setHealthLatencyMs(healthData ? elapsed : null);
      setStudents(studentsData);
      setTools(toolsData);

      if (studentsData.length > 0) {
        const attendanceEntries = await Promise.all(
          studentsData.map(async (s) => {
            const records = await apiClient
              .getStudentAttendance(s.student_id)
              .catch(() => []);
            return [s.student_id, records] as const;
          })
        );
        const courseEntries = await Promise.all(
          studentsData.map(async (s) => {
            const courses = await apiClient
              .getStudentCourses(s.student_id)
              .catch(() => []);
            return [s.student_id, courses] as const;
          })
        );
        setAttendanceByStudent(Object.fromEntries(attendanceEntries));
        setCoursesByStudent(Object.fromEntries(courseEntries));
      }
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    (async () => {
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      try {
        const [healthData, studentsData, toolsData] = await Promise.all([
          apiClient.checkHealth().catch(() => null),
          apiClient.listStudents().catch(() => []),
          apiClient.listTools().catch(() => []),
        ]);
        const elapsed = Math.max(
          1,
          Math.round(
            (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0
          )
        );
        if (!isMounted) return;
        setHealth(healthData);
        setHealthLatencyMs(healthData ? elapsed : null);
        setStudents(studentsData);
        setTools(toolsData);
        setHealthLoading(false);

        if (studentsData.length > 0) {
          const [attendanceEntries, courseEntries] = await Promise.all([
            Promise.all(
              studentsData.map(async (s) => {
                const records = await apiClient
                  .getStudentAttendance(s.student_id)
                  .catch(() => []);
                return [s.student_id, records] as const;
              })
            ),
            Promise.all(
              studentsData.map(async (s) => {
                const courses = await apiClient
                  .getStudentCourses(s.student_id)
                  .catch(() => []);
                return [s.student_id, courses] as const;
              })
            ),
          ]);
          if (isMounted) {
            setAttendanceByStudent(Object.fromEntries(attendanceEntries));
            setCoursesByStudent(Object.fromEntries(courseEntries));
          }
        }
      } catch {
        if (isMounted) {
          setHealthLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Responsive sidebar: automatically collapse on smaller screens (< 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Synchronize state, plan, and traces for a specific request ID
  const fetchWorkflowDetails = useCallback(
    async (requestId: number, latestResult?: AgentResult) => {
      const [stateData, planData, traceData] = await Promise.all([
        apiClient.getAgentState(requestId).catch(() => null),
        apiClient.getAgentPlan(requestId).catch(() => []),
        apiClient.getAgentTrace(requestId).catch(() => []),
      ]);

      if (!stateData && !latestResult) {
        throw new Error(`Workflow request #${requestId} was not found.`);
      }

      if (stateData) {
        setAgentState(stateData);
        setSelectedStudentId(stateData.student_id);
      }
      setTasks(planData.length > 0 ? planData : stateData?.plan || []);
      setTraces(traceData);

      const resolvedResult: AgentResult | null =
        latestResult ||
        resultsById[requestId] ||
        (stateData
          ? {
              request_id: stateData.request_id,
              status: stateData.current_status,
              original_goal: stateData.original_goal,
              completed_tasks: stateData.completed_tasks,
              failed_tasks: stateData.failed_tasks,
              replanning_count: stateData.replanning_count,
              human_intervention_count:
                stateData.human_approval_required ||
                stateData.human_approval_status !== "NONE"
                  ? 1
                  : 0,
              final_message:
                stateData.final_result ||
                stateData.error ||
                (stateData.current_status === "WAITING_FOR_HUMAN"
                  ? "Waiting for human approval"
                  : ""),
              execution_time: 0,
              trace_id: stateData.request_id,
            }
          : null);

      if (resolvedResult) {
        setAgentResult(resolvedResult);
        setResultsById((prev) => ({ ...prev, [requestId]: resolvedResult }));
      }

      if (stateData || resolvedResult) {
        const summary: WorkflowSessionSummary = {
          request_id: requestId,
          student_id: stateData?.student_id || "S001",
          goal:
            stateData?.original_goal ||
            resolvedResult?.original_goal ||
            `Request #${requestId}`,
          status:
            stateData?.current_status || resolvedResult?.status || "IDLE",
          completed_count:
            stateData?.completed_tasks.length ??
            resolvedResult?.completed_tasks.length ??
            0,
          total_tasks: stateData?.plan.length || planData.length || 6,
          replanning_count:
            stateData?.replanning_count ??
            resolvedResult?.replanning_count ??
            0,
          human_approval_status: stateData?.human_approval_status || "NONE",
          execution_time: resolvedResult?.execution_time ?? 0,
          final_message: resolvedResult?.final_message || "",
          updated_at: new Date().toISOString(),
        };
        setSessionSummaries((prev) => ({ ...prev, [requestId]: summary }));
      }

      setRecentRequestIds((prev) => {
        if (!prev.includes(requestId)) {
          return [requestId, ...prev].slice(0, 10);
        }
        return prev;
      });
    },
    [resultsById]
  );

  // Load or recover the active conversation session when student changes or on refresh
  useEffect(() => {
    if (!isAuthenticated || !selectedStudentId) return;
    let isMounted = true;
    (async () => {
      try {
        const listRes = await apiClient
          .listConversations(selectedStudentId)
          .catch(() => []);
        if (!isMounted) return;

        if (listRes && listRes.length > 0) {
          const latestSummary = listRes[0];
          const fullConv = await apiClient
            .getConversation(latestSummary.conversation_id)
            .catch(() => null);
          if (!isMounted) return;

          if (fullConv) {
            setConversation(fullConv);
            if (fullConv.active_workflow_request_id) {
              setActiveRequestId(fullConv.active_workflow_request_id);
              await fetchWorkflowDetails(fullConv.active_workflow_request_id).catch(
                () => undefined
              );
            } else {
              setActiveRequestId(null);
              setAgentState(null);
              setAgentResult(null);
              setTasks([]);
              setTraces([]);
            }
            return;
          }
        }

        // No existing conversation for this student yet
        setConversation(null);
      } catch {
        // Ignore background session recovery errors
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, selectedStudentId, fetchWorkflowDetails]);

  // Direct workflow execution (used by simulation fault-injection directives & evaluation suite)
  const handleLaunchAgent = async (studentId?: string, goal?: string) => {
    const sId = studentId || selectedStudentId;
    const gText = goal || goalText;

    if (!sId.trim() || !gText.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.runAgent({ student_id: sId, goal: gText });
      setAgentResult(result);
      setActiveRequestId(result.request_id);
      await fetchWorkflowDetails(result.request_id, result);
      setActiveSection("chat");
      setGoalText("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to execute agent workflow";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Conversational Assistant multi-turn message handler
  const handleSendMessage = async (overrideText?: string) => {
    const rawText = overrideText !== undefined ? overrideText : goalText;
    const trimmed = rawText.trim();
    if (!selectedStudentId.trim() || !trimmed || isLoading) return;

    // Direct fault-injection directives bypass conversation engine to test deterministic DAG self-healing
    if (trimmed.toUpperCase().includes("FAILURE_MODE=")) {
      await handleLaunchAgent(selectedStudentId, trimmed);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const sessionData = await apiClient.sendConversationMessage({
        conversation_id:
          conversation && conversation.student_id === selectedStudentId
            ? conversation.conversation_id
            : undefined,
        student_id: selectedStudentId,
        message: trimmed,
        user_display_name:
          preferredDisplayName?.trim() ||
          (user?.full_name ? user.full_name.trim().split(" ")[0] : "Student"),
      });

      setConversation(sessionData);
      // Clear input ONLY after submission succeeds
      if (overrideText === undefined || overrideText === goalText) {
        setGoalText("");
      }

      if (sessionData.active_workflow_request_id) {
        setActiveRequestId(sessionData.active_workflow_request_id);
        await fetchWorkflowDetails(sessionData.active_workflow_request_id);
      }
      setActiveSection("chat");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to send message to CampVion Assistant. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        composerTextareaRef.current?.focus();
      }, 40);
    }
  };

  // Smart Confirmation Card action handler (confirm / edit / cancel)
  const handleConfirmAction = async (
    action: "confirm" | "cancel" | "edit",
    updatedSlots?: Record<string, unknown>
  ) => {
    if (!conversation?.conversation_id || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const sessionData = await apiClient.confirmConversationAction(
        conversation.conversation_id,
        {
          action,
          updated_slots: updatedSlots,
        }
      );
      setConversation(sessionData);
      if (sessionData.active_workflow_request_id) {
        setActiveRequestId(sessionData.active_workflow_request_id);
        await fetchWorkflowDetails(sessionData.active_workflow_request_id);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to process confirmation action.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch request ID or load historical workflow
  const handleSelectRequestId = async (requestId: number) => {
    setActiveRequestId(requestId);
    setIsLoading(true);
    setError(null);
    try {
      await fetchWorkflowDetails(requestId);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to load workflow #${requestId}`;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Human approval handler
  const handleApprove = async (requestId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.approveWorkflow(requestId);
      setAgentResult(result);
      await fetchWorkflowDetails(requestId, result);
      await fetchPendingApprovals();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Approval failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Human rejection handler
  const handleReject = async (requestId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.rejectWorkflow(requestId);
      setAgentResult(result);
      await fetchWorkflowDetails(requestId, result);
      await fetchPendingApprovals();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Rejection failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Contextual bridge: Inspect a specific tool's execution events in the Trace Log
  const handleInspectToolInTrace = (toolName: string) => {
    setTraceSearchQuery(toolName);
    setActiveSection("observability");
    setTimeout(() => {
      traceSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  // New conversation reset action
  const handleNewRequest = async () => {
    setActiveRequestId(null);
    setAgentState(null);
    setAgentResult(null);
    setTasks([]);
    setTraces([]);
    setError(null);
    setGoalText("");
    setActiveSection("chat");
    try {
      const freshSession = await apiClient.createNewConversation(selectedStudentId);
      setConversation(freshSession);
    } catch {
      setConversation(null);
    }
    setTimeout(() => {
      composerTextareaRef.current?.focus();
    }, 50);
  };

  // Apply a preset goal from the Tools menu or starter cards
  const handleSelectPreset = (preset: (typeof PRESET_GOALS)[0]) => {
    setSelectedStudentId(preset.studentId);
    setGoalText(preset.goal);
    setTimeout(() => {
      composerTextareaRef.current?.focus();
    }, 50);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-cv-canvas text-cv-fg p-6">
        <div className="h-14 w-14 rounded-2xl campvion-emblem-surface p-2 flex items-center justify-center mb-4">
          <Image
            src="/brand/campvion-symbol.png"
            alt="CampVion Emblem"
            width={40}
            height={40}
            priority
            className="h-full w-full object-contain"
          />
        </div>
        <div className="flex items-center space-x-2 text-xs font-medium text-cv-fg-2">
          <Loader2 className="h-4 w-4 animate-spin text-cv-accent-ink" />
          <span>Verifying authenticated session...</span>
        </div>
      </div>
    );
  }

  const pendingApproval =
    agentState?.current_status === "WAITING_FOR_HUMAN" &&
    agentState?.human_approval_status === "PENDING";

  const orderedSessionSummaries = recentRequestIds
    .map((id) => sessionSummaries[id])
    .filter((s): s is WorkflowSessionSummary => Boolean(s));

  return (
    <div className="h-screen w-full flex flex-row overflow-hidden bg-cv-canvas text-cv-fg">
      {/* 1. Unified Left Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        recentRequestIds={recentRequestIds}
        activeRequestId={activeRequestId}
        sessionSummaries={sessionSummaries}
        onSelectRequestId={handleSelectRequestId}
        onNewRequest={handleNewRequest}
        health={health}
        healthLoading={healthLoading}
        healthLatencyMs={healthLatencyMs}
        onRefreshHealth={loadInitialData}
        apiBaseUrl={apiClient.getBaseUrl()}
        state={agentState}
        result={agentResult}
        tasks={tasks}
        tools={tools}
        onInspectToolInTrace={handleInspectToolInTrace}
        user={user}
        onLogout={handleLogout}
        pendingApprovalsCount={pendingApprovals.length}
      />

      {/* 2. Central Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Top Control Bar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-cv-line bg-cv-surface/90 backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Official CampVion Brand Lockup: Emblem + Wordmark */}
            <div className="flex items-center space-x-2.5 shrink-0 select-none">
              <div className="relative h-8 w-8 rounded-lg campvion-emblem-surface p-1 flex items-center justify-center shrink-0">
                <Image
                  src="/brand/campvion-symbol.png"
                  alt="CampVion Emblem"
                  width={24}
                  height={24}
                  priority
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-base font-bold tracking-tight text-cv-fg font-sans">
                Camp<span className="text-cv-accent-ink">Vion</span>
              </span>
            </div>

            {/* Contextual Workspace Label (shown when viewing dedicated workspaces) */}
            {activeSection !== "chat" && (
              <div className="hidden md:flex items-center space-x-2 pl-3 border-l border-cv-line text-xs text-cv-fg-2">
                <span className="font-medium">
                  {activeSection === "workspace" &&
                    (experienceMode === "simple" ? "Request Progress" : "Workflow Pipeline (DAG)")}
                  {activeSection === "observability" &&
                    (experienceMode === "simple" ? "Activity History" : "Execution Traces & Logs")}
                  {activeSection === "evaluation" &&
                    (experienceMode === "simple" ? "System Performance" : "Evaluation & Reliability")}
                  {activeSection === "registry" &&
                    (experienceMode === "simple" ? "Campus Services" : "Tool Registry & Schemas")}
                  {activeSection === "unified" &&
                    (experienceMode === "simple" ? "Operations Overview" : "Unified Operations Overview")}
                  {activeSection === "settings" && "Settings & Preferences"}
                </span>
              </div>
            )}

            {activeRequestId && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cv-raised border border-cv-line text-cv-accent-ink hidden sm:inline-flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cv-accent" />
                <span>Request #{activeRequestId}</span>
              </span>
            )}

            {pendingApproval && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cv-warning-soft border border-cv-warning-line text-cv-warning animate-pulse">
                Approval Required
              </span>
            )}

            {isAdmin && pendingApprovals.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSection("unified")}
                className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cv-warning-soft border border-cv-warning-line text-cv-warning hover:bg-cv-warning-soft/80 transition cursor-pointer"
                title="View Admin Approval Queue"
              >
                <ShieldAlert className="h-3 w-3 animate-pulse text-cv-warning" />
                <span>{pendingApprovals.length} Approval{pendingApprovals.length > 1 ? "s" : ""} Pending</span>
              </button>
            )}
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center space-x-2">
            {/* Authenticated Role Indicator */}
            {user && (
              <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cv-inset border border-cv-line text-[11px] text-cv-fg-2">
                <ShieldCheck className="h-3.5 w-3.5 text-cv-accent-ink" />
                <span className="font-medium text-cv-fg">{user.full_name}</span>
                <span className="text-[10px] font-mono uppercase text-cv-accent-ink">
                  ({user.role})
                </span>
              </div>
            )}

            {/* Experience Mode Toggle Pill */}
            <div className="flex items-center p-0.5 rounded-lg bg-cv-inset border border-cv-line text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setExperienceMode("simple")}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  experienceMode === "simple"
                    ? "bg-cv-surface text-cv-accent-ink font-semibold shadow-2xs"
                    : "text-cv-fg-2 hover:text-cv-fg"
                }`}
                title="Simple View: Student-friendly language and guidance"
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setExperienceMode("advanced")}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  experienceMode === "advanced"
                    ? "bg-cv-surface text-cv-accent-ink font-semibold shadow-2xs"
                    : "text-cv-fg-2 hover:text-cv-fg"
                }`}
                title="Advanced View: Technical DAG pipeline, traces, and metrics"
              >
                Advanced
              </button>
            </div>

            <button
              type="button"
              onClick={() => setToolsMenuOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cv-surface hover:bg-cv-raised text-cv-fg hover:text-cv-accent-ink border border-cv-line hover:border-cv-accent-line/40 transition cursor-pointer shadow-xs"
              title="Open Request Options, Presets & Campus Services"
            >
              <Wrench className="h-3.5 w-3.5 text-cv-accent-ink" />
              <span className="hidden sm:inline">
                {experienceMode === "simple" ? "Request Options" : "Tools"}
              </span>
            </button>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-cv-surface hover:bg-cv-raised text-cv-fg-2 hover:text-cv-fg border border-cv-line transition"
              title="Return to Public Overview"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Overview</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign Out"
              title="Sign Out"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-cv-surface hover:bg-cv-error-soft text-cv-fg-2 hover:text-cv-error border border-cv-line hover:border-cv-error-line transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>

            {activeRequestId && (
              <button
                type="button"
                onClick={() => handleSelectRequestId(activeRequestId)}
                disabled={isLoading}
                aria-label="Refresh Active Request State"
                className="p-1.5 rounded-lg bg-cv-surface hover:bg-cv-raised text-cv-fg-2 hover:text-cv-fg border border-cv-line transition cursor-pointer disabled:opacity-50"
                title="Refresh Request State"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-cv-accent-ink" : ""}`} />
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Main Workspace Content */}
        <main
          tabIndex={-1}
          className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden relative outline-none"
        >
          {/* VIEW: Conversational Assistant (Chat-First Workspace) */}
          {activeSection === "chat" && (
            <div className="flex-1 flex flex-col min-h-full">
              <div className="flex-1 flex flex-col">
                <ConversationFeed
                  conversation={conversation}
                  state={agentState}
                  result={agentResult}
                  tasks={tasks}
                  activeRequestId={activeRequestId}
                  isLoading={isLoading}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onSelectPreset={handleSelectPreset}
                  onSendMessage={handleSendMessage}
                  onConfirmAction={handleConfirmAction}
                  onInspectToolInTrace={handleInspectToolInTrace}
                />
              </div>

              {/* Floating Bottom Composer */}
              <div className="sticky bottom-0 z-20 bg-gradient-to-t from-cv-canvas via-cv-canvas/95 to-transparent pt-3 sm:pt-4 pb-3 sm:pb-4 px-2 sm:px-6">
                <AdvancedComposer
                  students={students}
                  selectedStudentId={selectedStudentId}
                  onSelectStudentId={setSelectedStudentId}
                  goalText={goalText}
                  onGoalTextChange={(text) => {
                    setGoalText(text);
                    if (error) setError(null);
                  }}
                  onSubmit={(text) => handleSendMessage(text)}
                  isLoading={isLoading}
                  error={error}
                  onClearError={() => setError(null)}
                  attendanceByStudent={attendanceByStudent}
                  coursesByStudent={coursesByStudent}
                  onOpenTools={() => setToolsMenuOpen(true)}
                  onNewConversation={() => void handleNewRequest()}
                  activeConversationTitle={conversation?.title}
                  textareaRef={composerTextareaRef}
                />
              </div>
            </div>
          )}

          {/* VIEW: Workflow Pipeline (Dedicated Topological DAG) */}
          {activeSection === "workspace" && (
            <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
              {pendingApproval && (
                <HumanApprovalCenter
                  state={agentState}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isLoading={isLoading}
                />
              )}

              <WorkflowStatus
                state={agentState}
                result={agentResult}
                tasks={tasks}
                onInspectToolInTrace={handleInspectToolInTrace}
              />
            </div>
          )}

          {/* VIEW: Execution & Observability (Decision Traces) */}
          {activeSection === "observability" && (
            <section ref={traceSectionRef} className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
              <ExecutionTrace
                traces={traces}
                requestId={activeRequestId}
                searchQuery={traceSearchQuery}
                onSearchQueryChange={setTraceSearchQuery}
              />
            </section>
          )}

          {/* VIEW: Evaluation & Reliability */}
          {activeSection === "evaluation" && (
            <section className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
              <EvaluationSection
                state={agentState}
                result={agentResult}
                traces={traces}
                sessionSummaries={orderedSessionSummaries}
                activeRequestId={activeRequestId}
                onSelectRequestId={handleSelectRequestId}
                onRunScenario={(sId, goal) => handleLaunchAgent(sId, goal)}
                isLoading={isLoading}
              />
            </section>
          )}

          {/* VIEW: Tool Registry & System Schemas */}
          {activeSection === "registry" && (
            <section className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
              <ToolRegistryPanel
                tools={tools}
                state={agentState}
                traces={traces}
                health={health}
                healthLoading={healthLoading}
                healthLatencyMs={healthLatencyMs}
                apiBaseUrl={apiClient.getBaseUrl()}
                onRefreshHealth={loadInitialData}
                onInspectToolInTrace={handleInspectToolInTrace}
              />
            </section>
          )}

          {/* VIEW: Operations Overview (Unified Dashboard) */}
          {activeSection === "unified" && (
            <section className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
              <OverviewDashboard
                state={agentState}
                result={agentResult}
                tools={tools}
                recentRequestIds={recentRequestIds}
                activeRequestId={activeRequestId}
                onSelectRequestId={handleSelectRequestId}
                isLoading={isLoading}
                sessionSummaries={sessionSummaries}
                onRefreshActiveRequest={() => {
                  if (activeRequestId) handleSelectRequestId(activeRequestId);
                }}
                onNavigateToSection={setActiveSection}
                onFocusComposer={() => {
                  setActiveSection("chat");
                  setTimeout(() => composerTextareaRef.current?.focus(), 50);
                }}
                user={user}
                onApproveWorkflow={handleApprove}
                onRejectWorkflow={handleReject}
                onRefreshPendingApprovals={fetchPendingApprovals}
              />

              {pendingApproval && (
                <HumanApprovalCenter
                  state={agentState}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isLoading={isLoading}
                />
              )}

              <WorkflowStatus
                state={agentState}
                result={agentResult}
                tasks={tasks}
                onInspectToolInTrace={handleInspectToolInTrace}
              />
            </section>
          )}

          {/* VIEW: Settings & Appearance Center */}
          {activeSection === "settings" && (
            <section className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
              <SettingsView
                health={health}
                selectedStudentId={selectedStudentId}
                onSelectStudentId={setSelectedStudentId}
                inspectorOpen={inspectorOpen}
                onToggleInspector={() => setInspectorOpen((prev) => !prev)}
                apiBaseUrl={apiClient.getBaseUrl()}
              />
            </section>
          )}
        </main>
      </div>

      {/* 3. Integrated Agentic Tools Popover Dialog */}
      <ToolsMenu
        isOpen={toolsMenuOpen}
        onClose={() => setToolsMenuOpen(false)}
        tools={tools}
        onSelectPreset={handleSelectPreset}
        onNavigateToSection={setActiveSection}
        onInspectTool={handleInspectToolInTrace}
        pendingApproval={pendingApproval}
      />
    </div>
  );
}
