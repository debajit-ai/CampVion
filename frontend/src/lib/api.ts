import {
  AgentResult,
  AgentState,
  AttendanceRecord,
  AuthSessionResponse,
  CourseRecord,
  ForgotPasswordResponse,
  HealthResponse,
  LoginPayload,
  ResetPasswordPayload,
  RunAgentPayload,
  SignupPayload,
  Student,
  Task,
  ToolSchema,
  TraceItem,
  UserProfile,
  ConversationSessionData,
  ConversationSummaryItem,
} from "../types/api";

export const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api";

let _activeBaseUrl: string = DEFAULT_API_BASE_URL;

function getCandidateBaseUrls(): string[] {
  const candidates: string[] = [_activeBaseUrl, DEFAULT_API_BASE_URL];

  if (DEFAULT_API_BASE_URL.includes("://localhost:")) {
    candidates.push(DEFAULT_API_BASE_URL.replace("://localhost:", "://127.0.0.1:"));
  } else if (DEFAULT_API_BASE_URL.includes("://127.0.0.1:")) {
    candidates.push(DEFAULT_API_BASE_URL.replace("://127.0.0.1:", "://localhost:"));
  }

  if (typeof window !== "undefined") {
    candidates.push("/api");
  }

  return Array.from(new Set(candidates));
}

// Strictly in-memory runtime references (never persisted to localStorage)
let _inMemorySessionToken: string | null = null;
let _inMemoryCsrfToken: string | null = null;

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return _inMemoryCsrfToken;
  const match = document.cookie.match(/(?:^|;\s*)campvion_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : _inMemoryCsrfToken;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const method = (options.method || "GET").toUpperCase();
  const extraHeaders: Record<string, string> = {};

  if (_inMemorySessionToken) {
    extraHeaders["Authorization"] = `Bearer ${_inMemorySessionToken}`;
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = readCsrfCookie();
    if (csrf) {
      extraHeaders["X-CSRF-Token"] = csrf;
    }
  }

  const candidateBases = getCandidateBaseUrls();
  let lastNetworkError: unknown = null;

  for (const base of candidateBases) {
    const url = `${base}${normalizedEndpoint}`;
    try {
      const res = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...extraHeaders,
          ...options.headers,
        },
        // Avoid stale cache in dev/operations console
        cache: "no-store",
      });

      // Remember the reachable base URL for subsequent requests
      _activeBaseUrl = base;

      if (!res.ok) {
        let errorBody: unknown;
        try {
          errorBody = await res.json();
        } catch {
          errorBody = await res.text();
        }

        let message = `API request failed: ${res.status} ${res.statusText}`;
        if (typeof errorBody === "object" && errorBody !== null && "detail" in errorBody) {
          const detail = (errorBody as { detail: unknown }).detail;
          if (typeof detail === "object" && detail !== null && "message" in detail) {
            message = String((detail as { message: unknown }).message);
          } else if (Array.isArray(detail) && detail.length > 0) {
            const first = detail[0] as { msg?: string };
            message = first?.msg || "Validation error in submitted fields.";
          } else {
            message = String(detail);
          }
        }
        throw new ApiError(message, res.status, errorBody);
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }
      lastNetworkError = err;
    }
  }

  const rawMsg =
    lastNetworkError instanceof Error
      ? lastNetworkError.message
      : "Network error or backend unreachable";
  const message =
    rawMsg === "Failed to fetch"
      ? `Failed to fetch — Backend server is unreachable at ${DEFAULT_API_BASE_URL}. Ensure the FastAPI server is running.`
      : rawMsg;
  throw new ApiError(message, 0);
}

