"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  MapPin,
  School,
  Send,
} from "lucide-react";
import { apiClient, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useEvents } from "../context/EventsContext";
import type { LeaveRequestItem } from "../types/api";
import { CollegeSelect } from "./CollegeSelect";
import { RequestStatusCard } from "./RequestStatusCard";

export interface LeaveGuidedPrefill {
  from_date?: string;
  from_time?: string;
  to_date?: string;
  to_time?: string;
  category?: string;
  reason?: string;
  college?: string;
  destination?: string;
}

interface LeaveDetailsCardProps {
  prefill?: LeaveGuidedPrefill;
  onSubmitted?: (leave: LeaveRequestItem) => void;
}

const LEAVE_TYPES = [
  { id: "personal", label: "Personal" },
  { id: "medical", label: "Medical" },
  { id: "family_emergency", label: "Family Emergency" },
  { id: "academic_event", label: "Academic Event" },
  { id: "placement", label: "Placement / Interview" },
];

function formatYmdCampus(d: Date): string {
  // Format local calendar date YYYY-MM-DD cleanly
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
}

function addDaysYmd(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return formatYmdCampus(next);
}

function getWeekdayName(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-IN", { weekday: "long" });
}

function formatReadableWindow(ymd: string, hm: string): string {
  if (!ymd || !hm) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm);
  if (Number.isNaN(dt.getTime())) return `${ymd} ${hm}`;
  const weekday = dt.toLocaleDateString("en-IN", { weekday: "long" });
  const dayNum = dt.getDate();
  const month = dt.toLocaleDateString("en-IN", { month: "short" });
  const yr = dt.getFullYear();
  const hr12 = hh % 12 || 12;
  const ampm = hh < 12 ? "AM" : "PM";
  return `${weekday}, ${dayNum} ${month} ${yr}, ${hr12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export function LeaveDetailsCard({ prefill, onSubmitted }: LeaveDetailsCardProps) {
  const { user } = useAuth();
  const { upsertLiveLeave } = useEvents();

  const todayYmd = useMemo(() => formatYmdCampus(new Date()), []);
  const tomorrowYmd = useMemo(() => addDaysYmd(new Date(), 1), []);

  const [category, setCategory] = useState(prefill?.category || "personal");
  const [reason, setReason] = useState(prefill?.reason || "");
  const [fromDate, setFromDate] = useState(prefill?.from_date || tomorrowYmd);
  const [fromTime, setFromTime] = useState(prefill?.from_time || "09:00");
  const [toDate, setToDate] = useState(prefill?.to_date || prefill?.from_date || tomorrowYmd);
  const [toTime, setToTime] = useState(prefill?.to_time || "18:00");
  const [destination, setDestination] = useState(prefill?.destination || "");
  const [college, setCollege] = useState(
    prefill?.college || user?.college || "Lovely Professional University"
  );
  const [editingCollege, setEditingCollege] = useState(false);

  const [step, setStep] = useState<"edit" | "review" | "submitted">("edit");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdLeave, setCreatedLeave] = useState<LeaveRequestItem | null>(null);

  const fromDay = useMemo(() => getWeekdayName(fromDate), [fromDate]);
  const toDay = useMemo(() => getWeekdayName(toDate), [toDate]);

  const applyQuickRange = (preset: "today" | "tomorrow" | "weekend") => {
    const now = new Date();
    setErrorMsg(null);
    if (preset === "today") {
      const t = formatYmdCampus(now);
      setFromDate(t);
      setToDate(t);
      if (now.getHours() >= 9) {
        const nextHr = Math.min(22, now.getHours() + 1);
        setFromTime(`${String(nextHr).padStart(2, "0")}:00`);
        setToTime("21:00");
      } else {
        setFromTime("09:00");
        setToTime("18:00");
      }
    } else if (preset === "tomorrow") {
      const tom = addDaysYmd(now, 1);
      setFromDate(tom);
      setToDate(tom);
      setFromTime("09:00");
      setToTime("18:00");
    } else {
      // Upcoming Sat -> Sun
      const dayOfWeek = now.getDay(); // 0 Sun..6 Sat
      const daysToSat = (6 - dayOfWeek + 7) % 7 || 7;
      const sat = addDaysYmd(now, daysToSat);
      const sun = addDaysYmd(now, daysToSat + 1);
      setFromDate(sat);
      setToDate(sun);
      setFromTime("09:00");
      setToTime("20:00");
    }
  };

  const validateFields = (): string | null => {
    if (!fromDate || !fromTime) return "Please pick your departure date and time.";
    if (!toDate || !toTime) return "Please pick your return date and time.";
    const [fy, fm, fd] = fromDate.split("-").map(Number);
    const [fh, fmi] = fromTime.split(":").map(Number);
    const [ty, tm, td] = toDate.split("-").map(Number);
    const [th, tmi] = toTime.split(":").map(Number);
    const fromDt = new Date(fy, fm - 1, fd, fh, fmi);
    const toDt = new Date(ty, tm - 1, td, th, tmi);
    if (Number.isNaN(fromDt.getTime()) || Number.isNaN(toDt.getTime())) {
      return "Please enter valid dates and times.";
    }
    if (fromDt.getTime() < Date.now() - 2 * 60 * 1000) {
      return "Departure date and time cannot be in the past.";
    }
    if (toDt.getTime() <= fromDt.getTime()) {
      return "Return date and time must be after departure time.";
    }
    const diffDays = (toDt.getTime() - fromDt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 30) {
      return "Leave duration cannot exceed 30 days.";
    }
    if (reason.trim().length < 3) {
      return "Please enter a brief reason (at least 3 characters).";
    }
    if (!college.trim()) {
      return "Please confirm or choose your college.";
    }
    return null;
  };

  const handleReview = () => {
    const err = validateFields();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setErrorMsg(null);
    setStep("review");
  };

  const handleSubmit = async () => {
    const err = validateFields();
    if (err) {
      setErrorMsg(err);
      setStep("edit");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const [fy, fm, fd] = fromDate.split("-").map(Number);
      const [ty, tm, td] = toDate.split("-").map(Number);
      const daySpan = Math.max(
        1,
        Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86400000) + 1
      );
      const res = await apiClient.submitLeaveRequest({
        days: daySpan,
        start_date: fromDate,
        category,
        reason: reason.trim(),
        from_date: fromDate,
        from_time: fromTime,
        to_date: toDate,
        to_time: toTime,
        destination: destination.trim() || undefined,
        college: college.trim(),
      });
      upsertLiveLeave(res.request);
      setCreatedLeave(res.request);
      setStep("submitted");
      onSubmitted?.(res.request);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setErrorMsg(e.message || "Unable to submit leave request.");
      } else if (e instanceof Error) {
        setErrorMsg(e.message);
      } else {
        setErrorMsg("Unable to submit leave request right now.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (step === "submitted" && createdLeave) {
    return (
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-cv-success px-2.5 py-1 rounded-full bg-cv-success-soft border border-cv-success-line">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Leave request submitted and awaiting Warden approval</span>
        </div>
        <RequestStatusCard
          initialRequest={createdLeave}
          allowCancel
          onUpdated={(updated) => {
            setCreatedLeave(updated);
            upsertLiveLeave(updated);
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-cv-surface border border-cv-line p-4 sm:p-5 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-cv-line">
        <div>
          <h4 className="text-sm font-semibold text-cv-fg">Leave Application Details</h4>
          <p className="text-xs text-cv-fg-2">
            Pick your exact departure and return schedule. You&apos;ll review before submitting.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["today", "tomorrow", "weekend"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={step === "review" || busy}
              onClick={() => applyQuickRange(preset)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-cv-inset hover:bg-cv-accent-soft text-cv-fg-2 hover:text-cv-accent-ink border border-cv-line transition cursor-pointer disabled:opacity-50"
            >
              {preset === "today" ? "Today" : preset === "tomorrow" ? "Tomorrow" : "This weekend"}
            </button>
          ))}
        </div>
      </div>

      {step === "edit" ? (
        <div className="space-y-3.5">
          {/* Leave type pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-cv-fg-2 block">Leave Type</label>
            <div className="flex flex-wrap gap-1.5">
              {LEAVE_TYPES.map((lt) => (
                <button
                  key={lt.id}
                  type="button"
                  onClick={() => setCategory(lt.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                    category === lt.id
                      ? "bg-cv-accent-soft border-cv-accent-line text-cv-accent-ink"
                      : "bg-cv-inset border-cv-line text-cv-fg-2 hover:text-cv-fg"
                  }`}
                >
                  {lt.label}
                </button>
              ))}
            </div>
          </div>

          {/* From Date & Time + To Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-cv-inset border border-cv-line p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cv-fg flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-cv-accent-ink" />
                  Departure (From)
                </span>
                {fromDay && (
                  <span className="text-[11px] font-medium text-cv-accent-ink">{fromDay}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  min={todayYmd}
                  value={fromDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFromDate(val);
                    if (toDate && val && toDate < val) setToDate(val);
                  }}
                  aria-label="Departure date"
                  className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-1.5 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
                />
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  aria-label="Departure time"
                  className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-1.5 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
                />
              </div>
            </div>

            <div className="rounded-xl bg-cv-inset border border-cv-line p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cv-fg flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-cv-accent-ink" />
                  Return (To)
                </span>
                {toDay && (
                  <span className="text-[11px] font-medium text-cv-accent-ink">{toDay}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  min={fromDate || todayYmd}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  aria-label="Return date"
                  className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-1.5 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
                />
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  aria-label="Return time"
                  className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-1.5 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
                />
              </div>
            </div>
          </div>

          {/* Reason + Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-cv-fg-2 block">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Sister's graduation ceremony"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-3 py-2 text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-cv-fg-2 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-cv-fg-3" />
                Destination <span className="text-cv-fg-3 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Chandigarh / Home"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-3 py-2 text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
              />
            </div>
          </div>

          {/* College snapshot row with inline change toggle */}
          <div className="rounded-xl bg-cv-inset border border-cv-line px-3 py-2.5">
            {!editingCollege ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <School className="h-3.5 w-3.5 text-cv-accent-ink shrink-0" />
                  <span className="text-cv-fg-2 shrink-0">College:</span>
                  <span className="font-medium text-cv-fg truncate">{college}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCollege(true)}
                  className="text-cv-accent-ink hover:underline font-medium shrink-0 cursor-pointer"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-cv-fg-2 block">
                  College for this leave slip
                </label>
                <CollegeSelect
                  value={college}
                  onChange={setCollege}
                  variant="workspace"
                />
                <button
                  type="button"
                  onClick={() => setEditingCollege(false)}
                  className="text-[11px] font-medium text-cv-accent-ink hover:underline cursor-pointer"
                >
                  Done selecting college
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Review Summary Step */
        <div className="rounded-xl bg-cv-inset border border-cv-accent-soft-line p-3.5 space-y-2.5 text-xs">
          <div className="font-semibold text-cv-fg">Review Leave Details Before Sending</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="text-cv-fg-3 block text-[11px]">From</span>
              <span className="font-medium text-cv-fg">
                {formatReadableWindow(fromDate, fromTime)}
              </span>
            </div>
            <div>
              <span className="text-cv-fg-3 block text-[11px]">To</span>
              <span className="font-medium text-cv-fg">
                {formatReadableWindow(toDate, toTime)}
              </span>
            </div>
            <div>
              <span className="text-cv-fg-3 block text-[11px]">Leave Type &amp; Reason</span>
              <span className="font-medium text-cv-fg">
                {LEAVE_TYPES.find((t) => t.id === category)?.label || category}: {reason}
              </span>
            </div>
            <div>
              <span className="text-cv-fg-3 block text-[11px]">College / Destination</span>
              <span className="font-medium text-cv-fg">
                {college}
                {destination.trim() ? ` • ${destination.trim()}` : ""}
              </span>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-xl bg-cv-error-soft border border-cv-error-line px-3 py-2 text-xs text-cv-error">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {step === "review" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("edit")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cv-inset hover:bg-cv-raised border border-cv-line text-xs font-medium text-cv-fg cursor-pointer disabled:opacity-50"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Edit Details</span>
          </button>
        )}

        {step === "edit" ? (
          <button
            type="button"
            onClick={handleReview}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent text-xs font-semibold transition cursor-pointer"
          >
            <span>Review &amp; Submit</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>Submit Leave Request</span>
          </button>
        )}
      </div>
    </div>
  );
}
