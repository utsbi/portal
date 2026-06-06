import type { AnswerMap } from "@/lib/questionnaire/schema";
import {
  countQuestions,
  type FieldDef,
  type FormSchema,
  isAnswered,
  isFieldVisible,
  parseFormSchema,
  validateAnswers,
} from "@/lib/questionnaire/schema";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Read paths for the questionnaire system. The canonical field/section/logic
// model lives in lib/questionnaire/schema.ts; this module wraps Supabase reads
// for (a) the client list/overview + fill-out, and (b) the director builder +
// responses. Forms live in custom_form_schemas.fields (jsonb array); per-project
// assignment lives in custom_form_assignments; answers live in
// custom_form_submissions (status draft|submitted, schema_version snapshot).
// ---------------------------------------------------------------------------

export type SubmissionStatus = "Done" | "In Process" | "Not Started";

export interface QuestionnaireFormView {
  id: number;
  title: string;
  description: string | null;
  version: number;
  schema: FormSchema;
  /** Back-compat shim for the existing list UI: ordered answerable fields. */
  fields: {
    key: string;
    type: string;
    label: string;
    required: boolean;
    description?: string;
  }[];
  questionCount: number;
  status: SubmissionStatus;
  /** True when the saved draft/submission is missing a visible required field. */
  missingRequired: boolean;
  submissionId: number | null;
  submissionStatus: "draft" | "submitted" | null;
}

export interface QuestionnaireData {
  forms: QuestionnaireFormView[];
}

function asRecord(value: Json | undefined): Record<string, Json> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : null;
}

function toAnswerMap(data: Json | undefined): AnswerMap {
  const rec = asRecord(data);
  if (!rec) return {};
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v === null || typeof v === "string" || typeof v === "number") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.filter((x): x is string => typeof x === "string");
    }
  }
  return out;
}

function fieldShim(fields: FieldDef[]) {
  return fields
    .filter((f) => f.type !== "section")
    .map((f) => ({
      key: f.id,
      type: f.type,
      label: f.label,
      required: f.required === true,
      description: f.description,
    }));
}

// ---------------------------------------------------------------------------
// CLIENT read path: forms assigned to this project + this user's submissions.
// A form is visible to a client only when it has been explicitly assigned to one
// of their projects via custom_form_assignments. A project with no assignment
// rows sees NO forms (assignment is the authorization boundary — we never fall
// back to "all active forms", which would leak other directors' forms).
// ---------------------------------------------------------------------------

export async function fetchQuestionnaireData(
  projectId: number,
): Promise<QuestionnaireData | { redirect: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const [{ data: assignments }, { data: submissions }] = await Promise.all([
    supabase
      .from("custom_form_assignments")
      .select("form_id")
      .eq("project_id", projectId),
    supabase
      .from("custom_form_submissions")
      .select("id, form_id, data, status")
      .eq("user_id", user.id)
      .eq("project_id", projectId),
  ]);

  const assignedFormIds = new Set<number>(
    (assignments ?? []).map((a) => a.form_id),
  );

  // No assignment for this project => no forms. Assignment is the authorization
  // boundary; we do not fall back to showing every active form.
  if (assignedFormIds.size === 0) return { forms: [] };

  const { data: schemas } = await supabase
    .from("custom_form_schemas")
    .select("id, title, description, fields, version")
    .eq("is_active", true)
    .in("id", Array.from(assignedFormIds))
    .order("created_at", { ascending: true });

  const submissionByForm = new Map<
    number,
    { id: number; data: AnswerMap; status: "draft" | "submitted" }
  >();
  for (const s of submissions ?? []) {
    submissionByForm.set(s.form_id, {
      id: s.id,
      data: toAnswerMap(s.data),
      status: (s.status as "draft" | "submitted") ?? "draft",
    });
  }

  const forms: QuestionnaireFormView[] = (schemas ?? []).map((schema) => {
    const parsed = parseFormSchema(schema.fields);
    const submission = submissionByForm.get(schema.id) ?? null;
    const answers = submission?.data ?? {};

    const visibleRequiredMissing = parsed.fields.some(
      (f) =>
        f.type !== "section" &&
        f.required &&
        isFieldVisible(f, answers) &&
        !isAnswered(answers[f.id] ?? null),
    );

    let status: SubmissionStatus;
    if (!submission) status = "Not Started";
    else if (submission.status === "submitted") status = "Done";
    else status = "In Process";

    return {
      id: schema.id,
      title: schema.title,
      description: schema.description,
      version: schema.version ?? 1,
      schema: parsed,
      fields: fieldShim(parsed.fields),
      questionCount: countQuestions(parsed),
      status,
      missingRequired:
        submission?.status === "submitted"
          ? false
          : !!submission && visibleRequiredMissing,
      submissionId: submission?.id ?? null,
      submissionStatus: submission?.status ?? null,
    };
  });

  return { forms };
}

