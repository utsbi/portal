import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "./roles";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Discriminated-union result shared by both guard functions.
 * On success the caller receives the RLS-respecting supabase client so it can
 * reuse the already-authenticated session for subsequent reads/writes.
 */
export type AuthzGate =
  | { ok: false; error: string }
  | {
      ok: true;
      supabase: Supabase;
      userId: string;
      profileId: number;
      role?: StaffRole;
    };

/**
 * Verifies the authenticated caller holds the **global** director role
 * (`profiles.role IN ('director', 'president')`).
 *
 * Always uses the RLS-respecting server client.  The service-role / admin
 * client must never be used here — doing so would bypass the very policies
 * that make the check meaningful.
 */
export async function requireDirector(): Promise<AuthzGate> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("uid", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found" };
  if (profile.role !== "director" && profile.role !== "president") {
    return { ok: false, error: "Director role required" };
  }

  return {
    ok: true,
    supabase,
    userId: user.id,
    profileId: profile.id,
    role: profile.role,
  };
}

/**
 * Verifies the authenticated caller holds the **per-project** director role
 * (`project_members.role === 'director'` for the given project).
 *
 * Always uses the RLS-respecting server client.  The service-role / admin
 * client must never be used here.
 */
export async function requireProjectDirector(
  projectId: number,
): Promise<AuthzGate> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not authenticated" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("uid", user.id)
    .single();
  if (profileError || !profile)
    return { ok: false, error: "Profile not found" };

  // Presidents are global staff and retain director access even if a legacy
  // database missed one of their synthetic project memberships.
  if (profile.role === "president") {
    return {
      ok: true,
      supabase,
      userId: user.id,
      profileId: profile.id,
      role: profile.role,
    };
  }

  const { data: membership, error: memberError } = await supabase
    .from("project_members")
    .select("role")
    .eq("profile_id", profile.id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (memberError) return { ok: false, error: "Membership lookup failed" };
  if (!membership || membership.role !== "director") {
    return { ok: false, error: "Director role required" };
  }

  return {
    ok: true,
    supabase,
    userId: user.id,
    profileId: profile.id,
    role: "director",
  };
}
