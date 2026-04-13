/**
 * Seed script: creates 3 test accounts (director, client, member)
 *
 * Usage: npx tsx scripts/seed-test-accounts.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

if (!TEST_PASSWORD) {
  console.error("Missing SEED_TEST_PASSWORD. Set it in .env or pass as env var:");
  console.error("  SEED_TEST_PASSWORD='yourpass' npx tsx scripts/seed-test-accounts.ts");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function cleanExisting() {
  console.log("Cleaning existing test accounts...");

  for (const account of TEST_ACCOUNTS) {
    // Find auth user by email
    const { data: users } = await supabase.auth.admin.listUsers();
    const existing = users?.users?.find((u) => u.email === account.email);

    if (existing) {
      // Delete project_members, projects, profile (cascade from auth user delete)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("uid", existing.id)
        .single();

      if (profile) {
        // Delete project memberships
        await supabase.from("project_members").delete().eq("profile_id", profile.id);

        // Delete projects created by this user
        await supabase.from("projects").delete().eq("created_by", profile.id);

        // Delete profile
        await supabase.from("profiles").delete().eq("id", profile.id);
      }

      // Delete auth user
      await supabase.auth.admin.deleteUser(existing.id);
      console.log(`  Deleted existing: ${account.email}`);
    }
  }
}

async function createTestAccounts() {
  console.log("Creating test accounts...\n");

  for (const account of TEST_ACCOUNTS) {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      console.error(`  Failed to create auth user ${account.email}:`, authError.message);
      continue;
    }

    const uid = authData.user.id;
    console.log(`  Auth user: ${account.email} (${uid})`);

    // 2. Create profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        uid,
        name: account.name,
        email: account.email,
        role: account.role,
        department: account.department,
      })
      .select("id")
      .single();

    if (profileError) {
      console.error(`  Failed to create profile:`, profileError.message);
      continue;
    }

    console.log(`  Profile: id=${profile.id}, role=${account.role}`);

    // 3. If client, create a project
    if (account.role === "client" && account.companyName) {
      const slug = account.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        + "-" + Math.random().toString(36).slice(2, 6);

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          url_slug: slug,
          company_name: account.companyName,
          created_by: profile.id,
        })
        .select("id, url_slug")
        .single();

      if (projectError) {
        console.error(`  Failed to create project:`, projectError.message);
      } else {
        console.log(`  Project: ${project.url_slug} (id=${project.id})`);
        // Note: auto_link_directors_to_new_project trigger handles director assignment
        // Note: auto_link_director_to_projects trigger handles new director → all projects
      }
    }

    console.log("");
  }
}

async function verify() {
  console.log("Verifying...\n");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email, role")
    .in("email", TEST_ACCOUNTS.map((a) => a.email))
    .order("role");

  if (!profiles?.length) {
    console.error("  No test profiles found!");
    return false;
  }

  for (const p of profiles) {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id, role, projects(company_name)")
      .eq("profile_id", p.id);

    const projectList = (memberships || [])
      .map((m: any) => `${m.projects?.company_name} (${m.role})`)
      .join(", ");

    console.log(`  ${p.role.padEnd(8)} | ${p.name.padEnd(15)} | ${p.email.padEnd(25)} | Projects: ${projectList || "none"}`);
  }

  // Test sign-in for each account
  console.log("\nTesting sign-in...\n");

  for (const account of TEST_ACCOUNTS) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: TEST_PASSWORD,
    });

    if (error) {
      console.error(`  FAIL: ${account.email} — ${error.message}`);
    } else {
      console.log(`  OK:   ${account.email} — signed in as ${data.user?.id}`);
      await supabase.auth.signOut();
    }
  }

  return true;
}

async function main() {
  try {
    await cleanExisting();
    await createTestAccounts();
    const ok = await verify();

    console.log(ok ? "\nSeed complete." : "\nSeed had errors.");
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

main();
