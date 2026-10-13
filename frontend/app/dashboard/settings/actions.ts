"use server";

import { randomUUID } from "node:crypto";
import { requireDirector } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/roles";
import { getPortalOrigin, sendAccountInvite } from "@/lib/email/send";
import {
  buildProjectRoster,
  isInternalProject,
  type RosterAssignment,
  type RosterProfile,
} from "@/lib/project/roster";
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

const ACCOUNT_ROLES = ["client", "director", "president", "member"] as const;
type AccountRole = (typeof ACCOUNT_ROLES)[number];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates a project without a client; the database adds all directors. */
export async function createProject(data: {
  companyName: string;
}): Promise<
  { success: true; projectId: number; companyName: string } | { error: string }
> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };

  const companyName = data.companyName.trim();
  if (companyName.length < 2 || companyName.length > 150) {
    return { error: "Project name must be between 2 and 150 characters" };
  }

  const slugBase =
    companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project";
  const urlSlug = `${slugBase}-${randomUUID().replaceAll("-", "").slice(0, 8)}`;

  const { data: project, error } = await createAdminClient()
    .from("projects")
    .insert({
      company_name: companyName,
      url_slug: urlSlug,
      created_by: gate.profileId,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { error: error?.message || "Couldn't create the project" };
  }

  return { success: true, projectId: project.id, companyName };
}

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
  // Only a president can create or assign the president role. Directors may
  // still manage ordinary director accounts; they may never create another
  // principal above their own role.
  if (data.role === "president" && gate.role !== "president") {
    return { error: "Only the president can manage president accounts" };
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

  // The member-profile invitation preserves historical Discord/recovery data.
  // Catch the common contact-email path here so the general form cannot make a
  // second profile for a member the director should invite from the roster.
  if (data.role === "member") {
    const { data: existingMember } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "member")
      .eq("contact_email", email)
      .maybeSingle();
    if (existingMember) {
      return {
        error:
          "A member profile already uses this contact email. Invite them from Member profiles instead.",
      };
    }
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
      portal_invited_at: new Date().toISOString(),
      portal_activated_at: null,
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
  });

  try {
    await sendAccountInvite({
      email,
      recipientName: name,
      invitedByName: inviter?.name ?? "An SBI director",
      role: data.role,
      confirmationUrl: `${getPortalOrigin()}/auth/continue?${confirmationParams.toString()}`,
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
    .select(
      "id, name, email, role, department, created_at, portal_invited_at, portal_activated_at",
    )
    .not("uid", "is", null)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, accounts: [] };
  return { accounts: profiles || [] };
}

/** Member roster records without a login. Pending invitations are Accounts. */
export async function listMemberProfiles() {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, members: [] };

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select(
      "id, name, eid, contact_email, discord_id, department, graduation, created_at, uid, portal_invited_at, portal_activated_at",
    )
    .eq("role", "member")
    .is("uid", null)
    .order("name");

  if (error) return { error: error.message, members: [] };
  return { members: data || [] };
}

/**
 * Gives an existing member profile a portal login without creating another
 * profile.  The order matters: the auth user is removed if the profile link or
 * email delivery fails, leaving the member record available to retry.
 */
