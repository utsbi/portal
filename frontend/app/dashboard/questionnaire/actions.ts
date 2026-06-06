"use server";

import { revalidatePath } from "next/cache";
import { notifyFormSubmission } from "@/lib/questionnaire/notify";
import { generatePublicToken, hashPassword } from "@/lib/questionnaire/public";
import type { AnswerMap } from "@/lib/questionnaire/schema";
import {
  type FormSchema,
  parseFormSchema,
  serializeFormSchema,
  validateAnswers,
} from "@/lib/questionnaire/schema";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./action-types";

// ---------------------------------------------------------------------------
// Server actions for the questionnaire system.
//   Director: createForm, updateForm, setAssignments, setFormActive, deleteForm
//   Client:   saveDraft, submitForm
// All director actions gate on profiles.role === 'director' AND ownership of the
// schema row (created_by). Client actions gate on auth only; RLS enforces the
// per-row constraints as defense in depth.
// ---------------------------------------------------------------------------

const QUESTIONNAIRE_PATH = "/dashboard/questionnaire";
const BUILDER_PATH = "/dashboard/questionnaire/builder";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type DirectorGate =
  | { ok: false; error: string }
  | { ok: true; supabase: Supabase; userId: string; profileId: number };

type AuthGate =
  | { ok: false; error: string }
  | { ok: true; supabase: Supabase; userId: string };

async function requireDirector(): Promise<DirectorGate> {
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
  if (profile.role !== "director") {
    return { ok: false, error: "Director role required" };
  }
  return { ok: true, supabase, userId: user.id, profileId: profile.id };
}

async function requireAuth(): Promise<AuthGate> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not authenticated" };
  return { ok: true, supabase, userId: user.id };
}

async function ownsForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formId: number,
): Promise<boolean> {
  const { data } = await supabase
    .from("custom_form_schemas")
    .select("created_by")
    .eq("id", formId)
    .maybeSingle();
  return data?.created_by === userId;
}

// ---------------------------------------------------------------------------
// Director — create / update form
// ---------------------------------------------------------------------------

export async function createForm(input: {
  title: string;
  description?: string;
  schema: FormSchema;
}): Promise<ActionResult<{ id: number }>> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };

  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  const { data, error } = await gate.supabase
    .from("custom_form_schemas")
    .insert({
      title,
      description: input.description?.trim() || null,
      fields: serializeFormSchema(input.schema) as unknown as Json,
      is_active: false, // start as draft; publish explicitly
      created_by: gate.userId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(BUILDER_PATH);
  return { id: data.id };
}

export async function updateForm(input: {
  id: number;
  title: string;
  description?: string;
  schema: FormSchema;
}): Promise<ActionResult> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!(await ownsForm(gate.supabase, gate.userId, input.id))) {
    return { error: "Form not found or not owned by you" };
  }

  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  // The DB trigger bumps `version` automatically when `fields` changes.
  const { error } = await gate.supabase
    .from("custom_form_schemas")
    .update({
      title,
      description: input.description?.trim() || null,
      fields: serializeFormSchema(input.schema) as unknown as Json,
    })
    .eq("id", input.id);

  if (error) return { error: error.message };
  revalidatePath(BUILDER_PATH);
  revalidatePath(`${BUILDER_PATH}/${input.id}`);
  return {};
}

export async function setFormActive(input: {
  id: number;
  isActive: boolean;
}): Promise<ActionResult> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!(await ownsForm(gate.supabase, gate.userId, input.id))) {
    return { error: "Form not found or not owned by you" };
  }

  const { error } = await gate.supabase
    .from("custom_form_schemas")
    .update({ is_active: input.isActive })
    .eq("id", input.id);

  if (error) return { error: error.message };
  revalidatePath(BUILDER_PATH);
  return {};
}

export async function deleteForm(input: { id: number }): Promise<ActionResult> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!(await ownsForm(gate.supabase, gate.userId, input.id))) {
    return { error: "Form not found or not owned by you" };
  }

  const { error } = await gate.supabase
    .from("custom_form_schemas")
    .delete()
    .eq("id", input.id);

  if (error) return { error: error.message };
  revalidatePath(BUILDER_PATH);
  return {};
}

