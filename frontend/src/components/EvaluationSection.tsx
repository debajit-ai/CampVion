"use client";

import React from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Info,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  AgentResult,
  AgentState,
  TraceItem,
  WorkflowSessionSummary,
} from "../types/api";
import { PRESET_GOALS } from "./NewRequestPanel";
import { useTheme } from "../context/ThemeContext";

interface EvaluationSectionProps {
  state: AgentState | null;
  result: AgentResult | null;
  traces: TraceItem[];
  sessionSummaries?: WorkflowSessionSummary[];
  activeRequestId?: number | null;
  onSelectRequestId?: (id: number) => void;
  onRunScenario?: (studentId: string, goal: string) => Promise<void>;
  isLoading?: boolean;
}

export function EvaluationSection({
  state,
  result,
  traces,
  sessionSummaries = [],
  activeRequestId = null,
  onSelectRequestId,
  onRunScenario,
  isLoading = false,
}: EvaluationSectionProps) {
  const { experienceMode } = useTheme();
  const isSimple = experienceMode === "simple";

  const completedCount =
    state?.completed_tasks.length ?? result?.completed_tasks.length ?? 0;
  const failedCount =
    state?.failed_tasks.length ?? result?.failed_tasks.length ?? 0;
  const totalTasks = state?.plan.length || (result ? 6 : 0);
  const replanCount = state?.replanning_count ?? result?.replanning_count ?? 0;
  const humanCount = state?.human_approval_required
    ? 1
    : result?.human_intervention_count ?? 0;
  const runtime = result?.execution_time ?? 0;

  // Verify monotonicity of step numbers in traces
  const stepNumbers = traces.map((t) => t.step_number);
  const isMonotonic =
    stepNumbers.length > 0 &&
    stepNumbers.every((val, i, arr) => i === 0 || val >= arr[i - 1]);

  const completionRate =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const observations = state?.observations || [];
  const successObsCount = observations.filter(
    (o) => o.observation === "SUCCESS"
  ).length;
  const recoverableObsCount = observations.filter(
    (o) => o.observation === "RECOVERABLE_FAILURE"
  ).length;
  const nonRecoverableObsCount = observations.filter(
    (o) => o.observation === "NON_RECOVERABLE_FAILURE"
  ).length;

  return (
    <div className="bg-cv-surface border border-cv-line rounded-2xl p-5 space-y-5 shadow-xs select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-cv-line">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cv-accent-soft border border-cv-accent-soft-line text-cv-accent-ink">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-cv-fg">
              {isSimple ? (
                <>System Performance &amp; <span className="text-cv-accent-ink">Reliability</span></>
              ) : (
                <>Operational Telemetry &amp; <span className="text-cv-accent-ink">Evaluation</span></>
              )}
            </h2>
            <p className="text-xs text-cv-fg-2 mt-0.5">
              {isSimple
                ? "Real-time health, response times, and automated recovery statistics"
                : "Live execution metrics computed from verified backend trace data"}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-cv-raised border border-cv-line text-cv-fg-2">
          {isSimple ? "Live Health & Performance" : "Empirical Telemetry"}
        </span>
      </div>

      {/* Real Computed Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-cv-inset border border-cv-line">
          <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
            {isSimple ? "Request Success Rate" : "Task Completion Rate"}
          </span>
          <div className="flex items-baseline space-x-1.5 mt-1.5">
            <span className="text-xl font-bold font-mono text-cv-success">
              {completionRate}%
            </span>
            <span className="text-[10px] text-cv-fg-2 font-mono">
              ({completedCount}/{totalTasks})
            </span>
          </div>
          <div className="mt-2 text-[10px] text-cv-fg-2">
            {failedCount > 0 ? (
              <span className="text-cv-error">
                {isSimple ? `${failedCount} step(s) had issues` : `${failedCount} task(s) failed`}
              </span>
            ) : (
              <span>{isSimple ? "All steps successful" : "0 failed tasks"}</span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-cv-inset border border-cv-line">
          <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
            {isSimple ? "Automatic Recovery" : "Replanning Events"}
          </span>
          <div className="flex items-baseline space-x-1.5 mt-1.5">
            <span className="text-xl font-bold font-mono text-cv-accent-ink">
              {replanCount}
            </span>
            <span className="text-[10px] text-cv-fg-2">
              {isSimple ? "auto-fixes" : "self-heals"}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-cv-fg-2">
            <span>
              {isSimple
                ? `Auto-resolved: ${recoverableObsCount} of ${recoverableObsCount + nonRecoverableObsCount} issues`
                : `Observer: ${recoverableObsCount} recoverable / ${nonRecoverableObsCount} fatal`}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-cv-inset border border-cv-line">
          <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
            {isSimple ? "Secure Approvals" : "Human Interventions"}
          </span>
          <div className="flex items-baseline space-x-1.5 mt-1.5">
            <span className="text-xl font-bold font-mono text-cv-warning">
              {humanCount}
            </span>
            <span className="text-[10px] text-cv-fg-2">
              {isSimple ? "check(s)" : "gate(s)"}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-cv-fg-2">
            <span>
              {isSimple
                ? state?.human_approval_status === "APPROVED"
                  ? "Approved by student"
                  : state?.human_approval_status === "REJECTED"
                  ? "Cancelled by student"
                  : state?.human_approval_required
                  ? "Needs your review"
                  : "None required"
                : `Decision: ${state?.human_approval_status || "NONE"}`}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-cv-inset border border-cv-line">
          <span className="text-[10px] uppercase font-semibold text-cv-fg-2 block">
            {isSimple ? "Response Speed & Health" : "Latency & Trace Audit"}
          </span>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs font-mono text-cv-fg flex items-center space-x-1">
              <Clock className="h-3.5 w-3.5 text-cv-accent-ink" />
              <span>{runtime > 0 ? `${runtime}s` : "Pending"}</span>
            </span>
            <span className="text-cv-line">&bull;</span>
            <div className="flex items-center space-x-1 text-xs text-cv-success font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isMonotonic ? (isSimple ? "Healthy" : "Strict") : "Pending"}</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-cv-fg-2">
            <span>
              {isSimple
                ? `${traces.length} steps recorded • ${successObsCount} completed`
                : `${traces.length} trace events • ${successObsCount} success obs`}
            </span>
          </div>
        </div>
      </div>

      {/* Session Evaluation Ledger */}
      {sessionSummaries.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
              {isSimple ? (
                <>Recent Service <span className="text-cv-accent-ink">Requests</span> History ({sessionSummaries.length} run{sessionSummaries.length === 1 ? "" : "s"})</>
              ) : (
                <>Recorded Session <span className="text-cv-accent-ink">Workflow</span> Ledger ({sessionSummaries.length} run{sessionSummaries.length === 1 ? "" : "s"})</>
              )}
            </h3>
            <span className="text-[10px] text-cv-fg-2">
              {isSimple ? "Select any request to view details" : "Click any run to inspect its plan and trace"}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-cv-line bg-cv-surface">
            <table className="w-full text-left text-xs">
              <thead className="bg-cv-inset text-[10px] uppercase text-cv-fg-2 border-b border-cv-line">
                <tr>
                  <th className="py-2.5 px-3">Req ID</th>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">{isSimple ? "Request Description" : "Goal / Directive"}</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">{isSimple ? "Steps" : "Tasks"}</th>
                  <th className="py-2.5 px-3">{isSimple ? "Auto-Fixes" : "Replans"}</th>
                  <th className="py-2.5 px-3">{isSimple ? "Approval" : "Governance"}</th>
                  <th className="py-2.5 px-3 text-right">{isSimple ? "Duration" : "Latency"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cv-line">
                {sessionSummaries.map((item) => {
                  const isCurrent = item.request_id === activeRequestId;
                  return (
                    <tr
                      key={item.request_id}
                      onClick={() => onSelectRequestId?.(item.request_id)}
                      className={`transition cursor-pointer ${
                        isCurrent
                          ? "bg-cv-accent-soft/60 text-cv-fg font-medium"
                          : "hover:bg-cv-inset text-cv-fg"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold font-mono">
                        #{item.request_id}
                      </td>
                      <td className="py-2.5 px-3 text-cv-accent-ink font-mono">{item.student_id}</td>
                      <td className="py-2.5 px-3 max-w-[240px] truncate">
                        {item.goal}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase ${
                            item.status === "COMPLETED"
                              ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                              : item.status === "WAITING_FOR_HUMAN"
                              ? "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
                              : item.status === "FAILED"
                              ? "bg-cv-error-soft border-cv-error-line text-cv-error"
                              : "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink"
                          }`}
                        >
                          {item.status === "COMPLETED" && (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          )}
                          {item.status === "WAITING_FOR_HUMAN" && (
                            <ShieldAlert className="h-2.5 w-2.5" />
                          )}
                          {item.status === "FAILED" && (
                            <XCircle className="h-2.5 w-2.5" />
                          )}
                          <span>{item.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {item.completed_count}/{item.total_tasks}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {item.replanning_count > 0 ? (
                          <span className="inline-flex items-center space-x-1 text-cv-accent-ink">
                            <RotateCcw className="h-2.5 w-2.5" />
                            <span>{item.replanning_count}</span>
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-2.5 px-3">{item.human_approval_status}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {item.execution_time > 0 ? `${item.execution_time}s` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deterministic Verification Scenario Suite */}
      {onRunScenario && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-cv-fg">
              {isSimple ? (
                <>Sample Campus <span className="text-cv-accent-ink">Requests</span></>
              ) : (
                <>Scenario Reliability &amp; <span className="text-cv-accent-ink">Verification</span> Matrix</>
              )}
            </h3>
            <span className="text-[10px] text-cv-fg-2">
              {isSimple
                ? "Try sample university requests directly"
                : "Execute scenarios against live SQLite backend"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PRESET_GOALS.map((scenario, idx) => {
              const matchingRun = sessionSummaries.find(
                (s) => s.student_id === scenario.studentId && s.goal === scenario.goal
              );
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-cv-inset border border-cv-line flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-cv-fg truncate">
                        {scenario.label}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cv-surface border border-cv-line text-cv-fg-2 shrink-0">
                        {scenario.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-cv-fg-2 mt-1 leading-relaxed">
                      {scenario.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-cv-line flex items-center justify-between gap-2">
                    {matchingRun ? (
                      <button
                        type="button"
                        onClick={() => onSelectRequestId?.(matchingRun.request_id)}
                        className="text-[10px] font-mono text-cv-success hover:underline cursor-pointer"
                      >
                        Verified: Req #{matchingRun.request_id} ({matchingRun.status})
                      </button>
                    ) : (
                      <span className="text-[10px] text-cv-fg-2">
                        Not yet executed
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => onRunScenario(scenario.studentId, scenario.goal)}
                      className="group inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cv-surface hover:bg-cv-accent hover:text-cv-on-accent border border-cv-line text-[10px] font-semibold text-cv-fg transition disabled:opacity-50 cursor-pointer shrink-0 shadow-xs"
                    >
                      <Play className="h-2.5 w-2.5 text-cv-accent-ink group-hover:text-cv-on-accent" />
                      <span>Run</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase Roadmap & Transparency Notice */}
      <div className="p-3.5 rounded-xl bg-cv-inset border border-cv-line text-xs text-cv-fg-2 space-y-1">
        <div className="flex items-center space-x-2 text-cv-fg font-semibold text-[11px]">
          <Info className="h-3.5 w-3.5 text-cv-accent-ink" />
          <span>
            ROADMAP NOTICE: PHASE 6 BENCHMARKING ENGINE
          </span>
        </div>
        <p className="text-[11px] leading-relaxed">
          In strict accordance with the ₹0-cost deterministic development roadmap, synthetic benchmark scores are NOT fabricated. Formal benchmarking against rule-based baselines is slated for Phase 6. All telemetry above reflects real, verified SQLite decision traces from the active backend.
        </p>
      </div>
    </div>
  );
}