// ---------------------------------------------------------------------------
// CLIENT fill-out read: one form schema + this user's current answers/status.
// ---------------------------------------------------------------------------

export interface FillOutData {
  formId: number;
  title: string;
  description: string | null;
  version: number;
  schema: FormSchema;
  answers: AnswerMap;
  submissionId: number | null;
  status: "draft" | "submitted" | null;
}

export async function fetchFillOutData(
  formId: number,
  projectId: number,
): Promise<FillOutData | { redirect: string } | { notFound: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const [{ data: schema }, { data: submission }] = await Promise.all([
    supabase
      .from("custom_form_schemas")
      .select("id, title, description, fields, version, is_active")
      .eq("id", formId)
      .maybeSingle(),
    supabase
      .from("custom_form_submissions")
      .select("id, data, status")
      .eq("form_id", formId)
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  if (!schema || schema.is_active === false) return { notFound: true };

  return {
    formId: schema.id,
    title: schema.title,
    description: schema.description,
    version: schema.version ?? 1,
    schema: parseFormSchema(schema.fields),
    answers: submission ? toAnswerMap(submission.data) : {},
    submissionId: submission?.id ?? null,
    status: (submission?.status as "draft" | "submitted" | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// DIRECTOR read path: forms this director created + assignment + response stats.
// ---------------------------------------------------------------------------

export interface DirectorFormView {
  id: number;
  title: string;
  description: string | null;
  version: number;
  isActive: boolean;
  questionCount: number;
  fieldCount: number;
  sectionCount: number;
  assignedProjectIds: number[];
  submissionCount: number;
  submittedCount: number;
  updatedAt: string | null;
}

export interface DirectorProject {
  id: number;
  name: string;
}

export interface DirectorData {
  forms: DirectorFormView[];
  projects: DirectorProject[];
}

export async function fetchDirectorData(): Promise<
  DirectorData | { redirect: string } | { forbidden: true }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("uid", user.id)
    .maybeSingle();
  if (!profile) return { redirect: "/login" };
  if (profile.role !== "director") return { forbidden: true };

  const { data: schemas } = await supabase
    .from("custom_form_schemas")
    .select("id, title, description, fields, version, is_active, updated_at")
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false });

  const formIds = (schemas ?? []).map((s) => s.id);

  const [{ data: assignments }, { data: submissions }, { data: memberships }] =
    await Promise.all([
      formIds.length > 0
        ? supabase
            .from("custom_form_assignments")
            .select("form_id, project_id")
            .in("form_id", formIds)
        : Promise.resolve({
            data: [] as { form_id: number; project_id: number | null }[],
          }),
      formIds.length > 0
        ? supabase
            .from("custom_form_submissions")
            .select("form_id, status")
            .in("form_id", formIds)
        : Promise.resolve({
            data: [] as { form_id: number; status: string }[],
          }),
      // Projects this director belongs to (assignment targets).
      supabase
        .from("project_members")
        .select("project_id, projects(id, company_name)")
        .eq("profile_id", profile.id),
    ]);

  const assignmentsByForm = new Map<number, number[]>();
  for (const a of assignments ?? []) {
    if (a.project_id == null) continue;
    const list = assignmentsByForm.get(a.form_id) ?? [];
    list.push(a.project_id);
    assignmentsByForm.set(a.form_id, list);
  }

  const subsByForm = new Map<number, { total: number; submitted: number }>();
  for (const s of submissions ?? []) {
    const agg = subsByForm.get(s.form_id) ?? { total: 0, submitted: 0 };
    agg.total += 1;
    if (s.status === "submitted") agg.submitted += 1;
    subsByForm.set(s.form_id, agg);
  }

  const forms: DirectorFormView[] = (schemas ?? []).map((s) => {
    const parsed = parseFormSchema(s.fields);
    const agg = subsByForm.get(s.id) ?? { total: 0, submitted: 0 };
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      version: s.version ?? 1,
      isActive: s.is_active !== false,
      questionCount: countQuestions(parsed),
      fieldCount: parsed.fields.filter((f) => f.type !== "section").length,
      sectionCount: parsed.fields.filter((f) => f.type === "section").length,
      assignedProjectIds: assignmentsByForm.get(s.id) ?? [],
      submissionCount: agg.total,
      submittedCount: agg.submitted,
      updatedAt: s.updated_at,
    };
  });

  const projects: DirectorProject[] = (memberships ?? [])
    .map((m) => {
      const p = m.projects as unknown as
        | { id: number; company_name: string }
        | { id: number; company_name: string }[]
        | null;
      const proj = Array.isArray(p) ? p[0] : p;
      return proj ? { id: proj.id, name: proj.company_name } : null;
    })
    .filter((x): x is DirectorProject => x !== null);

  return { forms, projects };
}

// ---------------------------------------------------------------------------
// DIRECTOR single-form read for the editor (full schema + current assignment).
// ---------------------------------------------------------------------------

export interface EditFormData {
  id: number;
  title: string;
  description: string | null;
  version: number;
  isActive: boolean;
  schema: FormSchema;
  assignedProjectIds: number[];
  projects: DirectorProject[];
}

export async function fetchEditFormData(
  formId: number,
): Promise<
  EditFormData | { redirect: string } | { forbidden: true } | { notFound: true }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("uid", user.id)
    .maybeSingle();
  if (!profile) return { redirect: "/login" };
  if (profile.role !== "director") return { forbidden: true };

  const { data: schema } = await supabase
    .from("custom_form_schemas")
    .select("id, title, description, fields, version, is_active, created_by")
    .eq("id", formId)
    .maybeSingle();
  if (!schema) return { notFound: true };
  if (schema.created_by !== user.id) return { forbidden: true };

  const [{ data: assignments }, { data: memberships }] = await Promise.all([
    supabase
      .from("custom_form_assignments")
      .select("project_id")
      .eq("form_id", formId),
    supabase
      .from("project_members")
      .select("project_id, projects(id, company_name)")
      .eq("profile_id", profile.id),
  ]);

  const projects: DirectorProject[] = (memberships ?? [])
    .map((m) => {
      const p = m.projects as unknown as
        | { id: number; company_name: string }
        | { id: number; company_name: string }[]
        | null;
      const proj = Array.isArray(p) ? p[0] : p;
      return proj ? { id: proj.id, name: proj.company_name } : null;
    })
    .filter((x): x is DirectorProject => x !== null);

  return {
    id: schema.id,
    title: schema.title,
    description: schema.description,
    version: schema.version ?? 1,
    isActive: schema.is_active !== false,
    schema: parseFormSchema(schema.fields),
    assignedProjectIds: (assignments ?? [])
      .map((a) => a.project_id)
      .filter((x): x is number => x != null),
    projects,
  };
}

