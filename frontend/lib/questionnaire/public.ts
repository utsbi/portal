import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { notifyFormSubmission } from "@/lib/questionnaire/notify";
import {
  type AnswerMap,
  type FormSchema,
  type FormWindowState,
  formWindowState,
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
  opens_at: string | null;
  closes_at: string | null;
}

async function loadPublicFormRow(token: string): Promise<PublicFormRow | null> {
  // Reject empty/garbage tokens before hitting the DB.
  if (!token || token.length < 16) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("custom_form_schemas")
    .select(
      "id, title, description, visibility, public_password_hash, fields, version, is_active, opens_at, closes_at",
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
  windowState: FormWindowState;
  /** Present only when open AND no password gate (password reveals on unlock). */
  schema: FormSchema | null;
}

/** Public-facing metadata. Never returns the password hash; gates the schema
 *  behind the password and the open/close window. */
export async function getPublicForm(
  token: string,
): Promise<PublicFormView | null> {
  const row = await loadPublicFormRow(token);
  if (!row) return null;
  const requiresPassword = row.visibility === "password";
  const windowState = formWindowState(row.opens_at, row.closes_at);
  return {
    title: row.title,
    description: row.description,
    requiresPassword,
    windowState,
    schema:
      requiresPassword || windowState !== "open"
        ? null
        : parseFormSchema(row.fields),
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

// Conservative, generous payload caps for the public (unauthenticated) submit
// path. Persistence here uses the service role with no RLS, so an attacker
// could otherwise store arbitrary keys / arbitrarily large values as a
// storage / DoS vector. These limits sit well above any realistic form and are
// layered ON TOP OF the schema-based answer validation below, never replacing
// it.
const MAX_ANSWER_ENTRIES = 500; // distinct keys in the answer map
const MAX_TOTAL_ANSWERS_BYTES = 256 * 1024; // serialized JSON length, 256 KB
const MAX_SINGLE_VALUE_BYTES = 50 * 1024; // any one answer value, 50 KB

/**
 * Reject answer maps that exceed conservative size/count bounds before they are
 * persisted. Returns a generic, user-safe message (no internals leaked) so the
 * caller can surface a 400-style error; returns null when within bounds.
 */
function checkAnswerBounds(answers: AnswerMap): string | null {
  const tooLarge = "Your submission is too large. Please shorten your answers.";

  const keys = Object.keys(answers);
  if (keys.length > MAX_ANSWER_ENTRIES) return tooLarge;

  let serialized: string;
  try {
    serialized = JSON.stringify(answers);
  } catch {
    // Non-serializable (e.g. circular) payloads are rejected outright.
    return tooLarge;
  }
  if (serialized.length > MAX_TOTAL_ANSWERS_BYTES) return tooLarge;

  for (const key of keys) {
    const value = answers[key];
    if (value == null) continue;
    const valueLength = Array.isArray(value)
      ? value.reduce((sum, item) => sum + String(item).length, 0)
      : String(value).length;
    if (valueLength > MAX_SINGLE_VALUE_BYTES) return tooLarge;
  }

  return null;
}

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

  const windowState = formWindowState(row.opens_at, row.closes_at);
  if (windowState !== "open") {
    return {
      error:
        windowState === "not_yet"
          ? "This form is not open yet."
          : "This form is closed.",
    };
  }

  // Bot check BEFORE any password verification. Checking the password first
  // would expose a timing/response oracle: an attacker could probe whether a
  // password is correct by observing whether they receive "Incorrect password."
  // vs "Captcha verification failed." Turnstile runs first so the password gate
  // is only reachable by requests that have passed the bot challenge.
  if (!(await verifyTurnstile(input.turnstileToken))) {
    return { error: "Captcha verification failed. Please try again." };
  }

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

  // Conservative size/count guard on the persisted payload (storage/DoS).
  const boundsError = checkAnswerBounds(input.answers);
  if (boundsError) return { error: boundsError };

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

  await notifyFormSubmission({
    formId: row.id,
    via: "public",
    submitterName: name,
    submitterEmail: email,
  });
  return { ok: true };
}