export async function inviteMemberProfile(data: {
  profileId: number;
  email: string;
  department?: string | null;
}) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };

  if (!Number.isInteger(data.profileId) || data.profileId <= 0) {
    return { error: "Invalid member profile" };
  }
  const email = data.email.trim().toLowerCase();
  const department = data.department?.trim() || null;
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: "Enter a valid email address" };
  }
  if (department && department.length > 100) {
    return { error: "Department must be 100 characters or fewer" };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, name, eid, role, uid, email, department")
    .eq("id", data.profileId)
    .single();
  if (profileError || !profile) {
    return { error: profileError?.message || "Member profile not found" };
  }
  if (profile.role !== "member" || profile.uid) {
    return { error: "This member already has a portal account" };
  }

  // Supabase's generateLink does not expose a reliable created-vs-existing
  // discriminator. Refuse an existing email up front so rollback can never
  // delete somebody else's Auth user.
  const { data: usersData, error: usersError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return { error: "Couldn't check the portal account email" };
  if (
    usersData.users.some((user) => user.email?.trim().toLowerCase() === email)
  ) {
    return { error: "A portal account already uses that email address" };
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { name: profile.name, role: "member" } },
    });
  if (authError || !authData.user || !authData.properties.hashed_token) {
    return {
      error: authError?.message || "Couldn't create an invitation link",
    };
  }

  const uid = authData.user.id;
  const rollback = async () => {
    await admin
      .from("profiles")
      .update({
        uid: null,
        email: profile.email ?? null,
        department: profile.department ?? null,
        portal_invited_at: null,
        portal_activated_at: null,
      })
      .eq("id", profile.id);
    await admin.auth.admin.deleteUser(uid);
  };

  const { error: linkError } = await admin
    .from("profiles")
    .update({
      uid,
      email,
      department: department ?? profile.department ?? null,
      portal_invited_at: new Date().toISOString(),
      portal_activated_at: null,
    })
    .eq("id", profile.id)
    .is("uid", null);
  if (linkError) {
    await rollback();
    return { error: linkError.message || "Couldn't link the portal account" };
  }

  const { data: inviter } = await gate.supabase
    .from("profiles")
    .select("name")
    .eq("id", gate.profileId)
    .maybeSingle();
  const confirmationParams = new URLSearchParams({
    token_hash: authData.properties.hashed_token,
    type: "invite",
  });

  try {
    await sendAccountInvite({
      email,
      recipientName: profile.name,
      invitedByName: inviter?.name ?? "An SBI director",
      role: "member",
      confirmationUrl: `${getPortalOrigin()}/auth/continue?${confirmationParams.toString()}`,
      userId: uid,
    });
  } catch (error) {
    console.error("Member invitation delivery failed:", error);
    await rollback();
    return {
      error:
        "The invitation email could not be delivered, so no account was created. Try again.",
    };
  }

  return { success: true, profileId: profile.id, invitedEmail: email };
}

export async function resendAccountInvitation(profileId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!Number.isInteger(profileId) || profileId <= 0) {
    return { error: "Invalid account" };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, uid, name, email, role, portal_activated_at")
    .eq("id", profileId)
    .single();
  if (error || !profile?.uid || !profile.email) {
    return { error: "Portal account not found" };
  }
  if (profile.role === "president" && gate.role !== "president") {
    return { error: "Only the president can manage president accounts" };
  }
  if (profile.portal_activated_at) {
    return { error: "This account has already completed setup" };
  }
  if (!ACCOUNT_ROLES.includes(profile.role)) {
    return { error: "Invalid account role" };
  }

  // A recipient may have opened the original invite but not set a password.
  // Recovery works for both unconfirmed and confirmed existing Auth users,
  // and returns them to password setup without creating another account.
  const { data: authData, error: authError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
    });
  if (
    authError ||
    authData?.user?.id !== profile.uid ||
    !authData?.properties?.hashed_token
  ) {
    return { error: "Couldn't create a new setup link" };
  }
  const { data: inviter } = await gate.supabase
    .from("profiles")
    .select("name")
    .eq("id", gate.profileId)
    .maybeSingle();
  const params = new URLSearchParams({
    token_hash: authData.properties.hashed_token,
    type: "recovery",
  });
  try {
    await sendAccountInvite({
      email: profile.email,
      recipientName: profile.name,
      invitedByName: inviter?.name ?? "An SBI director",
      role: profile.role,
      confirmationUrl: `${getPortalOrigin()}/auth/continue?${params.toString()}`,
      userId: profile.uid,
      // Each new token must be delivered, not deduplicated as the first invite.
      deliveryKey: authData.properties.hashed_token,
    });
  } catch (error) {
    console.error("Invitation resend failed:", error);
    return { error: "The invitation could not be sent. Try again." };
  }
  return { success: true };
}

