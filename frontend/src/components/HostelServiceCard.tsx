"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BedDouble,
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Send,
} from "lucide-react";
import { apiClient, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useEvents } from "../context/EventsContext";
import type { HostelBlockRoomItem, LeaveRequestItem } from "../types/api";
import { RequestStatusCard } from "./RequestStatusCard";

export interface HostelServicePrefill {
  current_block?: string;
  current_room?: string;
  preferred_block?: string;
}

interface HostelServiceCardProps {
  mode: "room_change" | "room_booking";
  prefill?: HostelServicePrefill;
  onSubmitted?: (req: LeaveRequestItem) => void;
}

const HOSTEL_BLOCKS = ["BH-1", "BH-2", "GH-1", "GH-2"];

function defaultMoveInDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function HostelServiceCard({
  mode,
  prefill,
  onSubmitted,
}: HostelServiceCardProps) {
  const { user, refreshSession } = useAuth();
  const { upsertLiveLeave } = useEvents();

  const isChange = mode === "room_change";
  const [currentBlock, setCurrentBlock] = useState(
    prefill?.current_block || user?.hostel_block || "BH-1"
  );
  const [currentRoom, setCurrentRoom] = useState(
    prefill?.current_room || user?.hostel_room || "302"
  );
  const [preferredBlock, setPreferredBlock] = useState(prefill?.preferred_block || "BH-1");
  const [sharingType, setSharingType] = useState<"single" | "double" | "triple">("double");
  const [acType, setAcType] = useState<"AC" | "Non-AC">("AC");
  const [moveInDate, setMoveInDate] = useState(defaultMoveInDate);
  const [roommatePref, setRoommatePref] = useState("");
  const [reason, setReason] = useState("");

  const [availableRooms, setAvailableRooms] = useState<HostelBlockRoomItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [step, setStep] = useState<"edit" | "review" | "submitted">("edit");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<LeaveRequestItem | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingRooms(true);
      try {
        const res = await apiClient.listHostelRooms({ available_only: true });
        if (active) setAvailableRooms(res.items || []);
      } catch {
        // optional availability hint
      } finally {
        if (active) setLoadingRooms(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const matchingVacantCount = useMemo(
    () =>
      availableRooms.filter(
        (r) =>
          (preferredBlock === "Any Available" || r.block === preferredBlock) &&
          r.sharing_type === sharingType &&
          r.ac_type === acType
      ).length,
    [availableRooms, preferredBlock, sharingType, acType]
  );

  const handleReview = () => {
    if (reason.trim().length < 3) {
      setErrorMsg("Please explain your reason or room preference (at least 3 characters).");
      return;
    }
    setErrorMsg(null);
    setStep("review");
  };

  const handleSubmit = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.submitCampusRequest({
        request_type: "hostel_allocation",
        sub_type: mode,
        preferred_block: preferredBlock,
        sharing_type: sharingType,
        ac_type: acType,
        start_date: moveInDate,
        reason: reason.trim(),
        details: {
          sub_type: mode,
          current_block: isChange ? currentBlock.trim() : undefined,
          current_room: isChange ? currentRoom.trim() : undefined,
          preferred_block: preferredBlock,
          requested_block: preferredBlock,
          sharing_type: sharingType,
          ac_type: acType,
          move_in_date: moveInDate,
          roommate_preference: roommatePref.trim() || undefined,
        },
      });
      upsertLiveLeave(res.request);
      setCreatedRequest(res.request);
      setStep("submitted");
      onSubmitted?.(res.request);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setErrorMsg(e.message);
      } else {
        setErrorMsg(e instanceof Error ? e.message : "Hostel request failed.");
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
          <span>
            {isChange ? "Hostel room change request sent to Warden" : "Hostel room booking sent to Warden"}
          </span>
        </div>
        <RequestStatusCard
          initialRequest={createdRequest}
          allowCancel
          onUpdated={(updated) => {
            setCreatedRequest(updated);
            upsertLiveLeave(updated);
            if (updated.status === "APPROVED") {
              void refreshSession();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-cv-surface border border-cv-line p-4 sm:p-5 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-cv-line">
        <div className="flex items-center gap-2">
          <BedDouble className="h-4 w-4 text-cv-accent-ink shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-cv-fg">
              {isChange ? "Hostel Room Change Request" : "Hostel Room Booking"}
            </h4>
            <p className="text-xs text-cv-fg-2">
              {isChange
                ? "Request a room transfer reviewed and allotted by your Hostel Warden."
                : "Apply for campus hostel accommodation and room preferences."}
            </p>
          </div>
        </div>
        {!loadingRooms && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-cv-inset border border-cv-line text-cv-fg-2">
            <Building2 className="h-3 w-3 text-cv-accent-ink" />
            <span>
              {matchingVacantCount > 0
                ? `${matchingVacantCount} matching room(s) vacant`
                : `${availableRooms.length} total vacant rooms`}
            </span>
          </span>
        )}
      </div>

      {step === "edit" ? (
        <div className="space-y-3.5 text-xs">
          {isChange && (
            <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-cv-inset border border-cv-line p-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-cv-fg-2 block">Current Block</label>
                <input
                  type="text"
                  value={currentBlock}
                  onChange={(e) => setCurrentBlock(e.target.value)}
                  className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-1.5 text-xs text-cv-fg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-cv-fg-2 block">Current Room</label>
                <input
                  type="text"
                  value={currentRoom}
                  onChange={(e) => setCurrentRoom(e.target.value)}
                  className="w-full rounded-lg bg-cv-surface border border-cv-line px-2.5 py-1.5 text-xs text-cv-fg"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-cv-fg-2 block">Preferred Block</label>
              <select
                value={preferredBlock}
                onChange={(e) => setPreferredBlock(e.target.value)}
                aria-label="Preferred Block"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
              >
                <option value="Any Available">Any Available</option>
                {HOSTEL_BLOCKS.map((blk) => (
                  <option key={blk} value={blk}>
                    {blk}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-cv-fg-2 block">Sharing Type</label>
              <select
                value={sharingType}
                onChange={(e) => setSharingType(e.target.value as "single" | "double" | "triple")}
                aria-label="Sharing Type"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
              >
                <option value="single">Single Seater</option>
                <option value="double">Double Sharing</option>
                <option value="triple">Triple Sharing</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-cv-fg-2 block">Room Type</label>
              <select
                value={acType}
                onChange={(e) => setAcType(e.target.value as "AC" | "Non-AC")}
                aria-label="Room Type"
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-2.5 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
              >
                <option value="AC">AC</option>
                <option value="Non-AC">Non-AC</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {isChange ? (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-cv-fg-2 block">
                  Roommate Preference <span className="text-cv-fg-3">(optional)</span>
                </label>
                <input
                  type="text"
                  value={roommatePref}
                  onChange={(e) => setRoommatePref(e.target.value)}
                  placeholder="e.g., Quiet study schedule / friend's ID"
                  className="w-full rounded-xl bg-cv-inset border border-cv-line px-3 py-2 text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-cv-fg-2 block">Preferred Move-In Date</label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  aria-label="Move-in date"
                  className="w-full rounded-xl bg-cv-inset border border-cv-line px-3 py-2 text-xs text-cv-fg focus:outline-none focus:border-cv-accent-line"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-cv-fg-2 block">
                {isChange ? "Reason for Room Change" : "Reason / Special Notes"}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isChange
                    ? "e.g., Need single AC room for thesis prep"
                    : "e.g., Semester hostel room allotment"
                }
                className="w-full rounded-xl bg-cv-inset border border-cv-line px-3 py-2 text-xs text-cv-fg placeholder-cv-fg-3 focus:outline-none focus:border-cv-accent-line"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-cv-inset border border-cv-accent-soft-line p-3.5 space-y-2 text-xs">
          <div className="font-semibold text-cv-fg">
            Review {isChange ? "Room Change" : "Hostel Booking"} Details
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {isChange && (
              <div>
                <span className="text-[11px] text-cv-fg-3 block">Current Room</span>
                <span className="font-medium text-cv-fg">
                  {currentBlock} &bull; Room {currentRoom}
                </span>
              </div>
            )}
            <div>
              <span className="text-[11px] text-cv-fg-3 block">Requested Preference</span>
              <span className="font-medium text-cv-fg">
                {preferredBlock} &bull; {sharingType} {acType}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-cv-fg-3 block">Reason</span>
              <span className="font-medium text-cv-fg">{reason}</span>
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
            <span>Submit Request</span>
          </button>
        )}
      </div>
    </div>
  );
}
