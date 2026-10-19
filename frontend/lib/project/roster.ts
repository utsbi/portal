import { isStaffRole, type PortalRole } from "@/lib/auth/roles";
import type { Json } from "@/lib/supabase/database.types";

export interface RosterProfile {
  id: number;
  name: string;
  email: string | null;
  contact_email: string | null;
  role: PortalRole;
  uid: string | null;
  portal_activated_at: string | null;
}

export interface RosterAssignment {
  id: number;
  role: string;
  profile_id: number;
  created_at: string | null;
  profiles: RosterProfile | null;
  assigner: { id: number; name: string } | null;
}

export interface ProjectPerson {
  id: number;
  profile_id: number;
  role: PortalRole;
  isOwner: boolean;
  canRemove: boolean;
  accountStatus: "active" | "pending" | "no_account";
  created_at: string | null;
  profiles: RosterProfile;
  assigner: { id: number; name: string } | null;
}

/** The persisted marker survives project renames. The fallback supports the
 * existing default SBI workspace until the migration has been applied. */
export function isInternalProject(project: {
  config: Json | null;
  company_name: string;
  is_default: boolean;
}) {
  const config = project.config;
  if (config && typeof config === "object" && !Array.isArray(config)) {
    if (config.workspace_type === "sbi") return true;
  }
  return (
    project.is_default && project.company_name.trim().toUpperCase() === "SBI"
  );
}

/** Ownership is a relationship; the displayed role is always the profile role.
 * Internal rosters originate from all non-client profiles, not account status. */
export function buildProjectRoster(
  assigned: RosterAssignment[],
  automaticProfiles: RosterProfile[],
  isInternal: boolean,
): ProjectPerson[] {
  const assignments = new Map(assigned.map((row) => [row.profile_id, row]));
  const profiles = new Map<number, RosterProfile>();
  if (!isInternal) {
    for (const row of assigned) {
      if (row.profiles) profiles.set(row.profile_id, row.profiles);
    }
  }
  for (const profile of automaticProfiles) {
    if (isInternal ? profile.role !== "client" : isStaffRole(profile.role)) {
      profiles.set(profile.id, profile);
    }
  }

  return [...profiles.values()]
    .map((profile): ProjectPerson => {
      const assignment = assignments.get(profile.id);
      const isOwner = assignment?.role === "owner";
      return {
        id: assignment?.id ?? -profile.id,
        profile_id: profile.id,
        role: profile.role,
        isOwner,
        canRemove:
          !isInternal &&
          !isOwner &&
          !isStaffRole(profile.role) &&
          assignment?.role === "member",
        accountStatus: !profile.uid
          ? "no_account"
          : profile.portal_activated_at
            ? "active"
            : "pending",
        created_at: assignment?.created_at ?? null,
        profiles: profile,
        assigner: assignment?.assigner ?? null,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isOwner) - Number(a.isOwner) ||
        a.profiles.name.localeCompare(b.profiles.name),
    );
}
