"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { apiClient } from "../../../lib/api";
import type { LeaveSlipVerifyResponse } from "../../../types/api";

export default function VerifyLeaveSlipPage() {
  const params = useParams();
  const code = typeof params?.code === "string" ? params.code : Array.isArray(params?.code) ? params.code[0] : "";

  const [data, setData] = useState<LeaveSlipVerifyResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(code));
  const [error, setError] = useState<string | null>(code ? null : "No verification code supplied.");

  useEffect(() => {
    if (!code) return;
    let active = true;
    (async () => {
      try {
        const res = await apiClient.verifyLeaveSlip(code);
        if (active) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to verify pass right now.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  const statusKey = data?.status || "NOT_FOUND";

  return (
    <div className="min-h-screen bg-cv-canvas text-cv-fg flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl bg-cv-surface border border-cv-line p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-cv-line pb-4">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/campvion-symbol.png"
              alt="CampVion"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-contain"
            />
            <div>
              <h1 className="text-sm font-semibold text-cv-fg">CampVion Gate Verification</h1>
              <p className="text-[11px] text-cv-fg-2">Official Slip Authenticity Check</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-cv-fg-2 hover:text-cv-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Home</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-xs text-cv-fg-2">
            <Loader2 className="h-6 w-6 animate-spin text-cv-accent-ink" />
            <span>Verifying slip authenticity...</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-cv-error-soft border border-cv-error-line p-5 text-center space-y-2">
            <ShieldAlert className="h-7 w-7 text-cv-error mx-auto" />
            <div className="text-sm font-semibold text-cv-error">Verification Unavailable</div>
            <p className="text-xs text-cv-fg-2">{error}</p>
          </div>
        ) : statusKey === "VALID" && data ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-cv-success-soft border border-cv-success-line p-4 flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-cv-success shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-cv-success">VALID LEAVE PASS</div>
                <p className="text-xs text-cv-fg-2 mt-0.5">{data.message}</p>
              </div>
            </div>

            <SlipPublicSummary data={data} />
          </div>
        ) : statusKey === "EXPIRED" && data ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-cv-warning-soft border border-cv-warning-line p-4 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-cv-warning shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-cv-warning">EXPIRED</div>
                <p className="text-xs text-cv-fg-2 mt-0.5">{data.message}</p>
              </div>
            </div>
            <SlipPublicSummary data={data} />
          </div>
        ) : statusKey === "REVOKED" && data ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-cv-error-soft border border-cv-error-line p-4 flex items-start gap-3">
              <ShieldX className="h-6 w-6 text-cv-error shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-cv-error">REVOKED / CANCELLED</div>
                <p className="text-xs text-cv-fg-2 mt-0.5">{data.message}</p>
              </div>
            </div>
            <SlipPublicSummary data={data} />
          </div>
        ) : (
          <div className="rounded-2xl bg-cv-inset border border-cv-line p-6 text-center space-y-2">
            <ShieldCheck className="h-7 w-7 text-cv-fg-3 mx-auto" />
            <div className="text-sm font-semibold text-cv-fg">NOT FOUND</div>
            <p className="text-xs text-cv-fg-2">
              {data?.message || "No leave slip or campus pass matches this verification code."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SlipPublicSummary({ data }: { data: LeaveSlipVerifyResponse }) {
  return (
    <div className="rounded-2xl bg-cv-inset border border-cv-line p-4 space-y-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">Slip Number</span>
          <span className="font-mono font-bold text-cv-fg">{data.slip_no || data.request_code || "—"}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">Student</span>
          <span className="font-semibold text-cv-fg">
            {data.student_name} ({data.student_id})
          </span>
        </div>
        <div className="sm:col-span-2">
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">College</span>
          <span className="font-medium text-cv-fg">{data.college || "—"}</span>
        </div>
      </div>

      <div className="border-t border-cv-line pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-cv-accent-ink" />
            <span>From (IST)</span>
          </span>
          <span className="font-medium text-cv-fg block mt-0.5">{data.from_display || "—"}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-cv-accent-ink" />
            <span>To (IST)</span>
          </span>
          <span className="font-medium text-cv-fg block mt-0.5">{data.to_display || "—"}</span>
        </div>
      </div>

      {(data.exit_gate || data.entry_gate) && (
        <div className="border-t border-cv-line pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">Exit Gate</span>
            <span className="font-semibold text-cv-fg">{data.exit_gate || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-cv-fg-3 block">Entry Gate</span>
            <span className="font-semibold text-cv-fg">{data.entry_gate || "—"}</span>
          </div>
        </div>
      )}

      {data.approved_by && (
        <div className="border-t border-cv-line pt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cv-fg-2">
          <span>
            Approved by <strong className="text-cv-fg">{data.approved_by}</strong>
            {data.approver_role ? ` (${data.approver_role})` : ""}
          </span>
          {data.approved_at_display && <span>{data.approved_at_display}</span>}
        </div>
      )}
    </div>
  );
}
