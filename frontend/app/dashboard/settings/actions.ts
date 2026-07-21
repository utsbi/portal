"use server";

import { randomUUID } from "node:crypto";
import { requireDirector } from "@/lib/auth/guards";
import { getPortalOrigin, sendAccountInvite } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "./types";

// ---------------------------------------------------------------------------
// requireUser — personal-account gate (any authenticated user).
//
// Uses the RLS-respecting server client for both the auth check and the
// profile read.  A user reading / updating their own profile is permitted by
// RLS, so the service-role client is not needed here.
// ---------------------------------------------------------------------------

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name, email, department, config")
    .eq("uid", user.id)
    .single();

  if (!profile) return { error: "Profile not found" as const };

  return {
    error: null,
    supabase,
    uid: user.id,
    profile,
  };
}

// ============================================================
// Account Management
// ============================================================

const ACCOUNT_ROLES = ["client", "director", "member"] as const;
type AccountRole = (typeof ACCOUNT_ROLES)[number];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteAccount(data: {
  email: string;
  name: string;
  role: AccountRole;
  companyName?: string;
  department?: string;
}) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const admin = createAdminClient();
  const callerProfileId = gate.profileId;

  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();
  const companyName = data.companyName?.trim() || null;
  const department = data.department?.trim() || null;
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: "Enter a valid email address" };
  }
  if (name.length < 2 || name.length > 100) {
    return { error: "Name must be between 2 and 100 characters" };
  }
  if (!ACCOUNT_ROLES.includes(data.role)) {
    return { error: "Select a valid account role" };
  }
  if (
    data.role === "client" &&
    (!companyName || companyName.length < 2 || companyName.length > 150)
  ) {
    return { error: "Company name must be between 2 and 150 characters" };
  }
  if (department && department.length > 100) {
    return { error: "Department must be 100 characters or fewer" };
  }

  // Generate a one-time Supabase invite token for our custom Resend template.
  // The director never creates, sees, or communicates the recipient's password.
  const { data: authData, error: authError } =
    await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { name, role: data.role } },
    });

  if (authError || !authData.user || !authData.properties.hashed_token) {
    return {
      error: authError?.message || "Couldn't create an invitation link",
    };
  }

  const uid = authData.user.id;
  let createdProjectId: number | null = null;

  const rollbackInvite = async () => {
    if (createdProjectId !== null) {
      await admin.from("projects").delete().eq("id", createdProjectId);
    }
    await admin.auth.admin.deleteUser(uid);
  };

  // Create profile
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      uid,
      name,
      email,
      role: data.role,
      department: data.role === "member" ? department : null,
    })
    .select("id")
    .single();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(uid);
    return { error: profileError?.message || "Couldn't create the profile" };
  }

  // If client, create a project AND link the client as its owner. Without
  // the project_members(owner) row the project is orphaned — no member sees
  // the client in the team list, and downstream queries that look up the
  // owner (calendar attendees, etc.) miss them entirely.
  if (data.role === "client" && companyName) {
    const slug =
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "project";
    const uniqueSlug = `${slug}-${randomUUID().replaceAll("-", "").slice(0, 8)}`;

    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({
        url_slug: uniqueSlug,
        company_name: companyName,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      // Roll back: auth user → profile cascades via FK. Without this the
      // email is permanently burned and re-running the form fails with a
      // duplicate-email error.
      await rollbackInvite();
      return { error: projectError?.message || "Couldn't create project" };
    }
    createdProjectId = project.id;

    const { error: ownerError } = await admin.from("project_members").insert({
      profile_id: profile.id,
      project_id: project.id,
      role: "owner",
      assigned_by: callerProfileId ?? null,
    });

    if (ownerError) {
      await rollbackInvite();
      return {
        error: `Couldn't create the client project: ${ownerError.message}`,
      };
    }
  }

  const { data: inviter } = await gate.supabase
    .from("profiles")
    .select("name")
    .eq("id", callerProfileId)
    .maybeSingle();
  const confirmationParams = new URLSearchParams({
    token_hash: authData.properties.hashed_token,
    type: "invite",
    next: "/auth/update-password",
  });

  try {
    await sendAccountInvite({
      email,
      recipientName: name,
      invitedByName: inviter?.name ?? "An SBI director",
      role: data.role,
      confirmationUrl: `${getPortalOrigin()}/auth/confirm?${confirmationParams.toString()}`,
      userId: uid,
    });
  } catch (error) {
    console.error("Account invitation delivery failed:", error);
    await rollbackInvite();
    return {
      error:
        "The invitation email could not be delivered, so no account was created. Try again.",
    };
  }

  return { success: true, profileId: profile.id, invitedEmail: email };
}

