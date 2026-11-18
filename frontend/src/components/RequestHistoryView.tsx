"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { apiClient } from "../lib/api";
import { LeaveRequestItem } from "../types/api";
import { useEvents } from "../context/EventsContext";
import { RequestStatusCard } from "./RequestStatusCard";

interface RequestHistoryViewProps {
  selectedLeaveId?: number | null;
  onClearSelectedLeave?: () => void;
  onPrefillNewRequest?: (prompt: string) => void;
  isAdmin?: boolean;
}

const FILTER_TABS = [
  { id: "ALL", label: "All Requests" },
  { id: "PENDING_APPROVAL", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "CANCELLED", label: "Withdrawn" },
] as const;

export function RequestHistoryView({
  selectedLeaveId,
  onClearSelectedLeave,
  onPrefillNewRequest,
  isAdmin = false,
}: RequestHistoryViewProps) {
  const { liveLeaveById, lastEventTick, upsertLiveLeave } = useEvents();
  const [items, setItems] = useState<LeaveRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [drawerDetail, setDrawerDetail] = useState<LeaveRequestItem | null>(null);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient.listLeaveRequests({ sort: "newest" });
      setItems(res.items);
      for (const req of res.items) {
        upsertLiveLeave(req);
      }
    } catch {
      // Ignore background errors cleanly
    } finally {
      setLoading(false);
    }
  }, [upsertLiveLeave]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await loadHistory();
    })();
    return () => {
      active = false;
    };
  }, [loadHistory, lastEventTick]);

  const openDrawer = useCallback(
    async (leaveId: number) => {
      setDrawerLoading(true);
      try {
        const detail = await apiClient.getLeaveRequestDetail(leaveId);
        setDrawerDetail(detail);
        upsertLiveLeave(detail);
      } catch {
        // Fall back to existing list record if present
      } finally {
        setDrawerLoading(false);
      }
    },
    [upsertLiveLeave]
  );

  useEffect(() => {
    if (!selectedLeaveId) return;
    let active = true;
    apiClient
      .getLeaveRequestDetail(selectedLeaveId)
      .then((detail) => {
        if (!active) return;
        setDrawerDetail(detail);
        upsertLiveLeave(detail);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setDrawerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedLeaveId, upsertLiveLeave]);

  const mergedItems = useMemo(() => {
    return items.map((item) => liveLeaveById[item.id] || item);
  }, [items, liveLeaveById]);

  const filteredItems = useMemo(() => {
    return mergedItems.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          item.leave_code.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.student_name.toLowerCase().includes(q) ||
          item.student_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mergedItems, statusFilter, search]);

  const activeDetail = drawerDetail ? liveLeaveById[drawerDetail.id] || drawerDetail : null;

  const statusPill = (st: LeaveRequestItem["status"]) => {
    if (st === "PENDING_APPROVAL") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-cv-warning animate-pulse" />
          Pending
        </span>
      );
    }
    if (st === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cv-success-soft border border-cv-success-line text-cv-success">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </span>
      );
    }
    if (st === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cv-error-soft border border-cv-error-line text-cv-error">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cv-raised border border-cv-line text-cv-fg-2">
        <RotateCcw className="h-3 w-3" />
        Withdrawn
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-cv-fg">
            {isAdmin ? "All Leave Requests" : "Request History"}
          </h2>
          <p className="text-xs text-cv-fg-2 mt-0.5">
            Track real-time status, policy verifications, and institutional decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadHistory()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cv-surface hover:bg-cv-raised border border-cv-line text-xs font-medium text-cv-fg transition cursor-pointer"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  active
                    ? "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink"
                    : "bg-cv-surface border-cv-line text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 text-cv-fg-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or reason..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-cv-surface border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
          />
        </div>
      </div>

      {/* Request Table */}
      <div className="rounded-2xl bg-cv-surface border border-cv-line overflow-hidden shadow-xs">
        {loading && mergedItems.length === 0 ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-cv-fg-2">
            <Loader2 className="h-4 w-4 animate-spin text-cv-accent-ink" />
            <span>Loading requests...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <FileText className="h-8 w-8 text-cv-fg-3 mx-auto" />
            <div className="text-sm font-medium text-cv-fg">No requests match this filter</div>
            <p className="text-xs text-cv-fg-2">
              {statusFilter === "ALL"
                ? "Submit a leave request from Assistant to track it live here."
                : "Try selecting All Requests or clearing the search box."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cv-line bg-cv-inset text-[11px] font-medium text-cv-fg-3 uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  {isAdmin && <th className="py-3 px-4">Student</th>}
                  <th className="py-3 px-4">Dates & Reason</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Authority</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cv-line text-xs">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => void openDrawer(item.id)}
                    className="hover:bg-cv-inset/70 transition cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-cv-fg whitespace-nowrap">
                      {item.leave_code}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-cv-fg">{item.student_name}</div>
                        <div className="text-[11px] text-cv-fg-3 font-mono">{item.student_id}</div>
                      </td>
                    )}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-cv-fg truncate">{item.reason}</div>
                      <div className="text-[11px] text-cv-fg-2 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3 text-cv-accent-ink shrink-0" />
                        <span>
                          {item.start_date === item.end_date
                            ? item.start_date
                            : `${item.start_date} \u2192 ${item.end_date}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-cv-fg-2">
                      {item.days_count} {item.days_count === 1 ? "day" : "days"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{statusPill(item.status)}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-cv-fg-2">
                      {item.assigned_approver} ({item.approver_role})
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-cv-accent-ink font-medium">
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Slide-Over Drawer */}
      {(activeDetail || drawerLoading) && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
          onClick={() => {
            setDrawerDetail(null);
            onClearSelectedLeave?.();
          }}
        >
          <div
            className="w-full max-w-xl bg-cv-surface border-l border-cv-line h-full overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-cv-line">
              <div>
                <h3 className="text-base font-semibold text-cv-fg">
                  {activeDetail?.leave_code || "Request Details"}
                </h3>
                <p className="text-xs text-cv-fg-2">
                  Live approval timeline & policy audit
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrawerDetail(null);
                  onClearSelectedLeave?.();
                }}
                aria-label="Close drawer"
                className="p-2 rounded-xl bg-cv-inset hover:bg-cv-raised border border-cv-line text-cv-fg-2 hover:text-cv-fg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {drawerLoading && !activeDetail ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-cv-fg-2">
                <Loader2 className="h-4 w-4 animate-spin text-cv-accent-ink" />
                <span>Loading request details...</span>
              </div>
            ) : (
              activeDetail && (
                <>
                  <RequestStatusCard
                    initialRequest={activeDetail}
                    allowCancel={!isAdmin}
                    onPrefillNewRequest={(prompt) => {
                      setDrawerDetail(null);
                      onClearSelectedLeave?.();
                      onPrefillNewRequest?.(prompt);
                    }}
                    onUpdated={(updated) => setDrawerDetail(updated)}
                  />

                  {/* Policy Check Summary */}
                  <div className="rounded-2xl bg-cv-inset border border-cv-line p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cv-fg">
                      <ShieldCheck className="h-4 w-4 text-cv-accent-ink" />
                      <span>Eligibility & Policy Snapshot</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-cv-surface border border-cv-line">
                        <span className="text-[10px] text-cv-fg-3 block uppercase">
                          Attendance
                        </span>
                        <span className="font-semibold text-cv-fg">
                          {activeDetail.attendance_snapshot !== null &&
                          activeDetail.attendance_snapshot !== undefined
                            ? `${Math.round(activeDetail.attendance_snapshot)}%`
                            : "Verified"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-cv-surface border border-cv-line">
                        <span className="text-[10px] text-cv-fg-3 block uppercase">
                          Policy Applied
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-cv-accent-ink">
                          {activeDetail.policy_result?.policy_applied || "POL-ATT-001 / POL-LV-001"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lifecycle Timeline */}
                  <div className="rounded-2xl bg-cv-inset border border-cv-line p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cv-fg">
                      <Clock className="h-4 w-4 text-cv-accent-ink" />
                      <span>Timeline</span>
                    </div>

                    <div className="space-y-3 pl-2 border-l-2 border-cv-line">
                      <div className="pl-3">
                        <div className="text-xs font-medium text-cv-fg">
                          Request Submitted
                        </div>
                        <div className="text-[11px] text-cv-fg-2">
                          {activeDetail.submitted_at
                            ? new Date(activeDetail.submitted_at).toLocaleString()
                            : "Recorded"}
                        </div>
                      </div>

                      <div className="pl-3">
                        <div className="text-xs font-medium text-cv-fg">
                          Routed to Approval Gate ({activeDetail.assigned_approver})
                        </div>
                        <div className="text-[11px] text-cv-fg-2">
                          {activeDetail.status === "PENDING_APPROVAL"
                            ? "Currently awaiting authorization"
                            : "Reviewed at institutional gate"}
                        </div>
                      </div>

                      {activeDetail.status !== "PENDING_APPROVAL" && (
                        <div className="pl-3">
                          <div className="text-xs font-medium text-cv-fg">
                            {activeDetail.status === "APPROVED"
                              ? "Approved"
                              : activeDetail.status === "REJECTED"
                              ? "Rejected"
                              : "Withdrawn by Student"}
                          </div>
                          <div className="text-[11px] text-cv-fg-2">
                            {activeDetail.decided_at
                              ? new Date(activeDetail.decided_at).toLocaleString()
                              : "Updated"}
                            {activeDetail.rejection_reason
                              ? ` — ${activeDetail.rejection_reason}`
                              : activeDetail.decision_comment
                              ? ` — ${activeDetail.decision_comment}`
                              : ""}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step Trace Accordion */}
                  {activeDetail.traces && activeDetail.traces.length > 0 && (
                    <details className="rounded-2xl bg-cv-inset border border-cv-line p-4 text-xs">
                      <summary className="cursor-pointer font-medium text-cv-fg-2 hover:text-cv-fg flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5" />
                        <span>Execution Audit Steps ({activeDetail.traces.length})</span>
                      </summary>
                      <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
                        {activeDetail.traces.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-[11px]"
                          >
                            <span className="font-mono text-cv-fg">
                              #{t.step_number} {t.event_type}
                            </span>
                            <span className="text-cv-fg-3 capitalize">{t.status}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