// ---------------------------------------------------------------------------
// DIRECTOR responses read: every submission for one form, with answers.
// ---------------------------------------------------------------------------

export interface ResponseRow {
  submissionId: number;
  userId: string;
  /** Responder display name (from profiles); null if no profile row. */
  userName: string | null;
  /** Responder email (from profiles); null if unset. */
  userEmail: string | null;
  projectId: number | null;
  status: "draft" | "submitted";
  submittedAt: string | null;
  updatedAt: string | null;
  schemaVersion: number;
  answers: AnswerMap;
  /**
   * Answerable fields of the schema_version this row was captured against, so
   * answers render with the labels/options the respondent actually saw. Falls
   * back to the current schema when no snapshot exists for that version.
   */
  fields: FieldDef[];
  /** Required fields missing (against this row's own schema version). */
  missingRequired: boolean;
}

export interface ResponsesData {
  formId: number;
  title: string;
  schema: FormSchema;
  rows: ResponseRow[];
}

export async function fetchResponsesData(
  formId: number,
): Promise<
  | ResponsesData
  | { redirect: string }
  | { forbidden: true }
  | { notFound: true }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: schema } = await supabase
    .from("custom_form_schemas")
    .select("id, title, fields, created_by")
    .eq("id", formId)
    .maybeSingle();
  if (!schema) return { notFound: true };
  if (schema.created_by !== user.id) return { forbidden: true };

  const parsed = parseFormSchema(schema.fields);

  const { data: submissions } = await supabase
    .from("custom_form_submissions")
    .select(
      "id, user_id, project_id, status, submitted_at, updated_at, schema_version, data",
    )
    .eq("form_id", formId)
    .order("updated_at", { ascending: false });

  // Resolve responder identities (uid -> name/email) so the viewer shows who
  // answered instead of a raw UUID.
  const responderIds = Array.from(
    new Set((submissions ?? []).map((s) => s.user_id)),
  );
  const profileByUid = new Map<
    string,
    { name: string; email: string | null }
  >();
  if (responderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("uid, name, email")
      .in("uid", responderIds);
    for (const p of profiles ?? []) {
      profileByUid.set(p.uid, { name: p.name, email: p.email });
    }
  }

  // Resolve each submission's schema_version to the field definitions it was
  // captured against, so old answers aren't reinterpreted against an edited
  // live schema. Versions with no snapshot row (e.g. before the snapshot
  // migration was applied) fall back to the current schema.
  const versionSchemas = new Map<number, FormSchema>();
  const neededVersions = Array.from(
    new Set((submissions ?? []).map((s) => s.schema_version ?? 1)),
  );
  if (neededVersions.length > 0) {
    const { data: snapshots } = await supabase
      .from("custom_form_schema_versions")
      .select("version, fields")
      .eq("form_id", formId)
      .in("version", neededVersions);
    for (const snap of snapshots ?? []) {
      versionSchemas.set(snap.version, parseFormSchema(snap.fields));
    }
  }
  const schemaForVersion = (version: number): FormSchema =>
    versionSchemas.get(version) ?? parsed;

  const rows: ResponseRow[] = (submissions ?? []).map((s) => {
    const answers = toAnswerMap(s.data);
    const version = s.schema_version ?? 1;
    const rowSchema = schemaForVersion(version);
    const missing = validateAnswers(rowSchema, answers).length > 0;
    const profile = profileByUid.get(s.user_id) ?? null;
    return {
      submissionId: s.id,
      userId: s.user_id,
      userName: profile?.name ?? null,
      userEmail: profile?.email ?? null,
      projectId: s.project_id,
      status: (s.status as "draft" | "submitted") ?? "draft",
      submittedAt: s.submitted_at,
      updatedAt: s.updated_at,
      schemaVersion: version,
      answers,
      fields: rowSchema.fields.filter((f) => f.type !== "section"),
      missingRequired: missing,
    };
  });

  return { formId, title: schema.title, schema: parsed, rows };
}

