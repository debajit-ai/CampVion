"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  FileCheck2,
  GitBranch,
  Loader2,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  X,
  XCircle,
} from "lucide-react";
import {
  AgentResult,
  AgentState,
  ConfirmationProposal,
  ConversationMessageItem,
  ConversationSessionData,
  Task,
} from "../types/api";
import { HumanApprovalCenter } from "./HumanApprovalCenter";
import { LeaveDetailsCard, LeaveGuidedPrefill } from "./LeaveDetailsCard";
import { RoomBookingCard, RoomBookingPrefill } from "./RoomBookingCard";
import { RequestStatusCard } from "./RequestStatusCard";
import { PRESET_GOALS } from "./NewRequestPanel";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useEvents } from "../context/EventsContext";
import { useAssistantUi } from "../store/assistantUiStore";
import type { Logo3DState } from "./brand/Logo3D";
import {
  formatStudentFriendlyError,
  getFirstNameTitleCase,
  getFriendlyTaskTitle,
  getFriendlyToolName,
  getFriendlyWorkflowStatus,
} from "../utils/language";

const WelcomeScene = dynamic(
  () => import("./assistant/WelcomeScene").then((m) => m.WelcomeScene),
  { ssr: false }
);

interface ConversationFeedProps {
  conversation?: ConversationSessionData | null;
  state: AgentState | null;
  result: AgentResult | null;
  tasks: Task[];
  activeRequestId: number | null;
  isLoading: boolean;
  hasPreviousRequests?: boolean;
  onApprove: (requestId: number) => Promise<void>;
  onReject: (requestId: number) => Promise<void>;
  onSelectPreset: (preset: (typeof PRESET_GOALS)[0]) => void;
  onSendMessage?: (messageText: string) => Promise<void>;
  onConfirmAction?: (
    action: "confirm" | "cancel" | "edit",
    updatedSlots?: Record<string, unknown>
  ) => Promise<void>;
  onInspectToolInTrace?: (toolName: string) => void;
  onPrefillComposer?: (prompt: string) => void;
}

function renderFormattedInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-cv-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-cv-inset border border-cv-line font-mono text-[11px] text-cv-accent-ink"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderMessageContent(content: string): React.ReactNode {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`${keyPrefix}-list`}
          className="space-y-1.5 my-2 pl-4 list-disc marker:text-cv-accent-ink text-xs sm:text-sm text-cv-fg"
        >
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderFormattedInline(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList(`line-${index}`);
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      listItems.push(trimmed.slice(2).trim());
    } else {
      flushList(`line-${index}`);
      elements.push(
        <p key={`p-${index}`} className="text-xs sm:text-sm text-cv-fg leading-relaxed">
          {renderFormattedInline(trimmed)}
        </p>
      );
    }
  });

  flushList("final");
  return <div className="space-y-2">{elements}</div>;
}

interface SmartConfirmationCardProps {
  proposal: ConfirmationProposal;
  isActive: boolean;
  isLoading: boolean;
  onConfirmAction?: (
    action: "confirm" | "cancel" | "edit",
    updatedSlots?: Record<string, unknown>
  ) => Promise<void>;
}

