"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

export interface NotificationPrefs {
  messages: boolean;
  calendar: boolean;
  requests: boolean;
  reports: boolean;
  weeklyDigest: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  messages: true,
  calendar: true,
  requests: true,
  reports: true,
  weeklyDigest: false,
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, admin: null, uid: null };

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
  if (data.password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
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

  // If client, create a project
  if (data.role === "client" && data.companyName) {
    const slug = data.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Math.random().toString(36).slice(2, 6);

    const { error: projectError } = await admin
      .from("projects")
      .insert({
        url_slug: slug,
        company_name: data.companyName,
        created_by: profile.id,
      });

    if (projectError) {
      return { error: projectError.message };
    }
  }

  // If director, auto-link triggers will add them to all projects
  // If member, they need to be explicitly assigned via team management

  return { success: true, profileId: profile.id };
}

export async function listAccounts() {
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized", accounts: [] };

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, name, email, role, department, created_at")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, accounts: [] };
  return { accounts: profiles || [] };
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
  if (authzError || !admin) return { error: authzError || "Not authorized", projects: [] };
  const { data, error } = await admin
    .from("projects")
    .select("id, url_slug, company_name")
    .order("company_name");

  if (error) return { error: error.message, projects: [] };
  return { projects: data || [] };
}

export async function listProjectMembers(projectId: number) {
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized", members: [] };
  const { data, error } = await admin
    .from("project_members")
    .select("id, role, profile_id, profiles(id, name, email, role)")
    .eq("project_id", projectId)
    .order("role");

  if (error) return { error: error.message, members: [] };
  return { members: data || [] };
}

export async function assignMemberToProject(profileId: number, projectId: number) {
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

  const { error } = await admin
    .from("project_members")
    .insert({
      profile_id: profileId,
      project_id: projectId,
      role: "member",
    });

  if (error) {
    if (error.code === "23505") return { error: "Already assigned to this project" };
    return { error: error.message };
  }

  return { success: true };
}

export async function removeMemberFromProject(membershipId: number) {
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized" };

  const { error } = await admin
    .from("project_members")
    .delete()
    .eq("id", membershipId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function listUnassignedMembers(projectId: number) {
  const { error: authzError, admin } = await requireDirector();
  if (authzError || !admin) return { error: authzError || "Not authorized", members: [] };

  // Get all members not already in this project
  const { data: existingIds } = await admin
    .from("project_members")
    .select("profile_id")
    .eq("project_id", projectId);

  const assignedIds = (existingIds || []).map((r: any) => r.profile_id);

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
  const storedPrefs = (config.notifications as Partial<NotificationPrefs>) || {};
  const prefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS, ...storedPrefs };

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

export async function updateMyProfile(data: { name: string; department: string | null }) {
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

  if (newPassword.length < 8) return { error: "Password must be at least 8 characters" };

  const { error } = await ctx.supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateMyNotificationPrefs(prefs: NotificationPrefs) {
  const ctx = await requireUser();
  if (ctx.error) return { error: ctx.error };

  const config = ((ctx.profile.config as Record<string, unknown>) || {});
  const nextConfig = { ...config, notifications: prefs };

  const { error } = await ctx.admin
    .from("profiles")
    .update({ config: nextConfig })
    .eq("id", ctx.profile.id);

  if (error) return { error: error.message };
  return { success: true };
}
