import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface ResolvedActor {
  profile: {
    id: number;
    name: string;
    email: string;
    role: "client" | "director" | "member";
    initials: string;
    department: string | null;
  };
  projects: {
    projectId: number;
    projectSlug: string;
    companyName: string;
    role: "owner" | "director" | "member";
  }[];
  activeProjectId: number | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || "??";
}

/**
 * Server-side actor resolution.
 * Replaces the 4-place "check clients then members" pattern.
 * Returns null if not authenticated or no profile found.
 */
export async function resolveActor(): Promise<ResolvedActor | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch profile from new identity table
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, department")
    .eq("uid", user.id)
    .single();

  if (!profile) return null;

  // Fetch all project memberships
  const { data: memberships } = await supabase
    .from("project_members")
    .select("role, project_id, projects(id, url_slug, company_name)")
    .eq("profile_id", profile.id);

  type MembershipRow = {
    role: string;
    projects: {
      id: number;
      url_slug: string;
      company_name: string;
    } | null;
  };

  const projects = ((memberships ?? []) as unknown as MembershipRow[])
    .filter(
      (
        m,
      ): m is MembershipRow & {
        projects: NonNullable<MembershipRow["projects"]>;
      } => m.projects !== null,
    )
    .map((m) => ({
      projectId: m.projects.id,
      projectSlug: m.projects.url_slug,
      companyName: m.projects.company_name,
      role: m.role as "owner" | "director" | "member",
    }));

  // Read active project from cookie
  const cookieStore = await cookies();
  const savedId = cookieStore.get("active_project_id")?.value;
  const activeProjectId = savedId
    ? parseInt(savedId, 10)
    : (projects[0]?.projectId ?? null);

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email || user.email || "",
      role: profile.role as ResolvedActor["profile"]["role"],
      initials: getInitials(profile.name),
      department: profile.department ?? null,
    },
    projects,
    activeProjectId,
  };
}
