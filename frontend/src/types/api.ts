export type WorkflowStatus =
  | "IDLE"
  | "UNDERSTANDING"
  | "PLANNING"
  | "EXECUTING"
  | "OBSERVING"
  | "REPLANNING"
  | "WAITING_FOR_HUMAN"
  | "COMPLETED"
  | "FAILED";

export type HumanApprovalStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export type WorkspaceSection =
  | "chat"
  | "unified"
  | "workspace"
  | "observability"
  | "evaluation"
  | "registry"
  | "settings";

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export interface Student {
  id: number;
  student_id: string;
  name: string;
  email: string;
  program: string;
  semester: number;
}

export interface AttendanceRecord {
  id: number;
  student_id: string;
  course_id: number;
  attended_classes: number;
  total_classes: number;
}

export interface CourseRecord {
  id: number;
  course_code: string;
  course_name: string;
  faculty: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  category: string;
  input_schema: Record<string, unknown>;
  requires_human_approval: boolean;
}

export interface Task {
  task_id: string;
  description: string;
  dependencies: string[];
  candidate_tools: string[];
  status: "PENDING" | "COMPLETED" | "FAILED";
  requires_human_approval: boolean;
}

export interface NormalizedGoal {
  goal_type: string;
  student_id: string;
  parameters: Record<string, unknown>;
  constraints?: string[];
}

export interface ObservationItem {
  task_id: string;
  observation: string;
}

export interface AgentState {
  request_id: number;
  student_id: string;
  original_goal: string;
  normalized_goal?: NormalizedGoal | null;
  current_status: WorkflowStatus;
  current_step: number;
  plan: Task[];
  completed_tasks: string[];
  pending_tasks: string[];
  failed_tasks: string[];
  observations: ObservationItem[];
  selected_tools: Record<string, string>;
  tool_results: Record<string, unknown>;
  replanning_count: number;
  human_approval_required: boolean;
  human_approval_status: HumanApprovalStatus;
  final_result?: string | null;
  error?: string | null;
}

export interface AgentResult {
  request_id: number;
  status: WorkflowStatus;
  original_goal: string;
  completed_tasks: string[];
  failed_tasks: string[];
  replanning_count: number;
  human_intervention_count: number;
  final_message: string;
  execution_time: number;
  trace_id?: number | null;
}

export interface TraceItem {
  id: number;
  request_id?: number | null;
  step_number: number;
  event_type: string;
  component: string;
  action: string;
  input_data?: string | null;
  output_data?: string | null;
  status: string;
  error_message?: string | null;
  timestamp: string;
}

export interface RunAgentPayload {
  student_id: string;
  goal: string;
}

export interface WorkflowSessionSummary {
  request_id: number;
  student_id: string;
  goal: string;
  status: WorkflowStatus;
  completed_count: number;
  total_tasks: number;
  replanning_count: number;
  human_approval_status: HumanApprovalStatus;
  execution_time: number;
  final_message: string;
  updated_at: string;
}

export type UserRole = "student" | "faculty" | "administrator" | "system_administrator";

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  student_id?: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: UserProfile;
  csrf_token: string;
  expires_at: string;
  session_token?: string | null;
}

