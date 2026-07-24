import { uuid } from "@/lib/uuid";

// ---------------------------------------------------------------------------
// Canonical form-schema definition for the Google-Forms-grade questionnaire
// system. This is the typed shape stored in `custom_form_schemas.fields` (jsonb)
// and the contract shared by the director form-builder and the client fill-out
// UI. Parsing is defensive (see parseFormSchema) so malformed / legacy rows
// degrade gracefully instead of throwing.
//
// Storage convention: `fields` is a JSON ARRAY of FieldDef objects (the DB
// CHECK enforces array-ness). Sections + ordering are expressed as fields of
// type "section" acting as page/section dividers; the array order is the
// authoritative render order. Conditional logic lives on each field.
// ---------------------------------------------------------------------------

export type FieldType =
  | "short_text"
  | "paragraph"
  | "number"
  | "date"
  | "time"
  | "radio" // single-choice (multiple-choice)
  | "checkboxes" // multi-choice
  | "dropdown" // single-choice select
  | "scale" // linear scale / rating
  | "file" // file upload
  | "section" // page / section divider (not an answerable field)
  | "text" // decorative: heading + body text (no answer)
  | "image"; // decorative: displayed image (no answer)

export const FIELD_TYPES: FieldType[] = [
  "short_text",
  "paragraph",
  "number",
  "date",
  "time",
  "radio",
  "checkboxes",
  "dropdown",
  "scale",
  "file",
  "section",
  "text",
  "image",
];

/** Display-only types that never collect an answer. */
export const DISPLAY_TYPES: FieldType[] = ["section", "text", "image"];

/** Field types that hold an answer (everything except display-only blocks). */
export const ANSWERABLE_TYPES: FieldType[] = FIELD_TYPES.filter(
  (t) => !DISPLAY_TYPES.includes(t),
);

/** True when a field collects an answer (vs. a section/text/image block). */
export function isAnswerableType(type: FieldType): boolean {
  return !DISPLAY_TYPES.includes(type);
}

export const CHOICE_TYPES: FieldType[] = ["radio", "checkboxes", "dropdown"];

export interface FieldOption {
  /** Stable value persisted as the answer. */
  value: string;
  label: string;
}

/** Per-field validation rules. All optional; only the relevant ones apply. */
export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  /** number / scale bounds. */
  min?: number;
  max?: number;
  /** scale step + endpoint labels. */
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  /** Regex source for short_text. */
  pattern?: string;
  patternMessage?: string;
}

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains" // for checkboxes (selected value among answers)
  | "is_answered"
  | "is_empty";

/**
 * Show this field/section only when the referenced field's answer satisfies the
 * condition. v1 supports a single condition per field (AND-of-one); the shape is
 * future-proofed for multiple rules.
 */
export interface ConditionRule {
  /** Field id whose answer gates this field. */
  fieldId: string;
  operator: ConditionOperator;
  /** Compared-against value (ignored for is_answered / is_empty). */
  value?: string;
}

export interface FieldDef {
  /** Stable unique id, also the answer key in submission.data. */
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required?: boolean;
  /** Choice fields only. */
  options?: FieldOption[];
  placeholder?: string;
  validation?: FieldValidation;
  /** Image block (type "image") source URL. */
  imageUrl?: string;
  /**
   * When present, the field is shown only if ALL rules pass. Empty / absent =
   * always shown. Section dividers may also carry conditions to hide a whole
   * section's following fields (see isFieldVisible).
   */
  conditions?: ConditionRule[];
}

export interface FormSchema {
  fields: FieldDef[];
}

// ---------------------------------------------------------------------------
// Answer value model (custom_form_submissions.data is keyed by field id).
// ---------------------------------------------------------------------------

export type AnswerValue = string | number | string[] | null;
export type AnswerMap = Record<string, AnswerValue>;

// ---------------------------------------------------------------------------
// Defensive parsing — tolerates the legacy `{ key, name, type }` convention the
// read path already understood, plus the new richer shape.
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const LEGACY_TYPE_MAP: Record<string, FieldType> = {
  text: "short_text",
  textarea: "paragraph",
  select: "dropdown",
  multiselect: "checkboxes",
  checkbox: "checkboxes",
};

function coerceType(raw: unknown): FieldType {
  if (typeof raw !== "string") return "short_text";
  if (FIELD_TYPES.includes(raw as FieldType)) return raw as FieldType;
  return LEGACY_TYPE_MAP[raw] ?? "short_text";
}

