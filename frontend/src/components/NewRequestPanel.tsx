"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Loader2,
  Sparkles,
  Terminal,
  UserCheck,
  UserX,
} from "lucide-react";
import { AttendanceRecord, CourseRecord, Student } from "../types/api";

interface NewRequestPanelProps {
  students: Student[];
  onSubmit: (studentId: string, goal: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  attendanceByStudent?: Record<string, AttendanceRecord[]>;
  coursesByStudent?: Record<string, CourseRecord[]>;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export const PRESET_GOALS = [
  {
    label: "Standard Leave (Alice - Eligible)",
    studentId: "S001",
    goal: "I want to apply for leave tomorrow because I have a family function.",
    description: "Nominal multi-step workflow. Alice has 75% attendance.",
    type: "nominal",
    badge: "NOMINAL",
  },
  {
    label: "Medical Emergency (3 Days)",
    studentId: "S001",
    goal: "Apply for leave for 3 days due to medical emergency",
    description: "Extracts 3 days duration and medical reasons parameter.",
    type: "nominal",
    badge: "3-DAY MEDICAL",
  },
  {
    label: "Low Attendance Check (Bob - Ineligible)",
    studentId: "S002",
    goal: "I need leave for 2 days due to personal reasons",
    description: "Bob has only 50% attendance. Fails eligibility (<75%).",
    type: "ineligible",
    badge: "POLICY GATE",
  },
  {
    label: "Simulated Network Timeout (Self-Healing)",
    studentId: "S001",
    goal: "FAILURE_MODE=attendance_timeout",
    description: "Simulates transient timeout. Self-heals on replan #1.",
    type: "recoverable",
    badge: "SELF-HEAL",
  },
  {
    label: "Persistent Timeout (Bounded Retries)",
    studentId: "S001",
    goal: "FAILURE_MODE=attendance_timeout_persistent",
    description: "Enforces MAX_REPLANS (3) limit before graceful termination.",
    type: "bounded",
    badge: "MAX 3 REPLANS",
  },
  {
    label: "Simulated Database Crash",
    studentId: "S001",
    goal: "FAILURE_MODE=unrecoverable",
    description: "Simulates unrecoverable tool crash. Halts immediately.",
    type: "unrecoverable",
    badge: "CRITICAL HALT",
  },
];

export function NewRequestPanel({
  students,
  onSubmit,
  isLoading,
  error,
  attendanceByStudent = {},
  coursesByStudent = {},
  textareaRef,
}: NewRequestPanelProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>("S001");
  const [goalText, setGoalText] = useState<string>(
    "I want to apply for leave tomorrow because I have a family function."
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStudentId.trim() || !goalText.trim() || isLoading) return;
    await onSubmit(selectedStudentId.trim(), goalText.trim());
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      await handleSubmit();
    }
  };

  const handleApplyPreset = (preset: (typeof PRESET_GOALS)[0]) => {
    setSelectedStudentId(preset.studentId);
    setGoalText(preset.goal);
  };

  const isSimulationDirective = goalText.toUpperCase().includes("FAILURE_MODE=");

