export type PortalRole = "client" | "director" | "president" | "member";
export type StaffRole = "director" | "president";

export function isStaffRole(
  role: string | null | undefined,
): role is StaffRole {
  return role === "director" || role === "president";
}

export function isPresidentRole(
  role: string | null | undefined,
): role is "president" {
  return role === "president";
}