export async function setDefaultProject(projectId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return { error: "Invalid project" };
  }

  return {
    error: "SBI is the fixed internal workspace; its roster is automatic",
  };
}

export async function updateAccount(data: {
  id: number;
  name: string;
  role: "client" | "director" | "president" | "member";
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

  if (
    (existing.role === "president" || data.role === "president") &&
    gate.role !== "president"
  ) {
    return { error: "Only the president can manage president accounts" };
  }

  // Block self role-change to prevent locking yourself out mid-session.
  if (data.id === callerProfileId && data.role !== existing.role) {
    return { error: "You can't change your own role." };
  }

  // The profile-role trigger maintains SBI access. Never remove that link
  // during the legacy client-project membership reconciliation below.
  const { data: internalProject, error: internalError } =
    await findInternalProject(admin);
  if (internalError) return { error: internalError.message };

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
    if (existing.role === "director" || existing.role === "president") {
      // Demotion from director: drop only the auto-linked director rows,
      // preserving owner/member memberships.
      let cleanup = admin
        .from("project_members")
        .delete()
        .eq("profile_id", data.id)
        .eq("role", "director");
      if (internalProject)
        cleanup = cleanup.neq("project_id", internalProject.id);
      const { error: cleanupError } = await cleanup;
      if (cleanupError) {
        return {
          error: `Role saved, but removing their director project access failed: ${cleanupError.message}. Review their client-project access in Projects settings.`,
        };
      }
    } else {
      // Other role changes: clean stale non-owner rows (e.g. 'member'
      // assignments) so they don't reference a role the profile no longer
      // has. Client-project access can be reviewed in Projects settings.
      let cleanup = admin
        .from("project_members")
        .delete()
        .eq("profile_id", data.id)
        .neq("role", "owner");
      if (internalProject)
        cleanup = cleanup.neq("project_id", internalProject.id);
      const { error: cleanupError } = await cleanup;
      if (cleanupError) {
        return {
          error: `Role saved, but cleaning up their project memberships failed: ${cleanupError.message}. Review their client-project access in Projects settings.`,
        };
      }
    }

    if (data.role === "director" || data.role === "president") {
      // Promotion to director: mirror auto_link_director_to_projects()
      // (INSERT ... ON CONFLICT DO NOTHING) for all existing projects.
      // ignoreDuplicates leaves any surviving row (e.g. 'owner') untouched,
      // matching the trigger's ON CONFLICT DO NOTHING semantics.
      const { data: projects, error: projectsError } = await admin
        .from("projects")
        .select("id");
      if (projectsError) {
        return {
          error: `Role saved, but granting director project access failed: ${projectsError.message}. Review their client-project access in Projects settings.`,
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
            error: `Role saved, but granting director project access failed: ${backfillError.message}. Review their client-project access in Projects settings.`,
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
    .select("uid, role")
    .eq("id", profileId)
    .single();

  if (!profile) return { error: "Profile not found" };

  if (profile.uid && profile.uid !== uid) {
    const { data: caller } = await admin
      .from("profiles")
      .select("role")
      .eq("uid", uid)
      .maybeSingle();
    if (profile.role === "president" && caller?.role !== "president") {
      return { error: "Only the president can manage president accounts" };
    }
  }

  if (!profile.uid) return { error: "This profile has no portal account" };

  if (profile.uid === uid) return { error: "Cannot delete your own account" };

  // Keep the thread discoverable under a neutral title after its participant
  // row cascades away with the profile.
  const { data: participantRows, error: participantError } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", profileId);
  if (participantError) {
    return {
      error: `Couldn't update conversation titles: ${participantError.message}`,
    };
  }
  const conversationIds = [
    ...new Set((participantRows ?? []).map((row) => row.conversation_id)),
  ];
  if (conversationIds.length > 0) {
    const { error: titleError } = await admin
      .from("conversations")
      .update({ title_override: "Deleted User" })
      .in("id", conversationIds);
    if (titleError) {
      return {
        error: `Couldn't update conversation titles: ${titleError.message}`,
      };
    }
  }

  // Preserve historical messages but remove identity foreign keys before the
  // auth/profile cascade. The display-name snapshot keeps attribution clear.
  const { error: attributionError } = await admin
    .from("messages")
    .update({
      sender_display_name: "Deleted User",
      sender_profile_id: null,
      sender_uid: null,
    })
    .or(`sender_uid.eq.${profile.uid},sender_profile_id.eq.${profileId}`);
  if (attributionError) {
    return {
      error: `Couldn't anonymize their messages: ${attributionError.message}`,
    };
  }

  // Delete auth user (cascades to profile via FK)
  const { error } = await admin.auth.admin.deleteUser(profile.uid);
  if (error)
    return { error: error.message || "Supabase rejected account deletion" };

  return { success: true };
}

// ============================================================
// Project access and rosters
// ============================================================

type AdminClient = ReturnType<typeof createAdminClient>;

async function findInternalProject(admin: AdminClient) {
  const marked = await admin
    .from("projects")
    .select("id")
    .eq("config->>workspace_type", "sbi")
    .maybeSingle();
  if (marked.error || marked.data) return marked;
  // Transitional lookup only: the migration persists an immutable marker.
  return admin
    .from("projects")
    .select("id")
    .eq("company_name", "SBI")
    .eq("is_default", true)
    .maybeSingle();
}

async function getManagedProject(admin: AdminClient, projectId: number) {
  return admin
    .from("projects")
    .select("id, company_name, config, is_default, archived_at")
    .eq("id", projectId)
    .maybeSingle();
}

export async function listProjects() {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, projects: [] };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("projects")
    .select("id, url_slug, company_name, config, is_default, archived_at")
    .is("archived_at", null)
    .order("company_name");

  if (error) return { error: error.message, projects: [] };
  return { projects: data || [] };
}

export async function listArchivedProjects() {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, projects: [] };

  const { data, error } = await createAdminClient()
    .from("projects")
    .select("id, url_slug, company_name, config, is_default, archived_at")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  if (error) return { error: error.message, projects: [] };
  return { projects: data || [] };
}

/** Archives a project without removing its records or storage objects. */
export async function archiveProject(projectId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return { error: "Invalid project" };
  }

  const { data: project, error: lookupError } = await getManagedProject(
    createAdminClient(),
    projectId,
  );
  if (lookupError || !project) {
    return { error: lookupError?.message || "Project not found" };
  }
  if (isInternalProject(project))
    return { error: "The SBI workspace cannot be archived" };
  if (project.archived_at) return { error: "This project is already archived" };

  const { error } = await gate.supabase.rpc("archive_project", {
    _project_id: projectId,
  });
  if (error) return { error: error.message };
  return { success: true, projectName: project.company_name };
}

/** Restores an archived project and makes it available to its existing members. */
export async function restoreProject(projectId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return { error: "Invalid project" };
  }

  const { data: project, error: lookupError } = await createAdminClient()
    .from("projects")
    .select("id, company_name, archived_at")
    .eq("id", projectId)
    .maybeSingle();
  if (lookupError || !project) {
    return { error: lookupError?.message || "Project not found" };
  }
  if (!project.archived_at) return { error: "This project is already active" };

  const { error } = await gate.supabase.rpc("restore_project", {
    _project_id: projectId,
  });
  if (error) return { error: error.message };
  return { success: true, projectName: project.company_name };
}

