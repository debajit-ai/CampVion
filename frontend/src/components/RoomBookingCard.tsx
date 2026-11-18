"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  Send,
  Users,
} from "lucide-react";
import { apiClient, ApiError } from "../lib/api";
import { useEvents } from "../context/EventsContext";
import type { DiscussionRoomItem, LeaveRequestItem } from "../types/api";
import { RequestStatusCard } from "./RequestStatusCard";

export interface RoomBookingPrefill {
  date?: string;
  start_time?: string;
  end_time?: string;
  people?: number;
  purpose?: string;
}

interface RoomBookingCardProps {
  prefill?: RoomBookingPrefill;
  onSubmitted?: (req: LeaveRequestItem) => void;
}

function todayYmdLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function addDaysYmdLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function to12h(hm: string): string {
  if (!hm || !hm.includes(":")) return hm;
  const [h, m] = hm.split(":").map(Number);
  const hr = h % 12 || 12;
  const ap = h < 12 ? "AM" : "PM";
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
}

export function RoomBookingCard({ prefill, onSubmitted }: RoomBookingCardProps) {
  const { upsertLiveLeave } = useEvents();
  const todayYmd = useMemo(() => todayYmdLocal(), []);
  const tomorrowYmd = useMemo(() => addDaysYmdLocal(1), []);

  const [date, setDate] = useState(prefill?.date || tomorrowYmd);
  const [startTime, setStartTime] = useState(prefill?.start_time || "14:00");
  const [endTime, setEndTime] = useState(prefill?.end_time || "16:00");
  const [people, setPeople] = useState<number>(Math.max(1, Number(prefill?.people || 3)));
  const [purpose, setPurpose] = useState(prefill?.purpose || "");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const [rooms, setRooms] = useState<DiscussionRoomItem[]>([]);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [step, setStep] = useState<"edit" | "review" | "submitted">("edit");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<LeaveRequestItem | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingRooms(true);
      try {
        const res = await apiClient.listAvailableRooms({
          date,
          start_time: startTime,
          end_time: endTime,
          people,
        });
        if (!active) return;
        setRooms(res.items || []);
        setWindowError(res.window_error || null);
        setSelectedRoomId((prev) => {
          const valid = (res.items || []).find((r) => r.id === prev && r.available);
          if (valid) return valid.id;
          const firstAvail = (res.items || []).find((r) => r.available);
          return firstAvail ? firstAvail.id : null;
        });
      } catch (e: unknown) {
        if (active) {
          setWindowError(e instanceof Error ? e.message : "Could not check room availability.");
        }
      } finally {
        if (active) setLoadingRooms(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [date, startTime, endTime, people]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  );

  const handleReview = () => {
    if (windowError) {
      setErrorMsg(windowError);
      return;
    }
    if (!selectedRoom || !selectedRoom.available) {
      setErrorMsg("Please select an available discussion room.");
      return;
    }
    if (purpose.trim().length < 3) {
      setErrorMsg("Please enter a short study purpose (at least 3 characters).");
      return;
    }
    setErrorMsg(null);
    setStep("review");
  };

  const handleSubmit = async () => {
    if (!selectedRoom) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.submitCampusRequest({
        request_type: "library_room",
        room_id: selectedRoom.id,
        room_name: selectedRoom.name,
        people,
        from_date: date,
        from_time: startTime,
        to_date: date,
        to_time: endTime,
        reason: purpose.trim(),
      });
      upsertLiveLeave(res.request);
      setCreatedRequest(res.request);
      setStep("submitted");
      onSubmitted?.(res.request);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setErrorMsg(e.message);
      } else {
        setErrorMsg(e instanceof Error ? e.message : "Booking submission failed.");
      }
      setStep("edit");
    } finally {
      setBusy(false);
    }
  };

  if (step === "submitted" && createdRequest) {
    return (
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-cv-success px-2.5 py-1 rounded-full bg-cv-success-soft border border-cv-success-line">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Discussion room booking submitted for approval</span>
        </div>
        <RequestStatusCard
          initialRequest={createdRequest}
          allowCancel
          onUpdated={(updated) => {
            setCreatedRequest(updated);
            upsertLiveLeave(updated);
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-cv-surface border border-cv-line p-4 sm:p-5 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-cv-line">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-cv-accent-ink shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-cv-fg">Book Discussion Room</h4>
            <p className="text-xs text-cv-fg-2">
              Open 08:00 AM – 08:00 PM IST &bull; Max 2 hours &bull; 1 active booking per day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={step === "review"}
            onClick={() => setDate(todayYmd)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-cv-inset hover:bg-cv-accent-soft text-cv-fg-2 hover:text-cv-accent-ink border border-cv-line cursor-pointer disabled:opacity-50"
          >
            Today
          </button>
          <button
            type="button"
            disabled={step === "review"}
            onClick={() => setDate(tomorrowYmd)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-cv-inset hover:bg-cv-accent-soft text-cv-fg-2 hover:text-cv-accent-ink border border-cv-line cursor-pointer disabled:opacity-50"
          >
            Tomorrow
          </button>
        </div>
      </div>

      {step === "edit" ? (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-cv-fg-2 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-cv-accent-ink" />
                Date
              </label>
              <input
                type="date"
                min={todayYmd}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Booking date"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-cv-fg-2 flex items-center gap-1">
                <Clock className="h-3 w-3 text-cv-accent-ink" />
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Start time"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-cv-fg-2 flex items-center gap-1">
                <Clock className="h-3 w-3 text-cv-accent-ink" />
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-label="End time"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-cv-fg-2 flex items-center gap-1">
                <Users className="h-3 w-3 text-cv-accent-ink" />
                Group Size
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={people}
                onChange={(e) => setPeople(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                aria-label="Group size"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
              />
            </div>
          </div>

          {windowError && (
            <div className="flex items-start gap-2 rounded-xl bg-cv-warning-soft border border-cv-warning-line px-3 py-2 text-xs text-cv-warning">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{windowError}</span>
            </div>
          )}

          {/* Available Rooms Grid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-cv-fg-2">Select Available Room</span>
              {loadingRooms && (
                <span className="inline-flex items-center gap-1 text-[11px] text-cv-fg-3">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking live slots...
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rooms.map((rm) => {
                const isSelected = selectedRoomId === rm.id && rm.available;
                return (
                  <button
                    key={rm.id}
                    type="button"
                    disabled={!rm.available}
                    onClick={() => setSelectedRoomId(rm.id)}
                    className={`text-left rounded-xl p-3 border transition cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-cv-accent-soft border-cv-accent-line ring-1 ring-cv-accent-line"
                        : "bg-cv-inset border-cv-line hover:bg-cv-raised"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-cv-fg">{rm.name}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cv-surface border border-cv-line text-cv-fg-2">
                        {rm.capacity} seats
                      </span>
                    </div>
                    <div className="text-[11px] text-cv-fg-2 mt-1">
                      {rm.floor} &bull; {rm.amenities}
                    </div>
                    {!rm.available && rm.conflict_reason && (
                      <div className="text-[10px] text-cv-error mt-1 font-medium">
                        {rm.conflict_reason}
                      </div>
                    )}
                    {isSelected && (
                      <div className="inline-flex items-center gap-1 text-[10px] text-cv-accent-ink font-semibold mt-1">
                        <Check className="h-3 w-3" />
                        Selected
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-cv-fg-2 block">Study Purpose</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Operating Systems group project prep"
              className="w-full rounded-xl bg-cv-inset border border-cv-line px-3 py-2 text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-cv-inset border border-cv-accent-soft-line p-3.5 space-y-2 text-xs">
          <div className="font-semibold text-cv-fg">Review Discussion Room Booking</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="text-[11px] text-cv-fg-3 block">Room</span>
              <span className="font-medium text-cv-fg">
                {selectedRoom?.name} ({selectedRoom?.floor})
              </span>
            </div>
            <div>
              <span className="text-[11px] text-cv-fg-3 block">Schedule (IST)</span>
              <span className="font-medium text-cv-fg">
                {date} &bull; {to12h(startTime)} – {to12h(endTime)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-cv-fg-3 block">Group Size</span>
              <span className="font-medium text-cv-fg">{people} people</span>
            </div>
            <div>
              <span className="text-[11px] text-cv-fg-3 block">Purpose</span>
              <span className="font-medium text-cv-fg">{purpose}</span>
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
            <span>Edit</span>
          </button>
        )}
        {step === "edit" ? (
          <button
            type="button"
            disabled={Boolean(windowError) || !selectedRoom || loadingRooms}
            onClick={handleReview}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <span>Review &amp; Book</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>Submit Room Booking</span>
          </button>
        )}
      </div>
    </div>
  );
}
