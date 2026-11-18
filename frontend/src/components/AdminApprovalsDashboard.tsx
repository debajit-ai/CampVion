"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  User,
  X,
  XCircle,
} from "lucide-react";
import { apiClient, ApiError } from "../lib/api";
import {
  CampusGateItem,
  DiscussionRoomItem,
  LeaveQueueStats,
  LeaveRequestItem,
} from "../types/api";
import { useEvents } from "../context/EventsContext";

const FALLBACK_GATES: CampusGateItem[] = [
  { id: 1, gate_code: "GATE-1", name: "Gate 1 - Main Gate", is_default_hostel: false },
  { id: 2, gate_code: "GATE-2", name: "Gate 2 - Hostel Gate", is_default_hostel: true },
  { id: 3, gate_code: "GATE-3", name: "Gate 3 - Library Gate", is_default_hostel: false },
  { id: 4, gate_code: "GATE-4", name: "Gate 4 - Sports Complex Gate", is_default_hostel: false },
];

function getWaitingMinutes(submittedIso?: string | null): number {
  if (!submittedIso) return 0;
  const ts = new Date(submittedIso).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

function formatWaitLabel(mins: number): string {
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const ADMIN_TABS = [
  { id: "PENDING_APPROVAL", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "CANCELLED", label: "Withdrawn" },
  { id: "ALL", label: "All" },
] as const;

interface AdminApprovalsDashboardProps {
  focusLeaveId?: number | null;
  onClearFocusLeave?: () => void;
}

export function AdminApprovalsDashboard({
  focusLeaveId,
  onClearFocusLeave,
}: AdminApprovalsDashboardProps) {
  const { lastEventTick, upsertLiveLeave } = useEvents();

  const [tab, setTab] = useState<string>("PENDING_APPROVAL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");
  const [search, setSearch] = useState<string>("");
  const [items, setItems] = useState<LeaveRequestItem[]>([]);
  const [stats, setStats] = useState<LeaveQueueStats>({
    pending_count: 0,
    approved_today_count: 0,
    rejected_today_count: 0,
    avg_response_minutes: 0,
    approval_rate_pct: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [banner, setBanner] = useState<{
    type: "info" | "error" | "success";
    text: string;
    details?: string;
  } | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);

  const [drawerItem, setDrawerItem] = useState<LeaveRequestItem | null>(null);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);

  const [gates, setGates] = useState<CampusGateItem[]>(FALLBACK_GATES);
  const [discussionRooms, setDiscussionRooms] = useState<DiscussionRoomItem[]>([]);
  const [approveModalItem, setApproveModalItem] = useState<LeaveRequestItem | null>(null);
  const [approveComment, setApproveComment] = useState<string>("");
  const [approveExitGate, setApproveExitGate] = useState<string>("");
  const [approveEntryGate, setApproveEntryGate] = useState<string>("");
  const [approveRoomId, setApproveRoomId] = useState<string>("");
  const [rejectModalItem, setRejectModalItem] = useState<LeaveRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [rejectNote, setRejectNote] = useState<string>("");
  const [decisionBusy, setDecisionBusy] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    apiClient
      .listCampusGates()
      .then((res) => {
        if (active && res.items?.length > 0) setGates(res.items);
      })
      .catch(() => {
        // fallback gates remain active
      });
    apiClient
      .listAvailableRooms()
      .then((res) => {
        if (active && res.items?.length > 0) setDiscussionRooms(res.items);
      })
      .catch(() => {
        // optional
      });
    return () => {
      active = false;
    };
  }, []);

  const openApproveModal = useCallback(
    (item: LeaveRequestItem) => {
      const isLeave = (item.request_type || "leave").toLowerCase() === "leave";
      if (isLeave) {
        const isHosteller =
          (item.student_residence_type || "").toLowerCase() === "hosteller" ||
          Boolean(item.student_hostel_block);
        const preferred =
          (isHosteller
            ? gates.find((g) => g.is_default_hostel)?.name
            : gates.find((g) => g.gate_code === "GATE-1")?.name) ||
          (isHosteller ? "Gate 2 - Hostel Gate" : "Gate 1 - Main Gate");
        setApproveExitGate(preferred);
        setApproveEntryGate(preferred);
      } else if ((item.request_type || "").toLowerCase() === "library_room") {
        const curRoomId = item.details?.room_id;
        setApproveRoomId(curRoomId ? String(curRoomId) : "");
        setApproveExitGate("");
        setApproveEntryGate("");
      } else {
        setApproveExitGate("");
        setApproveEntryGate("");
        setApproveRoomId("");
      }
      setApproveComment("");
      setApproveModalItem(item);
    },
    [gates]
  );

  const [, setClockTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClockTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchQueue = useCallback(async () => {
    const effectiveSort = tab === "PENDING_APPROVAL" ? sortOrder : "newest";
    const [listRes, statsRes] = await Promise.allSettled([
      apiClient.listLeaveRequests({
        status: tab,
        request_type: typeFilter === "ALL" ? undefined : typeFilter,
        q: search.trim() || undefined,
        sort: effectiveSort,
      }),
      apiClient.getLeaveRequestStats(),
    ]);

    if (statsRes.status === "fulfilled") {
      setStats(statsRes.value);
    } else if (listRes.status === "fulfilled" && listRes.value?.stats) {
      setStats(listRes.value.stats);
    } else {
      console.error("[AdminApprovalsDashboard] Failed to load queue stats:", statsRes.reason);
    }

    if (listRes.status === "fulfilled") {
      setItems(listRes.value.items);
      if (statsRes.status !== "fulfilled" && listRes.value?.stats) {
        setStats(listRes.value.stats);
      }
      setBanner((prev) => (prev?.type === "error" ? null : prev));
      setShowErrorDetails(false);
      for (const req of listRes.value.items) {
        upsertLiveLeave(req);
      }
    } else {
      const err = listRes.reason;
      console.error("[AdminApprovalsDashboard] Failed to load approval queue:", err);
      const errStatus = err instanceof ApiError ? err.status : 0;
      const errMsg = err instanceof Error ? err.message : String(err);
      const reqId = err instanceof ApiError && err.requestId ? ` (request_id=${err.requestId})` : "";
      setBanner({
        type: "error",
        text: "Unable to load approval queue right now. Please retry.",
        details: `HTTP ${errStatus}: ${errMsg}${reqId}`,
      });
    }

    setLoading(false);
  }, [tab, typeFilter, sortOrder, search, upsertLiveLeave]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await fetchQueue();
    })();
    return () => {
      active = false;
    };
  }, [fetchQueue, lastEventTick]);

  const openDetailDrawer = useCallback(
    async (leaveId: number) => {
      setDrawerLoading(true);
      try {
        const detail = await apiClient.getLeaveRequestDetail(leaveId);
        setDrawerItem(detail);
        upsertLiveLeave(detail);
      } catch {
        // Ignore
      } finally {
        setDrawerLoading(false);
      }
    },
    [upsertLiveLeave]
  );

  useEffect(() => {
    if (!focusLeaveId) return;
    let active = true;
    apiClient
      .getLeaveRequestDetail(focusLeaveId)
      .then((detail) => {
        if (!active) return;
        setDrawerItem(detail);
        upsertLiveLeave(detail);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setDrawerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [focusLeaveId, upsertLiveLeave]);

  const handleConfirmApprove = async () => {
    if (!approveModalItem || decisionBusy) return;
    const isLeaveType = (approveModalItem.request_type || "leave").toLowerCase() === "leave";
    if (isLeaveType && !approveExitGate.trim()) return;
    setDecisionBusy(true);
    setBanner(null);
    const target = approveModalItem;

    // Optimistic UI removal from Pending tab
    setItems((prev) => prev.filter((item) => item.id !== target.id || tab !== "PENDING_APPROVAL"));

    try {
      const isLibrary = (target.request_type || "").toLowerCase() === "library_room";
      const parsedRoomId = isLibrary && approveRoomId ? Number(approveRoomId) : undefined;
      const res = await apiClient.approveLeaveRequest(target.id, {
        comment: approveComment.trim() || undefined,
        version: target.version,
        exit_gate: isLeaveType ? approveExitGate.trim() : undefined,
        entry_gate: isLeaveType ? (approveEntryGate.trim() || approveExitGate.trim()) : undefined,
        room_id: parsedRoomId,
      });
      upsertLiveLeave(res.request);
      if (drawerItem?.id === target.id) {
        setDrawerItem(res.request);
      }
      setBanner({
        type: "success",
        text: `${res.request.leave_code} approved for ${res.request.student_name}.`,
      });
      setApproveModalItem(null);
      setApproveComment("");
      await fetchQueue();
    } catch (err: unknown) {
      await fetchQueue();
      if (err instanceof ApiError && err.status === 409) {
        setBanner({
          type: "info",
          text: "Already decided by another action. Queue has been refreshed.",
        });
      } else {
        setBanner({
          type: "error",
          text: err instanceof Error ? err.message : "Approval action failed.",
        });
      }
      setApproveModalItem(null);
    } finally {
      setDecisionBusy(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem || decisionBusy) return;
    const trimmedReason = rejectReason.trim();
    if (trimmedReason.length < 10) return;

    setDecisionBusy(true);
    setBanner(null);
    const target = rejectModalItem;

    setItems((prev) => prev.filter((item) => item.id !== target.id || tab !== "PENDING_APPROVAL"));

    try {
      const res = await apiClient.rejectLeaveRequest(target.id, {
        reason: trimmedReason,
        comment: rejectNote.trim() || undefined,
        version: target.version,
      });
      upsertLiveLeave(res.request);
      if (drawerItem?.id === target.id) {
        setDrawerItem(res.request);
      }
      setBanner({
        type: "success",
        text: `${res.request.leave_code} declined and ${res.request.student_name} was notified.`,
      });
      setRejectModalItem(null);
      setRejectReason("");
      setRejectNote("");
      await fetchQueue();
    } catch (err: unknown) {
      await fetchQueue();
      if (err instanceof ApiError && err.status === 409) {
        setBanner({
          type: "info",
          text: "Already decided by another action. Queue has been refreshed.",
        });
      } else {
        setBanner({
          type: "error",
          text: err instanceof Error ? err.message : "Rejection action failed.",
        });
      }
      setRejectModalItem(null);
    } finally {
      setDecisionBusy(false);
    }
  };

  const filteredStatCards = useMemo(
    () => [
      {
        label: "Pending Approval",
        value: String(stats.pending_count),
        sub: "Awaiting decision",
        icon: <ShieldAlert className="h-4 w-4 text-cv-warning" />,
        tone: stats.pending_count > 0 ? "text-cv-warning" : "text-cv-fg",
      },
      {
        label: "Approved Today",
        value: String(stats.approved_today_count),
        sub: `${stats.rejected_today_count} declined today`,
        icon: <CheckCircle2 className="h-4 w-4 text-cv-success" />,
        tone: "text-cv-success",
      },
      {
        label: "Avg Response Time",
        value: stats.avg_response_minutes > 0 ? `${stats.avg_response_minutes}m` : "—",
        sub: "Decision turnaround",
        icon: <Clock className="h-4 w-4 text-cv-accent-ink" />,
        tone: "text-cv-fg",
      },
      {
        label: "Approval Rate",
        value: stats.approval_rate_pct > 0 ? `${stats.approval_rate_pct}%` : "—",
        sub: "Of decided requests",
        icon: <TrendingUp className="h-4 w-4 text-cv-accent-ink" />,
        tone: "text-cv-fg",
      },
    ],
    [stats]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-cv-fg">
            Approval Queue
          </h2>
          <p className="text-xs text-cv-fg-2 mt-0.5">
            Review student leave requests, inspect verified attendance & policy gates, and authorize decisions in real time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchQueue()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cv-surface hover:bg-cv-raised border border-cv-line text-xs font-medium text-cv-fg transition cursor-pointer"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`flex flex-col gap-2 px-4 py-3 rounded-xl border text-xs ${
            banner.type === "error"
              ? "bg-cv-error-soft border-cv-error-line text-cv-error"
              : banner.type === "success"
              ? "bg-cv-success-soft border-cv-success-line text-cv-success"
              : "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{banner.text}</span>
            <div className="flex items-center gap-2 shrink-0">
              {banner.type === "error" && banner.details && (
                <button
                  type="button"
                  onClick={() => setShowErrorDetails((v) => !v)}
                  className="px-2 py-1 rounded-lg bg-cv-surface/70 border border-cv-error-line/60 text-[11px] font-medium text-cv-fg-2 hover:text-cv-fg cursor-pointer"
                >
                  {showErrorDetails ? "Hide details" : "Details"}
                </button>
              )}
              {banner.type === "error" && (
                <button
                  type="button"
                  onClick={() => {
                    setBanner(null);
                    setShowErrorDetails(false);
                    setLoading(true);
                    void fetchQueue();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-cv-surface border border-cv-error-line text-[11px] font-semibold text-cv-fg hover:bg-cv-raised cursor-pointer"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setBanner(null);
                  setShowErrorDetails(false);
                }}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {banner.type === "error" && showErrorDetails && banner.details && (
            <div className="px-2.5 py-1.5 rounded-lg bg-cv-surface/80 border border-cv-error-line/50 font-mono text-[11px] text-cv-fg-2 break-all">
              {banner.details}
            </div>
          )}
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {filteredStatCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-cv-surface border border-cv-line p-4 space-y-1.5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-cv-fg-2">{card.label}</span>
              <div className="p-1.5 rounded-lg bg-cv-inset border border-cv-line">
                {card.icon}
              </div>
            </div>
            <div className={`text-2xl font-bold tracking-tight ${card.tone}`}>
              {card.value}
            </div>
            <div className="text-[11px] text-cv-fg-3">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Request Type Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { id: "ALL", label: "All Types" },
          { id: "leave", label: "Leave" },
          { id: "library_room", label: "Library Room" },
          { id: "hostel_allocation", label: "Hostel Allocation" },
          { id: "certificate", label: "Certificate" },
        ].map((rt) => {
          const activeType = typeFilter === rt.id;
          return (
            <button
              key={rt.id}
              type="button"
              onClick={() => setTypeFilter(rt.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition cursor-pointer ${
                activeType
                  ? "bg-cv-raised border-cv-accent-line text-cv-fg"
                  : "bg-cv-surface border-cv-line text-cv-fg-2 hover:text-cv-fg"
              }`}
            >
              {rt.label}
            </button>
          );
        })}
      </div>

      {/* Tabs + Search + Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {ADMIN_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  active
                    ? "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink"
                    : "bg-cv-surface border-cv-line text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised"
                }`}
              >
                <span>{t.label}</span>
                {t.id === "PENDING_APPROVAL" && stats.pending_count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
                    {stats.pending_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 text-cv-fg-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, code, reason..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-cv-surface border border-cv-line text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
            />
          </div>

          {tab === "PENDING_APPROVAL" && (
            <button
              type="button"
              onClick={() => setSortOrder((s) => (s === "oldest" ? "newest" : "oldest"))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cv-surface hover:bg-cv-raised border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg cursor-pointer"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>{sortOrder === "oldest" ? "Oldest first" : "Newest first"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Queue List / Table */}
      <div className="rounded-2xl bg-cv-surface border border-cv-line overflow-hidden shadow-xs">
        {loading && items.length === 0 ? (
          <div className="p-12 flex items-center justify-center gap-2 text-xs text-cv-fg-2">
            <Loader2 className="h-4 w-4 animate-spin text-cv-accent-ink" />
            <span>Loading queue...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-cv-success mx-auto" />
            <div className="text-sm font-medium text-cv-fg">
              {tab === "PENDING_APPROVAL" ? "No pending requests awaiting review" : "No requests in this view"}
            </div>
            <p className="text-xs text-cv-fg-2">
              New student requests will appear here automatically without refreshing.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-cv-line">
            {items.map((item) => {
              const waitMins = getWaitingMinutes(item.submitted_at || item.created_at);
              const isOver2h = item.status === "PENDING_APPROVAL" && waitMins >= 120;
              const isOver30m = item.status === "PENDING_APPROVAL" && waitMins >= 30 && waitMins < 120;
              const attOk = (item.attendance_snapshot ?? 0) >= 75;

              return (
                <div
                  key={item.id}
                  onClick={() => void openDetailDrawer(item.id)}
                  className="p-4 hover:bg-cv-inset/60 transition cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cv-fg px-2 py-0.5 rounded bg-cv-inset border border-cv-line">
                        {item.leave_code}
                      </span>
                      <span className="text-sm font-semibold text-cv-fg">
                        {item.student_name}
                      </span>
                      <span className="text-[11px] font-mono text-cv-fg-3">
                        {item.student_id}
                      </span>

                      {item.attendance_snapshot !== null &&
                        item.attendance_snapshot !== undefined && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              attOk
                                ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                                : "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
                            }`}
                          >
                            {Math.round(item.attendance_snapshot)}% Attendance
                          </span>
                        )}

                      {item.status === "PENDING_APPROVAL" && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isOver2h
                              ? "bg-cv-error-soft border-cv-error-line text-cv-error"
                              : isOver30m
                              ? "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
                              : "bg-cv-inset border-cv-line text-cv-fg-2"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          <span>Waiting {formatWaitLabel(waitMins)}</span>
                        </span>
                      )}

                      {item.status !== "PENDING_APPROVAL" && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            item.status === "APPROVED"
                              ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                              : item.status === "REJECTED"
                              ? "bg-cv-error-soft border-cv-error-line text-cv-error"
                              : "bg-cv-raised border-cv-line text-cv-fg-2"
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.request_type === "library_room"
                            ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                            : item.request_type === "hostel_allocation"
                            ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                            : item.request_type === "certificate"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink"
                        }`}
                      >
                        {item.request_type_label ||
                          (item.request_type === "library_room"
                            ? "Library Room"
                            : item.request_type === "hostel_allocation"
                            ? "Hostel Allocation"
                            : item.request_type === "certificate"
                            ? "Certificate"
                            : "Leave")}
                      </span>
                      {item.title && (
                        <span className="text-xs font-semibold text-cv-fg">
                          {item.title}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-cv-fg-2">{item.reason}</p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-cv-fg-2">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-cv-accent-ink" />
                        {(item.details && typeof item.details.time_slot === "string" && item.details.time_slot) ||
                          (item.details && typeof item.details.requested_block === "string" && item.details.requested_block) ||
                          (item.details && typeof item.details.certificate_type === "string" && item.details.certificate_type) ||
                          (item.start_date === item.end_date
                            ? item.start_date
                            : `${item.start_date} \u2192 ${item.end_date}`)}
                      </span>
                      {(!item.request_type || item.request_type === "leave") && (
                        <span>
                          &bull; {item.days_count} {item.days_count === 1 ? "day" : "days"}
                        </span>
                      )}
                      {item.details && typeof item.details.room === "string" && (
                        <span>&bull; {item.details.room}</span>
                      )}
                      {item.details && typeof item.details.current_room === "string" && (
                        <span>&bull; From {item.details.current_room}</span>
                      )}
                      {item.details && typeof item.details.purpose === "string" && (
                        <span>&bull; {item.details.purpose}</span>
                      )}
                      <span className="capitalize">
                        &bull; {item.routed_to_role || item.approver_role || "Warden"}
                      </span>
                    </div>
                  </div>

                  {/* Quick Row Decision Actions */}
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.status === "PENDING_APPROVAL" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openApproveModal(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cv-success-solid hover:opacity-90 text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectReason("");
                            setRejectNote("");
                            setRejectModalItem(item);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cv-surface hover:bg-cv-error-soft text-cv-error border border-cv-error-line text-xs font-semibold transition cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void openDetailDrawer(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-cv-inset hover:bg-cv-raised border border-cv-line text-xs text-cv-fg-2 hover:text-cv-fg cursor-pointer"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Slide-Over Drawer */}
      {(drawerItem || drawerLoading) && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
          onClick={() => {
            setDrawerItem(null);
            onClearFocusLeave?.();
          }}
        >
          <div
            className="w-full max-w-xl bg-cv-surface border-l border-cv-line h-full overflow-y-auto p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-cv-line">
              <div>
                <h3 className="text-base font-semibold text-cv-fg">
                  {drawerItem ? `${drawerItem.leave_code} — ${drawerItem.request_type_label || "Request"} Review` : "Loading Request..."}
                </h3>
                <p className="text-xs text-cv-fg-2">
                  Verify student eligibility, policy rules, and approval action
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrawerItem(null);
                  onClearFocusLeave?.();
                }}
                aria-label="Close drawer"
                className="p-2 rounded-xl bg-cv-inset hover:bg-cv-raised border border-cv-line text-cv-fg-2 hover:text-cv-fg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {drawerLoading && !drawerItem ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-cv-fg-2">
                <Loader2 className="h-4 w-4 animate-spin text-cv-accent-ink" />
                <span>Loading student profile & policy trace...</span>
              </div>
            ) : (
              drawerItem && (
                <>
                  {/* Student Profile Card */}
                  <div className="rounded-2xl bg-cv-inset border border-cv-line p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cv-surface border border-cv-line text-cv-accent-ink">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-cv-fg">
                            {drawerItem.student_name}
                          </div>
                          <div className="text-xs text-cv-fg-2">
                            {drawerItem.student_id} &bull; {drawerItem.student_program || "Student"} &bull; Sem{" "}
                            {drawerItem.student_semester || "—"}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                          (drawerItem.attendance_snapshot ?? 0) >= 75
                            ? "bg-cv-success-soft border-cv-success-line text-cv-success"
                            : "bg-cv-warning-soft border-cv-warning-line text-cv-warning"
                        }`}
                      >
                        {drawerItem.attendance_snapshot !== null &&
                        drawerItem.attendance_snapshot !== undefined
                          ? `${Math.round(drawerItem.attendance_snapshot)}% Attendance`
                          : "Verified"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-cv-surface border border-cv-line">
                        <span className="text-[10px] text-cv-fg-3 uppercase block">Dates</span>
                        <span className="font-medium text-cv-fg">
                          {drawerItem.start_date} &rarr; {drawerItem.end_date} ({drawerItem.days_count}d)
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-cv-surface border border-cv-line">
                        <span className="text-[10px] text-cv-fg-3 uppercase block">Category</span>
                        <span className="font-medium text-cv-fg capitalize">
                          {drawerItem.category.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-cv-fg">
                      <span className="font-semibold text-cv-fg-2">Reason: </span>
                      {drawerItem.reason}
                    </div>
                  </div>

                  {/* Policy Verification Card */}
                  <div className="rounded-2xl bg-cv-inset border border-cv-line p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cv-fg">
                      <ShieldCheck className="h-4 w-4 text-cv-accent-ink" />
                      <span>Policy & Gate Verification</span>
                    </div>
                    <div className="text-xs text-cv-fg-2 space-y-1">
                      <div>
                        &bull; Threshold Check:{" "}
                        <span className="font-medium text-cv-fg">
                          {drawerItem.policy_result?.eligible ? "Eligible (>= 75%)" : "Exception Check"}
                        </span>
                      </div>
                      <div>
                        &bull; Policy References:{" "}
                        <span className="font-mono text-cv-accent-ink">
                          {drawerItem.policy_result?.policy_applied || "POL-ATT-001 / POL-LV-001"}
                        </span>
                      </div>
                      {drawerItem.doc_required && (
                        <div className="text-cv-warning flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Medical documentation policy flagged (&gt; 2 days).</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline / Decision Summary */}
                  {drawerItem.status === "PENDING_APPROVAL" ? (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => openApproveModal(drawerItem)}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cv-success-solid hover:opacity-90 text-white text-xs font-semibold transition cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        <span>Approve Leave</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectReason("");
                          setRejectNote("");
                          setRejectModalItem(drawerItem);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cv-surface hover:bg-cv-error-soft text-cv-error border border-cv-error-line text-xs font-semibold transition cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                        <span>Reject Leave</span>
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-cv-inset border border-cv-line p-4 space-y-1.5 text-xs">
                      <div className="font-semibold text-cv-fg">
                        Decision: {drawerItem.status}
                      </div>
                      <div className="text-cv-fg-2">
                        {drawerItem.decided_by_name
                          ? `By ${drawerItem.decided_by_name}`
                          : "Decision recorded"}
                        {drawerItem.decided_at
                          ? ` at ${new Date(drawerItem.decided_at).toLocaleString()}`
                          : ""}
                      </div>
                      {(drawerItem.rejection_reason || drawerItem.decision_comment) && (
                        <div className="text-cv-fg pt-1">
                          &ldquo;{drawerItem.rejection_reason || drawerItem.decision_comment}&rdquo;
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audit Traces */}
                  {drawerItem.traces && drawerItem.traces.length > 0 && (
                    <details className="rounded-2xl bg-cv-inset border border-cv-line p-4 text-xs">
                      <summary className="cursor-pointer font-medium text-cv-fg-2 hover:text-cv-fg">
                        Workflow Execution Trace ({drawerItem.traces.length} events)
                      </summary>
                      <div className="mt-2.5 space-y-1 max-h-52 overflow-y-auto">
                        {drawerItem.traces.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-cv-surface border border-cv-line text-[11px]"
                          >
                            <span className="font-mono text-cv-fg">
                              #{t.step_number} {t.event_type}
                            </span>
                            <span className="text-cv-fg-3">{t.status}</span>
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

      {/* Approve Confirmation Modal */}
      {approveModalItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !decisionBusy && setApproveModalItem(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-cv-surface border border-cv-line p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-cv-success" />
                <h3 className="text-base font-semibold text-cv-fg">
                  Approve {approveModalItem.leave_code}
                </h3>
              </div>
              <button
                type="button"
                disabled={decisionBusy}
                onClick={() => setApproveModalItem(null)}
                className="p-1 text-cv-fg-3 hover:text-cv-fg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-cv-fg-2">
              Authorize {approveModalItem.days_count} day(s) of{" "}
              <span className="capitalize">{approveModalItem.category}</span>{" "}
              {approveModalItem.request_type && approveModalItem.request_type !== "leave"
                ? approveModalItem.request_type_label || "request"
                : "leave"}{" "}
              for <span className="font-semibold text-cv-fg">{approveModalItem.student_name}</span> (
              {approveModalItem.from_display && approveModalItem.to_display
                ? `${approveModalItem.from_display} \u2192 ${approveModalItem.to_display}`
                : `${approveModalItem.start_date} \u2192 ${approveModalItem.end_date}`}
              ). The student will receive an instant notification.
            </p>

            {(approveModalItem.request_type || "leave").toLowerCase() === "leave" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-cv-inset border border-cv-line p-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-cv-fg block">
                    Exit Gate <span className="text-cv-error">*</span>
                  </label>
                  <select
                    value={approveExitGate}
                    onChange={(e) => {
                      const nextGate = e.target.value;
                      setApproveExitGate(nextGate);
                      if (!approveEntryGate || approveEntryGate === approveExitGate) {
                        setApproveEntryGate(nextGate);
                      }
                    }}
                    aria-label="Exit Gate"
                    className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
                  >
                    <option value="">Select exit gate...</option>
                    {gates.map((g) => (
                      <option key={g.gate_code} value={g.name}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-cv-fg block">
                    Entry Gate <span className="text-cv-error">*</span>
                  </label>
                  <select
                    value={approveEntryGate}
                    onChange={(e) => setApproveEntryGate(e.target.value)}
                    aria-label="Entry Gate"
                    className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
                  >
                    <option value="">Select entry gate...</option>
                    {gates.map((g) => (
                      <option key={g.gate_code} value={g.name}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {(approveModalItem.request_type || "").toLowerCase() === "library_room" &&
              discussionRooms.length > 0 && (
                <div className="space-y-1 rounded-xl bg-cv-inset border border-cv-line p-3">
                  <label className="text-[11px] font-medium text-cv-fg block">
                    Confirm / Reassign Discussion Room <span className="text-cv-fg-3">(optional)</span>
                  </label>
                  <select
                    value={approveRoomId}
                    onChange={(e) => setApproveRoomId(e.target.value)}
                    aria-label="Discussion Room"
                    className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
                  >
                    <option value="">
                      Keep requested room (
                      {String(
                        approveModalItem.details?.room_name ||
                          approveModalItem.details?.room ||
                          "Requested Room"
                      )}
                      )
                    </option>
                    {discussionRooms.map((rm) => (
                      <option key={rm.id} value={String(rm.id)}>
                        {rm.name} ({rm.floor}, {rm.capacity} seats)
                      </option>
                    ))}
                  </select>
                </div>
              )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-cv-fg">
                Comment <span className="text-cv-fg-3 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="e.g., Approved, safe travels."
                className="w-full rounded-xl bg-cv-inset border border-cv-line p-3 text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={decisionBusy}
                onClick={() => setApproveModalItem(null)}
                className="px-4 py-2 rounded-xl bg-cv-inset hover:bg-cv-raised border border-cv-line text-xs font-medium text-cv-fg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  decisionBusy ||
                  ((approveModalItem.request_type || "leave").toLowerCase() === "leave" &&
                    (!approveExitGate.trim() || !approveEntryGate.trim()))
                }
                onClick={() => void handleConfirmApprove()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cv-success-solid hover:opacity-90 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {decisionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !decisionBusy && setRejectModalItem(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-cv-surface border border-cv-line p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-cv-error" />
                <h3 className="text-base font-semibold text-cv-fg">
                  Decline {rejectModalItem.leave_code}
                </h3>
              </div>
              <button
                type="button"
                disabled={decisionBusy}
                onClick={() => setRejectModalItem(null)}
                className="p-1 text-cv-fg-3 hover:text-cv-fg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-cv-fg-2">
              Please state a clear reason for declining{" "}
              <span className="font-semibold text-cv-fg">{rejectModalItem.student_name}</span>&apos;s request. This message and your contact details will be shown to the student.
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-cv-fg">
                  Rejection Reason <span className="text-cv-error">*</span>
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    rejectReason.trim().length >= 10 ? "text-cv-success" : "text-cv-fg-3"
                  }`}
                >
                  {rejectReason.trim().length}/10 min chars
                </span>
              </div>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Midterm examinations are scheduled during these dates."
                className="w-full rounded-xl bg-cv-inset border border-cv-line p-3 text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-error-line resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={decisionBusy}
                onClick={() => setRejectModalItem(null)}
                className="px-4 py-2 rounded-xl bg-cv-inset hover:bg-cv-raised border border-cv-line text-xs font-medium text-cv-fg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={decisionBusy || rejectReason.trim().length < 10}
                onClick={() => void handleConfirmReject()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cv-error-solid hover:opacity-90 text-white text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {decisionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
