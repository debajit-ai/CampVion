"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Download, ExternalLink, Loader2, Printer, ShieldCheck, X } from "lucide-react";
import type { LeaveRequestItem } from "../types/api";
import { safeParseResponse } from "../lib/api";

interface LeaveSlipPreviewProps {
  request: LeaveRequestItem;
  onClose: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function downloadLeaveSlipPdf(req: LeaveRequestItem): Promise<string | null> {
  const slipUrl = `${API_BASE}/requests/${req.id}/slip.pdf`;
  const res = await fetch(slipUrl, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const parsed = await safeParseResponse(res, slipUrl);
    return parsed.errorMessage || "Unable to download slip.";
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `CampVion-${req.slip_no || req.leave_code || `slip-${req.id}`}.pdf`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return null;
}

export function LeaveSlipPreview({ request, onClose }: LeaveSlipPreviewProps) {
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setErrorMsg(null);
    const err = await downloadLeaveSlipPdf(request);
    if (err) setErrorMsg(err);
    setDownloading(false);
  };

  const verifyPath = request.verify_code ? `/verify/${encodeURIComponent(request.verify_code)}` : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar (hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-slate-100 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span>Official Leave Slip Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            {verifyPath && (
              <a
                href={verifyPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-blue-700 text-xs font-medium"
              >
                <span>Verify</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close slip preview"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 print:hidden">
            {errorMsg}
          </div>
        )}

        {/* Always-White Printable A4-Style Pass */}
        <div className="p-6 sm:p-8 space-y-5 bg-white text-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <Image
                src="/brand/campvion-lockup-dark.png"
                alt="CampVion"
                width={136}
                height={36}
                className="h-8 w-auto object-contain"
              />
              <h2 className="text-lg font-bold tracking-tight text-slate-900 pt-1">
                OFFICIAL CAMPUS LEAVE PASS
              </h2>
              <p className="text-xs text-slate-600">
                {request.college || request.student_college || "Lovely Professional University"}
              </p>
            </div>
            <div className="text-right space-y-1.5">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-800">
                {request.status}
              </span>
              <div className="font-mono text-xs text-slate-600">
                SLIP: <span className="font-semibold text-slate-900">{request.slip_no || request.leave_code}</span>
              </div>
              <div className="font-mono text-[11px] text-slate-500">
                REF: {request.leave_code}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Student Name</span>
              <span className="font-semibold text-slate-900 text-sm">{request.student_name}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Student ID</span>
              <span className="font-mono font-semibold text-slate-900">{request.student_id}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Course &amp; Residence</span>
              <span className="font-medium text-slate-800">
                {request.student_program || "Academic Program"} &bull; {request.student_residence_label || "Registered Student"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">College</span>
              <span className="font-medium text-slate-800">
                {request.college || request.student_college || "Lovely Professional University"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4 text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">From (IST)</span>
              <span className="font-semibold text-slate-900">
                {request.from_display || request.start_date}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">To (IST)</span>
              <span className="font-semibold text-slate-900">
                {request.to_display || request.end_date}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Leave Type &amp; Duration</span>
              <span className="font-medium text-slate-800 capitalize">
                {request.category.replace("_", " ")} ({request.days_count} {request.days_count === 1 ? "day" : "days"})
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Destination</span>
              <span className="font-medium text-slate-800">{request.destination || "Not specified"}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Reason</span>
              <span className="text-slate-800">{request.reason}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold block">
                Authorized Exit Gate
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {request.exit_gate || "Gate 1 - Main Gate"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold block">
                Authorized Entry Gate
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {request.entry_gate || request.exit_gate || "Gate 1 - Main Gate"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Approved By</span>
              <span className="font-semibold text-slate-900">
                {request.decided_by_name || request.assigned_approver} ({request.approver_role})
              </span>
              {request.approved_at_display && (
                <div className="text-slate-600">{request.approved_at_display}</div>
              )}
              {request.decision_comment && (
                <div className="text-slate-700 italic">&ldquo;{request.decision_comment}&rdquo;</div>
              )}
            </div>
            {request.verify_code && (
              <div className="text-right space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                  Security Verify Code
                </span>
                <span className="font-mono font-semibold text-slate-900">{request.verify_code}</span>
                {verifyPath && (
                  <div className="text-[11px] text-blue-700 font-medium">
                    Scan QR in PDF or visit {verifyPath}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