export const apiClient = {
  getBaseUrl(): string {
    return _activeBaseUrl || DEFAULT_API_BASE_URL;
  },

  async checkHealth(): Promise<HealthResponse> {
    return fetchJson<HealthResponse>("/health");
  },

  // Authentication & Session Management
  async signup(payload: SignupPayload): Promise<AuthSessionResponse> {
    const res = await fetchJson<AuthSessionResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    _inMemorySessionToken = res.session_token || null;
    _inMemoryCsrfToken = res.csrf_token || null;
    return res;
  },

  async login(payload: LoginPayload): Promise<AuthSessionResponse> {
    const res = await fetchJson<AuthSessionResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    _inMemorySessionToken = res.session_token || null;
    _inMemoryCsrfToken = res.csrf_token || null;
    return res;
  },

  async logout(): Promise<{ status: string; message: string }> {
    try {
      return await fetchJson<{ status: string; message: string }>("/auth/logout", {
        method: "POST",
      });
    } finally {
      _inMemorySessionToken = null;
      _inMemoryCsrfToken = null;
    }
  },

  async getCurrentUser(): Promise<UserProfile> {
    return fetchJson<UserProfile>("/auth/me");
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return fetchJson<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async verifyResetToken(token: string): Promise<{ valid: boolean; expires_at: string }> {
    return fetchJson<{ valid: boolean; expires_at: string }>(
      `/auth/verify-reset-token?token=${encodeURIComponent(token)}`
    );
  },

  async resetPassword(
    payload: ResetPasswordPayload
  ): Promise<{ status: string; message: string }> {
    return fetchJson<{ status: string; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Campus Operational Endpoints
  async listStudents(): Promise<Student[]> {
    return fetchJson<Student[]>("/students/");
  },

  async getStudent(studentId: string): Promise<Student> {
    return fetchJson<Student>(`/students/${studentId}`);
  },

  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    return fetchJson<AttendanceRecord[]>(`/students/${studentId}/attendance`);
  },

  async getStudentCourses(studentId: string): Promise<CourseRecord[]> {
    return fetchJson<CourseRecord[]>(`/students/${studentId}/courses`);
  },

  async listTools(): Promise<ToolSchema[]> {
    return fetchJson<ToolSchema[]>("/tools/");
  },

  async getTool(toolName: string): Promise<ToolSchema> {
    return fetchJson<ToolSchema>(`/tools/${toolName}`);
  },

  async runAgent(payload: RunAgentPayload): Promise<AgentResult> {
    return fetchJson<AgentResult>("/agent/run", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getAgentState(requestId: number): Promise<AgentState> {
    return fetchJson<AgentState>(`/agent/${requestId}`);
  },

  async getAgentPlan(requestId: number): Promise<Task[]> {
    return fetchJson<Task[]>(`/agent/${requestId}/plan`);
  },

  async getAgentTrace(requestId: number): Promise<TraceItem[]> {
    return fetchJson<TraceItem[]>(`/agent/${requestId}/trace`);
  },

  async approveWorkflow(requestId: number): Promise<AgentResult> {
    return fetchJson<AgentResult>(`/agent/${requestId}/approve`, {
      method: "POST",
    });
  },

  async rejectWorkflow(requestId: number): Promise<AgentResult> {
    return fetchJson<AgentResult>(`/agent/${requestId}/reject`, {
      method: "POST",
    });
  },

  async getLLMStatus(): Promise<{
    provider: string;
    model: string;
    masked_api_key: string;
    is_cloud_provider: boolean;
    is_configured: boolean;
    health: { status: string; is_available: boolean; latency_ms?: number; error_message?: string };
    telemetry: Record<string, unknown>;
    supported_providers: string[];
  }> {
    return fetchJson("/llm/status");
  },

  async interpretIntent(studentId: string, requestText: string): Promise<{
    success: boolean;
    student_id: string;
    goal?: { goal_type: string; parameters: Record<string, unknown> };
    needs_clarification?: boolean;
    clarification_question?: string;
    missing_information?: string[];
    used_llm: boolean;
    provider_name: string;
    latency_ms: number;
    error_message?: string;
    user_friendly_message?: string;
  }> {
    return fetchJson("/llm/interpret", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, request_text: requestText }),
    });
  },

  // Phase 4 — Conversational Assistant Endpoints
  async listConversations(studentId?: string): Promise<ConversationSummaryItem[]> {
    const query = studentId ? `?student_id=${encodeURIComponent(studentId)}` : "";
    return fetchJson<ConversationSummaryItem[]>(`/conversations/${query}`);
  },

  async createNewConversation(
    studentId?: string,
    title?: string
  ): Promise<ConversationSessionData> {
    return fetchJson<ConversationSessionData>("/conversations/new", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, title }),
    });
  },

  async getConversation(conversationId: string): Promise<ConversationSessionData> {
    return fetchJson<ConversationSessionData>(
      `/conversations/${encodeURIComponent(conversationId)}`
    );
  },

  async sendConversationMessage(payload: {
    conversation_id?: string | null;
    student_id: string;
    message: string;
  }): Promise<ConversationSessionData> {
    return fetchJson<ConversationSessionData>("/conversations/message", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async confirmConversationAction(
    conversationId: string,
    payload: {
      action: "confirm" | "cancel" | "edit";
      updated_slots?: Record<string, unknown>;
    }
  ): Promise<ConversationSessionData> {
    return fetchJson<ConversationSessionData>(
      `/conversations/${encodeURIComponent(conversationId)}/confirm`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },
};