// ---------------------------------------------------------------------------
// Director — assign form to projects (replace the full set).
// ---------------------------------------------------------------------------

export async function setAssignments(input: {
  formId: number;
  projectIds: number[];
}): Promise<ActionResult> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!(await ownsForm(gate.supabase, gate.userId, input.formId))) {
    return { error: "Form not found or not owned by you" };
  }

  const desired = Array.from(new Set(input.projectIds));

  const { data: existing } = await gate.supabase
    .from("custom_form_assignments")
    .select("id, project_id")
    .eq("form_id", input.formId);

  const existingByProject = new Map<number, number>();
  for (const row of existing ?? []) {
    if (row.project_id != null) existingByProject.set(row.project_id, row.id);
  }

  const toAdd = desired.filter((p) => !existingByProject.has(p));
  const toRemove = (existing ?? [])
    .filter(
      (row) => row.project_id != null && !desired.includes(row.project_id),
    )
    .map((row) => row.id);

  if (toAdd.length > 0) {
    const { error } = await gate.supabase
      .from("custom_form_assignments")
      .insert(
        toAdd.map((projectId) => ({
          form_id: input.formId,
          project_id: projectId,
        })),
      );
    if (error) return { error: error.message };
  }
  if (toRemove.length > 0) {
    const { error } = await gate.supabase
      .from("custom_form_assignments")
      .delete()
      .in("id", toRemove);
    if (error) return { error: error.message };
  }

  revalidatePath(BUILDER_PATH);
  revalidatePath(`${BUILDER_PATH}/${input.formId}`);
  return {};
}

// ---------------------------------------------------------------------------
// Client — save draft (autosave) and submit. Upsert on (form_id,user_id,project_id).
// ---------------------------------------------------------------------------

async function loadSchema(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formId: number,
): Promise<{ schema: FormSchema; version: number } | null> {
  const { data } = await supabase
    .from("custom_form_schemas")
    .select("fields, version, is_active")
    .eq("id", formId)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  return { schema: parseFormSchema(data.fields), version: data.version ?? 1 };
}

export async function saveDraft(input: {
  formId: number;
  projectId: number;
  answers: AnswerMap;
}): Promise<ActionResult<{ submissionId: number }>> {
  const gate = await requireAuth();
  if (!gate.ok) return { error: gate.error };

  const meta = await loadSchema(gate.supabase, input.formId);
  if (!meta) return { error: "Form not found or inactive" };

  const { data, error } = await gate.supabase
    .from("custom_form_submissions")
    .upsert(
      {
        form_id: input.formId,
        user_id: gate.userId,
        project_id: input.projectId,
        data: input.answers as unknown as Json,
        status: "draft",
        schema_version: meta.version,
      },
      { onConflict: "form_id,user_id,project_id" },
    )
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { submissionId: data.id };
}

export async function submitForm(input: {
  formId: number;
  projectId: number;
  answers: AnswerMap;
}): Promise<ActionResult<{ submissionId: number }>> {
  const gate = await requireAuth();
  if (!gate.ok) return { error: gate.error };

  const meta = await loadSchema(gate.supabase, input.formId);
  if (!meta) return { error: "Form not found or inactive" };

  const errors = validateAnswers(meta.schema, input.answers);
  if (errors.length > 0) {
    return {
      error: `Please fix ${errors.length} field${errors.length > 1 ? "s" : ""} before submitting.`,
    };
  }

  const { data, error } = await gate.supabase
    .from("custom_form_submissions")
    .upsert(
      {
        form_id: input.formId,
        user_id: gate.userId,
        project_id: input.projectId,
        data: input.answers as unknown as Json,
        status: "submitted",
        schema_version: meta.version,
      },
      { onConflict: "form_id,user_id,project_id" },
    )
    .select("id")
    .single();

  if (error) return { error: error.message };
  await notifyFormSubmission({
    formId: input.formId,
    via: "portal",
    userId: gate.userId,
  });
  revalidatePath(QUESTIONNAIRE_PATH);
  return { submissionId: data.id };
}

