"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiClient } from "../lib/api";
import { LeaveRequestItem, NotificationItem } from "../types/api";
import { useAuth } from "./AuthContext";

export interface LiveToastItem {
  id: string;
  title: string;
  body: string;
  tone: "pending" | "approved" | "rejected" | "info";
  leaveRequestId?: number | null;
  leaveCode?: string | null;
  createdAt: number;
}

export interface EventsContextValue {
  sseConnected: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: LiveToastItem[];
  liveLeaveById: Record<number, LeaveRequestItem>;
  liveLeaveByWorkflowId: Record<number, LeaveRequestItem>;
  lastEventTick: number;
  dismissToast: (toastId: string) => void;
  upsertLiveLeave: (item: LeaveRequestItem) => void;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const EventsContext = createContext<EventsContextValue | undefined>(undefined);

const BASE_DOCUMENT_TITLE = "CampVion — Autonomous University AI Platform";

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [toasts, setToasts] = useState<LiveToastItem[]>([]);
  const [liveLeaveById, setLiveLeaveById] = useState<Record<number, LeaveRequestItem>>({});
  const [liveLeaveByWorkflowId, setLiveLeaveByWorkflowId] = useState<Record<number, LeaveRequestItem>>({});
  const [lastEventTick, setLastEventTick] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const lastEventIdRef = useRef<string>("0");
  const seenToastKeysRef = useRef<Set<string>>(new Set());