function SmartConfirmationCard({
  proposal,
  isActive,
  isLoading,
  onConfirmAction,
}: SmartConfirmationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [daysInput, setDaysInput] = useState<number>(
    Number(proposal.fields.days || 1)
  );
  const [startDateInput, setStartDateInput] = useState<string>(
    String(proposal.fields.start_date || "Tomorrow")
  );
  const [categoryInput, setCategoryInput] = useState<string>(
    String(proposal.fields.category || "Personal").toLowerCase()
  );
  const [reasonInput, setReasonInput] = useState<string>(
    String(proposal.fields.reason || "Personal leave")
  );

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onConfirmAction) return;
    await onConfirmAction("edit", {
      days: Math.max(1, Math.min(30, Number(daysInput) || 1)),
      start_date: startDateInput.trim() || "Tomorrow",
      category: categoryInput.trim() || "personal",
      reason: reasonInput.trim() || "Personal leave",
    });
    setIsEditing(false);
  };

  return (
    <div
      className={`rounded-2xl border p-4 shadow-xs transition-all space-y-3.5 ${
        isActive
          ? "bg-cv-surface border-cv-accent-line"
          : "bg-cv-inset border-cv-line opacity-85"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-cv-line">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cv-accent-soft text-cv-accent-ink">
            <FileCheck2 className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-cv-fg block">
              {proposal.title}
            </span>
            <span className="text-[11px] text-cv-fg-2">
              Review details before CampVion dispatches this action
            </span>
          </div>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
            isActive
              ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink"
              : "bg-cv-surface border-cv-line text-cv-fg-2"
          }`}
        >
          {isActive ? "AWAITING CONFIRMATION" : "PROCESSED"}
        </span>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-cv-inset border border-cv-line">
          <span className="text-[10px] uppercase font-mono text-cv-fg-3 block">
            Student Identity
          </span>
          <span className="font-semibold text-cv-fg mt-0.5 block">
            {proposal.student_name}{" "}
            <span className="font-mono text-cv-accent-ink">
              ({proposal.student_id})
            </span>
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-cv-inset border border-cv-line">
          <span className="text-[10px] uppercase font-mono text-cv-fg-3 block">
            Attendance Standing
          </span>
          <span
            className={`font-semibold font-mono mt-0.5 block ${
              proposal.is_eligible ? "text-cv-success" : "text-cv-warning"
            }`}
          >
            {proposal.attendance_pct}% &bull;{" "}
            {proposal.is_eligible ? "Policy Eligible" : "Below 75% Threshold"}
          </span>
        </div>

        {Object.entries(proposal.fields)
          .filter(([key]) => key !== "days")
          .map(([key, value]) => (
            <div
              key={key}
              className="p-2.5 rounded-xl bg-cv-inset border border-cv-line"
            >
              <span className="text-[10px] uppercase font-mono text-cv-fg-3 block">
                {key.replace(/_/g, " ")}
              </span>
              <span className="font-medium text-cv-fg mt-0.5 block break-words">
                {String(value)}
              </span>
            </div>
          ))}
      </div>

      {/* Inline Edit Details Form */}
      {isEditing && isActive && proposal.operation_type === "LEAVE_APPLICATION" && (
        <form
          onSubmit={handleSaveEdit}
          className="p-3.5 rounded-xl bg-cv-inset border border-cv-line space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cv-fg">
              Modify Leave Parameters
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-cv-fg-2 hover:text-cv-fg p-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="text-[10px] font-mono uppercase text-cv-fg-2 block mb-1">
                Duration (Days)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={daysInput}
                onChange={(e) => setDaysInput(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-cv-fg font-mono text-xs focus:outline-none focus:border-cv-accent-line"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-cv-fg-2 block mb-1">
                Start Date
              </label>
              <input
                type="text"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-cv-fg text-xs focus:outline-none focus:border-cv-accent-line"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-cv-fg-2 block mb-1">
                Category
              </label>
              <select
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-cv-fg text-xs focus:outline-none focus:border-cv-accent-line"
              >
                <option value="medical">Medical</option>
                <option value="personal">Personal / Family</option>
                <option value="academic_event">Academic Event</option>
                <option value="family_emergency">Family Emergency</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-cv-fg-2 block mb-1">
              Reason / Remarks
            </label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-cv-fg text-xs focus:outline-none focus:border-cv-accent-line"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg cursor-pointer"
            >
              Cancel Edit
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg bg-cv-accent text-cv-on-accent text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              Save Updated Details
            </button>
          </div>
        </form>
      )}

      {/* Action Buttons */}
      {isActive && onConfirmAction && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cv-line">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void onConfirmAction("confirm")}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Confirm and Submit</span>
            </button>

            {proposal.operation_type === "LEAVE_APPLICATION" && !isEditing && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cv-inset hover:bg-cv-raised text-cv-fg border border-cv-line text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <Edit3 className="h-3.5 w-3.5 text-cv-accent-ink" />
                <span>Edit Details</span>
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => void onConfirmAction("cancel")}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cv-surface hover:bg-cv-error-soft text-cv-fg-2 hover:text-cv-error border border-cv-line hover:border-cv-error-line text-xs font-medium transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ConversationFeed({
  conversation,
  state,
  result,
  tasks,
  activeRequestId,
  isLoading,
  hasPreviousRequests = false,
  onApprove,
  onReject,
  onSelectPreset,
  onSendMessage,
  onConfirmAction,
  onInspectToolInTrace,
  onPrefillComposer,
}: ConversationFeedProps) {
  const {
    experienceMode,
    resolvedTheme,
    reducedMotion: contextReducedMotion,
  } = useTheme();
  const osReducedMotion = Boolean(useReducedMotion());
  const disableMotion = contextReducedMotion || osReducedMotion;
  const { user, preferredDisplayName } = useAuth();
  const { liveLeaveById, liveLeaveByWorkflowId, upsertLiveLeave } = useEvents();
  const {
    firstMessageSent,
    isScattering,
    welcomeCycle,
    completeScatter,
  } = useAssistantUi();

  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const messages: ConversationMessageItem[] = conversation?.messages || [];
  const hasMessages = messages.length > 0;
  const hasWorkflow = Boolean(state || result || tasks.length > 0 || activeRequestId);
  const roleStr = (user?.role || "").toLowerCase();
  const isAdmin =
    roleStr === "administrator" ||
    roleStr === "system_administrator" ||
    roleStr === "faculty";

  const firstName = getFirstNameTitleCase(
    preferredDisplayName?.trim() || user?.full_name,
    isAdmin ? "Admin" : "Student"
  );
  const leadLine =
    hasPreviousRequests || Boolean(user?.last_login_at)
      ? "Welcome back,"
      : "Welcome,";

  const suggestions = useMemo(() => {
    if (isAdmin) {
      return [
        {
          label: "Pending approvals",
          prompt: "Show me pending approvals and requests awaiting review.",
        },
        {
          label: "Today's requests",
          prompt: "Summarize today's student requests and their status.",
        },
        {
          label: "Policy summary",
          prompt: "Summarize the university leave and 75% attendance policy.",
        },
      ];
    }
    return [
      {
        label: "Apply for leave",
        prompt: "I want to apply for leave",
      },
      {
        label: "Book a discussion room",
        prompt: "Book a discussion room",
      },
      {
        label: "Check my attendance",
        prompt: "Check my overall attendance",
      },
    ];
  }, [isAdmin]);

  const rawStatus = state?.current_status || result?.status || "IDLE";
  const welcomeLogoState: Logo3DState = isLoading
    ? "thinking"
    : rawStatus === "WAITING_FOR_HUMAN"
    ? "waiting_for_approval"
    : rawStatus === "COMPLETED"
    ? "completed"
    : rawStatus === "FAILED"
    ? "failed"
    : "idle";

  const showWelcome =
    isScattering || (!hasMessages && !hasWorkflow && !firstMessageSent);

  // Auto-scroll to bottom when messages appear outside the welcome state
  useEffect(() => {
    if (!showWelcome && (hasMessages || hasWorkflow || isLoading)) {
      feedEndRef.current?.scrollIntoView({
        behavior: disableMotion ? "auto" : "smooth",
        block: "end",
      });
    }
  }, [showWelcome, messages.length, hasWorkflow, isLoading, hasMessages, disableMotion]);

  if (showWelcome) {
    return (
      <WelcomeScene
        key={welcomeCycle}
        leadLine={leadLine}
        firstName={firstName}
        subtitle="How can I help with your campus today?"
        suggestions={suggestions}
        assistantState={welcomeLogoState}
        isDark={resolvedTheme === "dark"}
        isScattering={isScattering}
        onScatterComplete={completeScatter}
        forceReducedMotion={disableMotion}
        onSelectSuggestion={(prompt) => {
          if (onSendMessage) {
            void onSendMessage(prompt);
          } else {
            onSelectPreset({
              label: prompt,
              studentId: user?.student_id || "S001",
              goal: prompt,
              description: prompt,
              type: "nominal",
              badge: "REQUEST",
            });
          }
        }}
      />
    );
  }

  // Active workflow execution details synced live with SSE LeaveRequest state
  const resolvedWfId = activeRequestId ?? state?.request_id ?? result?.request_id ?? null;
  const liveLeaveForWorkflow = resolvedWfId ? liveLeaveByWorkflowId[resolvedWfId] : undefined;

  const planTasks = state?.plan && state.plan.length > 0 ? state.plan : tasks;
  const completedSet = new Set(
    state?.completed_tasks || result?.completed_tasks || []
  );
  const failedSet = new Set(state?.failed_tasks || result?.failed_tasks || []);
  const pendingSet = new Set(state?.pending_tasks || []);

  if (liveLeaveForWorkflow?.status === "APPROVED") {
    for (const t of planTasks) {
      completedSet.add(t.task_id);
      pendingSet.delete(t.task_id);
    }
  } else if (liveLeaveForWorkflow?.status === "REJECTED") {
    for (const t of planTasks) {
      if (t.requires_human_approval) {
        failedSet.add(t.task_id);
        pendingSet.delete(t.task_id);
      }
    }
  }

  const toolResults = state?.tool_results || {};
  const selectedTools = state?.selected_tools || {};
  const observations = state?.observations || [];
  const rawWorkflowStatus = state?.current_status || result?.status || "IDLE";
  const workflowStatus =
    liveLeaveForWorkflow?.status === "APPROVED"
      ? "COMPLETED"
      : liveLeaveForWorkflow?.status === "REJECTED"
      ? "ENDED_REJECTED"
      : liveLeaveForWorkflow?.status === "CANCELLED"
      ? "CANCELLED"
      : liveLeaveForWorkflow?.status === "PENDING_APPROVAL"
      ? "WAITING_FOR_HUMAN"
      : rawWorkflowStatus;

  const replanCount = state?.replanning_count ?? result?.replanning_count ?? 0;
  const friendlyStatus = getFriendlyWorkflowStatus(
    workflowStatus,
    experienceMode
  );

  const rawFinalMessage =
    result?.final_message ||
    state?.final_result ||
    state?.error ||
    null;

  const finalMessage =
    workflowStatus === "WAITING_FOR_HUMAN"
      ? null
      : liveLeaveForWorkflow?.status === "APPROVED"
      ? `${liveLeaveForWorkflow.leave_code} approved by ${liveLeaveForWorkflow.decided_by_name || liveLeaveForWorkflow.assigned_approver}.`
      : liveLeaveForWorkflow?.status === "REJECTED"
      ? `${liveLeaveForWorkflow.leave_code} declined: ${liveLeaveForWorkflow.rejection_reason || "See details below."}`
      : rawFinalMessage;

  const formattedOutcome = formatStudentFriendlyError(
    finalMessage,
    experienceMode
  );
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
    <motion.div
      initial={disableMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: disableMotion ? 0 : 0.25, ease: "easeOut" }}
      className="px-3 sm:px-6 py-4 sm:py-6 pb-12 space-y-5 max-w-4xl mx-auto w-full"
    >
      {/* 1. Multi-Turn Conversation Message History */}
      {messages.map((msg, index) => {
        const isUser = msg.role === "user";
        const isLastMessage = index === messages.length - 1;
        const meta = msg.metadata || {};
        const toolData = meta.tool_data;
        const policyCitations = meta.policy_citations || [];
        const proposal = meta.confirmation_proposal;
        const quickReplies = meta.quick_replies || [];
        const isPendingProposal =
          Boolean(proposal) &&
          conversation?.status === "awaiting_confirmation" &&
          conversation?.pending_confirmation?.proposal_id ===
            proposal?.proposal_id;

        if (isUser) {
          return (
            <div key={msg.id || index} className="flex items-start justify-end space-x-3">
              <div className="max-w-xl rounded-2xl rounded-tr-sm bg-cv-raised border border-cv-line p-3.5 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-cv-line">
                  <div className="flex items-center space-x-1.5">
                    <User className="h-3.5 w-3.5 text-cv-accent-ink" />
                    <span className="text-xs font-semibold text-cv-fg">You</span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-cv-fg font-sans leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            </div>
          );
        }

        return (
          <div key={msg.id || index} className="flex items-start space-x-3">
            {/* Official CampVion Emblem */}
            <div className="h-8 w-8 rounded-xl campvion-emblem-surface p-1 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Image
                src="/brand/campvion-symbol.png"
                alt="CampVion Emblem"
                width={22}
                height={22}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex-1 max-w-3xl space-y-3 min-w-0">
              {/* Main Assistant Bubble */}
              <div className="rounded-2xl rounded-tl-sm bg-cv-surface border border-cv-line p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-cv-line">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-cv-fg">
                      Camp<span className="text-cv-accent-ink">Vion</span>
                    </span>
                    {msg.intent_category && experienceMode === "advanced" && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-inset border border-cv-line text-cv-fg-2">
                        {msg.intent_category}
                      </span>
                    )}
                  </div>
                  {meta.llm_telemetry?.provider && experienceMode === "advanced" && (
                    <span className="text-[10px] font-mono text-cv-fg-3">
                      {meta.llm_telemetry.provider}
                      {meta.llm_telemetry.latency_ms
                        ? ` • ${Math.round(meta.llm_telemetry.latency_ms)}ms`
                        : ""}
                    </span>
                  )}
                </div>

                {/* Formatted Conversational Reply */}
                {renderMessageContent(msg.content)}

                {/* Policy Citations Row */}
                {policyCitations.length > 0 && (
                  <div className="pt-2 border-t border-cv-line space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cv-fg-3 block">
                      Verified Campus Policy Citations
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {policyCitations.map((pol) => (
                        <div
                          key={pol.policy_id}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cv-inset border border-cv-line text-[11px]"
                          title={pol.description}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-cv-accent-ink shrink-0" />
                          <span className="font-mono font-bold text-cv-accent-ink">
                            {pol.policy_id}
                          </span>
                          <span className="text-cv-fg-2 truncate max-w-[200px]">
                            {pol.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contextual Tool Data Cards (Attendance / Courses / Exams) */}
                {toolData && toolData.courses && toolData.courses.length > 0 && (
                  <div className="pt-2 border-t border-cv-line space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cv-fg-2 flex items-center space-x-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-cv-accent-ink" />
                        <span>Live Academic Attendance Record</span>
                      </span>
                      {toolData.overall_percentage !== undefined && (
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                            toolData.is_eligible
                              ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                              : "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
                          }`}
                        >
                          Overall: {toolData.overall_percentage}% (
                          {toolData.total_attended}/{toolData.total_classes})
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {toolData.courses.map((course) => {
                        const pct = course.percentage ?? 0;
                        const courseOk = pct >= 75;
                        return (
                          <div
                            key={course.course_code}
                            className="p-2.5 rounded-xl bg-cv-inset border border-cv-line space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-cv-fg truncate">
                                {course.course_name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2 shrink-0">
                                {course.course_code}
                              </span>
                            </div>
                            {course.total !== undefined && (
                              <>
                                <div className="w-full h-1.5 rounded-full bg-cv-surface overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      courseOk
                                        ? "bg-cv-success-solid"
                                        : "bg-cv-warning-solid"
                                    }`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                  <span
                                    className={
                                      courseOk
                                        ? "text-cv-success font-semibold"
                                        : "text-cv-warning font-semibold"
                                    }
                                  >
                                    {pct}% ({courseOk ? "Eligible" : "Below 75%"})
                                  </span>
                                  <span className="text-cv-fg-3">
                                    {course.attended}/{course.total} classes
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {toolData && toolData.exams && toolData.exams.length > 0 && (
                  <div className="pt-2 border-t border-cv-line space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cv-fg-2 flex items-center space-x-1.5">
                      <Calendar className="h-3.5 w-3.5 text-cv-accent-ink" />
                      <span>Examination Schedule</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {toolData.exams.map((ex, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-cv-inset border border-cv-line text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-cv-fg">
                              {ex.course_code} &bull; {ex.exam_type}
                            </span>
                            <span className="text-[10px] font-mono text-cv-accent-ink">
                              {ex.exam_date}
                            </span>
                          </div>
                          <div className="text-[11px] text-cv-fg-2">
                            {ex.course_name} ({ex.start_time}, Room {ex.room})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Smart Confirmation Card */}
              {proposal && (
                <SmartConfirmationCard
                  proposal={proposal}
                  isActive={isPendingProposal}
                  isLoading={isLoading}
                  onConfirmAction={onConfirmAction}
                />
              )}

              {/* Guided Interactive Service Card (Leave Dates & Times / Discussion Room) */}
              {isLastMessage && meta.guided_card?.type === "leave_details" && !isAdmin && (
                <LeaveDetailsCard
                  prefill={(meta.guided_card.prefill || {}) as LeaveGuidedPrefill}
                  onSubmitted={(leave) => upsertLiveLeave(leave)}
                />
              )}
              {isLastMessage && meta.guided_card?.type === "room_booking" && !isAdmin && (
                <RoomBookingCard
                  prefill={(meta.guided_card.prefill || {}) as RoomBookingPrefill}
                  onSubmitted={(req) => upsertLiveLeave(req)}
                />
              )}

              {/* Live In-Place Leave Request Status Card */}
              {meta.leave_request && (
                <RequestStatusCard
                  initialRequest={liveLeaveById[meta.leave_request.id] || meta.leave_request}
                  allowCancel={!isAdmin}
                  onPrefillNewRequest={onPrefillComposer}
                  onUpdated={upsertLiveLeave}
                />
              )}

              {/* Quick Reply Suggestion Chips (on latest message) */}
              {isLastMessage && quickReplies.length > 0 && !isLoading && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {quickReplies.map((chip, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => {
                        if (
                          isPendingProposal &&
                          onConfirmAction &&
                          chip.toLowerCase() === "confirm and submit"
                        ) {
                          void onConfirmAction("confirm");
                        } else if (
                          isPendingProposal &&
                          onConfirmAction &&
                          chip.toLowerCase() === "cancel"
                        ) {
                          void onConfirmAction("cancel");
                        } else if (onSendMessage) {
                          void onSendMessage(chip);
                        }
                      }}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-cv-surface hover:bg-cv-accent-soft text-cv-fg hover:text-cv-accent-ink border border-cv-line hover:border-cv-accent-line text-xs font-medium transition cursor-pointer shadow-2xs"
                    >
                      <Send className="h-3 w-3 text-cv-accent-ink" />
                      <span>{chip}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 2. Legacy / Direct Workflow Fallback User Bubble (when workflow launched directly without conversation messages) */}
      {!hasMessages && hasWorkflow && (
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
              {state?.original_goal ||
                result?.original_goal ||
                "Processing campus service request..."}
            </p>
          </div>
        </div>
      )}

      {/* 3. Active Governed Agent Workflow Execution Card */}
      {hasWorkflow && (
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
          <div className="flex-1 max-w-3xl space-y-4 min-w-0">
            {/* Normalization & Plan Header Card */}
            <div className="rounded-2xl rounded-tl-sm bg-cv-surface border border-cv-line p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cv-fg">
                    CampVion{" "}
                    <span className="text-cv-accent-ink">
                      {experienceMode === "simple"
                        ? "Workflow Execution"
                        : "DAG Orchestrator"}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border ${friendlyStatus.badgeClass}`}
                  >
                    {friendlyStatus.label}
                  </span>
                </div>
                <span className="text-[10px] text-cv-fg-2">
                  {experienceMode === "simple"
                    ? replanCount > 0
                      ? `Auto-Recovery: ${replanCount} replans`
                      : `Request #${activeRequestId || state?.request_id || ""}`
                    : `Replans: ${replanCount}/3 max`}
                </span>
              </div>

              {normalizedGoal && Object.keys(normalizedParams).length > 0 && (
                <div className="p-3 rounded-xl bg-cv-inset border border-cv-line text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-semibold text-cv-fg-2">
                      {experienceMode === "simple"
                        ? "Dispatched Workflow Parameters"
                        : `Goal Type: ${
                            normalizedGoal.goal_type || "campus_request"
                          }`}
                    </span>
                    <span className="text-[10px] font-medium text-cv-accent-ink">
                      {experienceMode === "simple"
                        ? "Student Confirmed"
                        : "Governed Execution"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono text-cv-fg">
                    {Object.entries(normalizedParams).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-1.5 rounded bg-cv-surface border border-cv-line truncate"
                      >
                        <span className="text-cv-fg-2">{k}: </span>
                        <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Live Leave Card inside workflow block when not already shown by a conversation message */}
            {liveLeaveForWorkflow &&
              !messages.some((m) => m.metadata?.leave_request?.id === liveLeaveForWorkflow.id) && (
                <RequestStatusCard
                  initialRequest={liveLeaveForWorkflow}
                  allowCancel={!isAdmin}
                  onPrefillNewRequest={onPrefillComposer}
                  onUpdated={upsertLiveLeave}
                />
              )}

            {/* Institutional Human Approval Gate (Admins only inside chat if workflow active) */}
            {workflowStatus === "WAITING_FOR_HUMAN" && isAdmin && (
              <div className="animate-in fade-in duration-200">
                <HumanApprovalCenter
                  state={state}
                  onApprove={onApprove}
                  onReject={onReject}
                  isLoading={isLoading}
                />
              </div>
            )}

            {/* Interactive Task Execution Card */}
            {planTasks.length > 0 && (
              <div className="rounded-2xl bg-cv-surface border border-cv-line p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-cv-line">
                  <div className="flex items-center space-x-2">
                    <GitBranch className="h-4 w-4 text-cv-accent-ink" />
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
                      {experienceMode === "simple"
                        ? "Request Steps"
                        : "Topological Execution Pipeline"}
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
                      selectedTools[task.task_id] ||
                      task.candidate_tools[0] ||
                      "unassigned";
                    const isExpanded = expandedTask === task.task_id;
                    const toolOutput = toolResults[task.task_id];
                    const obs = observations.find(
                      (o) => o.task_id === task.task_id
                    );
                    const friendlyTitle = getFriendlyTaskTitle(
                      task.task_id,
                      task.description
                    );
                    const friendlyTool = getFriendlyToolName(assignedTool);

                    return (
                      <div
                        key={task.task_id}
                        className="rounded-xl bg-cv-inset border border-cv-line overflow-hidden transition-all"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTask(isExpanded ? null : task.task_id)
                          }
                          className="w-full text-left p-3 flex items-center justify-between gap-3 hover:bg-cv-raised transition cursor-pointer"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
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
                              {experienceMode === "simple"
                                ? friendlyTitle
                                : task.description}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2 truncate max-w-[140px]">
                              {experienceMode === "simple"
                                ? friendlyTool
                                : assignedTool}
                            </span>
                            {task.requires_human_approval && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
                                INSTITUTIONAL GATE
                              </span>
                            )}
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-cv-fg-2 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-3.5 border-t border-cv-line bg-cv-surface text-xs font-mono space-y-2.5">
                            {task.dependencies.length > 0 && (
                              <div>
                                <span className="text-[10px] text-cv-fg-2 uppercase block mb-1">
                                  {experienceMode === "simple"
                                    ? "Prerequisites:"
                                    : "Prerequisite Tasks:"}
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
                                  {experienceMode === "simple"
                                    ? "Execution Note:"
                                    : "Agent Observation:"}
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
                                    {experienceMode === "simple"
                                      ? "Service Result:"
                                      : "Tool Output Payload:"}
                                  </span>
                                  {onInspectToolInTrace && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onInspectToolInTrace(assignedTool)
                                      }
                                      className="text-[10px] text-cv-accent-ink hover:underline"
                                    >
                                      {experienceMode === "simple"
                                        ? "View in Activity History \u2192"
                                        : "Inspect in Trace \u2192"}
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
            )}

            {/* Final Outcome / Resolution Card (ONLY shown once workflow truly finishes/declines/fails, never while WAITING_FOR_HUMAN) */}
            {finalMessage && workflowStatus !== "WAITING_FOR_HUMAN" && (
              <div
                className={`rounded-2xl p-4 border text-xs sm:text-sm font-sans leading-relaxed shadow-xs ${
                  workflowStatus === "COMPLETED"
                    ? "bg-cv-success-soft border-cv-success-line text-cv-fg"
                    : workflowStatus === "FAILED" || workflowStatus === "ENDED_REJECTED"
                    ? "bg-cv-error-soft border-cv-error-line text-cv-fg"
                    : "bg-cv-surface border-cv-line text-cv-fg"
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-current/15 text-[11px]">
                  <div className="flex items-center space-x-1.5 font-semibold">
                    {workflowStatus === "COMPLETED" ? (
                      <CheckCircle2 className="h-4 w-4 text-cv-success" />
                    ) : workflowStatus === "FAILED" || workflowStatus === "ENDED_REJECTED" ? (
                      <XCircle className="h-4 w-4 text-cv-error" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-cv-accent-ink" />
                    )}
                    <span>
                      {workflowStatus === "COMPLETED"
                        ? "Request Approved & Recorded"
                        : workflowStatus === "ENDED_REJECTED"
                        ? "Request Declined at Approval Gate"
                        : workflowStatus === "CANCELLED"
                        ? "Request Withdrawn"
                        : workflowStatus === "FAILED"
                        ? "Unable to Complete Request"
                        : "Execution Update"}
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
                <p className="mt-1 leading-relaxed">
                  {formattedOutcome.message}
                </p>

                {formattedOutcome.technical &&
                  experienceMode === "simple" &&
                  formattedOutcome.technical !== formattedOutcome.message && (
                    <details className="mt-3 pt-2 border-t border-current/15 text-[11px] text-cv-fg-2">
                      <summary className="cursor-pointer hover:underline text-cv-fg-2">
                        Show technical details (for administrators &amp;
                        developers)
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
      )}

      {/* 4. Typing / Thinking Indicator */}
      {isLoading && (
        <div className="flex items-center space-x-3 animate-in fade-in duration-150">
          <div className="h-8 w-8 rounded-xl campvion-emblem-surface p-1 flex items-center justify-center shrink-0 shadow-2xs">
            <Image
              src="/brand/campvion-symbol.png"
              alt="CampVion Emblem"
              width={22}
              height={22}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="inline-flex items-center space-x-2.5 px-4 py-2.5 rounded-2xl rounded-tl-sm bg-cv-surface border border-cv-line shadow-2xs text-xs text-cv-fg-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cv-accent-ink" />
            <span>CampVion is thinking...</span>
          </div>
        </div>
      )}

      <div ref={feedEndRef} />
    </motion.div>
  );
}
