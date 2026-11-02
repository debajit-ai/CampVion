"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Wrench,
} from "lucide-react";

import { Sidebar } from "../components/Sidebar";
import { ConversationFeed } from "../components/ConversationFeed";
import { AdvancedComposer } from "../components/AdvancedComposer";
import { ToolsMenu } from "../components/ToolsMenu";
import { ContextualInspector } from "../components/ContextualInspector";

import { OverviewDashboard } from "../components/OverviewDashboard";
import { WorkflowStatus } from "../components/WorkflowStatus";
import { HumanApprovalCenter } from "../components/HumanApprovalCenter";
import { ExecutionTrace } from "../components/ExecutionTrace";
import { EvaluationSection } from "../components/EvaluationSection";
import { ToolRegistryPanel } from "../components/ToolRegistryPanel";

import { apiClient } from "../lib/api";
import {
  AgentResult,
  AgentState,
  AttendanceRecord,
  CourseRecord,
  HealthResponse,
  Student,
  Task,
  ToolSchema,
  TraceItem,
  WorkflowSessionSummary,
  WorkspaceSection,
} from "../types/api";
import { PRESET_GOALS } from "../components/NewRequestPanel";

export default function Home() {
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
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [toolsMenuOpen, setToolsMenuOpen] = useState<boolean>(false);

  // Workflow dispatch and execution states
  const [selectedStudentId, setSelectedStudentId] = useState<string>("S001");
  const [goalText, setGoalText] = useState<string>(
    "I want to apply for leave tomorrow because I have a family function."
  );

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

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const traceSectionRef = useRef<HTMLElement | null>(null);

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

  // Submit new goal from composer
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to execute agent workflow";
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
  const handleNewRequest = () => {
    setActiveRequestId(null);
    setAgentState(null);
    setAgentResult(null);
    setTasks([]);
    setTraces([]);
    setError(null);
    setActiveSection("chat");
    setGoalText("I want to apply for leave tomorrow because I have a family function.");
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

  const pendingApproval =
    agentState?.current_status === "WAITING_FOR_HUMAN" &&
    agentState?.human_approval_status === "PENDING";

  const orderedSessionSummaries = recentRequestIds
    .map((id) => sessionSummaries[id])
    .filter((s): s is WorkflowSessionSummary => Boolean(s));

  return (
    <div className="h-screen w-full flex flex-row overflow-hidden bg-[#F5F2EB] text-[#26231F]">
      {/* 1. Left Sidebar Navigation */}
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
      />

      {/* 2. Central Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Top Control Bar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-[#E8E2D9] bg-[#FFFFFF]/90 backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <span className="text-sm font-semibold text-[#26231F] capitalize">
              {activeSection === "chat" && "Conversational Assistant"}
              {activeSection === "workspace" && "Workflow Pipeline (DAG)"}
              {activeSection === "observability" && "Execution Traces & Logs"}
              {activeSection === "evaluation" && "Evaluation & Reliability"}
              {activeSection === "registry" && "Tool Registry & Schemas"}
              {activeSection === "unified" && "Unified Operations Overview"}
            </span>

            {activeRequestId && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#F0ECE5] border border-[#E8E2D9] text-[#C66A43] hidden sm:inline-flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C66A43]" />
                <span>Workflow #{activeRequestId}</span>
              </span>
            )}

            {pendingApproval && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932] animate-pulse">
                Action Requires Approval
              </span>
            )}
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setToolsMenuOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FFFFFF] hover:bg-[#F0ECE5] text-[#26231F] hover:text-[#C66A43] border border-[#E8E2D9] hover:border-[#C66A43]/40 transition cursor-pointer shadow-xs"
              title="Open Agentic Tools Popover"
            >
              <Wrench className="h-3.5 w-3.5 text-[#C66A43]" />
              <span className="hidden sm:inline">Tools</span>
            </button>

            {activeRequestId && (
              <button
                type="button"
                onClick={() => handleSelectRequestId(activeRequestId)}
                disabled={isLoading}
                aria-label="Refresh Active Workflow State"
                className="p-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#F0ECE5] text-[#77716A] hover:text-[#26231F] border border-[#E8E2D9] transition cursor-pointer disabled:opacity-50"
                title="Refresh Workflow State"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-[#C66A43]" : ""}`} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setInspectorOpen((prev) => !prev)}
              aria-label={inspectorOpen ? "Hide Inspector" : "Show Inspector"}
              className={`p-1.5 rounded-lg border transition cursor-pointer hidden lg:inline-flex ${
                inspectorOpen
                  ? "bg-[#F5E7DE] text-[#C66A43] border-[#E8CFC1]"
                  : "bg-[#FFFFFF] text-[#77716A] hover:text-[#26231F] border-[#E8E2D9]"
              }`}
              title={inspectorOpen ? "Hide Contextual Inspector" : "Show Contextual Inspector"}
            >
              {inspectorOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        {/* Dynamic Main Workspace Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">
          {/* VIEW: Conversational Assistant (Chat-First Workspace) */}
          {activeSection === "chat" && (
            <div className="flex-1 flex flex-col min-h-0">
              <ConversationFeed
                state={agentState}
                result={agentResult}
                tasks={tasks}
                activeRequestId={activeRequestId}
                isLoading={isLoading}
                onApprove={handleApprove}
                onReject={handleReject}
                onSelectPreset={handleSelectPreset}
                onInspectToolInTrace={handleInspectToolInTrace}
              />

              {/* Floating Bottom Composer */}
              <div className="sticky bottom-0 z-20 bg-gradient-to-t from-[#F5F2EB] via-[#F5F2EB]/95 to-transparent pt-4">
                <AdvancedComposer
                  students={students}
                  selectedStudentId={selectedStudentId}
                  onSelectStudentId={setSelectedStudentId}
                  goalText={goalText}
                  onGoalTextChange={setGoalText}
                  onSubmit={() => handleLaunchAgent(selectedStudentId, goalText)}
                  isLoading={isLoading}
                  error={error}
                  attendanceByStudent={attendanceByStudent}
                  coursesByStudent={coursesByStudent}
                  onOpenTools={() => setToolsMenuOpen(true)}
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
        </main>
      </div>

      {/* 3. Contextual Right Inspector (Collapsible) */}
      <ContextualInspector
        isOpen={inspectorOpen}
        onToggle={() => setInspectorOpen((prev) => !prev)}
        state={agentState}
        result={agentResult}
        tasks={tasks}
        tools={tools}
        activeRequestId={activeRequestId}
        onNavigateToSection={setActiveSection}
        onInspectToolInTrace={handleInspectToolInTrace}
      />

      {/* 4. Integrated Agentic Tools Popover Dialog */}
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