  const upsertLiveLeave = useCallback((item: LeaveRequestItem) => {
    setLiveLeaveById((prev) => ({ ...prev, [item.id]: item }));
    if (item.workflow_run_id) {
      setLiveLeaveByWorkflowId((prev) => ({ ...prev, [item.workflow_run_id!]: item }));
    }
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const pushToast = useCallback((toast: Omit<LiveToastItem, "createdAt">) => {
    if (seenToastKeysRef.current.has(toast.id)) return;
    seenToastKeysRef.current.add(toast.id);
    setToasts((prev) => [{ ...toast, createdAt: Date.now() }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 6500);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiClient.listNotifications(30);
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    } catch {
      // Ignore background fetch failures
    }
  }, [isAuthenticated]);

  const markNotificationRead = useCallback(async (notificationId: number) => {
    try {
      const res = await apiClient.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? res.notification : n))
      );
      setUnreadCount(res.unread_count);
    } catch {
      // Ignore errors
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await apiClient.markAllNotificationsRead();
      const nowIso = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || nowIso })));
      setUnreadCount(0);
    } catch {
      // Ignore errors
    }
  }, []);

  // Keep browser tab title synchronized with unread notification count
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isAuthenticated || unreadCount <= 0) {
      if (document.title.startsWith("(")) {
        document.title = BASE_DOCUMENT_TITLE;
      }
      return;
    }
    document.title = `(${unreadCount}) ${BASE_DOCUMENT_TITLE}`;
  }, [isAuthenticated, unreadCount]);

  // Initial notifications + initial leave requests hydration (reset derived when unauthenticated)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    let cancelled = false;
    (async () => {
      await refreshNotifications();
      try {
        const listRes = await apiClient.listLeaveRequests();
        if (cancelled) return;
        const byId: Record<number, LeaveRequestItem> = {};
        const byWf: Record<number, LeaveRequestItem> = {};
        for (const req of listRes.items) {
          byId[req.id] = req;
          if (req.workflow_run_id) byWf[req.workflow_run_id] = req;
        }
        setLiveLeaveById(byId);
        setLiveLeaveByWorkflowId(byWf);
      } catch {
        // Ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, refreshNotifications]);

  // SSE subscription with exponential backoff, pause when tab hidden, and focus refetch
  useEffect(() => {
    if (!isAuthenticated || !user?.id || typeof window === "undefined") {
      return;
    }

    let stopped = false;

    const handleEnvelope = (rawType: string, dataStr: string, lastId?: string) => {
      if (lastId && lastId !== "0") {
        lastEventIdRef.current = lastId;
      }
      try {
        const envelope = JSON.parse(dataStr) as {
          id?: string;
          type?: string;
          data?: {
            request?: LeaveRequestItem;
            notification?: NotificationItem;
            notification_title?: string;
            notification_body?: string;
            catchup?: boolean;
          };
        };
        const payload = envelope?.data || {};
        const req = payload.request || payload.notification?.request;
        if (req) {
          upsertLiveLeave(req);
        }
        if (
          rawType === "request.created" ||
          rawType === "request.updated" ||
          rawType === "notification.created"
        ) {
          setLastEventTick(Date.now());
          if (rawType === "request.created" || rawType === "request.updated") {
            void refreshNotifications();
          }
        }

        if (rawType === "notification.created" && payload.notification) {
          const n = payload.notification;
          setNotifications((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            return [n, ...prev].slice(0, 40);
          });
          setUnreadCount((prev) => prev + 1);
          const tone: LiveToastItem["tone"] =
            req?.status === "APPROVED"
              ? "approved"
              : req?.status === "REJECTED"
              ? "rejected"
              : "pending";
          pushToast({
            id: req ? `evt-${req.id}-v${req.version}` : `notif-${n.id}`,
            title: n.title,
            body: n.body,
            tone,
            leaveRequestId: req?.id ?? n.leave_request_id,
            leaveCode: req?.leave_code ?? null,
          });
        } else if (rawType === "request.updated" && req && !payload.catchup) {
          if (payload.notification_title) {
            const tone: LiveToastItem["tone"] =
              req.status === "APPROVED"
                ? "approved"
                : req.status === "REJECTED"
                ? "rejected"
                : "info";
            pushToast({
              id: `evt-${req.id}-v${req.version}`,
              title: payload.notification_title,
              body: payload.notification_body || `Request ${req.leave_code} is now ${req.status}.`,
              tone,
              leaveRequestId: req.id,
              leaveCode: req.leave_code,
            });
          }
        } else if (rawType === "request.created" && req && !payload.catchup) {
          const roleStr = (user.role || "").toLowerCase();
          const isAdminUser =
            roleStr === "administrator" ||
            roleStr === "system_administrator" ||
            roleStr === "admin";
          if (isAdminUser && payload.notification_title) {
            pushToast({
              id: `evt-${req.id}-v${req.version}`,
              title: payload.notification_title,
              body: payload.notification_body || `${req.student_name} submitted ${req.leave_code}.`,
              tone: "pending",
              leaveRequestId: req.id,
              leaveCode: req.leave_code,
            });
          }
        }
      } catch {
        // Ignore malformed SSE JSON frame
      }
    };

    const closeSource = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setSseConnected(false);
    };

    const connect = () => {
      if (stopped) return;
      if (document.visibilityState === "hidden") {
        closeSource();
        return;
      }

      closeSource();
      const qs =
        lastEventIdRef.current && lastEventIdRef.current !== "0"
          ? `?last_event_id=${encodeURIComponent(lastEventIdRef.current)}`
          : "";
      const es = new EventSource(`/api/events${qs}`, { withCredentials: true });
      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        if (stopped) return;
        reconnectAttemptRef.current = 0;
        setSseConnected(true);
      });

      const wire = (eventName: string) => {
        es.addEventListener(eventName, (evt: MessageEvent) => {
          handleEnvelope(eventName, evt.data, evt.lastEventId);
        });
      };

      wire("request.created");
      wire("request.updated");
      wire("notification.created");

      es.onerror = () => {
        if (stopped) return;
        closeSource();
        const attempt = reconnectAttemptRef.current;
        reconnectAttemptRef.current += 1;
        const delayMs = Math.min(30000, 1000 * Math.pow(2, attempt));
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (!stopped && document.visibilityState !== "hidden") {
            connect();
          }
        }, delayMs);
      };
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        closeSource();
      } else {
        void refreshNotifications();
        void apiClient
          .listLeaveRequests()
          .then((res) => {
            for (const req of res.items) upsertLiveLeave(req);
          })
          .catch(() => {});
        if (!eventSourceRef.current) {
          reconnectAttemptRef.current = 0;
          connect();
        }
      }
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      stopped = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      closeSource();
    };
  }, [isAuthenticated, user?.id, user?.role, pushToast, refreshNotifications, upsertLiveLeave]);

  // Graceful 5s fallback polling when SSE stream is unavailable
  useEffect(() => {
    if (!isAuthenticated || sseConnected) return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refreshNotifications();
      void apiClient
        .listLeaveRequests()
        .then((res) => {
          for (const req of res.items) upsertLiveLeave(req);
        })
        .catch(() => {});
      setLastEventTick(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, sseConnected, refreshNotifications, upsertLiveLeave]);

  const hasAuth = Boolean(isAuthenticated && user?.id);

  const value = useMemo<EventsContextValue>(
    () => ({
      sseConnected: hasAuth ? sseConnected : false,
      notifications: hasAuth ? notifications : [],
      unreadCount: hasAuth ? unreadCount : 0,
      toasts: hasAuth ? toasts : [],
      liveLeaveById: hasAuth ? liveLeaveById : {},
      liveLeaveByWorkflowId: hasAuth ? liveLeaveByWorkflowId : {},
      lastEventTick: hasAuth ? lastEventTick : 0,
      dismissToast,
      upsertLiveLeave,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [
      hasAuth,
      sseConnected,
      notifications,
      unreadCount,
      toasts,
      liveLeaveById,
      liveLeaveByWorkflowId,
      lastEventTick,
      dismissToast,
      upsertLiveLeave,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
    ]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return ctx;
}
