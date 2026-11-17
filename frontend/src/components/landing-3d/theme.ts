import { BuildingId } from "./campusData";

export type LandingColorMode = "dark" | "light";

export interface LandingPaletteTokens {
  bg: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  muted: string;
  border: string;
  primaryIndigo: string;
  primaryCyan: string;
  success: string;
  amber: string;
}

/**
 * Single-source UI color palette for CampVion's landing experience.
 * Restrained architectural obsidian dark (#05070F) default + single #38BDF8 accent.
 */
export const LANDING_PALETTE: Record<LandingColorMode, LandingPaletteTokens> = {
  dark: {
    bg: "#05070F",
    surface: "#0B1020",
    surfaceElevated: "rgba(11, 16, 32, 0.72)",
    text: "#F5F7FF",
    muted: "#B6C0D8",
    border: "rgba(255, 255, 255, 0.08)",
    primaryIndigo: "#38BDF8",
    primaryCyan: "#38BDF8",
    success: "#34D399",
    amber: "#FBBF24",
  },
  light: {
    bg: "#F6F7FB",
    surface: "#FFFFFF",
    surfaceElevated: "rgba(255, 255, 255, 0.88)",
    text: "#0F172A",
    muted: "#475569",
    border: "rgba(15, 23, 42, 0.09)",
    primaryIndigo: "#0284C7",
    primaryCyan: "#0E7490",
    success: "#047857",
    amber: "#B45309",
  },
};

/**
 * Single accent in 3D (#38BDF8); emerald & amber reserved strictly for UI trace states.
 */
export const ACCENT_3D = "#38BDF8";
export const ACCENT_3D_LIGHT = "#7DD3FC";
export const ACCENT_3D_WHITE = "#F8FAFC";

export const AGENT_COLORS = {
  intentParser: "#38BDF8",
  policyVerifier: "#34D399", // UI trace "Policy Verified" only
  approvalAgent: "#FBBF24", // UI trace "Human Approval" only
  policyCore: "#38BDF8",
  coreGlow: "#E0F2FE",
} as const;

/**
 * Unified restrained 3D accent per building (zero multi-color neon).
 */
export const BUILDING_AGENT_COLOR: Record<BuildingId, string> = {
  academics: ACCENT_3D,
  leave: ACCENT_3D,
  hostel: ACCENT_3D,
  "admin-gate": ACCENT_3D,
};

export interface Campus3DModePalette {
  bg: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  keyLight: string;
  rimLight: string;
  coreLight: string;
  wall: string;
  wallEmissive: string;
  trim: string;
  plaza: string;
  plazaRingPrimary: string;
  edgeIdle: string;
  edgeCore: string;
  coreBody: string;
  coreAccent: string;
  coreGlow: string;
  splineIdle: string;
  splineLit: string;
  dust: string;
  shadow: string;
}

export const CAMPUS_3D_THEME: Record<LandingColorMode, Campus3DModePalette> = {
  dark: {
    bg: "#05070F",
    fog: "#05070F",
    hemiSky: "#7DD3FC",
    hemiGround: "#05070F",
    keyLight: "#F1F5F9",
    rimLight: "#38BDF8",
    coreLight: "#38BDF8",
    wall: "#1B2433",
    wallEmissive: "#000000",
    trim: "#232E42",
    plaza: "#0A1020",
    plazaRingPrimary: "#38BDF8",
    edgeIdle: "#7DD3FC",
    edgeCore: "#7DD3FC",
    coreBody: "#232E42",
    coreAccent: "#38BDF8",
    coreGlow: "#E0F2FE",
    splineIdle: "#38BDF8",
    splineLit: "#7DD3FC",
    dust: "#E2E8F0",
    shadow: "#02040A",
  },
  light: {
    bg: "#F6F7FB",
    fog: "#F6F7FB",
    hemiSky: "#FFFFFF",
    hemiGround: "#E2E8F0",
    keyLight: "#FFFFFF",
    rimLight: "#38BDF8",
    coreLight: "#38BDF8",
    wall: "#E2E8F0",
    wallEmissive: "#FFFFFF",
    trim: "#CBD5E1",
    plaza: "#E8EDF5",
    plazaRingPrimary: "#0284C7",
    edgeIdle: "#0284C7",
    edgeCore: "#0284C7",
    coreBody: "#CBD5E1",
    coreAccent: "#0284C7",
    coreGlow: "#38BDF8",
    splineIdle: "#0284C7",
    splineLit: "#0284C7",
    dust: "#475569",
    shadow: "#0F172A",
  },
};