// ---------------------------------------------------------------------------
// DIRECTOR form version history: every snapshotted version of a form's fields.
// ---------------------------------------------------------------------------

export interface FormVersionView {
  version: number;
  createdAt: string | null;
  questionCount: number;
  sectionCount: number;
  schema: FormSchema;
  isCurrent: boolean;
}

export interface FormHistoryData {
  formId: number;
  title: string;
  currentVersion: number;
  versions: FormVersionView[];
}

export async function fetchFormHistory(
  formId: number,
): Promise<
  | FormHistoryData
  | { redirect: string }
  | { forbidden: true }
  | { notFound: true }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: schema } = await supabase
    .from("custom_form_schemas")
    .select("id, title, version, created_by")
    .eq("id", formId)
    .maybeSingle();
  if (!schema) return { notFound: true };
  if (schema.created_by !== user.id) return { forbidden: true };

  const currentVersion = schema.version ?? 1;

  const { data: rows } = await supabase
    .from("custom_form_schema_versions")
    .select("version, fields, created_at")
    .eq("form_id", formId)
    .order("version", { ascending: false });

  const versions: FormVersionView[] = (rows ?? []).map((r) => {
    const parsed = parseFormSchema(r.fields);
    return {
      version: r.version,
      createdAt: r.created_at,
      questionCount: countQuestions(parsed),
      sectionCount: parsed.fields.filter((f) => f.type === "section").length,
      schema: parsed,
      isCurrent: r.version === currentVersion,
    };
  });

  return { formId, title: schema.title, currentVersion, versions };
}