export async function listAccounts() {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, accounts: [] };
  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, name, email, role, department, created_at")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, accounts: [] };
  return { accounts: profiles || [] };
}

export async function updateAccount(data: {
  id: number;
  name: string;
  role: "client" | "director" | "member";
  department: string | null;
}) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const admin = createAdminClient();
  const callerProfileId = gate.profileId;

  const name = data.name.trim();
  if (name.length < 2) return { error: "Name must be at least 2 characters" };

  const department = data.department?.trim() || null;

  // Fetch the existing row so we can detect a role change.
  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", data.id)
    .single();
  if (existingError || !existing)
    return { error: existingError?.message || "Profile not found" };

  // Block self role-change to prevent locking yourself out mid-session.
  if (data.id === callerProfileId && data.role !== existing.role) {
    return { error: "You can't change your own role." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ name, role: data.role, department })
    .eq("id", data.id);
  if (error) return { error: error.message };

  // If the role changed, reconcile project_members. Two hard rules:
  //   1. NEVER delete 'owner' rows — removing one orphans the client's
  //      project (no member sees them in the team list, owner-based lookups
  //      miss them, and nothing recreates the row).
  //   2. The DB director auto-link triggers fire only on profile INSERT and
  //      project INSERT — never on a role UPDATE — so promotion to director
  //      must backfill director memberships here, and demotion must remove
  //      exactly the rows the auto-link would have created.
  if (data.role !== existing.role) {
    if (existing.role === "director") {
      // Demotion from director: drop only the auto-linked director rows,
      // preserving owner/member memberships.
      const { error: cleanupError } = await admin
        .from("project_members")
        .delete()
        .eq("profile_id", data.id)
        .eq("role", "director");
      if (cleanupError) {
        return {
          error: `Role saved, but removing their director project access failed: ${cleanupError.message}. Remove them from projects via the Team panel.`,
        };
      }
    } else {
      // Other role changes: clean stale non-owner rows (e.g. 'member'
      // assignments) so they don't reference a role the profile no longer
      // has. The caller can reassign memberships from the Team panel.
      const { error: cleanupError } = await admin
        .from("project_members")
        .delete()
        .eq("profile_id", data.id)
        .neq("role", "owner");
      if (cleanupError) {
        return {
          error: `Role saved, but cleaning up their project memberships failed: ${cleanupError.message}. Adjust their projects via the Team panel.`,
        };
      }
    }

    if (data.role === "director") {
      // Promotion to director: mirror auto_link_director_to_projects()
      // (INSERT ... ON CONFLICT DO NOTHING) for all existing projects.
      // ignoreDuplicates leaves any surviving row (e.g. 'owner') untouched,
      // matching the trigger's ON CONFLICT DO NOTHING semantics.
      const { data: projects, error: projectsError } = await admin
        .from("projects")
        .select("id");
      if (projectsError) {
        return {
          error: `Role saved, but granting director project access failed: ${projectsError.message}. Assign their projects via the Team panel.`,
        };
      }
      if (projects && projects.length > 0) {
        const { error: backfillError } = await admin
          .from("project_members")
          .upsert(
            projects.map((p: { id: number }) => ({
              project_id: p.id,
              profile_id: data.id,
              role: "director" as const,
              assigned_by: callerProfileId ?? null,
            })),
            { onConflict: "project_id,profile_id", ignoreDuplicates: true },
          );
        if (backfillError) {
          return {
            error: `Role saved, but granting director project access failed: ${backfillError.message}. Assign their projects via the Team panel.`,
          };
        }
      }
    }
  }

  return { success: true };
}

