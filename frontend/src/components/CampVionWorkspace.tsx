"use client";

import React, { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  Moon,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sun,
} from "lucide-react";

import { BrandLogo } from "./BrandLogo";
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
import { ExperienceMode, useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAssistantUi } from "../store/assistantUiStore";
import { formatRoleLabel, getUserInitials, toTitleCase } from "../utils/language";

interface CampVionWorkspaceProps {
  initialSection?: WorkspaceSection;
}

export function CampVionWorkspace({ initialSection = "chat" }: CampVionWorkspaceProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout, preferredDisplayName } = useAuth();
  const {
    theme,
    resolvedTheme,
    setTheme,
    experienceMode,
    setExperienceMode,
    reducedMotion,
  } = useTheme();
  const {
    firstMessageSent,
    startFirstMessageScatter,
    markConversationActive,
    resetWelcome,
  } = useAssistantUi();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isDark = mounted ? resolvedTheme === "dark" : true;

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
  const [sectionOverride, setSectionOverride] = useState<WorkspaceSection | null>(
    initialSection === "chat" ? null : initialSection
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState<boolean>(false);
  const [isMainScrolled, setIsMainScrolled] = useState<boolean>(false);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [toolsMenuOpen, setToolsMenuOpen] = useState<boolean>(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);

  // Workflow dispatch and execution states
  const [customStudentId, setSelectedStudentId] = useState<string | null>(null);
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

  const roleStr = (user?.role || "").toLowerCase();
  const isAdmin = roleStr === "administrator" || roleStr === "system_administrator";
  const isFaculty = roleStr === "faculty";
  const canUseAdvanced = isAdmin || isFaculty;
  const effectiveMode: ExperienceMode = canUseAdvanced ? experienceMode : "simple";
  const activeSection: WorkspaceSection =
    sectionOverride ?? (isAdmin && initialSection === "chat" ? "unified" : initialSection);
  const setActiveSection = useCallback((next: WorkspaceSection) => {
    setSectionOverride(next);
  }, []);
  const selectedStudentId =
    customStudentId && customStudentId !== "S001"
      ? customStudentId
      : user?.student_id || customStudentId || "S001";

  // Close header avatar menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAvatarMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [avatarMenuOpen]);

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

  // Global pending approvals fetcher for administrators
  const fetchPendingApprovals = useCallback(async () => {
    if (!user) return;
    const role = (user.role || "").toLowerCase();
    if (role === "administrator" || role === "system_administrator") {
      try {
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
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const role = (user.role || "").toLowerCase();
    if (role !== "administrator" && role !== "system_administrator") return;

    let active = true;
    apiClient
      .listPendingApprovals()
      .then((list) => {
        if (!active) return;
        setPendingApprovals(list);
        if (list.length > 0) {
          setRecentRequestIds((prev) => {
            const idsToAdd = list.slice(0, 10).map((i) => i.request_id);
            const combined = Array.from(new Set([...idsToAdd, ...prev]));
            return combined.slice(0, 15);
          });
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load pending approvals:", err);
      });
    return () => {
      active = false;
    };
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
            if (fullConv.messages.length > 0 || fullConv.active_workflow_request_id) {
              markConversationActive();
            } else {
              resetWelcome();
            }
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
        resetWelcome();
      } catch {
        // Ignore background session recovery errors
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, selectedStudentId, fetchWorkflowDetails, markConversationActive, resetWelcome]);

  // Direct workflow execution (used by simulation fault-injection directives & evaluation suite)
  const handleLaunchAgent = async (studentId?: string, goal?: string) => {
    const sId = studentId || selectedStudentId;
    const gText = goal || goalText;

    if (!sId.trim() || !gText.trim() || isLoading) return;

    const wasEmpty =
      (conversation?.messages?.length ?? 0) === 0 &&
      !agentState &&
      !agentResult &&
      !activeRequestId;
    if (wasEmpty && !firstMessageSent) {
      startFirstMessageScatter(reducedMotion);
    }

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
      if (wasEmpty) {
        resetWelcome();
      }
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

    const wasEmpty =
      (conversation?.messages?.length ?? 0) === 0 &&
      !agentState &&
      !agentResult &&
      !activeRequestId;
    if (wasEmpty && !firstMessageSent) {
      startFirstMessageScatter(reducedMotion);
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
      if (wasEmpty) {
        resetWelcome();
      }
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
    markConversationActive();
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
    setConversation(null);
    resetWelcome();
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
      <div
        data-theme={isDark ? "dark" : "light"}
        className="cv-app min-h-screen w-full flex flex-col items-center justify-center bg-cv-canvas text-cv-fg p-6 relative overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(34, 211, 238, 0.05) 50%, transparent 75%)",
          }}
        />
        <BrandLogo
          variant="mark"
          isDark={isDark}
          size={40}
          alt="CampVion Emblem"
          priority
          className="h-10 w-auto mb-4 relative z-10"
        />
        <div className="flex items-center space-x-2 text-xs font-medium text-cv-fg-2 relative z-10">
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

  const sectionTitle = (() => {
    switch (activeSection) {
      case "chat":
        return "Assistant";
      case "unified":
        return "Overview";
      case "approvals":
        return "Approval Queue";
      case "workspace":
        return "Workflow Pipeline (DAG)";
      case "observability":
        return effectiveMode === "simple" ? "Request History" : "Decision Traces & Logs";
      case "evaluation":
        return "Evaluation & Reliability";
      case "registry":
        return "Tool Registry & Schemas";
      case "settings":
        return "Settings";
      default:
        return "Workspace";
    }
  })();

  const userDisplayName = toTitleCase(user?.full_name) || "Campus User";
  const userInitials = getUserInitials(user?.full_name, user?.email);
  const userRoleLabel = formatRoleLabel(user?.role);

  return (
    <div
      data-theme={isDark ? "dark" : "light"}
      className="cv-app h-screen w-full flex flex-row overflow-hidden bg-cv-canvas text-cv-fg relative"
    >
      {/* Subtle Ambient Background Layers (~6% radial glow + faint fading grid) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div
          className="absolute -top-40 right-[12%] w-[680px] h-[520px] rounded-full blur-3xl"
          style={{
            background: isDark
              ? "radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, rgba(34, 211, 238, 0.05) 45%, transparent 72%)"
              : "radial-gradient(circle, rgba(79, 70, 229, 0.06) 0%, rgba(8, 145, 178, 0.04) 45%, transparent 72%)",
          }}
        />
        <div
          className="absolute -bottom-48 left-[18%] w-[560px] h-[440px] rounded-full blur-3xl"
          style={{
            background: isDark
              ? "radial-gradient(circle, rgba(34, 211, 238, 0.05) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(8, 145, 178, 0.045) 0%, transparent 70%)",
          }}
        />
        <div className="absolute inset-0 cv-app-ambient-grid" />
      </div>

      {/* 1. Unified Left Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          setIsMainScrolled(false);
        }}
        recentRequestIds={recentRequestIds}
        activeRequestId={activeRequestId}
        sessionSummaries={sessionSummaries}
        onSelectRequestId={handleSelectRequestId}
        onNewRequest={handleNewRequest}
        health={health}
        healthLoading={healthLoading}
        healthLatencyMs={healthLatencyMs}
        onRefreshHealth={loadInitialData}
        user={user}
        onLogout={handleLogout}
        pendingApprovalsCount={pendingApprovals.length}
        effectiveMode={effectiveMode}
      />

      {/* 2. Central Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-10">
        {/* Top Frosted Glass Header */}
        <header
          className={`h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b transition-all duration-200 z-20 shrink-0 ${
            isMainScrolled
              ? "border-cv-line bg-cv-surface/85 backdrop-blur-xl shadow-xs"
              : "border-cv-line/70 bg-transparent backdrop-blur-md"
          }`}
        >
          <div className="flex items-center space-x-3 min-w-0">
            {/* Mobile Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1.5 rounded-xl text-cv-fg-2 hover:text-cv-fg hover:bg-cv-hover border border-transparent hover:border-cv-line transition cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Mobile-only compact mark (desktop already has logo in Sidebar) */}
            <BrandLogo
              variant="mark"
              isDark={isDark}
              size={22}
              alt="CampVion"
              className="h-5 w-auto lg:hidden shrink-0"
            />

            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-cv-fg truncate">
              {sectionTitle}
            </h1>

            {activeRequestId && (effectiveMode === "advanced" || activeSection !== "chat") && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink hidden sm:inline-flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cv-accent" />
                <span>#{activeRequestId}</span>
              </span>
            )}

            {pendingApproval && (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-cv-warning-soft border border-cv-warning-line text-cv-warning hidden sm:inline-flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cv-warning-solid animate-pulse" />
                <span>Waiting for approval</span>
              </span>
            )}

            {canUseAdvanced && pendingApprovals.length > 0 && activeSection !== "approvals" && (
              <button
                type="button"
                onClick={() => setActiveSection("approvals")}
                className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-cv-warning-soft border border-cv-warning-line text-cv-warning hover:brightness-105 transition cursor-pointer"
                title="View Approval Queue"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>
                  {pendingApprovals.length} pending approval
                  {pendingApprovals.length > 1 ? "s" : ""}
                </span>
              </button>
            )}
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            {/* Simple / Advanced Segmented Control (Admin & Faculty only) */}
            {canUseAdvanced && (
              <div
                role="group"
                aria-label="Workspace View Mode"
                className="flex items-center p-0.5 rounded-xl bg-cv-surface/80 border border-cv-line text-[11px] font-medium"
              >
                <button
                  type="button"
                  onClick={() => setExperienceMode("simple")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    experienceMode === "simple"
                      ? "bg-cv-accent-soft text-cv-accent-ink font-semibold"
                      : "text-cv-fg-2 hover:text-cv-fg"
                  }`}
                >
                  Simple
                </button>
                <button
                  type="button"
                  onClick={() => setExperienceMode("advanced")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    experienceMode === "advanced"
                      ? "bg-cv-accent-soft text-cv-accent-ink font-semibold"
                      : "text-cv-fg-2 hover:text-cv-fg"
                  }`}
                >
                  Advanced
                </button>
              </div>
            )}

            {/* Theme Segmented Control (Shared with Landing: Light / Dark / System) */}
            <div
              role="group"
              aria-label="Theme Switcher"
              className="flex items-center p-0.5 rounded-xl bg-cv-surface/80 border border-cv-line"
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                aria-label="Light mode"
                title="Light mode"
                aria-pressed={mounted && theme === "light"}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  mounted && theme === "light"
                    ? "bg-cv-accent-soft text-cv-accent-ink"
                    : "text-cv-fg-3 hover:text-cv-fg"
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                aria-label="Dark mode"
                title="Dark mode"
                aria-pressed={mounted && theme === "dark"}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  mounted && theme === "dark"
                    ? "bg-cv-accent-soft text-cv-accent-ink"
                    : "text-cv-fg-3 hover:text-cv-fg"
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                aria-label="System theme"
                title="System theme"
                aria-pressed={mounted && theme === "system"}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  mounted && theme === "system"
                    ? "bg-cv-accent-soft text-cv-accent-ink"
                    : "text-cv-fg-3 hover:text-cv-fg"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>

            {activeRequestId && activeSection !== "chat" && (
              <button
                type="button"
                onClick={() => handleSelectRequestId(activeRequestId)}
                disabled={isLoading}
                aria-label="Refresh active request"
                title="Refresh request"
                className="p-2 rounded-xl bg-cv-surface/80 hover:bg-cv-hover text-cv-fg-2 hover:text-cv-fg border border-cv-line transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-cv-accent-ink" : ""}`}
                />
              </button>
            )}

            {/* Compact Avatar Menu (Settings + Sign Out) */}
            <div className="relative" ref={avatarMenuRef}>
              <button
                type="button"
                onClick={() => setAvatarMenuOpen((prev) => !prev)}
                aria-expanded={avatarMenuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="flex items-center space-x-1.5 pl-1 pr-2 py-1 rounded-xl bg-cv-surface/80 hover:bg-cv-hover border border-cv-line transition cursor-pointer"
              >
                <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#6366F1]/25 to-[#22D3EE]/25 border border-cv-accent-soft-line flex items-center justify-center text-[11px] font-semibold text-cv-fg">
                  {userInitials}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-cv-fg-3 transition-transform duration-150 ${
                    avatarMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {avatarMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account actions"
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-cv-surface border border-cv-line-strong shadow-xl p-1.5 z-50 backdrop-blur-xl"
                >
                  <div className="px-3 py-2 border-b border-cv-line mb-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-cv-fg truncate">
                        {userDisplayName}
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cv-accent-soft text-cv-accent-ink">
                        {userRoleLabel}
                      </span>
                    </div>
                    <span className="text-[11px] text-cv-fg-3 block truncate mt-0.5">
                      {user?.email}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      setActiveSection("settings");
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-cv-fg-2 hover:text-cv-fg hover:bg-cv-hover transition cursor-pointer text-left"
                  >
                    <Settings className="h-3.5 w-3.5 text-cv-accent-ink" />
                    <span>Settings</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      void handleLogout();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-cv-fg-2 hover:text-cv-error hover:bg-cv-error-soft transition cursor-pointer text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Main Workspace Content */}
        <main
          tabIndex={-1}
          onScroll={(e) => setIsMainScrolled(e.currentTarget.scrollTop > 8)}
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
                  hasPreviousRequests={recentRequestIds.length > 0}
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

          {/* Role-restricted route fallback for students attempting admin/developer views */}
          {!canUseAdvanced &&
          ["approvals", "workspace", "evaluation", "registry"].includes(activeSection) ? (
            <section className="p-4 sm:p-6 max-w-2xl mx-auto w-full my-auto">
              <div className="glass-panel rounded-2xl p-6 sm:p-8 text-center space-y-4">
                <div className="mx-auto h-11 w-11 rounded-2xl bg-cv-warning-soft border border-cv-warning-line text-cv-warning flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-semibold text-cv-fg">
                    Administrator Access Required
                  </h2>
                  <p className="text-xs text-cv-fg-2 max-w-md mx-auto leading-relaxed">
                    This operational view is restricted to authorized faculty and university administrators. Return to your assistant or overview to manage your campus requests.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection("chat")}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold cv-btn-gradient cursor-pointer"
                >
                  Back to Assistant
                </button>
              </div>
            </section>
          ) : (
            <>
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

              {/* VIEW: Execution & Observability (Request History / Decision Traces) */}
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

              {/* VIEW: Operations Overview & Admin Approval Queue */}
              {(activeSection === "unified" || activeSection === "approvals") && (
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

                  {activeSection === "unified" && (
                    <WorkflowStatus
                      state={agentState}
                      result={agentResult}
                      tasks={tasks}
                      onInspectToolInTrace={handleInspectToolInTrace}
                    />
                  )}
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
            </>
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
