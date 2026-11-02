"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  GraduationCap,
  Loader2,
  Send,
  Terminal,
  UserCheck,
  UserX,
  Wrench,
} from "lucide-react";
import { AttendanceRecord, CourseRecord, Student } from "../types/api";

interface AdvancedComposerProps {
  students: Student[];
  selectedStudentId: string;
  onSelectStudentId: (studentId: string) => void;
  goalText: string;
  onGoalTextChange: (text: string) => void;
  onSubmit: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  attendanceByStudent?: Record<string, AttendanceRecord[]>;
  coursesByStudent?: Record<string, CourseRecord[]>;
  onOpenTools: () => void;
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
  attendanceByStudent = {},
  coursesByStudent = {},
  onOpenTools,
  textareaRef: externalRef,
}: AdvancedComposerProps) {
  const [studentPickerOpen, setStudentPickerOpen] = useState<boolean>(false);
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalRef || internalRef;
  const pickerRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      const newHeight = Math.min(Math.max(el.scrollHeight, 44), 160);
      el.style.height = `${newHeight}px`;
    }
  }, [goalText, textareaRef]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isLoading && goalText.trim() && selectedStudentId.trim()) {
        await onSubmit();
      }
    }
  };

  const currentStudent = students.find((s) => s.student_id === selectedStudentId);
  const currentRecords = attendanceByStudent[selectedStudentId] || [];
  const currentTotalAttended = currentRecords.reduce((acc, r) => acc + r.attended_classes, 0);
  const currentTotalClasses = currentRecords.reduce((acc, r) => acc + r.total_classes, 0);
  const currentPct =
    currentTotalClasses > 0
      ? Math.round((currentTotalAttended / currentTotalClasses) * 100)
      : selectedStudentId === "S001"
      ? 75
      : 50;
  const isCurrentEligible = currentPct >= 75;

  const isSimulationDirective = goalText.toUpperCase().includes("FAILURE_MODE=");

  return (
    <div className="relative w-full max-w-4xl mx-auto px-4 pb-4 select-none">
      {/* Fault Injection Alert Badge */}
      {isSimulationDirective && (
        <div className="mb-2 flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#FBF3E8] border border-[#F0D9BC] text-[#B77932] text-xs font-mono animate-in fade-in duration-150">
          <div className="flex items-center space-x-1.5">
            <Terminal className="h-3.5 w-3.5 text-[#B77932]" />
            <span className="font-semibold">TEST DIRECTIVE ACTIVE:</span>
            <span>Simulating deliberate runtime failure injection</span>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#F0D9BC]">
            Override
          </span>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div
          role="alert"
          className="mb-2 flex items-start space-x-2.5 p-3.5 rounded-xl bg-[#FBEDED] border border-[#F3CBC7] text-[#C44E45] text-xs animate-in fade-in duration-150"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-xs block">
              Workflow Execution Error
            </span>
            <span className="block mt-0.5 text-xs text-[#26231F]">{error}</span>
          </div>
        </div>
      )}

      {/* Composer Container Card */}
      <div className="relative rounded-2xl bg-[#FFFFFF] border border-[#E8E2D9] shadow-[0_2px_12px_rgba(38,35,31,0.06)] focus-within:border-[#C66A43] focus-within:shadow-[0_4px_24px_-2px_rgba(198,106,67,0.12)] transition-all duration-200">
        {/* Top Control Bar: Student Context Chip & Tools Access */}
        <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-[#E8E2D9] bg-[#FAF7F2] rounded-t-2xl">
          {/* Student Selector Chip with Popover */}
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setStudentPickerOpen((prev) => !prev)}
              aria-expanded={studentPickerOpen}
              aria-label="Change Student Context"
              className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#F0ECE5] border border-[#E8E2D9] hover:border-[#C66A43]/50 transition cursor-pointer text-left group shadow-xs"
            >
              <div
                className={`p-1 rounded-md shrink-0 border ${
                  isCurrentEligible
                    ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
                    : "bg-[#FBF3E8] border-[#F0D9BC] text-[#B77932]"
                }`}
              >
                {isCurrentEligible ? (
                  <UserCheck className="h-3.5 w-3.5" />
                ) : (
                  <UserX className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-semibold text-[#26231F]">
                  {currentStudent?.name || selectedStudentId}
                </span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[#F0ECE5] text-[#77716A]">
                  {selectedStudentId}
                </span>
                <span
                  className={`text-[11px] font-medium hidden sm:inline ${
                    isCurrentEligible ? "text-[#287A53]" : "text-[#B77932]"
                  }`}
                >
                  &bull; {currentPct}% ({isCurrentEligible ? "Eligible" : "Ineligible"})
                </span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-[#77716A] group-hover:text-[#26231F] transition-transform ${
                  studentPickerOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Student Picker Popover Dropdown */}
            {studentPickerOpen && (
              <div className="absolute left-0 bottom-full mb-2 w-80 sm:w-96 rounded-xl bg-[#FFFFFF] border border-[#E8E2D9] shadow-lg p-3 z-50 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D9] mb-2">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#77716A]">
                    Select Student Context
                  </span>
                  <span className="text-[10px] text-[#77716A]">
                    Threshold: &ge;75% Attendance
                  </span>
                </div>
                <div className="space-y-2">
                  {students.map((student) => {
                    const isSelected = selectedStudentId === student.student_id;
                    const records = attendanceByStudent[student.student_id] || [];
                    const courses = coursesByStudent[student.student_id] || [];
                    const attended = records.reduce((acc, r) => acc + r.attended_classes, 0);
                    const total = records.reduce((acc, r) => acc + r.total_classes, 0);
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
                        className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer flex items-start space-x-2.5 ${
                          isSelected
                            ? "bg-[#F5E7DE] border-[#C66A43]/50"
                            : "bg-[#FFFFFF] hover:bg-[#F0ECE5] border-[#E8E2D9]"
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-md mt-0.5 border shrink-0 ${
                            eligible
                              ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
                              : "bg-[#FBF3E8] border-[#F0D9BC] text-[#B77932]"
                          }`}
                        >
                          {eligible ? (
                            <UserCheck className="h-3.5 w-3.5" />
                          ) : (
                            <UserX className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-[#26231F] truncate">
                              {student.name}
                            </span>
                            <span className="text-[10px] font-mono px-1 rounded bg-[#F0ECE5] text-[#77716A]">
                              {student.student_id}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 mt-0.5 text-[11px] text-[#77716A]">
                            <GraduationCap className="h-3 w-3 text-[#C66A43]" />
                            <span>
                              {student.program} &bull; Sem {student.semester}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className={eligible ? "text-[#287A53]" : "text-[#B77932]"}>
                              {pct}% Attendance ({eligible ? "Eligible" : "Policy Gate Fail"})
                            </span>
                            {courses.length > 0 && (
                              <span className="text-[#77716A] flex items-center space-x-1 text-[10px] font-mono">
                                <BookOpen className="h-2.5 w-2.5" />
                                <span>{courses.map((c) => c.course_code).join(", ")}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Integrated Tools Button */}
          <button
            type="button"
            onClick={onOpenTools}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FFFFFF] hover:bg-[#F5E7DE] text-[#26231F] hover:text-[#C66A43] border border-[#E8E2D9] hover:border-[#C66A43]/40 transition cursor-pointer shadow-xs group"
            title="Open Agentic Tools, Presets & Capabilities Menu"
          >
            <Wrench className="h-3.5 w-3.5 text-[#C66A43] group-hover:rotate-45 transition-transform" />
            <span className="font-medium">Tools &amp; Presets</span>
          </button>
        </div>

        {/* Multiline Textarea */}
        <div className="px-4 py-3">
          <textarea
            ref={textareaRef}
            rows={2}
            value={goalText}
            onChange={(e) => onGoalTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CampVion to apply for leave, check courses, or inject a simulation directive..."
            className="w-full bg-transparent border-0 text-xs sm:text-sm text-[#26231F] placeholder-[#9E978E] focus:outline-none resize-none leading-relaxed font-sans"
          />
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[#E8E2D9] bg-[#FAF7F2] rounded-b-2xl">
          <div className="flex items-center space-x-2 text-[11px] text-[#77716A]">
            <span>Deterministic DAG</span>
            <span>&bull;</span>
            <span className="hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#E8E2D9] text-[#77716A] font-mono text-[10px]">Ctrl+Enter</kbd>
            </span>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || !goalText.trim() || !selectedStudentId.trim()}
            className="flex items-center space-x-2 px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#C66A43] hover:bg-[#AD5735] text-[#FFFFFF] shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-sans"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Orchestrating...</span>
              </>
            ) : (
              <>
                <span>Execute Workflow</span>
                <Send className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