export async function listProjectMembers(projectId: number) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error, members: [] };
  const admin = createAdminClient();
  const { data: project, error: projectError } = await getManagedProject(
    admin,
    projectId,
  );
  if (projectError || !project)
    return { error: projectError?.message || "Project not found", members: [] };
  const isInternal = isInternalProject(project);

  const { data: assigned, error: assignedError } = await admin
    .from("project_members")
    .select(
      "id, role, profile_id, created_at, " +
        "profiles!project_members_profile_id_fkey(id, name, email, contact_email, role, uid, portal_activated_at), " +
        "assigner:profiles!project_members_assigned_by_fkey(id, name)",
    )
    .eq("project_id", projectId)
    .order("created_at");
  if (assignedError) return { error: assignedError.message, members: [] };

  let automatic = admin
    .from("profiles")
    .select("id, name, email, contact_email, role, uid, portal_activated_at");
  automatic = isInternal
    ? automatic.neq("role", "client")
    : automatic.in("role", ["director", "president"]);
  const { data: profiles, error: profilesError } =
    await automatic.order("name");
  if (profilesError) return { error: profilesError.message, members: [] };

  return {
    members: buildProjectRoster(
      (assigned || []) as unknown as RosterAssignment[],
      (profiles || []) as RosterProfile[],
      isInternal,
    ),
  };
}

