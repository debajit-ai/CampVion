import { WorkflowStatus } from "../types/api";

export type ExperienceMode = "simple" | "advanced";

/**
 * Human-readable status mapping for student-friendly UI
 */
export function getFriendlyWorkflowStatus(
  status: WorkflowStatus,
  mode: ExperienceMode = "simple"
): { label: string; description: string; badgeClass: string } {
  if (mode === "advanced") {
    switch (status) {
      case "WAITING_FOR_HUMAN":
        return {
          label: "WAITING_FOR_HUMAN",
          description: "Execution paused at human governance authorization gate.",
          badgeClass: "bg-cv-warning-soft border-cv-warning-line text-cv-warning",
        };
      case "EXECUTING":
        return {
          label: "EXECUTING",
          description: "Topological DAG tasks currently being dispatched to bound tools.",
          badgeClass: "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink",
        };
      case "PLANNING":
        return {
          label: "PLANNING",
          description: "Synthesizing prerequisite-enforced topological execution plan.",
          badgeClass: "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink",
        };
      case "UNDERSTANDING":
        return {
          label: "UNDERSTANDING",
          description: "Normalizing natural language goal into canonical JSON schema.",
          badgeClass: "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink",
        };
      case "OBSERVING":
        return {
          label: "OBSERVING",
          description: "Evaluating tool return payload and checking output contracts.",
          badgeClass: "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink",
        };
      case "REPLANNING":
        return {
          label: "REPLANNING",
          description: "Self-healing loop triggered; dynamically re-evaluating DAG path.",
          badgeClass: "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink",
        };
      case "COMPLETED":
        return {
          label: "COMPLETED",
          description: "DAG execution terminated successfully; all terminal outputs verified.",
          badgeClass: "bg-cv-success-soft border-cv-success-line text-cv-success",
        };
      case "FAILED":
        return {
          label: "FAILED",
          description: "Unrecoverable policy or runtime failure halted execution graph.",
          badgeClass: "bg-cv-error-soft border-cv-error-line text-cv-error",
        };
      case "IDLE":
      default:
        return {
          label: "IDLE",
          description: "System standby; awaiting goal dispatch from composer.",
          badgeClass: "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink",
        };
    }
  }

  // Student-friendly descriptions (Simple View)
  switch (status) {
    case "WAITING_FOR_HUMAN":
      return {
        label: "Waiting for Your Approval",
        description: "CampVion needs your review and approval before submitting your official application.",
        badgeClass: "bg-cv-warning-soft border-cv-warning-line text-cv-warning animate-pulse",
      };
    case "EXECUTING":
    case "UNDERSTANDING":
    case "PLANNING":
    case "OBSERVING":
      return {
        label: "Processing Your Request",
        description: "Checking required campus records and coordinating the next steps.",
        badgeClass: "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink",
      };
    case "REPLANNING":
      return {
        label: "Trying Another Approach",
        description: "Encountered a temporary delay; CampVion is automatically trying an alternative path.",
        badgeClass: "bg-cv-accent-soft border-cv-accent-soft-line text-cv-accent-ink",
      };
    case "COMPLETED":
      return {
        label: "Request Completed",
        description: "All steps finished successfully and your campus request is complete.",
        badgeClass: "bg-cv-success-soft border-cv-success-line text-cv-success",
      };
    case "FAILED":
      return {
        label: "Unable to Complete Request",
        description: "We could not complete your request. Please review the details below.",
        badgeClass: "bg-cv-error-soft border-cv-error-line text-cv-error",
      };
    case "IDLE":
    default:
      return {
        label: "Ready",
        description: "Tell CampVion what you need, and we will guide you step by step.",
        badgeClass: "bg-cv-raised border-cv-line text-cv-fg-2",
      };
  }
}

/**
 * Format raw technical errors into clear, polite student-friendly messages.
 * Preserves the raw technical error message for debugging in Advanced View.
 */
export function formatStudentFriendlyError(
  rawError?: string | null,
  mode: ExperienceMode = "simple"
): { message: string; technical?: string } {
  if (!rawError) {
    return {
      message: mode === "simple"
        ? "We couldn't complete this step right now. Please try again."
        : "Unknown system failure occurred during workflow execution.",
    };
  }

  const clean = rawError.trim();

  // If in advanced mode, show raw technical error
  if (mode === "advanced") {
    return { message: clean, technical: clean };
  }

  // Attendance policy failure
  if (clean.includes("Attendance is") || clean.includes("threshold") || clean.includes("Ineligible")) {
    const match = clean.match(/Attendance is (\d+(\.\d+)?)%/i);
    const pct = match ? match[1] : "below 75";
    return {
      message: `Your current course attendance is ${pct}%, which is below the university's 75% minimum threshold for leave approval.`,
      technical: clean,
    };
  }

  // Database crash / corruption failure
  if (
    clean.includes("database_corrupted") ||
    clean.includes("SQLite") ||
    clean.includes("OperationalError") ||
    clean.includes("database")
  ) {
    return {
      message: "We encountered a temporary database service issue. Campus IT administrators have been alerted. Please try again in a few moments.",
      technical: clean,
    };
  }

  // Network / timeout failures
  if (
    clean.includes("timeout") ||
    clean.includes("timed out") ||
    clean.includes("persistent_timeout") ||
    clean.includes("attendance_timeout")
  ) {
    return {
      message: "The university service is taking longer than usual to respond. We tried multiple times automatically, but could not reach the system. Please try again shortly.",
      technical: clean,
    };
  }

  // Approval gate unresolved
  if (clean.includes("approval") || clean.includes("Approval gate")) {
    return {
      message: "This request needs your approval before we can continue. Please review and approve the request above.",
      technical: clean,
    };
  }

  // Generic fallback: remove code identifiers and format cleanly
  const simplified = clean
    .replace(/^Unrecoverable failure on task [a-zA-Z0-9_-]+:\s*/i, "")
    .replace(/^Error:\s*/i, "");

  return {
    message: simplified.length > 0 && !simplified.includes("{") && !simplified.includes("Exception")
      ? simplified
      : "We couldn't complete this step right now. Please try again or check your request details.",
    technical: clean,
  };
}

/**
 * Friendly task description map
 */
export function getFriendlyTaskTitle(taskId: string, rawDescription: string): string {
  switch (taskId) {
    case "t1":
      return "Verify student profile & credentials";
    case "t2":
      return "Check course attendance records";
    case "t3":
      return "Review university leave policy";
    case "t4":
      return "Evaluate leave eligibility";
    case "t5":
      return "Prepare official leave application";
    case "t6":
      return "Confirm application submission status";
    default:
      return rawDescription;
  }
}

/**
 * Friendly tool title map
 */
export function getFriendlyToolName(toolName: string): string {
  switch (toolName) {
    case "get_student_profile":
      return "Student Profile Directory";
    case "get_attendance":
      return "Attendance Tracking System";
    case "get_course_schedule":
      return "Course & Schedule Records";
    case "get_leave_policy":
      return "University Leave Policy";
    case "check_leave_eligibility":
      return "Leave Eligibility Checker";
    case "create_leave_application":
      return "Official Leave Submission Service";
    case "get_leave_application_status":
      return "Application Status Tracker";
    default:
      return toolName;
  }
}

