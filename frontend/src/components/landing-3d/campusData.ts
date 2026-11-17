export type BuildingId = "leave" | "academics" | "hostel" | "admin-gate";
export type TraceStage = "idle" | "parsing" | "policy" | "approval" | "executed";

export interface ReasoningStep {
  label: string;
  detail: string;
}

export interface CampusBuildingSpec {
  id: BuildingId;
  name: string;
  shortTag: string;
  policyCode: string;
  authority: string;
  liveAction: string;
  statusHeadline: string;
  statusDetail: string;
  position: [number, number, number];
  cameraOffset: [number, number, number];
  labelHeight: number;
  pipelineSteps: ReasoningStep[];
}

export interface PromptPreset {
  id: string;
  label: string;
  targetBuilding: BuildingId;
}

export const SCENE_GROUP_OFFSET_Y = -0.25;
export const POLICY_CORE_LABEL_Y = -0.16;

export const CAMPUS_BUILDINGS: CampusBuildingSpec[] = [
  {
    id: "admin-gate",
    name: "Admin & Dean Gate",
    shortTag: "Admin Gate",
    policyCode: "GOV-HITL-001",
    authority: "Office of the Dean & Registrar",
    liveAction: "Awaiting Dean approval...",
    statusHeadline: "Governance Gate: Institutional Sign-Off Armed \u2713",
    statusDetail:
      "Consequential campus actions pause strictly at WAITING_FOR_HUMAN until authorized.",
    position: [0, 0, -4.15],
    cameraOffset: [5.6, 5.0, 6.4],
    labelHeight: 2.9,
    pipelineSteps: [
      { label: "Intent Parsed", detail: "Institutional governance audit requested" },
      { label: "DAG Planned", detail: "6-node dependency graph locked" },
      { label: "Policy Verified", detail: "GOV-HITL-001 authority check \u2713" },
      { label: "Human Approval (Dean/Warden)", detail: "Dean queue sign-off ready" },
      { label: "Executed", detail: "Immutable ledger updated" },
    ],
  },
  {
    id: "academics",
    name: "Academic & Attendance Hall",
    shortTag: "Academics",
    policyCode: "POL-ATT-001",
    authority: "Academic Affairs & Examination Cell",
    liveAction: "Reading attendance records...",
    statusHeadline: "Attendance Policy: 88.5% Verified \u2713",
    statusDetail:
      "Real-time standing verified above the mandatory 75% semester threshold.",
    position: [4.15, 0, 0],
    cameraOffset: [5.8, 4.9, 6.0],
    labelHeight: 2.3,
    pipelineSteps: [
      { label: "Intent Parsed", detail: "Target: Verify 75% attendance eligibility" },
      { label: "DAG Planned", detail: "Roster \u2192 Attendance \u2192 Eligibility check" },
      { label: "Policy Verified", detail: "88.5% \u2265 75% threshold passed \u2713" },
      { label: "Human Approval (Dean/Warden)", detail: "Dean sign-off verified" },
      { label: "Executed", detail: "Eligibility certificate issued" },
    ],
  },
  {
    id: "hostel",
    name: "Hostel & Facilities",
    shortTag: "Hostel",
    policyCode: "POL-HST-002",
    authority: "Chief Hostel Warden & Estates",
    liveAction: "Checking room allocation policy...",
    statusHeadline: "Hostel Allocation: Block-B Room 304 Verified \u2713",
    statusDetail:
      "Room availability checked against residential allotment quotas and caretaker queue.",
    position: [-4.15, 0, 0],
    cameraOffset: [5.8, 5.0, 6.2],
    labelHeight: 2.95,
    pipelineSteps: [
      { label: "Intent Parsed", detail: "Target: Request hostel room allocation" },
      { label: "DAG Planned", detail: "Standing \u2192 Room inventory \u2192 Gate" },
      { label: "Policy Verified", detail: "POL-HST-002 Block-B available \u2713" },
      { label: "Human Approval (Dean/Warden)", detail: "Chief Warden authorization" },
      { label: "Executed", detail: "Block-B Room 304 allocated" },
    ],
  },
  {
    id: "leave",
    name: "Leave & Student Desk",
    shortTag: "Leave Desk",
    policyCode: "POL-LVE-001",
    authority: "Student Welfare & Class Advisor",
    liveAction: "Verifying 75% attendance eligibility...",
    statusHeadline: "Medical Leave: 12 Days Available \u2713",
    statusDetail:
      "2-day medical leave eligible under semester quota and automatic advisor routing.",
    position: [0, 0, 4.15],
    cameraOffset: [5.6, 4.8, 6.0],
    labelHeight: 1.95,
    pipelineSteps: [
      { label: "Intent Parsed", detail: "Target: 2-day medical leave" },
      { label: "DAG Planned", detail: "Attendance \u2192 Quota \u2192 Leave commit" },
      { label: "Policy Verified", detail: "12 days balance & 88.5% standing \u2713" },
      { label: "Human Approval (Dean/Warden)", detail: "Warden approval signed" },
      { label: "Executed", detail: "Leave #LV-2026-108 approved" },
    ],
  },
];

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "preset-leave",
    label: "Apply for 2-day medical leave",
    targetBuilding: "leave",
  },
  {
    id: "preset-attendance",
    label: "Verify 75% attendance eligibility",
    targetBuilding: "academics",
  },
  {
    id: "preset-hostel",
    label: "Request hostel room allocation",
    targetBuilding: "hostel",
  },
];

export const INTRO_CAMERA_POS: [number, number, number] = [14.0, 9.8, 15.2];
export const OVERVIEW_CAMERA_POS: [number, number, number] = [11.2, 8.2, 12.2];
export const OVERVIEW_CAMERA_TARGET: [number, number, number] = [0, 0.4, 0];