// ---------------------------------------------------------------------------
// Director — restore a previous form version (non-destructive).
// Re-applies a snapshot's fields as a new edit; the DB trigger bumps the
// version + snapshots it, so prior versions are preserved.
// ---------------------------------------------------------------------------

export async function restoreFormVersion(input: {
  formId: number;
  version: number;
}): Promise<ActionResult<{ version: number }>> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!(await ownsForm(gate.supabase, gate.userId, input.formId))) {
    return { error: "Form not found or not owned by you" };
  }

  const { data: snap } = await gate.supabase
    .from("custom_form_schema_versions")
    .select("fields")
    .eq("form_id", input.formId)
    .eq("version", input.version)
    .maybeSingle();
  if (!snap) return { error: "That version no longer exists" };

  const { data, error } = await gate.supabase
    .from("custom_form_schemas")
    .update({ fields: snap.fields })
    .eq("id", input.formId)
    .select("version")
    .single();

  if (error) return { error: error.message };
  revalidatePath(BUILDER_PATH);
  revalidatePath(`${BUILDER_PATH}/${input.formId}`);
  revalidatePath(`${BUILDER_PATH}/${input.formId}/history`);
  return { version: data.version ?? input.version };
}

// ---------------------------------------------------------------------------
// Director — configure sharing (visibility + capability token + password).
// Switching to internal clears the token + password. Going public mints a token
// if none exists. A non-empty password sets a new hash; empty keeps the
// existing one (password forms require a hash to exist).
// ---------------------------------------------------------------------------

export async function updateFormSharing(input: {
  id: number;
  visibility: "internal" | "link" | "password";
  password?: string;
}): Promise<ActionResult<{ token: string | null }>> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };
  if (!(await ownsForm(gate.supabase, gate.userId, input.id))) {
    return { error: "Form not found or not owned by you" };
  }

  const { data: cur } = await gate.supabase
    .from("custom_form_schemas")
    .select("public_token, public_password_hash")
    .eq("id", input.id)
    .maybeSingle();

  const update: {
    visibility: string;
    public_token?: string | null;
    public_password_hash?: string | null;
  } = { visibility: input.visibility };

  if (input.visibility === "internal") {
    update.public_token = null;
    update.public_password_hash = null;
  } else {
    update.public_token = cur?.public_token ?? generatePublicToken();
    if (input.visibility === "password") {
      if (typeof input.password === "string" && input.password.length > 0) {
        if (input.password.length < 6) {
          return { error: "Password must be at least 6 characters." };
        }
        update.public_password_hash = hashPassword(input.password);
      } else if (!cur?.public_password_hash) {
        return { error: "Set a password for password-protected forms." };
      }
    } else {
      update.public_password_hash = null;
    }
  }

  const { error } = await gate.supabase
    .from("custom_form_schemas")
    .update(update)
    .eq("id", input.id);
  if (error) return { error: error.message };

  revalidatePath(BUILDER_PATH);
  revalidatePath(`${BUILDER_PATH}/${input.id}`);
  return { token: update.public_token ?? cur?.public_token ?? null };
}

// ---------------------------------------------------------------------------
// Director — duplicate a form. Copies title/description/questions into a new
// draft owned by the caller. Sharing (visibility/token/password) is NOT copied:
// the duplicate starts internal so it never silently shares a public link.
// ---------------------------------------------------------------------------

export async function duplicateForm(input: {
  id: number;
}): Promise<ActionResult<{ id: number }>> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };

  const { data: src } = await gate.supabase
    .from("custom_form_schemas")
    .select("title, description, fields, created_by")
    .eq("id", input.id)
    .maybeSingle();
  if (!src) return { error: "Form not found" };
  if (src.created_by !== gate.userId) {
    return { error: "Form not found or not owned by you" };
  }

  const { data, error } = await gate.supabase
    .from("custom_form_schemas")
    .insert({
      title: `${src.title} (copy)`,
      description: src.description,
      fields: src.fields,
      is_active: false,
      created_by: gate.userId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(BUILDER_PATH);
  return { id: data.id };
}