export async function deleteAccount(profileId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const admin = createAdminClient();
  const uid = gate.userId;

  // Get the profile to delete
  const { data: profile } = await admin
    .from("profiles")
    .select("uid")
    .eq("id", profileId)
    .single();

  if (!profile) return { error: "Profile not found" };

  if (profile.uid === uid) return { error: "Cannot delete your own account" };

  // Delete auth user (cascades to profile via FK)
  const { error } = await admin.auth.admin.deleteUser(profile.uid);
  if (error) return { error: error.message };

  return { success: true };
}

// ============================================================
// Team Management
// ============================================================

export async function listProjects() {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, projects: [] };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("projects")
    .select("id, url_slug, company_name")
    .order("company_name");

  if (error) return { error: error.message, projects: [] };
  return { projects: data || [] };
}

export async function listProjectMembers(projectId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, members: [] };
  const admin = createAdminClient();

  // project_members has two FKs to profiles (profile_id + assigned_by), so
  // we name the constraints. Aliasing the assigner embed as `assigner` keeps
  // the resulting payload tidy.
  const { data: assigned, error: assignedError } = await admin
    .from("project_members")
    .select(
      "id, role, profile_id, created_at, " +
        "profiles!project_members_profile_id_fkey(id, name, email, role), " +
        "assigner:profiles!project_members_assigned_by_fkey(id, name)",
    )
    .eq("project_id", projectId)
    .order("role");
  if (assignedError) return { error: assignedError.message, members: [] };

  // Directors are documented as auto-assigned to every project. If the
  // backfill trigger has missed any, materialise them in the response so
  // the UI never shows an empty list when a director clearly belongs.
  const { data: directors, error: directorsError } = await admin
    .from("profiles")
    .select("id, name, email, role")
    .eq("role", "director")
    .order("name");
  if (directorsError) return { error: directorsError.message, members: [] };

  type AssignedRow = {
    id: number;
    role: string;
    profile_id: number;
    created_at: string | null;
    profiles: {
      id: number;
      name: string;
      email: string | null;
      role: string;
    } | null;
    assigner: { id: number; name: string } | null;
  };
  type DirectorRow = {
    id: number;
    name: string;
    email: string | null;
    role: string;
  };

  const assignedRows = (assigned || []) as unknown as AssignedRow[];
  const directorRows = (directors || []) as unknown as DirectorRow[];

  const seen = new Set(assignedRows.map((m) => m.profile_id));
  const synthetic = directorRows
    .filter((d) => !seen.has(d.id))
    .map((d) => ({
      // Display-only rows for directors auto-assigned without a backing
      // project_members row. `synthetic: true` is the discriminator — the
      // negative id is just for React keys, but UI code MUST check
      // `synthetic` before passing the id to any mutation.
      id: -d.id,
      synthetic: true as const,
      role: "director" as const,
      profile_id: d.id,
      created_at: null,
      profiles: { id: d.id, name: d.name, email: d.email, role: d.role },
      assigner: null,
    }));

  // Mark real rows explicitly for symmetry.
  const real = assignedRows.map((m) => ({ ...m, synthetic: false as const }));

  return { members: [...synthetic, ...real] };
}

export async function assignMemberToProject(
  profileId: number,
  projectId: number,
) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const admin = createAdminClient();
  const callerProfileId = gate.profileId;

  const { error } = await admin.from("project_members").insert({
    profile_id: profileId,
    project_id: projectId,
    role: "member",
    assigned_by: callerProfileId ?? null,
  });

  if (error) {
    if (error.code === "23505")
      return { error: "Already assigned to this project" };
    return { error: error.message };
  }

  return { success: true };
}

