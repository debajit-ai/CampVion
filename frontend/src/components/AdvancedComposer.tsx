"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserCheck,
  UserX,
  Wrench,
  X,
} from "lucide-react";
import { AttendanceRecord, CourseRecord, Student } from "../types/api";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

interface AdvancedComposerProps {
  students: Student[];
  selectedStudentId: string;
  onSelectStudentId: (studentId: string) => void;
  goalText: string;
  onGoalTextChange: (text: string) => void;
  onSubmit: (messageText?: string) => Promise<boolean | void>;
  isLoading: boolean;
  error: string | null;
  onClearError?: () => void;
  attendanceByStudent?: Record<string, AttendanceRecord[]>;
  coursesByStudent?: Record<string, CourseRecord[]>;
  onOpenTools: () => void;
  onNewConversation?: () => void;
  activeConversationTitle?: string | null;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function AdvancedComposer({
  students,
  selectedStudentId,
  onSelectStudentId,
  goalText,
  onGoalTextChange,
  onSubmit,
  isLoading,
  error,
  onClearError,
  attendanceByStudent = {},
  coursesByStudent = {},
  onOpenTools,
  onNewConversation,
  textareaRef: externalRef,
}: AdvancedComposerProps) {
  const { experienceMode } = useTheme();
  const { user } = useAuth();
  const [studentPickerOpen, setStudentPickerOpen] = useState<boolean>(false);
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalRef || internalRef;
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const inFlightLockRef = useRef<boolean>(false);

  // Close student picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setStudentPickerOpen(false);
      }
    }
    if (studentPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [studentPickerOpen]);

  // Auto-resize multiline textarea naturally without disrupting layout
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      const newHeight = Math.min(Math.max(el.scrollHeight, 44), 160);
      el.style.height = `${newHeight}px`;
    }
  }, [goalText, textareaRef]);

  // Single shared submission function for Enter key, Ctrl+Enter, and Send button
  const triggerSubmit = useCallback(async () => {
    const trimmed = goalText.trim();
    if (!trimmed || !selectedStudentId.trim() || isLoading || inFlightLockRef.current) {
      return;
    }

    inFlightLockRef.current = true;
    try {
      await onSubmit(trimmed);
    } finally {
      inFlightLockRef.current = false;
    }
  }, [goalText, selectedStudentId, isLoading, onSubmit]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;

    // Shift + Enter inserts a newline naturally
    if (e.key === "Enter" && e.shiftKey) {
      return;
    }

    // Enter (or Ctrl/Meta + Enter) submits the message
    if (e.key === "Enter") {
      e.preventDefault();
      await triggerSubmit();
    }
  };

  const currentStudent = students.find((s) => s.student_id === selectedStudentId);
  const currentRecords = attendanceByStudent[selectedStudentId] || [];
  const currentCourses = coursesByStudent[selectedStudentId] || [];
  const currentTotalAttended = currentRecords.reduce(
    (acc, r) => acc + r.attended_classes,
    0
  );
  const currentTotalClasses = currentRecords.reduce(
    (acc, r) => acc + r.total_classes,
    0
  );
  const currentPct =
    currentTotalClasses > 0
      ? Math.round((currentTotalAttended / currentTotalClasses) * 100)
      : selectedStudentId === "S001"
      ? 75
      : 50;
  const isCurrentEligible = currentPct >= 75;
  const isSimulationDirective = goalText.toUpperCase().includes("FAILURE_MODE=");

  return (
    <div className="relative w-full max-w-4xl mx-auto px-2 sm:px-4 pb-2 select-none">
      {/* Fault Injection Alert Badge */}
      {isSimulationDirective && (
        <div className="mb-2 flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-cv-warning-soft border border-cv-warning-line text-cv-warning text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <Terminal className="h-3.5 w-3.5 text-cv-warning" />
            <span className="font-semibold">TEST DIRECTIVE ACTIVE:</span>
            <span>Simulating deliberate runtime fault injection</span>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cv-surface border border-cv-warning-line">
            Simulation
          </span>
        </div>
      )}

      {/* Error Notification with Retry Option */}
      {error && (
        <div
          role="alert"
          className="mb-2 flex items-start space-x-2.5 p-3.5 rounded-xl bg-cv-error-soft border border-cv-error-line text-cv-error text-xs"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-xs block">
              Message Delivery / Execution Notice
            </span>
            <span className="block mt-0.5 text-xs text-cv-fg">{error}</span>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            {goalText.trim() && !isLoading && (
              <button
                type="button"
                onClick={() => void triggerSubmit()}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cv-surface hover:bg-cv-raised text-cv-fg border border-cv-line text-[11px] font-semibold transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            )}
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                aria-label="Dismiss error"
                className="text-cv-fg-2 hover:text-cv-fg p-1 rounded transition cursor-pointer"
                title="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Composer Container Card */}
      <div className="cv-composer-shell relative rounded-2xl bg-cv-surface border border-cv-line focus-within:border-cv-accent-line transition-all duration-200">
        {/* Top Control Bar: Professional Student Identity Selector & Quick Utilities */}
        <div className="flex items-center justify-between px-3.5 pt-2.5 pb-2 border-b border-cv-line bg-cv-inset rounded-t-2xl gap-2">
          {/* Student Identity Selector with Detailed Profile Popover */}
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setStudentPickerOpen((prev) => !prev)}
              aria-expanded={studentPickerOpen}
              aria-label="Student Identity and Academic Profile Selector"
              className="flex items-center space-x-2 px-2.5 py-1.5 rounded-xl bg-cv-surface hover:bg-cv-raised border border-cv-line hover:border-cv-accent-line/50 transition cursor-pointer text-left group shadow-2xs"
            >
              <div
                className={`p-1 rounded-lg shrink-0 border ${
                  isCurrentEligible
                    ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                    : "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
                }`}
              >
                {isCurrentEligible ? (
                  <UserCheck className="h-3.5 w-3.5" />
                ) : (
                  <UserX className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-cv-fg">
                  {currentStudent?.name || selectedStudentId}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cv-raised border border-cv-line text-cv-fg-2">
                  {selectedStudentId}
                </span>
                <span
                  className={`text-[11px] font-semibold hidden sm:inline ${
                    isCurrentEligible ? "text-cv-success" : "text-cv-warning"
                  }`}
                >
                  &bull; {currentPct}% {isCurrentEligible ? "Eligible" : "Below 75%"}
                </span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-cv-fg-2 group-hover:text-cv-fg transition-transform ${
                  studentPickerOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Student Identity & Academic Profile Popover Panel */}
            {studentPickerOpen && (
              <div className="absolute left-0 bottom-full mb-2 w-80 sm:w-[420px] rounded-2xl bg-cv-surface border border-cv-line-strong shadow-xl p-4 z-50 space-y-3">
                {/* Active Selected Student Detailed Summary Card */}
                <div className="p-3 rounded-xl bg-cv-inset border border-cv-line space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cv-accent-ink">
                      Active Student Identity
                    </span>
                    <span className="inline-flex items-center space-x-1 text-[10px] text-cv-fg-2">
                      <ShieldCheck className="h-3 w-3 text-cv-accent-ink" />
                      <span>
                        {user?.student_id === selectedStudentId
                          ? "Authenticated Profile"
                          : "Authorized Demo Profile"}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-cv-fg">
                        {currentStudent?.name || selectedStudentId}
                      </div>
                      <div className="text-[11px] text-cv-fg-2 flex items-center space-x-1 mt-0.5">
                        <GraduationCap className="h-3.5 w-3.5 text-cv-accent-ink" />
                        <span>
                          {currentStudent?.program || "B.Tech CSE"} &bull; Semester{" "}
                          {currentStudent?.semester || 5}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-extrabold font-mono ${
                          isCurrentEligible ? "text-cv-success" : "text-cv-warning"
                        }`}
                      >
                        {currentPct}%
                      </div>
                      <div className="text-[10px] text-cv-fg-3">
                        {currentTotalAttended}/{currentTotalClasses || 40} classes
                      </div>
                    </div>
                  </div>

                  {currentCourses.length > 0 && (
                    <div className="pt-1.5 border-t border-cv-line flex items-center space-x-1.5 text-[10px] font-mono text-cv-fg-2 truncate">
                      <BookOpen className="h-3 w-3 text-cv-accent-ink shrink-0" />
                      <span className="truncate">
                        Courses: {currentCourses.map((c) => c.course_code).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Switch Demonstration Profile List */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-cv-line">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-cv-fg-2">
                      Switch Authorized Demo Profile
                    </span>
                    <span className="text-[10px] font-mono text-cv-fg-3">
                      Policy Gate: &ge;75%
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {students.slice(0, 6).map((student) => {
                      const isSelected = selectedStudentId === student.student_id;
                      const records = attendanceByStudent[student.student_id] || [];
                      const attended = records.reduce(
                        (acc, r) => acc + r.attended_classes,
                        0
                      );
                      const total = records.reduce(
                        (acc, r) => acc + r.total_classes,
                        0
                      );
                      const pct =
                        total > 0
                          ? Math.round((attended / total) * 100)
                          : student.student_id === "S001"
                          ? 75
                          : 50;
                      const eligible = pct >= 75;

                      return (
                        <button
                          key={student.student_id}
                          type="button"
                          onClick={() => {
                            onSelectStudentId(student.student_id);
                            setStudentPickerOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-cv-accent-soft border-cv-accent-line"
                              : "bg-cv-surface hover:bg-cv-raised border-cv-line"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div
                              className={`p-1.5 rounded-lg border shrink-0 ${
                                eligible
                                  ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                                  : "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
                              }`}
                            >
                              {eligible ? (
                                <UserCheck className="h-3.5 w-3.5" />
                              ) : (
                                <UserX className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-xs font-bold text-cv-fg truncate">
                                  {student.name}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cv-raised text-cv-fg-2">
                                  {student.student_id}
                                </span>
                              </div>
                              <div className="text-[11px] text-cv-fg-2 truncate">
                                {student.program} &bull; Sem {student.semester}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-bold font-mono block ${
                                eligible ? "text-cv-success" : "text-cv-warning"
                              }`}
                            >
                              {pct}%
                            </span>
                            <span className="text-[10px] text-cv-fg-3">
                              {eligible ? "Eligible" : "Ineligible"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Bar Actions: New Chat & Request Options */}
          <div className="flex items-center space-x-2">
            {onNewConversation && (
              <button
                type="button"
                onClick={onNewConversation}
                disabled={isLoading}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-cv-surface hover:bg-cv-raised text-cv-fg-2 hover:text-cv-fg border border-cv-line transition cursor-pointer disabled:opacity-50"
                title="Start a fresh conversation"
              >
                <Sparkles className="h-3.5 w-3.5 text-cv-accent-ink" />
                <span className="hidden sm:inline text-[11px]">New Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenTools}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium bg-cv-surface hover:bg-cv-accent-soft text-cv-fg hover:text-cv-accent-ink border border-cv-line hover:border-cv-accent-line/40 transition cursor-pointer shadow-2xs group"
              title="Open Request Options, Presets & Campus Services"
            >
              <Wrench className="h-3.5 w-3.5 text-cv-accent-ink group-hover:rotate-45 transition-transform" />
              <span className="font-medium text-[11px] sm:text-xs">
                {experienceMode === "simple" ? "Campus Services" : "Tools & Presets"}
              </span>
            </button>
          </div>
        </div>

        {/* Multiline Conversational Input */}
        <div className="px-4 py-3 flex items-end space-x-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={goalText}
            disabled={isLoading}
            onChange={(e) => onGoalTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CampVion anything or tell it what you need..."
            aria-label="Message CampVion Assistant"
            className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-cv-fg placeholder-cv-fg-3 focus:outline-none resize-none leading-relaxed font-sans disabled:opacity-60"
          />

          <button
            type="button"
            onClick={() => void triggerSubmit()}
            disabled={isLoading || !goalText.trim() || !selectedStudentId.trim()}
            aria-label="Send message"
            className="flex items-center justify-center space-x-1.5 h-9 px-4 rounded-xl text-xs font-bold bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Sending...</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Bottom Helper Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-cv-line bg-cv-inset rounded-b-2xl text-[11px] text-cv-fg-3">
          <div className="flex items-center space-x-1.5 truncate">
            <CheckCircle2 className="h-3 w-3 text-cv-accent-ink shrink-0" />
            <span className="truncate">
              {experienceMode === "simple"
                ? "CampVion remembers conversation context and asks before submitting actions."
                : "Groq Conversational Engine • Multi-Turn Slot Tracking • Governed DAG"}
            </span>
          </div>

          <span className="hidden sm:inline shrink-0 font-mono text-[10px]">
            <kbd className="px-1.5 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2">
              Enter
            </kbd>{" "}
            to send &bull;{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2">
              Shift+Enter
            </kbd>{" "}
            new line
          </span>
        </div>
      </div>
    </div>
  );
}
