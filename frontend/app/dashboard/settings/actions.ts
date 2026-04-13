"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Not authenticated" };

  // Verify caller is a director
  const admin = getAdminClient();
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("uid", currentUser.id)
    .single();

  if (!callerProfile || callerProfile.role !== "director") {
    return { error: "Only directors can create accounts" };
  }

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
  const admin = getAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, name, email, role, department, created_at")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, accounts: [] };
  return { accounts: profiles || [] };
}

export async function deleteAccount(profileId: number) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Not authenticated" };

  const admin = getAdminClient();

  // Verify caller is director
  const { data: caller } = await admin
    .from("profiles")
    .select("role")
    .eq("uid", currentUser.id)
    .single();

  if (caller?.role !== "director") return { error: "Not authorized" };

  // Get the profile to delete
  const { data: profile } = await admin
    .from("profiles")
    .select("uid")
    .eq("id", profileId)
    .single();

  if (!profile) return { error: "Profile not found" };

  // Delete auth user (cascades to profile via FK)
  const { error } = await admin.auth.admin.deleteUser(profile.uid);
  if (error) return { error: error.message };

  return { success: true };
}

// ============================================================
// Team Management
// ============================================================

export async function listProjects() {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id, url_slug, company_name")
    .order("company_name");

  if (error) return { error: error.message, projects: [] };
  return { projects: data || [] };
}

export async function listProjectMembers(projectId: number) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("project_members")
    .select("id, role, profile_id, profiles(id, name, email, role)")
    .eq("project_id", projectId)
    .order("role");

  if (error) return { error: error.message, members: [] };
  return { members: data || [] };
}

export async function assignMemberToProject(profileId: number, projectId: number) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Not authenticated" };

  const admin = getAdminClient();

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
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Not authenticated" };

  const admin = getAdminClient();
  const { error } = await admin
    .from("project_members")
    .delete()
    .eq("id", membershipId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function listUnassignedMembers(projectId: number) {
  const admin = getAdminClient();

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