export interface SignupPayload {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface ForgotPasswordResponse {
  status: string;
  message: string;
  email_service_configured: boolean;
  delivery_mode: string;
  configuration_notice?: string | null;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
  confirm_password: string;
}

// =============================================================================
// Phase 4 — Conversational Agentic AI Assistant Types
// =============================================================================

export interface ConfirmationProposal {
  proposal_id: string;
  operation_type: string;
  title: string;
  student_id: string;
  student_name: string;
  attendance_pct: number;
  is_eligible: boolean;
  fields: Record<string, string | number | boolean>;
  raw_goal: string;
}

export interface ConversationMessageMetadata {
  intent_category?: string;
  llm_telemetry?: {
    used_llm?: boolean;
    provider?: string;
    model?: string;
    latency_ms?: number;
    status?: string;
  };
  student_id?: string;
  quick_replies?: string[];
  policy_citations?: Array<{
    policy_id: string;
    title: string;
    category: string;
    provenance_type: string;
    description: string;
    version: string;
  }>;
  guidance_type?: string;
  tool_data?: {
    type: string;
    tool_name?: string;
    overall_percentage?: number;
    total_attended?: number;
    total_classes?: number;
    is_eligible?: boolean;
    courses?: Array<{
      course_code: string;
      course_name: string;
      attended?: number;
      total?: number;
      percentage?: number;
      faculty?: string;
    }>;
    academic_summary?: Record<string, unknown>;
    exams?: Array<{
      course_code: string;
      course_name: string;
      exam_type: string;
      exam_date: string;
      start_time: string;
      duration_minutes: number;
      room: string;
    }>;
    fee_status?: Record<string, unknown>;
    hostel_status?: Record<string, unknown>;
    leave_status?: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
  awaiting_clarification?: boolean;
  awaiting_confirmation?: boolean;
  confirmation_proposal?: ConfirmationProposal;
  collected_slots?: Record<string, unknown>;
  missing_slots?: string[];
  workflow_executed?: boolean;
  request_id?: number;
  workflow_result?: AgentResult;
  workflow_state?: AgentState;
  ambiguous_confirmation_blocked?: boolean;
  request_canceled?: boolean;
}

export interface ConversationMessageItem {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  intent_category?: string | null;
  metadata?: ConversationMessageMetadata;
  created_at?: string | null;
}

export interface ConversationSessionData {
  conversation_id: string;
  student_id: string;
  title: string;
  status: string;
  active_intent?: string | null;
  collected_slots: Record<string, unknown>;
  missing_slots: string[];
  pending_confirmation?: ConfirmationProposal | null;
  active_workflow_request_id?: number | null;
  workflow_state?: AgentState | null;
  messages: ConversationMessageItem[];
  latest_reply?: ConversationMessageItem | null;
}

export interface ConversationSummaryItem {
  conversation_id: string;
  student_id: string;
  title: string;
  status: string;
  active_intent?: string | null;
  active_workflow_request_id?: number | null;
  updated_at?: string | null;
}

// =============================================================================
// Project 55 Baseline Benchmark Evaluation Types
// =============================================================================

export interface BenchmarkMetric {
  agentic_pct: number;
  baseline_pct: number;
  delta_pct: number;
  agentic_ratio?: string;
  baseline_ratio?: string;
}

export interface BenchmarkLatencyMetric {
  agentic_avg_ms: number;
  baseline_avg_ms: number;
}

export interface BenchmarkSummary {
  total_scenarios: number;
  task_completion_rate: BenchmarkMetric;
  tool_invocation_accuracy: BenchmarkMetric;
  failure_recovery_rate: BenchmarkMetric;
  execution_latency_ms: BenchmarkLatencyMetric;
}

export interface ScenarioComparisonItem {
  scenario_id: string;
  name: string;
  category: string;
  natural_language_request: string;
  expected_state: string;
  agentic: {
    status: string;
    success: boolean;
    completed_tasks: number;
    replanning_count: number;
    tools_executed: string[];
    latency_ms: number;
  };
  baseline: {
    status: string;
    success: boolean;
    tools_executed: string[];
    failure_recovered: boolean;
    latency_ms: number;
    error?: string;
  };
  delta: string;
}

export interface BenchmarkReportResponse {
  timestamp: string;
  database: string;
  syllabus_requirement: string;
  summary: BenchmarkSummary;
  scenarios: ScenarioComparisonItem[];
}

export interface PendingApprovalItem {
  request_id: number;
  student_id: string;
  student_name: string;
  student_email?: string | null;
  goal: string;
  days?: number | null;
  category?: string | null;
  reason?: string | null;
  attendance_percentage?: number | null;
  assigned_approver?: string | null;
  current_status: WorkflowStatus;
  human_approval_status: HumanApprovalStatus;
  pending_task_description?: string | null;
  created_at?: string | null;
}