  return (
    <div className="bg-[#FFFFFF] border border-[#E8E2D9] rounded-xl p-5 relative shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E8E2D9]">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-[#F5E7DE] border border-[#E8E2D9] text-[#C66A43]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[#26231F] uppercase">
              Dispatch Campus <span className="text-[#C66A43]">Service Goal</span>
            </h2>
            <p className="text-xs text-[#77716A]">
              Submit student intent or fault-injection directive to the autonomous orchestrator
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-[#FAF7F2] border border-[#E8E2D9] text-[#77716A]">
          ₹0-cost deterministic
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {/* Step 1: Student Context Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-mono font-medium text-[#26231F]">
              1. SELECT DEMO STUDENT CONTEXT
            </label>
            <span className="text-[10px] font-mono text-[#A0988F]">
              Threshold: &ge;75% Attendance
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {students.length > 0 ? (
              students.map((student) => {
                const isSelected = selectedStudentId === student.student_id;
                const records = attendanceByStudent[student.student_id] || [];
                const courses = coursesByStudent[student.student_id] || [];

                const totalAttended = records.reduce((acc, r) => acc + r.attended_classes, 0);
                const totalClasses = records.reduce((acc, r) => acc + r.total_classes, 0);
                const computedPct =
                  totalClasses > 0
                    ? Math.round((totalAttended / totalClasses) * 100)
                    : student.student_id === "S001"
                    ? 75
                    : 50;
                const isEligible = computedPct >= 75;

                return (
                  <button
                    type="button"
                    key={student.student_id}
                    onClick={() => setSelectedStudentId(student.student_id)}
                    aria-pressed={isSelected}
                    className={`flex items-start space-x-3 p-3.5 rounded-lg border text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-[#F5E7DE]/50 border-[#C66A43] shadow-xs"
                        : "bg-[#FAF7F2] border-[#E8E2D9] hover:bg-[#F0ECE5] hover:border-[#C66A43]/40"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-md mt-0.5 border shrink-0 ${
                        isEligible
                          ? "bg-[#287A53]/10 border-[#287A53]/30 text-[#287A53]"
                          : "bg-[#B77932]/10 border-[#B77932]/30 text-[#B77932]"
                      }`}
                    >
                      {isEligible ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <UserX className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-[#26231F] truncate">
                          {student.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            isSelected
                              ? "bg-[#C66A43] border-[#C66A43] text-white"
                              : "bg-[#FFFFFF] border-[#E8E2D9] text-[#77716A]"
                          }`}
                        >
                          {student.student_id}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 mt-1 text-[11px] text-[#77716A]">
                        <GraduationCap className="h-3 w-3 shrink-0 text-[#C66A43]" />
                        <span className="truncate">
                          {student.program} &bull; Sem {student.semester}
                        </span>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-[#E8E2D9] flex items-center justify-between gap-1">
                        <span
                          className={`text-[10px] font-mono font-medium ${
                            isEligible ? "text-[#287A53]" : "text-[#B77932]"
                          }`}
                        >
                          {isEligible
                            ? `Attendance: ${computedPct}% (Eligible)`
                            : `Attendance: ${computedPct}% (Ineligible)`}
                        </span>
                        {totalClasses > 0 && (
                          <span className="text-[10px] font-mono text-[#77716A]">
                            {totalAttended}/{totalClasses}
                          </span>
                        )}
                      </div>

                      {courses.length > 0 && (
                        <div className="mt-1 flex items-center space-x-1 text-[10px] font-mono text-[#A0988F] truncate">
                          <BookOpen className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {courses.map((c) => c.course_code).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-2">
                <input
                  type="text"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  placeholder="Enter Student ID (e.g. S001)"
                  aria-label="Student ID"
                  className="w-full bg-[#FAF7F2] border border-[#E8E2D9] rounded-lg px-3 py-2 text-xs text-[#26231F] placeholder-[#A0988F] focus:outline-none focus:border-[#C66A43] font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Goal Text Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="axora-goal-input"
              className="block text-xs font-mono font-medium text-[#26231F]"
            >
              2. STUDENT GOAL IN NATURAL LANGUAGE OR SIMULATION DIRECTIVE
            </label>
            {isSimulationDirective && (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#B77932]/10 border border-[#B77932]/30 text-[#B77932]">
                <Terminal className="h-2.5 w-2.5" />
                <span>FAULT INJECTION ACTIVE</span>
              </span>
            )}
          </div>
          <div className="relative">
            <textarea
              id="axora-goal-input"
              ref={textareaRef}
              rows={3}
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what the student wants the campus assistant to accomplish..."
              className="w-full bg-[#FAF7F2] border border-[#E8E2D9] rounded-lg p-3.5 text-xs text-[#26231F] placeholder-[#A0988F] focus:outline-none focus:border-[#C66A43] font-mono transition resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Step 3: Testing Presets & Failure Simulations */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="block text-[11px] font-mono font-medium text-[#26231F]">
              TESTING PRESETS &amp; SIMULATIONS:
            </span>
            <span className="text-[10px] font-mono text-[#A0988F]">
              {PRESET_GOALS.length} verified scenarios
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_GOALS.map((preset, idx) => {
              const isPresetActive =
                selectedStudentId === preset.studentId && goalText === preset.goal;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleApplyPreset(preset)}
                  className={`p-2.5 rounded-lg text-left text-[11px] border transition group cursor-pointer ${
                    isPresetActive
                      ? "bg-[#F5E7DE] border-[#C66A43] text-[#26231F] shadow-xs"
                      : "bg-[#FAF7F2] hover:bg-[#F0ECE5] border-[#E8E2D9] hover:border-[#C66A43]/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center space-x-1.5 font-medium text-[#26231F] min-w-0">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          preset.type === "nominal"
                            ? "bg-[#287A53]"
                            : preset.type === "recoverable"
                            ? "bg-[#C66A43]"
                            : preset.type === "ineligible"
                            ? "bg-[#B77932]"
                            : "bg-[#C44E45]"
                        }`}
                      />
                      <span className="truncate">{preset.label}</span>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[#77716A] shrink-0">
                      {preset.studentId}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#77716A] mt-1 line-clamp-1">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div
            role="alert"
            className="flex items-start space-x-2.5 p-3 rounded-lg bg-[#C44E45]/10 border border-[#C44E45]/30 text-[#C44E45] text-xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[10px] uppercase font-semibold block">
                Execution Dispatch Error
              </span>
              <span className="block mt-0.5">{error}</span>
            </div>
          </div>
        )}

        {/* Submit Bar */}
        <div className="pt-2 border-t border-[#E8E2D9] flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-[#77716A] font-mono">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[#FAF7F2] border border-[#E8E2D9] text-[#26231F]">
              Ctrl+Enter
            </kbd>{" "}
            to launch
          </span>
          <button
            type="submit"
            disabled={isLoading || !goalText.trim() || !selectedStudentId.trim()}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#C66A43] hover:bg-[#AD5735] text-white shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Orchestrating...</span>
              </>
            ) : (
              <>
                <span>Execute Agent Workflow</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
