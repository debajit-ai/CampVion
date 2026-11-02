"use client";

import React from "react";
import Image from "next/image";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Terminal,
  Wrench,
} from "lucide-react";
import {
  HealthResponse,
  WorkflowSessionSummary,
  WorkspaceSection,
} from "../types/api";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  recentRequestIds: number[];
  activeRequestId: number | null;
  sessionSummaries: Record<number, WorkflowSessionSummary>;
  onSelectRequestId: (id: number) => void;
  onNewRequest: () => void;
  health: HealthResponse | null;
  healthLoading: boolean;
  healthLatencyMs: number | null;
  onRefreshHealth: () => void;
  apiBaseUrl: string;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  activeSection,
  onSelectSection,
  recentRequestIds,
  activeRequestId,
  sessionSummaries,
  onSelectRequestId,
  onNewRequest,
  health,
  healthLoading,
  healthLatencyMs,
  onRefreshHealth,
  apiBaseUrl,
}: SidebarProps) {
  const isOnline = health?.status === "healthy";

  const navItems = [
    {
      id: "chat" as WorkspaceSection,
      label: "Conversational Assistant",
      shortLabel: "Chat",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: "workspace" as WorkspaceSection,
      label: "Workflow Pipeline (DAG)",
      shortLabel: "Workflow",
      icon: <Layers className="h-4 w-4" />,
    },
    {
      id: "observability" as WorkspaceSection,
      label: "Decision Traces & Logs",
      shortLabel: "Traces",
      icon: <Terminal className="h-4 w-4" />,
    },
    {
      id: "evaluation" as WorkspaceSection,
      label: "Evaluation & Reliability",
      shortLabel: "Evaluation",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      id: "registry" as WorkspaceSection,
      label: "Tool Registry & Schemas",
      shortLabel: "Tools",
      icon: <Wrench className="h-4 w-4" />,
    },
  ];

  return (
    <aside
      aria-label="CampVion Navigation Sidebar"
      className={`relative flex flex-col h-full bg-[#FFFFFF] border-r border-[#E8E2D9] transition-all duration-300 ease-in-out shrink-0 z-30 select-none ${
        isCollapsed ? "w-16" : "w-64 sm:w-72"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-[#E8E2D9]">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="relative h-9 w-9 rounded-xl campvion-emblem-surface p-1 flex items-center justify-center shrink-0 shadow-2xs">
            <Image
              src="/brand/campvion-symbol.png"
              alt="CampVion Emblem"
              width={26}
              height={26}
              className="h-full w-full object-contain"
            />
            <span
              className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${
                isOnline ? "bg-[#287A53]" : "bg-[#C44E45]"
              }`}
            />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-semibold tracking-tight text-[#26231F]">
                  Camp<span className="text-[#C66A43]">Vion</span>
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-[#F0ECE5] text-[#77716A]">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-[#77716A] truncate">
                Campus Operations AI
              </p>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-lg text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] border border-transparent hover:border-[#E8E2D9] transition cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* New Request Button */}
      <div className="p-3 border-b border-[#E8E2D9]">
        <button
          type="button"
          onClick={onNewRequest}
          className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold bg-[#F0ECE5] hover:bg-[#F5E7DE] text-[#26231F] hover:text-[#C66A43] border border-[#E8E2D9] hover:border-[#C66A43]/40 shadow-xs transition cursor-pointer group ${
            isCollapsed ? "px-0" : ""
          }`}
          title="Start New Request"
        >
          <Plus className="h-4 w-4 text-[#C66A43] group-hover:scale-110 transition-transform" />
          {!isCollapsed && <span>New Request</span>}
        </button>
      </div>

      {/* Primary Workspaces Navigation */}
      <div className="px-2 py-3 space-y-1">
        {!isCollapsed && (
          <span className="px-2.5 text-[10px] uppercase tracking-wider font-semibold text-[#77716A] block mb-1">
            Workspaces
          </span>
        )}
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                isActive
                  ? "bg-[#F5E7DE] text-[#C66A43] border border-[#E8CFC1] font-semibold"
                  : "text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] border border-transparent"
              } ${isCollapsed ? "justify-center px-0" : ""}`}
              title={item.label}
            >
              <div
                className={`shrink-0 ${
                  isActive ? "text-[#C66A43]" : "text-[#77716A]"
                }`}
              >
                {item.icon}
              </div>
              {!isCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          );
        })}

        {/* Swagger REST API Link */}
        <a
          href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] border border-transparent transition ${
            isCollapsed ? "justify-center px-0" : ""
          }`}
          title="Interactive OpenAPI / Swagger Documentation"
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-[#C66A43]" />
          {!isCollapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="truncate">Swagger API Docs</span>
              <span className="text-[9px] font-mono text-[#77716A]">REST</span>
            </div>
          )}
        </a>
      </div>

      {/* Recent Sessions List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 border-t border-[#E8E2D9]">
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2.5 mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#77716A]">
              Recent Sessions
            </span>
            <span className="text-[10px] font-mono text-[#77716A]">
              {recentRequestIds.length}
            </span>
          </div>
        )}

        {recentRequestIds.length === 0 ? (
          !isCollapsed && (
            <p className="px-2.5 py-4 text-xs text-[#77716A] text-center italic">
              No recent workflows. Submit a request to initiate.
            </p>
          )
        ) : (
          <div className="space-y-1">
            {recentRequestIds.map((id) => {
              const summary = sessionSummaries[id];
              const isSelected = activeRequestId === id;
              const status = summary?.status || "IDLE";

              const badgeColor =
                status === "COMPLETED"
                  ? "bg-[#EAF4EE] border-[#C8E3D4] text-[#287A53]"
                  : status === "WAITING_FOR_HUMAN"
                  ? "bg-[#FBF3E8] border-[#F0D9BC] text-[#B77932]"
                  : status === "FAILED"
                  ? "bg-[#FBEDED] border-[#F3CBC7] text-[#C44E45]"
                  : "bg-[#F5E7DE] border-[#E8CFC1] text-[#C66A43]";

              if (isCollapsed) {
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onSelectRequestId(id);
                      if (activeSection !== "chat") onSelectSection("chat");
                    }}
                    className={`w-full flex items-center justify-center p-2 rounded-lg transition cursor-pointer ${
                      isSelected
                        ? "bg-[#F5E7DE] text-[#C66A43] font-bold"
                        : "hover:bg-[#F0ECE5] text-[#77716A]"
                    }`}
                    title={`Workflow #${id} - ${summary?.goal || "Session"}`}
                  >
                    <span className="text-[10px] font-mono">#{id}</span>
                  </button>
                );
              }

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelectRequestId(id);
                    if (activeSection !== "chat") onSelectSection("chat");
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer group ${
                    isSelected
                      ? "bg-[#F5E7DE]/70 border-[#C66A43]/40 shadow-xs"
                      : "bg-[#FFFFFF] hover:bg-[#F0ECE5] border-[#E8E2D9]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-[#26231F] group-hover:text-[#C66A43] transition-colors">
                      Workflow #{id}
                    </span>
                    <span
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded border uppercase ${badgeColor}`}
                    >
                      {status === "WAITING_FOR_HUMAN" ? "APPROVAL" : status}
                    </span>
                  </div>
                  <p className="text-xs text-[#77716A] line-clamp-1">
                    {summary?.goal || `Request #${id}`}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-[#77716A] mt-1.5 pt-1 border-t border-[#E8E2D9]">
                    <span>{summary?.student_id || "Student"}</span>
                    <span>
                      {summary?.completed_count ?? 0}/{summary?.total_tasks ?? 6} tasks
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Utility Navigation: Settings & API Docs */}
      <div className="p-2 border-t border-[#E8E2D9] space-y-1">
        <button
          type="button"
          onClick={() => onSelectSection("settings")}
          title="Settings & Appearance"
          aria-label="Settings"
          aria-current={activeSection === "settings" ? "page" : undefined}
          className={`w-full flex items-center ${
            isCollapsed ? "justify-center px-2" : "space-x-3 px-3"
          } py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeSection === "settings"
              ? "bg-[#F5E7DE] text-[#C66A43] border border-[#E8CFC1] font-semibold"
              : "text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] border border-transparent"
          }`}
        >
          <Settings className="h-4 w-4 shrink-0 text-[#C66A43]" />
          {!isCollapsed && <span>Settings</span>}
        </button>

        <a
          href={`${apiBaseUrl.replace(/\/api$/, "")}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          title="API Documentation (Swagger UI)"
          className={`w-full flex items-center ${
            isCollapsed ? "justify-center px-2" : "space-x-3 px-3"
          } py-1.5 rounded-lg text-xs text-[#77716A] hover:text-[#26231F] hover:bg-[#F0ECE5] transition`}
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>API Docs</span>}
        </a>
      </div>

      {/* Sidebar Footer: System Status */}
      <div className="p-3 border-t border-[#E8E2D9] bg-[#FDFBF7]">
        <div
          className={`flex items-center justify-between gap-2 p-2 rounded-lg bg-[#F0ECE5] border border-[#E8E2D9] ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                isOnline ? "bg-[#287A53]" : "bg-[#C44E45]"
              }`}
            />
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-medium text-[#26231F] truncate">
                    {isOnline ? "Backend Online" : "Backend Offline"}
                  </span>
                  {healthLatencyMs !== null && (
                    <span className="text-[9px] font-mono text-[#77716A]">
                      {healthLatencyMs}ms
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#77716A] block truncate">
                  FastAPI &bull; SQLite
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={onRefreshHealth}
              disabled={healthLoading}
              aria-label="Refresh Backend Connection"
              className="p-1 rounded text-[#77716A] hover:text-[#C66A43] hover:bg-[#FFFFFF] transition cursor-pointer disabled:opacity-50"
              title="Ping Backend API"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  healthLoading ? "animate-spin text-[#C66A43]" : ""
                }`}
              />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