function parseOptions(raw: unknown): FieldOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: FieldOption[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      out.push({ value: entry, label: entry });
    } else if (isRecord(entry) && typeof entry.value === "string") {
      out.push({
        value: entry.value,
        label: typeof entry.label === "string" ? entry.label : entry.value,
      });
    }
  }
  return out.length > 0 ? out : undefined;
}

function parseValidation(raw: unknown): FieldValidation | undefined {
  if (!isRecord(raw)) return undefined;
  const v: FieldValidation = {};
  const num = (x: unknown) => (typeof x === "number" ? x : undefined);
  const str = (x: unknown) => (typeof x === "string" ? x : undefined);
  v.minLength = num(raw.minLength);
  v.maxLength = num(raw.maxLength);
  v.min = num(raw.min);
  v.max = num(raw.max);
  v.step = num(raw.step);
  v.minLabel = str(raw.minLabel);
  v.maxLabel = str(raw.maxLabel);
  v.pattern = str(raw.pattern);
  v.patternMessage = str(raw.patternMessage);
  const hasAny = Object.values(v).some((x) => x !== undefined);
  return hasAny ? v : undefined;
}

const OPERATORS: ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "is_answered",
  "is_empty",
];

function parseConditions(raw: unknown): ConditionRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ConditionRule[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const fieldId = typeof entry.fieldId === "string" ? entry.fieldId : null;
    const operator =
      typeof entry.operator === "string" &&
      OPERATORS.includes(entry.operator as ConditionOperator)
        ? (entry.operator as ConditionOperator)
        : null;
    if (!fieldId || !operator) continue;
    out.push({
      fieldId,
      operator,
      value: typeof entry.value === "string" ? entry.value : undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

let fallbackIdCounter = 0;

export function parseFormSchema(raw: unknown): FormSchema {
  if (!Array.isArray(raw)) return { fields: [] };
  const fields: FieldDef[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const id =
      (typeof entry.id === "string" && entry.id) ||
      (typeof entry.key === "string" && entry.key) ||
      (typeof entry.name === "string" && entry.name) ||
      `field_${++fallbackIdCounter}`;
    const type = coerceType(entry.type);
    const label =
      typeof entry.label === "string"
        ? entry.label
        : type === "section"
          ? "Section"
          : id;
    fields.push({
      id,
      type,
      label,
      description:
        typeof entry.description === "string" ? entry.description : undefined,
      required: entry.required === true,
      placeholder:
        typeof entry.placeholder === "string" ? entry.placeholder : undefined,
      options: parseOptions(entry.options),
      validation: parseValidation(entry.validation),
      imageUrl: typeof entry.imageUrl === "string" ? entry.imageUrl : undefined,
      conditions: parseConditions(entry.conditions),
    });
  }
  return { fields };
}

/** Serialize a FormSchema back to the jsonb array shape, dropping undefineds. */
export function serializeFormSchema(schema: FormSchema): unknown[] {
  return schema.fields.map((f) => {
    const out: Record<string, unknown> = {
      id: f.id,
      type: f.type,
      label: f.label,
    };
    if (f.description) out.description = f.description;
    if (f.required) out.required = true;
    if (f.placeholder) out.placeholder = f.placeholder;
    if (f.options && f.options.length > 0) out.options = f.options;
    if (f.validation && Object.keys(f.validation).length > 0) {
      const v: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(f.validation)) {
        if (val !== undefined) v[k] = val;
      }
      if (Object.keys(v).length > 0) out.validation = v;
    }
    if (f.imageUrl) out.imageUrl = f.imageUrl;
    if (f.conditions && f.conditions.length > 0) out.conditions = f.conditions;
    return out;
  });
}

// ---------------------------------------------------------------------------
// Conditional-logic evaluation + validation, shared by builder preview and
// client fill-out.
// ---------------------------------------------------------------------------

function answerMatches(rule: ConditionRule, answer: AnswerValue): boolean {
  switch (rule.operator) {
    case "is_answered":
      return isAnswered(answer);
    case "is_empty":
      return !isAnswered(answer);
    case "equals":
      if (Array.isArray(answer)) return answer.includes(rule.value ?? "");
      return String(answer ?? "") === (rule.value ?? "");
    case "not_equals":
      if (Array.isArray(answer)) return !answer.includes(rule.value ?? "");
      return String(answer ?? "") !== (rule.value ?? "");
    case "contains":
      if (Array.isArray(answer)) return answer.includes(rule.value ?? "");
      return String(answer ?? "").includes(rule.value ?? "");
    default:
      return true;
  }
}

/** Whether a field should render given the current answers (conditional logic). */
export function isFieldVisible(field: FieldDef, answers: AnswerMap): boolean {
  if (!field.conditions || field.conditions.length === 0) return true;
  return field.conditions.every((rule) =>
    answerMatches(rule, answers[rule.fieldId] ?? null),
  );
}

export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export interface ValidationError {
  fieldId: string;
  message: string;
}

/**
 * Validate answers against the schema, respecting conditional visibility
 * (hidden fields are never required / validated). Used by the Submit path.
 */
export function validateAnswers(
  schema: FormSchema,
  answers: AnswerMap,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of schema.fields) {
    if (!isAnswerableType(field.type)) continue;
    if (!isFieldVisible(field, answers)) continue;
    const value = answers[field.id] ?? null;
    const answered = isAnswered(value);

    if (field.required && !answered) {
      errors.push({ fieldId: field.id, message: "This field is required." });
      continue;
    }
    if (!answered) continue;

    const v = field.validation;
    if (v) {
      if (
        (field.type === "short_text" || field.type === "paragraph") &&
        typeof value === "string"
      ) {
        if (v.minLength !== undefined && value.length < v.minLength) {
          errors.push({
            fieldId: field.id,
            message: `Must be at least ${v.minLength} characters.`,
          });
        }
        if (v.maxLength !== undefined && value.length > v.maxLength) {
          errors.push({
            fieldId: field.id,
            message: `Must be at most ${v.maxLength} characters.`,
          });
        }
        if (v.pattern) {
          try {
            if (!new RegExp(v.pattern).test(value)) {
              errors.push({
                fieldId: field.id,
                message: v.patternMessage ?? "Invalid format.",
              });
            }
          } catch {
            // Ignore malformed author-supplied regex.
          }
        }
      }
      if (
        (field.type === "number" || field.type === "scale") &&
        value !== null
      ) {
        const n = typeof value === "number" ? value : Number(value);
        if (!Number.isNaN(n)) {
          if (v.min !== undefined && n < v.min) {
            errors.push({
              fieldId: field.id,
              message: `Must be at least ${v.min}.`,
            });
          }
          if (v.max !== undefined && n > v.max) {
            errors.push({
              fieldId: field.id,
              message: `Must be at most ${v.max}.`,
            });
          }
        }
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Field-builder helpers
// ---------------------------------------------------------------------------

export function generateFieldId(): string {
  return `f_${uuid().replaceAll("-", "")}`;
}

function defaultLabelForType(type: FieldType): string {
  switch (type) {
    case "section":
      return "New section";
    case "text":
      return "Heading";
    case "image":
      return "";
    default:
      return "Untitled question";
  }
}

export function defaultFieldForType(type: FieldType): FieldDef {
  const base: FieldDef = {
    id: generateFieldId(),
    type,
    label: defaultLabelForType(type),
    required: false,
  };
  if (CHOICE_TYPES.includes(type)) {
    base.options = [
      { value: "option_1", label: "Option 1" },
      { value: "option_2", label: "Option 2" },
    ];
  }
  if (type === "scale") {
    base.validation = { min: 1, max: 5, step: 1 };
  }
  if (type === "text") {
    base.description = "Add descriptive text here.";
  }
  if (type === "image") {
    base.imageUrl = "";
  }
  return base;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  paragraph: "Paragraph",
  number: "Number",
  date: "Date",
  time: "Time",
  radio: "Multiple choice",
  checkboxes: "Checkboxes",
  dropdown: "Dropdown",
  scale: "Linear scale",
  file: "File upload",
  section: "Section",
  text: "Text",
  image: "Image",
};

/** Question count = answerable fields (display blocks excluded). */
export function countQuestions(schema: FormSchema): number {
  return schema.fields.filter((f) => isAnswerableType(f.type)).length;
}

// ---------------------------------------------------------------------------
// Scheduled open/close window
// ---------------------------------------------------------------------------

export type FormWindowState = "open" | "not_yet" | "closed";

/** Where the current time falls relative to a form's opens_at / closes_at. */
export function formWindowState(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
  nowMs: number = Date.now(),
): FormWindowState {
  if (opensAt) {
    const t = Date.parse(opensAt);
    if (!Number.isNaN(t) && t > nowMs) return "not_yet";
  }
  if (closesAt) {
    const t = Date.parse(closesAt);
    if (!Number.isNaN(t) && t < nowMs) return "closed";
  }
  return "open";
}
