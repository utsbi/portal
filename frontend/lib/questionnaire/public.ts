import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  type AnswerMap,
  type FormSchema,
  parseFormSchema,
  validateAnswers,
} from "@/lib/questionnaire/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Server-only logic for public (capability-link) questionnaire forms.
// Every function here runs with the service-role client AFTER the caller has
// verified the relevant gate; nothing in this module is reachable from the
// browser (enforced by "server-only").
// ---------------------------------------------------------------------------

export type PublicVisibility = "link" | "password";

/** 32 random bytes, URL-safe. Capability secret embedded in the share link. */
export function generatePublicToken(): string {
  return randomBytes(32).toString("base64url");
}

// --- Password hashing (scrypt; salted; constant-time compare) --------------

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return timingSafeEqual(derived, expected);
}

// --- Turnstile (Cloudflare) bot verification -------------------------------

export async function verifyTurnstile(token: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not configured");
    return false;
  }
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, response: token }),
      },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification error", err);
    return false;
  }
}

// --- Form loading ----------------------------------------------------------

interface PublicFormRow {
  id: number;
  title: string;
  description: string | null;
  visibility: string;
  public_password_hash: string | null;
  fields: Json;
  version: number;
  is_active: boolean | null;
}

async function loadPublicFormRow(token: string): Promise<PublicFormRow | null> {
  // Reject empty/garbage tokens before hitting the DB.
  if (!token || token.length < 16) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("custom_form_schemas")
    .select(
      "id, title, description, visibility, public_password_hash, fields, version, is_active",
    )
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;
  if (data.is_active === false) return null;
  if (data.visibility !== "link" && data.visibility !== "password") return null;
  return data as PublicFormRow;
}

export interface PublicFormView {
  title: string;
  description: string | null;
  requiresPassword: boolean;
  /** Only present when no password gate (password forms reveal it on unlock). */
  schema: FormSchema | null;
}

/** Public-facing metadata. Never returns the password hash; gates the schema
 *  behind the password for password-protected forms. */
export async function getPublicForm(
  token: string,
): Promise<PublicFormView | null> {
  const row = await loadPublicFormRow(token);
  if (!row) return null;
  const requiresPassword = row.visibility === "password";
  return {
    title: row.title,
    description: row.description,
    requiresPassword,
    schema: requiresPassword ? null : parseFormSchema(row.fields),
  };
}

/** Verify a password and, on success, return the form schema. */
export async function unlockPublicForm(
  token: string,
  password: string,
): Promise<{ schema: FormSchema } | { error: string }> {
  const row = await loadPublicFormRow(token);
  if (!row || row.visibility !== "password" || !row.public_password_hash) {
    return { error: "This form is not available." };
  }
  if (!verifyPassword(password, row.public_password_hash)) {
    return { error: "Incorrect password." };
  }
  return { schema: parseFormSchema(row.fields) };
}

// --- Submission ------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PublicSubmitInput {
  token: string;
  password?: string;
  submitterName: string;
  submitterEmail: string;
  answers: AnswerMap;
  turnstileToken: string | null;
}

export async function submitPublicForm(
  input: PublicSubmitInput,
): Promise<{ ok: true } | { error: string }> {
  const row = await loadPublicFormRow(input.token);
  if (!row) return { error: "This form is not available." };

  // Re-verify the password gate server-side on submit (never trust the client).
  if (row.visibility === "password") {
    if (
      !row.public_password_hash ||
      !input.password ||
      !verifyPassword(input.password, row.public_password_hash)
    ) {
      return { error: "Incorrect password." };
    }
  }

  // Bot check.
  if (!(await verifyTurnstile(input.turnstileToken))) {
    return { error: "Captcha verification failed. Please try again." };
  }

  // Submitter identity.
  const name = input.submitterName.trim();
  const email = input.submitterEmail.trim();
  if (!name) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email." };

  // Answer validation against the live schema.
  const schema = parseFormSchema(row.fields);
  const errors = validateAnswers(schema, input.answers);
  if (errors.length > 0) {
    return {
      error: `Please complete ${errors.length} required or invalid field${
        errors.length > 1 ? "s" : ""
      }.`,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("custom_form_submissions").insert({
    form_id: row.id,
    user_id: null,
    project_id: null,
    data: input.answers as unknown as Json,
    status: "submitted",
    schema_version: row.version,
    submitter_name: name,
    submitter_email: email,
  });
  if (error) return { error: "Could not submit. Please try again." };
  return { ok: true };
}
