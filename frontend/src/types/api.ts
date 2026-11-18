export type WorkflowStatus =
  | "IDLE"
  | "UNDERSTANDING"
  | "PLANNING"
  | "EXECUTING"
  | "OBSERVING"
  | "REPLANNING"
  | "WAITING_FOR_HUMAN"
  | "COMPLETED"
  | "FAILED"
  | "ENDED_REJECTED"
  | "CANCELLED";

export type HumanApprovalStatus =
  | "NONE"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type LeaveRequestStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface AuthorityContact {
  user_id?: number | null;
  name: string;
  title: string;
  email: string;
  phone?: string | null;
  office?: string | null;
  office_hours?: string | null;
}

export interface LeavePolicyResult {
  eligible?: boolean;
  status?: string;
  reason?: string;
  attendance_percentage?: number;
  required_threshold?: number;
  policy_applied?: string;
  policy_provenance?: string;
  assigned_approver?: string;
  approver_role?: string;
  requires_documentation?: boolean;
  checked_at?: string;
}

export interface LeaveTraceEvent {
  id: number;
  step_number: number;
  event_type: string;
  component: string;
  action: string;
  status: string;
  error_message?: string | null;
  timestamp?: string | null;
}

export type CampusRequestType =
  | "leave"
  | "library_room"
  | "hostel_allocation"
  | "certificate";

export interface LeaveRequestItem {
  id: number;
  leave_code: string;
  request_code?: string;
  request_type?: CampusRequestType | string;
  request_type_label?: string;
  title?: string | null;
  details?: Record<string, unknown> | null;
  workflow_run_id?: number | null;
  student_id: string;
  student_name: string;
  student_email?: string | null;
  student_program?: string | null;
  student_semester?: number | null;
  student_department?: string | null;
  student_college?: string | null;
  college?: string | null;
  student_residence_type?: string | null;
  student_residence_label?: string | null;
  student_hostel_block?: string | null;
  student_room_number?: string | null;
  category: string;
  start_date: string;
  end_date: string;
  days_count: number;
  from_at?: string | null;
  to_at?: string | null;
  from_at_campus?: string | null;
  to_at_campus?: string | null;
  from_display?: string | null;
  to_display?: string | null;
  from_day?: string | null;
  to_day?: string | null;
  campus_tz?: string | null;
  destination?: string | null;
  exit_gate?: string | null;
  entry_gate?: string | null;
  slip_no?: string | null;
  verify_code?: string | null;
  approved_at?: string | null;
  approved_at_display?: string | null;
  has_slip?: boolean;
  can_cancel?: boolean;
  reason: string;
  doc_required?: boolean;
  status: LeaveRequestStatus;
  attendance_snapshot?: number | null;
  policy_result?: LeavePolicyResult;
  routed_to_role: string;
  assigned_approver: string;
  approver_role: string;
  authority_contact?: AuthorityContact;
  decided_by?: number | null;
  decided_by_name?: string | null;
  decision_comment?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  version: number;
  workflow?: {
    request_id: number;
    current_status: WorkflowStatus;
    human_approval_status: HumanApprovalStatus;
    completed_tasks: string[];
    pending_tasks: string[];
    failed_tasks: string[];
    plan: Task[];
  } | null;
  traces?: LeaveTraceEvent[];
}

export interface CampusGateItem {
  id: number;
  gate_code: string;
  name: string;
  location?: string | null;
  is_default_hostel?: boolean;
}

export interface DiscussionRoomItem {
  id: number;
  room_code: string;
  name: string;
  floor: string;
  capacity: number;
  amenities: string;
  fits_capacity: boolean;
  available: boolean;
  conflict_reason?: string | null;
}

export interface HostelBlockRoomItem {
  id: number;
  room_code: string;
  block: string;
  hostel_name: string;
  room_number: string;
  sharing_type: string;
  ac_type: string;
  capacity: number;
  occupied: number;
  free_beds: number;
  available: boolean;
  gender: string;
}

export interface HostelRoomsResponse {
  items: HostelBlockRoomItem[];
  blocks: string[];
}

export interface AvailableRoomsResponse {
  items: DiscussionRoomItem[];
  window_valid: boolean;
  window_error?: string | null;
  library_hours: {
    open_hour: number;
    close_hour: number;
    max_hours: number;
    campus_tz: string;
  };
}

export interface LeaveSlipVerifyResponse {
  status: "VALID" | "EXPIRED" | "REVOKED" | "NOT_FOUND";
  verification_status: "VALID" | "EXPIRED" | "REVOKED" | "NOT_FOUND";
  valid: boolean;
  message: string;
  slip_no?: string | null;
  request_code?: string | null;
  request_type?: string | null;
  student_name?: string | null;
  student_id?: string | null;
  college?: string | null;
  from_at?: string | null;
  to_at?: string | null;
  from_display?: string | null;
  to_display?: string | null;
  exit_gate?: string | null;
  entry_gate?: string | null;
  approved_by?: string | null;
  approver_role?: string | null;
  approved_at_display?: string | null;
  campus_tz?: string | null;
}

export interface GuidedCardPayload {
  type: "leave_details" | "room_booking" | "hostel_change" | "hostel_booking" | "email_authority";
  prefill?: Record<string, unknown>;
}

export interface LeaveQueueStats {
  pending_count: number;
  approved_today_count: number;
  rejected_today_count: number;
  avg_response_minutes: number;
  approval_rate_pct: number;
}

export interface LeaveListResponse {
  items: LeaveRequestItem[];
  total: number;
  stats: LeaveQueueStats;
}

export interface NotificationItem {
  id: number;
  user_id?: number;
  leave_request_id?: number | null;
  event_type: string;
  title: string;
  body: string;
  request?: LeaveRequestItem | null;
  read_at?: string | null;
  created_at?: string | null;
}

export type WorkspaceSection =
  | "chat"
  | "unified"
  | "approvals"
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

export interface CollegeOption {
  name: string;
  short?: string;
  city?: string;
  state?: string;
  category?: string;
  featured?: boolean;
}

export interface Student {
  id: number;
  student_id: string;
  name: string;
  email: string;
  program: string;
  semester: number;
  college?: string | null;
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
  college?: string | null;
  hostel_block?: string | null;
  hostel_room?: string | null;
  authority_title?: string | null;
  phone?: string | null;
  office?: string | null;
  office_hours?: string | null;
  contact_email?: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface AdminProfileUpdatePayload {
  full_name?: string;
  college?: string;
  authority_title?: string;
  phone?: string;
  office?: string;
  office_hours?: string;
  contact_email?: string;
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
  role?: "student" | "administrator";
  student_id?: string;
  college?: string;
  display_name?: string;
  invite_code?: string;
  authority_title?: string;
  phone?: string;
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
  guided_card?: GuidedCardPayload | null;
  collected_slots?: Record<string, unknown>;
  missing_slots?: string[];
  workflow_executed?: boolean;
  request_id?: number;
  leave_request?: LeaveRequestItem | null;
  workflow_result?: AgentResult;
  workflow_state?: AgentState;
  ambiguous_confirmation_blocked?: boolean;
  duplicate_blocked?: boolean;
  existing_leave_code?: string;
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
  leave_id?: number | null;
  leave_code?: string | null;
  student_id: string;
  student_name: string;
  student_email?: string | null;
  goal: string;
  days?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  category?: string | null;
  reason?: string | null;
  attendance_percentage?: number | null;
  assigned_approver?: string | null;
  current_status: WorkflowStatus;
  human_approval_status: HumanApprovalStatus;
  pending_task_description?: string | null;
  version?: number | null;
  created_at?: string | null;
}




