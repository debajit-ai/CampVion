"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { apiClient } from "../lib/api";
import { LeaveRequestItem } from "../types/api";
import { useEvents } from "../context/EventsContext";

function formatWaitingDuration(submittedIso?: string | null): string {
  if (!submittedIso) return "Waiting just now";
  const ts = new Date(submittedIso).getTime();
  if (Number.isNaN(ts)) return "Pending review";
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return "Waiting <1 min";
  if (mins < 60) return `Waiting ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `Waiting ${hrs}h ${rem}m` : `Waiting ${hrs}h`;
}

export function ContactAuthorityCard({ request }: { request: LeaveRequestItem }) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const contact = request.authority_contact || {
    name: request.assigned_approver || "Dr. Rajesh Rao",
    title: request.approver_role || request.routed_to_role || "Warden",
    email: "admin@campvion.edu",
    phone: "+91 98765 01042",
    office: "Hostel Block A, Warden Office",
    office_hours: "Mon-Fri 10:00-16:00",
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <div className="mt-3 rounded-xl bg-cv-surface border border-cv-line p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-cv-fg-3">
          Contact Authority
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cv-inset border border-cv-line text-cv-accent-ink">
          {contact.title}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-cv-fg">{contact.name}</div>
          <div className="text-[11px] text-cv-fg-2 flex items-center gap-1.5 mt-0.5">
            <Building2 className="h-3 w-3 text-cv-fg-3 shrink-0" />
            <span>{contact.office || "Warden Office"}</span>
          </div>
        </div>
        {contact.office_hours && (
          <div className="text-[11px] text-cv-fg-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-cv-fg-3 shrink-0" />
            <span>{contact.office_hours}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <a
          href={`mailto:${contact.email}?subject=${encodeURIComponent(
            `Regarding Leave Request ${request.leave_code}`
          )}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cv-inset hover:bg-cv-raised border border-cv-line text-[11px] font-medium text-cv-fg transition"
        >
          <Mail className="h-3 w-3 text-cv-accent-ink" />
          <span>{contact.email}</span>
        </a>

        <button
          type="button"
          onClick={handleCopyEmail}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-cv-inset hover:bg-cv-raised border border-cv-line text-[11px] text-cv-fg-2 hover:text-cv-fg transition cursor-pointer"
        >
          {copiedEmail ? (
            <>
              <Check className="h-3 w-3 text-cv-success" />
              <span className="text-cv-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy Email</span>
            </>
          )}
        </button>

        {contact.phone && (
          <a
            href={`tel:${contact.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cv-inset hover:bg-cv-raised border border-cv-line text-[11px] font-medium text-cv-fg transition"
          >
            <Phone className="h-3 w-3 text-cv-accent-ink" />
            <span>{contact.phone}</span>
          </a>
        )}
      </div>
    </div>
  );
}

interface RequestStatusCardProps {
  initialRequest: LeaveRequestItem;
  allowCancel?: boolean;
  onPrefillNewRequest?: (prompt: string) => void;
  onUpdated?: (updated: LeaveRequestItem) => void;
}

export function RequestStatusCard({
  initialRequest,
  allowCancel = true,
  onPrefillNewRequest,
  onUpdated,
}: RequestStatusCardProps) {
  const { liveLeaveById, liveLeaveByWorkflowId, upsertLiveLeave } = useEvents();
  const [cancelling, setCancelling] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flashHighlight, setFlashHighlight] = useState(false);
  const [, setTick] = useState(0);

  const liveMatch =
    liveLeaveById[initialRequest.id] ||
    (initialRequest.workflow_run_id
      ? liveLeaveByWorkflowId[initialRequest.workflow_run_id]
      : undefined);

  const req = liveMatch || initialRequest;
  const prevStatusRef = useRef(req.status);

  useEffect(() => {
    if (prevStatusRef.current !== req.status) {
      prevStatusRef.current = req.status;
      setFlashHighlight(true);
      const t = setTimeout(() => setFlashHighlight(false), 1800);
      return () => clearTimeout(t);
    }
  }, [req.status]);

  // Live minute ticker while pending
  useEffect(() => {
    if (req.status !== "PENDING_APPROVAL") return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [req.status]);

  const handleCancel = async () => {
    setCancelling(true);
    setActionError(null);
    try {
      const res = await apiClient.cancelLeaveRequest(req.id, { version: req.version });
      upsertLiveLeave(res.request);
      onUpdated?.(res.request);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Could not cancel leave request."
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(req.leave_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  const isPending = req.status === "PENDING_APPROVAL";
  const isApproved = req.status === "APPROVED";
  const isRejected = req.status === "REJECTED";
  const isCancelled = req.status === "CANCELLED";

  const borderClass = isApproved
    ? "border-cv-success-line bg-cv-success-soft/40"
    : isRejected
    ? "border-cv-error-line bg-cv-error-soft/40"
    : isPending
    ? "border-cv-warning-line bg-cv-inset"
    : "border-cv-line bg-cv-inset";

  return (
    <div
      className={`rounded-2xl border p-4 shadow-xs space-y-3 transition-all duration-500 ${borderClass} ${
        flashHighlight ? "ring-2 ring-cv-accent-line" : ""
      }`}
    >
      {/* Top Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-cv-line">
        <div className="flex items-center gap-2 min-w-0">
          {isPending && (
            <ShieldAlert className="h-4 w-4 text-cv-warning shrink-0 animate-pulse" />
          )}
          {isApproved && (
            <CheckCircle2 className="h-4 w-4 text-cv-success shrink-0" />
          )}
          {isRejected && (
            <XCircle className="h-4 w-4 text-cv-error shrink-0" />
          )}
          {isCancelled && (
            <RotateCcw className="h-4 w-4 text-cv-fg-3 shrink-0" />
          )}
          <span className="font-mono text-xs font-bold text-cv-fg">
            {req.leave_code}
          </span>
          <span className="text-xs text-cv-fg-2 capitalize">
            &bull; {req.category.replace("_", " ")} Leave
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPending && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cv-warning-soft border border-cv-warning-line text-cv-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-cv-warning animate-ping" />
              <span>Pending approval</span>
            </span>
          )}
          {isApproved && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cv-success-soft border border-cv-success-line text-cv-success">
              <span>Approved</span>
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cv-error-soft border border-cv-error-line text-cv-error">
              <span>Rejected</span>
            </span>
          )}
          {isCancelled && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cv-raised border border-cv-line text-cv-fg-2">
              <span>Withdrawn</span>
            </span>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2 rounded-xl bg-cv-surface border border-cv-line">
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">
            Dates
          </span>
          <span className="font-medium text-cv-fg flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3 text-cv-accent-ink shrink-0" />
            <span>
              {req.start_date === req.end_date
                ? req.start_date
                : `${req.start_date} \u2192 ${req.end_date}`}
            </span>
          </span>
        </div>

        <div className="p-2 rounded-xl bg-cv-surface border border-cv-line">
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">
            Duration
          </span>
          <span className="font-medium text-cv-fg mt-0.5 block">
            {req.days_count} {req.days_count === 1 ? "day" : "days"}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-cv-surface border border-cv-line">
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">
            Routed To
          </span>
          <span className="font-medium text-cv-fg mt-0.5 block truncate">
            {req.assigned_approver} ({req.approver_role})
          </span>
        </div>

        <div className="p-2 rounded-xl bg-cv-surface border border-cv-line">
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">
            {isPending ? "Queue Time" : "Attendance Snapshot"}
          </span>
          <span className="font-medium text-cv-fg mt-0.5 block">
            {isPending
              ? formatWaitingDuration(req.submitted_at || req.created_at)
              : req.attendance_snapshot !== null && req.attendance_snapshot !== undefined
              ? `${Math.round(req.attendance_snapshot)}%`
              : "Verified"}
          </span>
        </div>
      </div>

      {/* Reason */}
      <div className="text-xs text-cv-fg-2">
        <span className="font-semibold text-cv-fg">Reason:</span> {req.reason}
      </div>

      {/* Status-specific outcome panel */}
      {isApproved && (
        <div className="rounded-xl bg-cv-surface border border-cv-success-line p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-cv-success flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />
              <span>
                Approved by {req.decided_by_name || req.assigned_approver}
              </span>
            </span>
            {req.decided_at && (
              <span className="text-[11px] text-cv-fg-3">
                {new Date(req.decided_at).toLocaleString()}
              </span>
            )}
          </div>
          {req.decision_comment && (
            <p className="text-cv-fg-2">{req.decision_comment}</p>
          )}
        </div>
      )}

      {isRejected && (
        <div className="space-y-2">
          <div className="rounded-xl bg-cv-surface border border-cv-error-line p-3 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-cv-error">
                Declined by {req.decided_by_name || req.assigned_approver}
              </span>
              {req.decided_at && (
                <span className="text-[11px] text-cv-fg-3">
                  {new Date(req.decided_at).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-cv-fg font-medium">
              {req.rejection_reason || req.decision_comment || "No rejection note supplied."}
            </p>
          </div>
          <ContactAuthorityCard request={req} />
        </div>
      )}

      {actionError && (
        <div className="text-xs text-cv-error bg-cv-error-soft border border-cv-error-line rounded-lg px-3 py-2">
          {actionError}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-cv-fg-3">
          {isPending
            ? "You will see an automatic live update here once reviewed."
            : isApproved
            ? "Leave authorization recorded in university registry."
            : isRejected
            ? "Zero leave balance was consumed."
            : "This request was withdrawn before review."}
        </span>

        <div className="flex items-center gap-2">
          {isPending && allowCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cv-surface hover:bg-cv-error-soft text-cv-fg-2 hover:text-cv-error border border-cv-line hover:border-cv-error-line text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              {cancelling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              <span>Cancel Request</span>
            </button>
          )}

          {isApproved && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cv-surface hover:bg-cv-raised border border-cv-line text-xs font-medium text-cv-fg transition cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3.5 w-3.5 text-cv-success" />
                  <span className="text-cv-success">Copied {req.leave_code}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-cv-accent-ink" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          )}

          {(isRejected || isCancelled) && onPrefillNewRequest && (
            <button
              type="button"
              onClick={() =>
                onPrefillNewRequest(
                  `I want to submit a new ${req.category} leave request for ${req.days_count} days.`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cv-accent hover:bg-cv-accent-hover text-cv-on-accent text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Submit New Request</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