export async function assignMemberToProject(
  profileId: number,
  projectId: number,
) {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const admin = createAdminClient();
  const callerProfileId = gate.profileId;
  const { data: project, error: projectError } = await getManagedProject(
    admin,
    projectId,
  );
  if (projectError || !project)
    return { error: projectError?.message || "Project not found" };
  if (isInternalProject(project))
    return { error: "SBI membership is automatic for all non-clients" };
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile)
    return { error: profileError?.message || "Profile not found" };
  if (profile.role !== "member")
    return {
      error:
        "Only member profiles can be added; staff access is automatic and clients are assigned as owners",
    };

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
  // Display-only automatic roster entries use negative ids (no link exists yet).
  // Reject them defensively — Supabase would silently match zero rows
  // and report success, masking a real bug.
  if (!Number.isInteger(membershipId) || membershipId <= 0) {
    return { error: "Invalid membership id" };
  }

  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  const admin = createAdminClient();

  const { data: membership, error: lookupError } = await admin
    .from("project_members")
    .select("project_id, profile_id, role")
    .eq("id", membershipId)
    .maybeSingle();
  if (lookupError || !membership)
    return { error: lookupError?.message || "Membership not found" };
  const { data: project, error: projectError } = await getManagedProject(
    admin,
    membership.project_id,
  );
  if (projectError || !project)
    return { error: projectError?.message || "Project not found" };
  if (isInternalProject(project))
    return { error: "SBI membership is automatic for all non-clients" };
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", membership.profile_id)
    .maybeSingle();
  if (profileError || !profile)
    return { error: profileError?.message || "Profile not found" };
  if (membership.role === "owner" || isStaffRole(profile.role))
    return {
      error: "Owners and automatic staff access cannot be removed here",
    };

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
  const { data: project, error: projectError } = await getManagedProject(
    admin,
    projectId,
  );
  if (projectError || !project)
    return { error: projectError?.message || "Project not found" };
  if (isInternalProject(project))
    return { error: "Clients cannot be assigned to the SBI workspace" };

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
  const { data: project, error: projectError } = await getManagedProject(
    admin,
    projectId,
  );
  if (projectError || !project)
    return { error: projectError?.message || "Project not found", clients: [] };
  if (isInternalProject(project)) return { clients: [] };

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
  const { data: project, error: projectError } = await getManagedProject(
    admin,
    projectId,
  );
  if (projectError || !project)
    return { error: projectError?.message || "Project not found", members: [] };
  if (isInternalProject(project)) return { members: [] };

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

  // A member's department is roster metadata managed by directors. Keep the
  // stored value even if a client tampers with the submitted payload.
  const department =
    ctx.profile.role === "member"
      ? ctx.profile.department
      : data.department?.trim() || null;

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