export async function removeMemberFromProject(membershipId: number) {
  // Synthetic director rows use negative ids (no real row backs them).
  // Reject them defensively — Supabase would silently match zero rows
  // and report success, masking a real bug.
  if (!Number.isInteger(membershipId) || membershipId <= 0) {
    return { error: "Invalid membership id" };
  }

  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const admin = createAdminClient();

  const { error } = await admin
    .from("project_members")
    .delete()
    .eq("id", membershipId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function assignOwnerToProject(
  profileId: number,
  projectId: number,
) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const admin = createAdminClient();
  const callerProfileId = gate.profileId;

  // Verify the target is actually a client.
  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .single();
  if (!target) return { error: "Profile not found" };
  if (target.role !== "client")
    return { error: "Only clients can be project owners" };

  // Enforce one-owner-per-project at the application layer (no partial
  // unique index exists yet).
  const { data: existingOwner } = await admin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("role", "owner")
    .maybeSingle();
  if (existingOwner) return { error: "This project already has an owner" };

  const { error } = await admin.from("project_members").insert({
    profile_id: profileId,
    project_id: projectId,
    role: "owner",
    assigned_by: callerProfileId ?? null,
  });
  if (error) {
    if (error.code === "23505")
      return { error: "Client is already on this project" };
    return { error: error.message };
  }

  return { success: true };
}

export async function listAvailableOwners(projectId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, clients: [] };
  const admin = createAdminClient();

  // All clients not already a member of this project.
  const { data: existing } = await admin
    .from("project_members")
    .select("profile_id")
    .eq("project_id", projectId);
  const taken = (existing || []).map(
    (r: { profile_id: number }) => r.profile_id,
  );

  let query = admin
    .from("profiles")
    .select("id, name, email")
    .eq("role", "client")
    .order("name");
  if (taken.length > 0) query = query.not("id", "in", `(${taken.join(",")})`);

  const { data, error } = await query;
  if (error) return { error: error.message, clients: [] };
  return { clients: data || [] };
}

export async function listUnassignedMembers(projectId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, members: [] };
  const admin = createAdminClient();

  // Get all members not already in this project
  const { data: existingIds } = await admin
    .from("project_members")
    .select("profile_id")
    .eq("project_id", projectId);

  const assignedIds = (existingIds || []).map(
    (r: { profile_id: number }) => r.profile_id,
  );

  let query = admin
    .from("profiles")
    .select("id, name, email, role, department")
    .eq("role", "member")
    .order("name");

  if (assignedIds.length > 0) {
    query = query.not("id", "in", `(${assignedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message, members: [] };
  return { members: data || [] };
}

// ============================================================
// Personal Account (any authenticated user)
// ============================================================

export async function getMyAccount() {
  const ctx = await requireUser();
  if (ctx.error) return { error: ctx.error };

  const config = (ctx.profile.config as Record<string, unknown>) || {};
  const storedPrefs =
    (config.notifications as Partial<NotificationPrefs>) || {};
  const prefs: NotificationPrefs = {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...storedPrefs,
  };

  return {
    error: null,
    account: {
      id: ctx.profile.id,
      name: ctx.profile.name,
      email: ctx.profile.email,
      role: ctx.profile.role,
      department: ctx.profile.department,
      prefs,
    },
  };
}

export async function updateMyProfile(data: {
  name: string;
  department: string | null;
}) {
  const ctx = await requireUser();
  if (ctx.error) return { error: ctx.error };

  const name = data.name.trim();
  if (name.length < 2) return { error: "Name must be at least 2 characters" };

  const department = data.department?.trim() || null;

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ name, department })
    .eq("id", ctx.profile.id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMyPassword(newPassword: string) {
  const ctx = await requireUser();
  if (ctx.error) return { error: ctx.error };

  if (newPassword.length < 8)
    return { error: "Password must be at least 8 characters" };

  const { error } = await ctx.supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMyNotificationPrefs(prefs: NotificationPrefs) {
  const ctx = await requireUser();
  if (ctx.error) return { error: ctx.error };

  const config = (ctx.profile.config as Record<string, unknown>) || {};
  const nextConfig = { ...config, notifications: prefs };

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ config: nextConfig })
    .eq("id", ctx.profile.id);

  if (error) return { error: error.message };
  return { success: true };
}
