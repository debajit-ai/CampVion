"use client";

import React from "react";
import Image from "next/image";
import {
  Activity,
  BarChart3,
  BookOpen,
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
    <header className="border-b border-cv-line bg-cv-surface/95 backdrop-blur-md sticky top-0 z-50">
      {/* Top Primary Bar */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="relative h-9 w-9 rounded-lg campvion-emblem-surface p-1 flex items-center justify-center shrink-0">
            <Image
              src="/brand/campvion-symbol.png"
              alt="CampVion Emblem"
              width={26}
              height={26}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-cv-fg">
                CampVion
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-cv-accent-soft border border-cv-line text-cv-accent-ink font-medium">
                Ops Console
              </span>
              <span className="text-[11px] font-mono text-cv-fg-3 hidden sm:inline">
                {versionText}
              </span>
            </div>
            <p className="text-[11px] text-cv-fg-2 truncate hidden md:block">
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
              className="hidden lg:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono bg-cv-warning-solid/10 border border-cv-warning/30 text-cv-warning hover:bg-cv-warning-solid/15 transition cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5 animate-pulse" />
              <span>Approval Gate Active</span>
            </button>
          )}

          {/* Backend Connection Badge */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${
              isOnline
                ? "bg-cv-success-solid/10 border-cv-success/30 text-cv-success"
                : "bg-cv-error-solid/10 border-cv-error/30 text-cv-error"
            }`}
          >
            {isOnline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cv-success-solid opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cv-success-solid" />
                </span>
                <span className="font-medium">Backend Online</span>
                {typeof healthLatencyMs === "number" && healthLatencyMs >= 0 && (
                  <span className="text-[10px] text-cv-fg-2 border-l border-cv-line pl-2 hidden sm:inline">
                    {healthLatencyMs}ms
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-cv-error" />
                <span className="font-medium">Backend Offline</span>
              </>
            )}
            <button
              type="button"
              onClick={onRefreshHealth}
              disabled={healthLoading}
              title="Ping backend health endpoint"
              aria-label="Ping backend health endpoint"
              className="ml-1 p-0.5 text-cv-fg-3 hover:text-cv-fg rounded transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${healthLoading ? "animate-spin text-cv-accent-ink" : ""}`} />
            </button>
          </div>

          {/* Swagger API Docs Link */}
          <a
            href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cv-inset border border-cv-line hover:border-cv-accent-line/45 text-cv-fg hover:bg-cv-raised transition"
          >
            <BookOpen className="h-3.5 w-3.5 text-cv-accent-ink" />
            <span className="hidden sm:inline">API Docs</span>
          </a>
        </div>
      </div>

      {/* Secondary Navigation Bar */}
      {onSelectSection && (
        <div className="border-t border-cv-line bg-cv-inset/95 backdrop-blur-md">
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
                        ? "bg-cv-accent-soft text-cv-accent-ink border border-cv-line font-semibold shadow-xs"
                        : "text-cv-fg-2 hover:text-cv-fg hover:bg-cv-raised border border-transparent"
                    }`}
                  >
                    <span className={isActive ? "text-cv-accent-ink" : "text-cv-fg-3"}>
                      {item.icon}
                    </span>
                    <span className="hidden md:inline">{item.label}</span>
                    <span className="md:hidden">{item.shortLabel}</span>

                    {item.alert && (
                      <span className="h-2 w-2 rounded-full bg-cv-warning-solid animate-pulse" />
                    )}

                    {item.badge !== undefined && item.badge !== null && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                          isActive
                            ? "bg-cv-accent text-cv-on-accent"
                            : "bg-cv-surface text-cv-fg-2 border border-cv-line"
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
            <div className="hidden xl:flex items-center space-x-3 text-[11px] font-mono text-cv-fg-2 shrink-0">
              <span className="flex items-center space-x-1.5 text-cv-fg">
                <Activity className="h-3 w-3 text-cv-accent-ink" />
                <span>ENGINE: DETERMINISTIC DAG</span>
              </span>
              <span className="text-cv-line-strong">|</span>
              <span>MAX REPLANS: 3</span>
              <span className="text-cv-line-strong">|</span>
              <span>SQLITE AUDIT TRACE</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
