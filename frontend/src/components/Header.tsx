"use client";

import React from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Cpu,
  Layers,
  LayoutGrid,
  RefreshCw,
  ShieldAlert,
  Terminal,
  WifiOff,
  Wrench,
} from "lucide-react";
import { HealthResponse, WorkspaceSection } from "../types/api";

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  healthLatencyMs?: number | null;
  onRefreshHealth: () => void;
  apiBaseUrl: string;
  activeSection?: WorkspaceSection;
  onSelectSection?: (section: WorkspaceSection) => void;
  pendingApproval?: boolean;
  traceCount?: number;
  toolCount?: number;
  activeRequestId?: number | null;
}

export function Header({
  health,
  healthLoading,
  healthLatencyMs,
  onRefreshHealth,
  apiBaseUrl,
  activeSection = "unified",
  onSelectSection,
  pendingApproval = false,
  traceCount = 0,
  toolCount = 0,
  activeRequestId = null,
}: HeaderProps) {
  const isOnline = health?.status === "healthy";
  const versionText = health?.version ? `v${health.version.replace(/^v/, "")}` : "v0.1.0";

  const navItems: {
    id: WorkspaceSection;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: string | number | null;
    alert?: boolean;
  }[] = [
    {
      id: "unified",
      label: "Operations Overview",
      shortLabel: "Overview",
      icon: <LayoutGrid className="h-3.5 w-3.5" />,
    },
    {
      id: "workspace",
      label: "Workflow Workspace",
      shortLabel: "Workspace",
      icon: <Layers className="h-3.5 w-3.5" />,
      badge: activeRequestId ? `#${activeRequestId}` : null,
      alert: pendingApproval,
    },
    {
      id: "observability",
      label: "Execution & Observability",
      shortLabel: "Observability",
      icon: <Terminal className="h-3.5 w-3.5" />,
      badge: traceCount > 0 ? traceCount : null,
    },
    {
      id: "evaluation",
      label: "Evaluation & Reliability",
      shortLabel: "Evaluation",
      icon: <BarChart3 className="h-3.5 w-3.5" />,
    },
    {
      id: "registry",
      label: "Tool Registry & System",
      shortLabel: "Tools & System",
      icon: <Wrench className="h-3.5 w-3.5" />,
      badge: toolCount > 0 ? toolCount : null,
    },
  ];

  return (
    <header className="border-b border-[#E8E2D9] bg-[#FFFFFF]/95 backdrop-blur-md sticky top-0 z-50">
      {/* Top Primary Bar */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="relative h-9 w-9 rounded-lg bg-[#F5E7DE] flex items-center justify-center border border-[#E8E2D9] shrink-0 text-[#C66A43]">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-[#26231F]">
                CampVion
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-[#F5E7DE] border border-[#E8E2D9] text-[#C66A43] font-medium">
                Ops Console
              </span>
              <span className="text-[11px] font-mono text-[#A0988F] hidden sm:inline">
                {versionText}
              </span>
            </div>
            <p className="text-[11px] text-[#77716A] truncate hidden md:block">
              Intelligent Campus Operations &bull; Agentic AI Assistant for Multi-Step Campus Service Workflows
            </p>
          </div>
        </div>

        {/* Status & System Controls */}
        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Pending Human Governance Alert Indicator */}
          {pendingApproval && (
            <button
              type="button"
              onClick={() => onSelectSection?.("workspace")}
              className="hidden lg:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono bg-[#B77932]/10 border border-[#B77932]/30 text-[#B77932] hover:bg-[#B77932]/15 transition cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5 animate-pulse" />
              <span>Approval Gate Active</span>
            </button>
          )}

          {/* Backend Connection Badge */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${
              isOnline
                ? "bg-[#287A53]/10 border-[#287A53]/30 text-[#287A53]"
                : "bg-[#C44E45]/10 border-[#C44E45]/30 text-[#C44E45]"
            }`}
          >
            {isOnline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#287A53] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#287A53]" />
                </span>
                <span className="font-medium">Backend Online</span>
                {typeof healthLatencyMs === "number" && healthLatencyMs >= 0 && (
                  <span className="text-[10px] text-[#77716A] border-l border-[#E8E2D9] pl-2 hidden sm:inline">
                    {healthLatencyMs}ms
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-[#C44E45]" />
                <span className="font-medium">Backend Offline</span>
              </>
            )}
            <button
              type="button"
              onClick={onRefreshHealth}
              disabled={healthLoading}
              title="Ping backend health endpoint"
              aria-label="Ping backend health endpoint"
              className="ml-1 p-0.5 text-[#A0988F] hover:text-[#26231F] rounded transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${healthLoading ? "animate-spin text-[#C66A43]" : ""}`} />
            </button>
          </div>

          {/* Swagger API Docs Link */}
          <a
            href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#C66A43]/45 text-[#26231F] hover:bg-[#F0ECE5] transition"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#C66A43]" />
            <span className="hidden sm:inline">API Docs</span>
          </a>
        </div>
      </div>

      {/* Secondary Navigation Bar */}
      {onSelectSection && (
        <div className="border-t border-[#E8E2D9] bg-[#FAF7F2]/95 backdrop-blur-md">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 overflow-x-auto">
            <nav aria-label="Workspace Navigation" className="flex items-center space-x-1 py-1.5">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-[#F5E7DE] text-[#C66A43] border border-[#E8E2D9] font-semibold shadow-xs"
                        : "text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] border border-transparent"
                    }`}
                  >
                    <span className={isActive ? "text-[#C66A43]" : "text-[#A0988F]"}>
                      {item.icon}
                    </span>
                    <span className="hidden md:inline">{item.label}</span>
                    <span className="md:hidden">{item.shortLabel}</span>

                    {item.alert && (
                      <span className="h-2 w-2 rounded-full bg-[#B77932] animate-pulse" />
                    )}

                    {item.badge !== undefined && item.badge !== null && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                          isActive
                            ? "bg-[#C66A43] text-white"
                            : "bg-[#FFFFFF] text-[#77716A] border border-[#E8E2D9]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Operational Engine Mode Indicator */}
            <div className="hidden xl:flex items-center space-x-3 text-[11px] font-mono text-[#77716A] shrink-0">
              <span className="flex items-center space-x-1.5 text-[#26231F]">
                <Activity className="h-3 w-3 text-[#C66A43]" />
                <span>ENGINE: DETERMINISTIC DAG</span>
              </span>
              <span className="text-[#DFD7CB]">|</span>
              <span>MAX REPLANS: 3</span>
              <span className="text-[#DFD7CB]">|</span>
              <span>SQLITE AUDIT TRACE</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
