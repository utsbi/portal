/**
 * Create missing test accounts and reset existing accounts' passwords in place.
 * Existing profiles, projects, memberships, and messages are never deleted.
 *
 * Usage (from frontend): bun run scripts/seed-test-accounts.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and
 * SEED_TEST_PASSWORD in .env.local or the environment. Use a test database.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const TEST_ACCOUNTS = [
  {
    email: "director@utsbi.org",
    name: "Test Director",
    role: "director" as const,
    department: null,
    companyName: null,
  },
  {
    email: "client@utsbi.org",
    name: "Test Client",
    role: "client" as const,
    department: null,
    companyName: "Test Corp",
  },
  {
    email: "member@utsbi.org",
    name: "Test Member",
    role: "member" as const,
    department: "Engineering",
    companyName: null,
  },
];

export async function seedTestAccounts(
  supabase: SupabaseClient,
  password: string,
) {
  if (!password) throw new Error("Missing SEED_TEST_PASSWORD");

  // listUsers is paginated; do not mistake accounts beyond page one for new users.
  const existingUsers = new Map<string, string>();
  const perPage = 100;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`Cannot list auth users: ${error.message}`);
    for (const user of data.users) {
      if (user.email) existingUsers.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < perPage) break;
  }

  console.log("Seeding test accounts (preserving existing data)...\n");

  for (const account of TEST_ACCOUNTS) {
    const existingUid = existingUsers.get(account.email);
    const { data: authData, error: authError } = existingUid
      ? await supabase.auth.admin.updateUserById(existingUid, {
          password,
          email_confirm: true,
        })
      : await supabase.auth.admin.createUser({
          email: account.email,
          password,
          email_confirm: true,
        });

    if (authError || !authData.user) {
      throw new Error(
        `Cannot ${existingUid ? "update" : "create"} ${account.email}: ${authError?.message ?? "No auth user returned"}`,
      );
    }

    const uid = authData.user.id;
    console.log(
      `  ${existingUid ? "Reset password" : "Created auth user"}: ${account.email}`,
    );

    const { data: existingProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("uid", uid)
      .maybeSingle();
    if (lookupError) {
      throw new Error(
        `Cannot look up ${account.email}: ${lookupError.message}`,
      );
    }

    let profile = existingProfile;
    if (!profile) {
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          uid,
          name: account.name,
          email: account.email,
          role: account.role,
          department: account.department,
        })
        .select("id, role")
        .single();
      if (error || !data) {
        throw new Error(
          `Cannot create profile for ${account.email}: ${error?.message ?? "No profile returned"}`,
        );
      }
      profile = data;
    }
    if (profile.role !== account.role) {
      throw new Error(
        `Unexpected role for ${account.email}: ${profile.role}; expected ${account.role}. Existing profile left unchanged.`,
      );
    }
    console.log(`  Profile: id=${profile.id}, role=${profile.role}`);

    if (account.role === "client" && account.companyName) {
      const { data: projects, error: projectLookupError } = await supabase
        .from("projects")
        .select("id")
        .eq("created_by", profile.id)
        .limit(1);
      if (projectLookupError) {
        throw new Error(
          `Cannot look up projects: ${projectLookupError.message}`,
        );
      }
      const { data: memberships, error: membershipError } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("profile_id", profile.id)
        .limit(1);
      if (membershipError) {
        throw new Error(
          `Cannot look up memberships: ${membershipError.message}`,
        );
      }

      if (!projects?.length && !memberships?.length) {
        const slug =
          account.companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") +
          "-" +
          Math.random().toString(36).slice(2, 6);
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            url_slug: slug,
            company_name: account.companyName,
            created_by: profile.id,
          })
          .select("id, url_slug")
          .single();
        if (projectError || !project) {
          throw new Error(
            `Cannot create client project: ${projectError?.message ?? "No project returned"}`,
          );
        }
        console.log(
          `  Created project: ${project.url_slug} (id=${project.id})`,
        );
        // Database triggers handle client/director project assignment.
      } else {
        console.log("  Preserved existing client project/memberships.");
      }
    }
    console.log("");
  }
}

export async function verifyTestAccounts(
  supabase: SupabaseClient,
  signInClient: SupabaseClient,
  password: string,
) {
  let ok = true;
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .in(
      "email",
      TEST_ACCOUNTS.map((a) => a.email),
    );
  if (error) throw new Error(`Cannot verify profiles: ${error.message}`);

  for (const account of TEST_ACCOUNTS) {
    const matching = profiles?.filter((p) => p.email === account.email) ?? [];
    if (matching.length !== 1 || matching[0].role !== account.role) {
      console.error(`  FAIL: ${account.email} — missing or incorrect profile`);
      ok = false;
    }
  }

  console.log("Testing sign-in...\n");
  for (const account of TEST_ACCOUNTS) {
    const { data, error: signInError } =
      await signInClient.auth.signInWithPassword({
        email: account.email,
        password,
      });
    if (signInError || !data.user) {
      console.error(
        `  FAIL: ${account.email} — ${signInError?.message ?? "No user returned"}`,
      );
      ok = false;
    } else {
      console.log(`  OK:   ${account.email} — signed in as ${data.user.id}`);
      const { error: signOutError } = await signInClient.auth.signOut();
      if (signOutError) {
        console.error(`  FAIL: sign-out — ${signOutError.message}`);
        ok = false;
      }
    }
  }
  return ok;
}

async function main() {
  // Explicitly support .env.local even when run with a runtime other than Bun.
  config({ path: resolve(import.meta.dirname, "../.env.local"), quiet: true });
  config({ path: resolve(import.meta.dirname, "../.env"), quiet: true });

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    const password = process.env.SEED_TEST_PASSWORD;
    if (!url || !key || !password) {
      throw new Error(
        "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and SEED_TEST_PASSWORD in frontend/.env.local or the environment.",
      );
    }
    const options = {
      auth: { autoRefreshToken: false, persistSession: false },
    };
    const supabase = createClient(url, key, options);
    // A separate client keeps test sign-ins from replacing the admin session.
    const signInClient = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || key,
      options,
    );
    await seedTestAccounts(supabase, password);
    const ok = await verifyTestAccounts(supabase, signInClient, password);
    console.log(ok ? "\nSeed complete." : "\nSeed had errors.");
    process.exitCode = ok ? 0 : 1;
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
