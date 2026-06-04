import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Field-definition convention for custom_form_schemas.fields (jsonb)
//
// The live DB ships forms with `fields: []` (no convention captured yet) and a
// legacy questionnaire_responses blob keyed by form-id → field-name → answer.
// We standardize `fields` as an ordered array of typed field definitions. This
// is the canonical shape the upcoming form-builder writes and the fill-out UI
// renders. Parsing is defensive so malformed/empty rows degrade to zero fields
// rather than throwing.
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "checkbox"
  | "file";

export interface FieldOption {
  label: string;
  value: string;
}

export interface FormField {
  /** Stable key used as the answer key in custom_form_submissions.data. */
  key: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  /** Choice fields only. */
  options?: FieldOption[];
  placeholder?: string;
}

export type SubmissionStatus = "Done" | "In Process";

export interface QuestionnaireFormView {
  id: number;
  title: string;
  description: string | null;
  fields: FormField[];
  questionCount: number;
  status: SubmissionStatus;
  /** True when a submission exists but a required field is unanswered. */
  missingRequired: boolean;
  submissionId: number | null;
}

export interface QuestionnaireData {
  forms: QuestionnaireFormView[];
}

// ---------------------------------------------------------------------------
// Defensive parsing of the untyped jsonb `fields` array.
// ---------------------------------------------------------------------------

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "checkbox",
  "file",
];

function asRecord(value: Json): Record<string, Json> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : null;
}

function parseOptions(raw: Json | undefined): FieldOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options: FieldOption[] = [];
  for (const entry of raw) {
    const rec = asRecord(entry);
    if (rec && typeof rec.value === "string") {
      options.push({
        value: rec.value,
        label: typeof rec.label === "string" ? rec.label : rec.value,
      });
    } else if (typeof entry === "string") {
      options.push({ value: entry, label: entry });
    }
  }
  return options.length > 0 ? options : undefined;
}

export function parseFormFields(raw: Json): FormField[] {
  if (!Array.isArray(raw)) return [];
  const fields: FormField[] = [];
  for (const entry of raw) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const key =
      typeof rec.key === "string" && rec.key.length > 0
        ? rec.key
        : typeof rec.name === "string"
          ? rec.name
          : null;
    if (!key) continue;
    const type =
      typeof rec.type === "string" &&
      FIELD_TYPES.includes(rec.type as FieldType)
        ? (rec.type as FieldType)
        : "text";
    fields.push({
      key,
      type,
      label: typeof rec.label === "string" ? rec.label : key,
      description:
        typeof rec.description === "string" ? rec.description : undefined,
      required: rec.required === true,
      placeholder:
        typeof rec.placeholder === "string" ? rec.placeholder : undefined,
      options: parseOptions(rec.options),
    });
  }
  return fields;
}

function isAnswered(value: Json | undefined): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// ---------------------------------------------------------------------------
// Server read path: active forms + this user's submissions for one project.
// ---------------------------------------------------------------------------

export async function fetchQuestionnaireData(
  projectId: number,
): Promise<QuestionnaireData | { redirect: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const [{ data: schemas }, { data: submissions }] = await Promise.all([
    supabase
      .from("custom_form_schemas")
      .select("id, title, description, fields")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("custom_form_submissions")
      .select("id, form_id, data")
      .eq("user_id", user.id)
      .eq("project_id", projectId),
  ]);

  const submissionByForm = new Map<
    number,
    { id: number; data: Record<string, Json> }
  >();
  for (const s of submissions ?? []) {
    submissionByForm.set(s.form_id, {
      id: s.id,
      data: asRecord(s.data) ?? {},
    });
  }

  const forms: QuestionnaireFormView[] = (schemas ?? []).map((schema) => {
    const fields = parseFormFields(schema.fields);
    const submission = submissionByForm.get(schema.id) ?? null;
    const hasSubmission = submission !== null;
    const missingRequired = hasSubmission
      ? fields.some((f) => f.required && !isAnswered(submission?.data[f.key]))
      : fields.some((f) => f.required);

    return {
      id: schema.id,
      title: schema.title,
      description: schema.description,
      fields,
      questionCount: fields.length,
      status: hasSubmission && !missingRequired ? "Done" : "In Process",
      missingRequired: hasSubmission && missingRequired,
      submissionId: submission?.id ?? null,
    };
  });

  return { forms };
}
