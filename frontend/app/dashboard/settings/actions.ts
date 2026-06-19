"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "./types";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY environment variable",
    );
  }
  return createAdminClient(supabaseUrl, supabaseSecretKey);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, name, email, department, config")
    .eq("uid", user.id)
    .single();

  if (!profile) return { error: "Profile not found" as const };

  return {
    error: null,
    admin,
    supabase,
    uid: user.id,
    profile,
  };
}

async function requireDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: "Not authenticated" as const, admin: null, uid: null };

  const admin = getAdminClient();
  const { data: caller } = await admin
    .from("profiles")
    .select("id, role")
    .eq("uid", user.id)
    .single();

  if (!caller || caller.role !== "director") {
    return { error: "Not authorized" as const, admin: null, uid: null };
  }

  return { error: null, admin, uid: user.id, profileId: caller.id };
}

// ============================================================
// Account Management
// ============================================================

export async function createAccount(data: {
  email: string;
  password: string;
  name: string;
  role: "client" | "director" | "member";
  companyName?: string;
  department?: string;
}) {
  const {
    error: authzError,
    admin,
    profileId: callerProfileId,
  } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

  if (data.password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  // Create auth user
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

  if (authError) {
    return { error: authError.message };
  }

  const uid = authData.user.id;

  // Create profile
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      uid,
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department || null,
    })
    .select("id")
    .single();

  if (profileError) {
    await admin.auth.admin.deleteUser(uid);
    return { error: profileError.message };
  }

  // If client, create a project AND link the client as its owner. Without
  // the project_members(owner) row the project is orphaned — no member sees
  // the client in the team list, and downstream queries that look up the
  // owner (calendar attendees, etc.) miss them entirely.
  if (data.role === "client" && data.companyName) {
    const slug =
      data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({
        url_slug: slug,
        company_name: data.companyName,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      // Roll back: auth user → profile cascades via FK. Without this the
      // email is permanently burned and re-running the form fails with a
      // duplicate-email error.
      await admin.auth.admin.deleteUser(uid);
      return { error: projectError?.message || "Couldn't create project" };
    }

    const { error: ownerError } = await admin.from("project_members").insert({
      profile_id: profile.id,
      project_id: project.id,
      role: "owner",
      assigned_by: callerProfileId ?? null,
    });

    if (ownerError) {
      // Project exists but ownership link failed. Surface a non-fatal
      // warning — the director can recover from the Team panel.
      return {
        success: true,
        profileId: profile.id,
        warning: `Project created, but couldn't link the owner: ${ownerError.message}. Use the Team panel to assign the owner manually.`,
      };
    }
  }

  // If director, auto-link triggers will add them to all projects
  // If member, they need to be explicitly assigned via team management

  return { success: true, profileId: profile.id };
}

export async function listAccounts() {
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin)
    return { error: authzError || "Not authorized", accounts: [] };

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
  const {
    error: authzError,
    admin,
    profileId: callerProfileId,
  } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

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

  // If the role changed, clean stale project_members rows so they don't
  // reference a role the profile no longer has. The caller can reassign
  // memberships explicitly from the Team panel.
  if (data.role !== existing.role) {
    await admin.from("project_members").delete().eq("profile_id", data.id);
  }

  return { success: true };
}

export async function deleteAccount(profileId: number) {
  const { error: authzError, admin, uid } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

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
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin)
    return { error: authzError || "Not authorized", projects: [] };
  const { data, error } = await admin
    .from("projects")
    .select("id, url_slug, company_name")
    .order("company_name");

  if (error) return { error: error.message, projects: [] };
  return { projects: data || [] };
}

export async function listProjectMembers(projectId: number) {
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin)
    return { error: authzError || "Not authorized", members: [] };

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
  const {
    error: authzError,
    admin,
    profileId: callerProfileId,
  } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

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

  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

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
  const {
    error: authzError,
    admin,
    profileId: callerProfileId,
  } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

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
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin)
    return { error: authzError || "Not authorized", clients: [] };

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
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin)
    return { error: authzError || "Not authorized", members: [] };

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

  const { error } = await ctx.admin
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

  const { error } = await ctx.admin
    .from("profiles")
    .update({ config: nextConfig })
    .eq("id", ctx.profile.id);

  if (error) return { error: error.message };
  return { success: true };
}
