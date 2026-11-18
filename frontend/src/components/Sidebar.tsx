"use client";

import React, { useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import {
  HealthResponse,
  UserProfile,
  WorkflowSessionSummary,
  WorkspaceSection,
} from "../types/api";
import { ExperienceMode, useTheme } from "../context/ThemeContext";
import {
  formatRelativeTime,
  formatRoleLabel,
  getUserInitials,
  toTitleCase,
} from "../utils/language";
import { BrandLogo } from "./BrandLogo";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
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
  user?: UserProfile | null;
  onLogout?: () => void;
  pendingApprovalsCount?: number;
  effectiveMode?: ExperienceMode;
}

interface NavItemConfig {
  id: WorkspaceSection;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
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
  user,
  onLogout,
  pendingApprovalsCount = 0,
  effectiveMode,
}: SidebarProps) {
  const { resolvedTheme, reducedMotion: contextReducedMotion, experienceMode } = useTheme();
  const osReducedMotion = Boolean(useReducedMotion());
  const disableMotion = contextReducedMotion || osReducedMotion;
  const isDark = resolvedTheme === "dark";
  const isOnline = health?.status === "healthy";

  const roleStr = (user?.role || "").toLowerCase();
  const isAdmin = roleStr === "administrator" || roleStr === "system_administrator";
  const isFaculty = roleStr === "faculty";
  const canUseAdvanced = isAdmin || isFaculty;
  const activeMode: ExperienceMode =
    effectiveMode ?? (canUseAdvanced ? experienceMode : "simple");

  const navButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const navItems: NavItemConfig[] = useMemo(() => {
    const items: NavItemConfig[] = [
      {
        id: "chat",
        label: "Assistant",
        icon: <MessageSquare className="h-4 w-4" />,
      },
      {
        id: "unified",
        label: "Overview",
        icon: <LayoutGrid className="h-4 w-4" />,
      },
    ];

    if (isAdmin || isFaculty) {
      items.push({
        id: "approvals",
        label: "Approval Queue",
        icon: <ShieldAlert className="h-4 w-4" />,
        badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      });
    }

    if (activeMode === "simple") {
      items.push({
        id: "observability",
        label: "Request History",
        icon: <Clock className="h-4 w-4" />,
      });
    } else {
      items.push(
        {
          id: "workspace",
          label: "Workflow Pipeline (DAG)",
          icon: <Layers className="h-4 w-4" />,
        },
        {
          id: "observability",
          label: "Decision Traces & Logs",
          icon: <Terminal className="h-4 w-4" />,
        },
        {
          id: "evaluation",
          label: "Evaluation & Reliability",
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          id: "registry",
          label: "Tool Registry & Schemas",
          icon: <Wrench className="h-4 w-4" />,
        }
      );
    }

    return items;
  }, [activeMode, isAdmin, isFaculty, pendingApprovalsCount]);

  const handleNavKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (index + 1) % navItems.length;
      navButtonRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (index - 1 + navItems.length) % navItems.length;
      navButtonRefs.current[prev]?.focus();
    }
  };

  const handleSelectNav = (id: WorkspaceSection) => {
    onSelectSection(id);
    onCloseMobile?.();
  };

  const displayName = toTitleCase(user?.full_name) || "Campus User";
  const initials = getUserInitials(user?.full_name, user?.email);
  const roleLabel = formatRoleLabel(user?.role);

  const renderSidebarBody = (collapsed: boolean, isMobileDrawer: boolean) => (
    <div className="flex flex-col h-full w-full overflow-hidden select-none">
      {/* 1. Brand Header */}
      <div
        className={`h-14 sm:h-16 flex items-center border-b border-cv-line shrink-0 ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        <Link
          href="/"
          className={`flex items-center group min-w-0 ${collapsed ? "justify-center" : "space-x-2.5"}`}
          title="CampVion — Campus Operations"
        >
          <BrandLogo
            variant="mark"
            isDark={isDark}
            size={24}
            alt="CampVion Emblem"
            priority
            className="h-6 w-auto shrink-0 transition-transform duration-200 group-hover:scale-105"
          />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <span className="text-sm font-bold tracking-tight text-cv-fg block truncate">
                Camp<span className="text-cv-accent-ink">Vion</span>
              </span>
              <span className="text-[10px] text-cv-fg-3 block truncate">
                Campus Operations
              </span>
            </div>
          )}
        </Link>

        {isMobileDrawer ? (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-lg text-cv-fg-2 hover:text-cv-fg hover:bg-cv-hover transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          !collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="p-1.5 rounded-lg text-cv-fg-2 hover:text-cv-fg hover:bg-cv-hover border border-transparent hover:border-cv-line transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {/* Expand rail button when collapsed on desktop */}
      {collapsed && !isMobileDrawer && (
        <div className="pt-2.5 px-2 flex justify-center shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="w-10 h-8 flex items-center justify-center rounded-lg text-cv-fg-2 hover:text-cv-fg hover:bg-cv-hover border border-transparent hover:border-cv-line transition cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Primary CTA: New Request */}
      <div className={`shrink-0 ${collapsed ? "p-2.5" : "px-3.5 pt-3.5 pb-2"}`}>
        <button
          type="button"
          onClick={() => {
            onNewRequest();
            onCloseMobile?.();
          }}
          aria-label="New Request"
          title="New Request"
          className={`w-full flex items-center justify-center rounded-xl text-xs font-semibold cv-btn-gradient cursor-pointer group ${
            collapsed ? "h-10 px-0" : "h-10 px-3.5 space-x-2"
          }`}
        >
          <Plus className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
          {!collapsed && <span>New Request</span>}
        </button>
      </div>

      {/* 3. Navigation Links (fixed top block, never scrolls off) */}
      <nav
        aria-label="Workspace Navigation"
        className={`shrink-0 space-y-1 ${collapsed ? "px-2 py-2" : "px-3 py-2"}`}
      >
        {!collapsed && (
          <span className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-cv-fg-3 block">
            Workspace
          </span>
        )}

        {navItems.map((item, idx) => {
          const isActive = activeSection === item.id;
          return (
            <div key={item.id} className="relative group/navitem">
              <button
                ref={(el) => {
                  navButtonRefs.current[idx] = el;
                }}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                onKeyDown={(e) => handleNavKeyDown(e, idx)}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                className={`relative w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer border ${
                  collapsed ? "justify-center h-10 px-0" : "px-3 py-2 space-x-2.5"
                } ${
                  isActive
                    ? "bg-cv-accent-soft border-cv-accent-soft-line text-cv-fg font-semibold"
                    : "border-transparent text-cv-fg-2 hover:text-cv-fg hover:bg-cv-hover hover:border-cv-line hover:-translate-y-px"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId={disableMotion ? undefined : "cv-sidebar-active-bar"}
                    aria-hidden="true"
                    transition={{ type: "spring", stiffness: 460, damping: 34 }}
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-gradient-to-b from-[#6366F1] to-[#22D3EE]"
                  />
                )}

                <span
                  className={`shrink-0 relative transition-colors ${
                    isActive
                      ? "text-cv-accent-ink"
                      : "text-cv-fg-3 group-hover/navitem:text-cv-fg"
                  }`}
                >
                  {item.icon}
                  {collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-cv-warning-solid ring-2 ring-cv-sidebar" />
                  )}
                </span>

                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cv-warning-soft border border-cv-warning-line text-cv-warning shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>

              {collapsed && (
                <div
                  role="tooltip"
                  className="pointer-events-none opacity-0 group-hover/navitem:opacity-100 group-focus-within/navitem:opacity-100 transition-opacity duration-150 absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 rounded-lg bg-cv-elevated border border-cv-line-strong text-[11px] font-medium text-cv-fg whitespace-nowrap shadow-lg z-50"
                >
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 4. Recent Requests (ONLY scrollable section in Sidebar) */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-cv-line mt-1 pt-2.5">
        {!collapsed && (
          <div className="flex items-center justify-between px-4 pb-1.5 shrink-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-cv-fg-3">
              Recent Requests
            </span>
            {recentRequestIds.length > 0 && (
              <span className="text-[10px] font-mono text-cv-fg-3">
                {recentRequestIds.length}
              </span>
            )}
          </div>
        )}

        <div className={`flex-1 min-h-0 overflow-y-auto cv-thin-scroll ${collapsed ? "px-2 pb-2" : "px-3 pb-2"}`}>
          {recentRequestIds.length === 0 ? (
            !collapsed && (
              <p className="px-2 py-2 text-[11px] text-cv-fg-3 truncate">
                No recent requests yet.
              </p>
            )
          ) : (
            <div className="space-y-1">
              {recentRequestIds.map((id) => {
                const summary = sessionSummaries[id];
                const isSelected = activeRequestId === id && activeSection === "chat";
                const status = summary?.status || "IDLE";

                const dotColor =
                  status === "COMPLETED"
                    ? "bg-cv-success-solid"
                    : status === "WAITING_FOR_HUMAN"
                    ? "bg-cv-warning-solid"
                    : status === "FAILED"
                    ? "bg-cv-error-solid"
                    : "bg-cv-accent";

                const titleText = summary?.goal?.trim() || `Request #${id}`;
                const relTime = formatRelativeTime(summary?.updated_at);

                if (collapsed) {
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        onSelectRequestId(id);
                        onSelectSection("chat");
                      }}
                      aria-label={`Request #${id}: ${titleText}`}
                      title={`#${id} — ${titleText}`}
                      className={`w-full h-8 flex items-center justify-center rounded-lg border transition cursor-pointer ${
                        isSelected
                          ? "bg-cv-accent-soft border-cv-accent-soft-line"
                          : "border-transparent hover:bg-cv-hover hover:border-cv-line"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                    </button>
                  );
                }

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onSelectRequestId(id);
                      onSelectSection("chat");
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-left transition cursor-pointer group ${
                      isSelected
                        ? "bg-cv-accent-soft border-cv-accent-soft-line"
                        : "border-transparent hover:bg-cv-hover hover:border-cv-line"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`}
                      />
                      <span className="text-xs text-cv-fg-2 group-hover:text-cv-fg truncate font-medium">
                        {titleText}
                      </span>
                    </div>
                    <span className="text-[10px] text-cv-fg-3 shrink-0 tabular-nums">
                      {relTime}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Bottom Footer: Subtle System Status + Single User Card */}
      <div className="border-t border-cv-line shrink-0 bg-cv-sidebar">
        {/* Subtle System Status Line */}
        {!collapsed && (
          <div className="px-4 pt-2.5 pb-1 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  isOnline ? "bg-cv-success-solid" : "bg-cv-error-solid"
                }`}
              />
              {isAdmin && activeMode === "advanced" ? (
                <span className="text-[10px] font-mono text-cv-fg-3 truncate">
                  {isOnline
                    ? `API Online${typeof healthLatencyMs === "number" ? ` · ${healthLatencyMs}ms` : ""}`
                    : "API Offline"}
                </span>
              ) : (
                <span className="text-[11px] text-cv-fg-3 truncate">
                  {isOnline ? "All systems normal" : "Service reconnecting"}
                </span>
              )}
            </div>

            {isAdmin && activeMode === "advanced" && (
              <button
                type="button"
                onClick={onRefreshHealth}
                disabled={healthLoading}
                aria-label="Refresh system status"
                title="Refresh system health"
                className="p-1 rounded text-cv-fg-3 hover:text-cv-fg transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3 w-3 ${healthLoading ? "animate-spin text-cv-accent-ink" : ""}`}
                />
              </button>
            )}
          </div>
        )}

        {/* Single Bottom User Card */}
        {user && (
          <div className={`${collapsed ? "p-2" : "px-3 pt-1.5 pb-3"}`}>
            <div
              className={`flex items-center rounded-xl border border-cv-line bg-cv-raised/60 ${
                collapsed
                  ? "justify-center p-1.5 flex-col space-y-1.5"
                  : "justify-between gap-2 p-2"
              }`}
            >
              <div className={`flex items-center min-w-0 ${collapsed ? "justify-center" : "space-x-2.5 flex-1"}`}>
                <div
                  className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#6366F1]/25 to-[#22D3EE]/25 border border-cv-accent-soft-line flex items-center justify-center shrink-0 text-[11px] font-semibold text-cv-fg"
                  aria-hidden="true"
                >
                  {initials}
                </div>

                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold text-cv-fg truncate">
                        {displayName}
                      </span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-cv-accent-soft text-cv-accent-ink border border-cv-accent-soft-line shrink-0">
                        {roleLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-cv-fg-3 block truncate">
                      {user.email}
                    </span>
                  </div>
                )}
              </div>

              <div className={`flex items-center shrink-0 ${collapsed ? "flex-col space-y-1" : "space-x-0.5"}`}>
                <button
                  type="button"
                  onClick={() => handleSelectNav("settings")}
                  aria-label="Settings"
                  title="Settings"
                  aria-current={activeSection === "settings" ? "page" : undefined}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    activeSection === "settings"
                      ? "bg-cv-accent-soft text-cv-accent-ink"
                      : "text-cv-fg-3 hover:text-cv-fg hover:bg-cv-hover"
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    aria-label="Sign out"
                    title="Sign out"
                    className="p-1.5 rounded-lg text-cv-fg-3 hover:text-cv-error hover:bg-cv-error-soft transition cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Rail Sidebar */}
      <aside
        aria-label="CampVion Navigation Sidebar"
        className={`hidden lg:flex flex-col h-full bg-cv-sidebar border-r border-cv-line transition-[width] duration-200 ease-out shrink-0 z-30 ${
          isCollapsed ? "w-16" : "w-68 xl:w-72"
        }`}
      >
        {renderSidebarBody(isCollapsed, false)}
      </aside>

      {/* Mobile / Tablet Slide-Over Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={disableMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={disableMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onCloseMobile}
              aria-hidden="true"
              className="fixed inset-0 bg-black/55 backdrop-blur-xs"
            />
            <motion.aside
              aria-label="CampVion Mobile Navigation Drawer"
              initial={disableMotion ? { x: 0 } : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={disableMotion ? { x: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="relative z-10 w-72 max-w-[85vw] h-full bg-cv-sidebar border-r border-cv-line shadow-2xl"
            >
              {renderSidebarBody(false, true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
