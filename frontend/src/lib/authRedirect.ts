export function isAdminRole(role?: string | null): boolean {
  const normalized = (role || "").trim().toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "administrator" ||
    normalized === "system_administrator"
  );
}

export function getWorkspaceRedirectPath(role?: string | null): string {
  return isAdminRole(role) ? "/app?role=admin" : "/app";
}

export const DEMO_ACCOUNTS = {
  student: {
    label: "Student (S001)",
    badge: "Demo",
    email: "alice@lpu.edu",
    password: "CampVion@2026",
  },
  admin: {
    label: "Administrator",
    badge: "Admin",
    email: "admin@campvion.edu",
    password: "Admin@CampVion2026",
  },
} as const;

export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
