import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Return only the people who belong to the requested project for event invites. */
export async function GET(request: Request) {
  const projectId = Number(new URL(request.url).searchParams.get("project_id"));
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: caller, error: callerError } = await admin
    .from("profiles")
    .select("id")
    .eq("uid", user.id)
    .maybeSingle();
  if (callerError || !caller) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await admin
    .from("project_members")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("profile_id", caller.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "You do not have access to this project" },
      { status: 403 },
    );
  }

  const { data: memberships, error: membersError } = await admin
    .from("project_members")
    .select("profile_id")
    .eq("project_id", projectId);
  if (membersError) {
    console.error("calendar members lookup failed:", membersError);
    return NextResponse.json(
      { error: "Couldn't load project members" },
      { status: 500 },
    );
  }

  const profileIds = (memberships ?? []).map((row) => row.profile_id);
  const { data: profiles, error: profilesError } = profileIds.length
    ? await admin
        .from("profiles")
        .select("id, name, role")
        .in("id", profileIds)
        .order("name", { ascending: true })
    : { data: [], error: null };
  if (profilesError) {
    console.error("calendar invitee lookup failed:", profilesError);
    return NextResponse.json(
      { error: "Couldn't load project members" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    members: (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.name,
      role: profile.role,
    })),
  });
}
