"use client";

import {
  ChevronDown,
  Copy,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { isActionError } from "@/app/dashboard/questionnaire/action-types";
import {
  createForm,
  setAssignments,
  setFormActive,
  updateForm,
} from "@/app/dashboard/questionnaire/actions";
import {
  btnGhost,
  btnPrimary,
  DashboardShell,
  inputClass,
  labelClass,
  PageHeader,
  Panel,
  SectionLabel,
  SelectField,
} from "@/components/dashboard/common/ui";
import type { DirectorProject } from "@/lib/data/questionnaire";
import { toastError, toastSuccess } from "@/lib/notifications";
import {
  CHOICE_TYPES,
  type ConditionOperator,
  defaultFieldForType,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  type FieldDef,
  type FieldType,
  type FormSchema,
  generateFieldId,
} from "@/lib/questionnaire/schema";
import { cn } from "@/lib/utils";

interface FormBuilderProps {
  mode: "create" | "edit";
  formId?: number;
  initialTitle?: string;
  initialDescription?: string;
  initialSchema?: FormSchema;
  initialActive?: boolean;
  projects: DirectorProject[];
  initialAssignedProjectIds?: number[];
}

type AutoSaveState = "idle" | "saving" | "saved" | "error";

export function FormBuilder({
  mode,
  formId,
  initialTitle = "",
  initialDescription = "",
  initialSchema,
  initialActive = false,
  projects,
  initialAssignedProjectIds = [],
}: FormBuilderProps) {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [fields, setFields] = useState<FieldDef[]>(initialSchema?.fields ?? []);
  const [assigned, setAssigned] = useState<number[]>(initialAssignedProjectIds);
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);
  const [currentFormId, setCurrentFormId] = useState<number | undefined>(
    formId,
  );

  // Autosave (existing forms only; creating a new form stays an explicit Save
  // so we don't auto-create empty drafts).
  const [autoSave, setAutoSave] = useState<AutoSaveState>("idle");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstAutosave = useRef(true);
  const lastAssignedRef = useRef<string>(
    JSON.stringify([...initialAssignedProjectIds].sort((a, b) => a - b)),
  );

  // Fields that can be referenced by conditional logic = answerable fields that
  // appear before the field being edited.
  const answerableBefore = (index: number): FieldDef[] =>
    fields.slice(0, index).filter((f) => f.type !== "section");

  const updateField = (id: string, patch: Partial<FieldDef>) =>
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );

  const removeField = (id: string) =>
    setFields((prev) => prev.filter((f) => f.id !== id));

  const duplicateField = (id: string) =>
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const copy: FieldDef = {
        ...prev[idx],
        id: generateFieldId(),
        label: `${prev[idx].label} (copy)`,
        options: prev[idx].options?.map((o) => ({ ...o })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const addField = (type: FieldType) =>
    setFields((prev) => [...prev, defaultFieldForType(type)]);

  // Drag-and-drop reorder via the grip handle (native HTML5 DnD).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDrop = (to: number) => {
    setFields((prev) => {
      if (dragIndex === null || dragIndex === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragIndex(null);
    setOverIndex(null);
  };

  const schema: FormSchema = useMemo(() => ({ fields }), [fields]);

  const persist = async (): Promise<number | null> => {
    if (!title.trim()) {
      toastError("Give the form a title first.");
      return null;
    }
    setSaving(true);
    try {
      if (mode === "create" && currentFormId === undefined) {
        const res = await createForm({ title, description, schema });
        if (isActionError(res)) {
          toastError(res.error);
          return null;
        }
        setCurrentFormId(res.id);
        return res.id;
      }
      const id = currentFormId ?? formId;
      if (id === undefined) return null;
      const res = await updateForm({ id, title, description, schema });
      if (isActionError(res)) {
        toastError(res.error);
        return null;
      }
      return id;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const id = await persist();
    if (id === null) return;
    // Sync assignments + active state.
    await setAssignments({ formId: id, projectIds: assigned });
    lastAssignedRef.current = JSON.stringify(
      [...assigned].sort((a, b) => a - b),
    );
    setAutoSave("saved");
    toastSuccess("Form saved.");
    if (mode === "create") {
      router.push(`/dashboard/questionnaire/builder/${id}`);
      router.refresh();
    } else {
      router.refresh();
    }
  };

  const handlePublishToggle = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const id = await persist();
    if (id === null) return;
    const next = !active;
    const res = await setFormActive({ id, isActive: next });
    if (isActionError(res)) {
      toastError(res.error);
      return;
    }
    await setAssignments({ formId: id, projectIds: assigned });
    lastAssignedRef.current = JSON.stringify(
      [...assigned].sort((a, b) => a - b),
    );
    setAutoSave("saved");
    setActive(next);
    toastSuccess(next ? "Form published." : "Form unpublished.");
    router.refresh();
  };

  const toggleProject = (id: number) =>
    setAssigned((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );

  // Debounced autosave for existing forms: persists title/description/fields and
  // re-syncs assignments only when they changed. Skips the initial mount and any
  // moment a manual Save/Publish is in flight.
  useEffect(() => {
    if (skipFirstAutosave.current) {
      skipFirstAutosave.current = false;
      return;
    }
    if (currentFormId === undefined || !title.trim() || saving) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      const id = currentFormId;
      setAutoSave("saving");
      const res = await updateForm({ id, title, description, schema });
      if (isActionError(res)) {
        setAutoSave("error");
        return;
      }
      const assignedKey = JSON.stringify([...assigned].sort((a, b) => a - b));
      if (assignedKey !== lastAssignedRef.current) {
        const ares = await setAssignments({ formId: id, projectIds: assigned });
        if (!isActionError(ares)) lastAssignedRef.current = assignedKey;
      }
      setAutoSave("saved");
    }, 1000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [title, description, schema, assigned, currentFormId, saving]);

  return (
    <DashboardShell>
      <PageHeader
        title={mode === "create" ? "New Form" : "Edit Form"}
        subtitle={
          active
            ? "Published — visible to assigned clients"
            : "Draft — not yet visible"
        }
        action={
          <div className="flex items-center gap-2">
            {currentFormId !== undefined && <AutoSaveBadge state={autoSave} />}
            <Link
              href="/dashboard/questionnaire/builder"
              className={cn(btnGhost, "h-9")}
            >
              Back
            </Link>
            <button
              type="button"
              className={cn(btnGhost, "h-9")}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </button>
            <button
              type="button"
              className={cn(btnPrimary, "h-9")}
              disabled={saving}
              onClick={handlePublishToggle}
            >
              {active ? "Unpublish" : "Publish"}
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto dashboard-scrollbar pb-10">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-6 max-w-3xl"
        >
          {/* Meta */}
          <Panel className="flex flex-col gap-4">
            <div>
              <span className={cn("block", labelClass)}>Form Title</span>
              <input
                className={cn(inputClass, "mt-2")}
                value={title}
                placeholder="e.g. Pre-construction intake"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <span className={cn("block", labelClass)}>Description</span>
              <textarea
                className={cn(inputClass, "mt-2 min-h-16 resize-y")}
                value={description}
                placeholder="Optional context shown to clients"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </Panel>

          {/* Assignment */}
          <Panel className="flex flex-col gap-3">
            <SectionLabel>Assign to projects</SectionLabel>
            {projects.length === 0 ? (
              <p className="text-xs text-sbi-muted">
                You are not a director on any project yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {projects.map((p) => {
                  const on = assigned.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProject(p.id)}
                      className={cn(
                        "px-3 h-9 rounded-md border text-xs transition-colors",
                        on
                          ? "bg-sbi-green/10 text-sbi-green border-sbi-green/40"
                          : "bg-sbi-dark-card text-sbi-muted border-sbi-dark-border/50 hover:border-white/30",
                      )}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Fields */}
          <div className="flex flex-col gap-3">
            <SectionLabel>Questions</SectionLabel>
            {fields.length === 0 && (
              <p className="text-xs text-sbi-muted px-1">
                Add your first question or section below.
              </p>
            )}
            {fields.map((field, index) => (
              <FieldEditor
                key={field.id}
                field={field}
                referenceable={answerableBefore(index)}
                isDragging={dragIndex === index}
                isOver={
                  overIndex === index &&
                  dragIndex !== null &&
                  dragIndex !== index
                }
                onChange={(patch) => updateField(field.id, patch)}
                onRemove={() => removeField(field.id)}
                onDuplicate={() => duplicateField(field.id)}
                onDragStart={() => setDragIndex(index)}
                onDragEnterItem={() => setOverIndex(index)}
                onDropItem={() => handleDrop(index)}
                onDragEndItem={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
              />
            ))}

            <AddFieldBar onAdd={addField} />
          </div>
        </motion.div>
      </main>
    </DashboardShell>
  );
}

function AutoSaveBadge({ state }: { state: AutoSaveState }) {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-sbi-muted">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  if (state === "saved")
    return <span className="text-xs text-sbi-green/80">Saved</span>;
  if (state === "error")
    return <span className="text-xs text-red-400">Couldn’t save</span>;
  return <span className="text-xs text-sbi-muted-dark">Autosaves changes</span>;
}

// ---------------------------------------------------------------------------
// Add-field bar
// ---------------------------------------------------------------------------

const FIELD_GROUPS: { label: string; types: FieldType[] }[] = [
  {
    label: "Text",
    types: ["short_text", "paragraph", "number", "date", "time"],
  },
  { label: "Choice", types: ["radio", "checkboxes", "dropdown", "scale"] },
  { label: "Media & layout", types: ["file", "section"] },
];

function AddFieldBar({ onAdd }: { onAdd: (type: FieldType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(btnGhost, "w-full")}
      >
        <Plus className="size-4" /> Add question or section
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-3 p-3 rounded-lg bg-sbi-dark-card border border-sbi-dark-border/50">
          {FIELD_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <span className="px-1 text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark">
                {group.label}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {group.types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onAdd(t);
                      setOpen(false);
                    }}
                    className="text-left px-3 py-2 rounded-md text-xs text-white/80 hover:bg-sbi-green/10 hover:text-sbi-green transition-colors"
                  >
                    {FIELD_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-field editor
// ---------------------------------------------------------------------------

interface FieldEditorProps {
  field: FieldDef;
  referenceable: FieldDef[];
  isDragging: boolean;
  isOver: boolean;
  onChange: (patch: Partial<FieldDef>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onDragStart: () => void;
  onDragEnterItem: () => void;
  onDropItem: () => void;
  onDragEndItem: () => void;
}

function FieldEditor({
  field,
  referenceable,
  isDragging,
  isOver,
  onChange,
  onRemove,
  onDuplicate,
  onDragStart,
  onDragEnterItem,
  onDropItem,
  onDragEndItem,
}: FieldEditorProps) {
  const [expanded, setExpanded] = useState(true);
  // The wrapper is only draggable once the grip handle is grabbed, so text
  // selection inside the field inputs keeps working normally.
  const [grabbed, setGrabbed] = useState(false);
  const isSection = field.type === "section";
  const isChoice = CHOICE_TYPES.includes(field.type);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: native HTML5 drag drop target; the real control is the grip <button> below.
    <div
      draggable={grabbed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnter={onDragEnterItem}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropItem();
      }}
      onDragEnd={() => {
        setGrabbed(false);
        onDragEndItem();
      }}
      className={cn(
        "rounded-xl transition-all",
        isDragging && "opacity-40",
        isOver && "ring-2 ring-sbi-green/50",
      )}
    >
      <Panel
        padded={false}
        className={cn(
          "overflow-hidden",
          isSection && "border-sbi-green/30 bg-sbi-green/5",
        )}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-sbi-dark-border/40">
          <button
            type="button"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            onMouseDown={() => setGrabbed(true)}
            onMouseUp={() => setGrabbed(false)}
            className="flex shrink-0 items-center justify-center cursor-grab active:cursor-grabbing touch-none p-0.5 text-sbi-muted-dark hover:text-sbi-muted transition-colors"
          >
            <GripVertical className="size-4" />
          </button>
          <span className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted shrink-0">
            {FIELD_TYPE_LABELS[field.type]}
          </span>
          <span className="flex-1 truncate text-sm text-white/80">
            {field.label || "Untitled"}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <IconBtn label="Duplicate" onClick={onDuplicate}>
              <Copy className="size-3.5" />
            </IconBtn>
            <IconBtn label="Delete" onClick={onRemove} danger>
              <Trash2 className="size-3.5" />
            </IconBtn>
            <IconBtn label="Toggle" onClick={() => setExpanded((e) => !e)}>
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </IconBtn>
          </div>
        </div>

        {expanded && (
          <div className="p-4 flex flex-col gap-4">
            {/* Label + type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <span className={cn("block", labelClass)}>
                  {isSection ? "Section title" : "Question"}
                </span>
                <input
                  className={cn(inputClass, "mt-1.5")}
                  value={field.label}
                  onChange={(e) => onChange({ label: e.target.value })}
                />
              </div>
              <div>
                <span className={cn("block", labelClass)}>Type</span>
                <SelectField
                  className="mt-1.5"
                  value={field.type}
                  onChange={(e) => {
                    const type = e.target.value as FieldType;
                    const patch: Partial<FieldDef> = { type };
                    if (CHOICE_TYPES.includes(type) && !field.options) {
                      patch.options = [
                        { value: "option_1", label: "Option 1" },
                        { value: "option_2", label: "Option 2" },
                      ];
                    }
                    if (type === "scale" && !field.validation) {
                      patch.validation = { min: 1, max: 5, step: 1 };
                    }
                    onChange(patch);
                  }}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            {/* Help text */}
            <div>
              <span className={cn("block", labelClass)}>Help text</span>
              <input
                className={cn(inputClass, "mt-1.5")}
                value={field.description ?? ""}
                placeholder="Optional"
                onChange={(e) =>
                  onChange({ description: e.target.value || undefined })
                }
              />
            </div>

            {/* Options editor */}
            {isChoice && (
              <OptionsEditor
                field={field}
                onChange={(options) => onChange({ options })}
              />
            )}

            {/* Scale config */}
            {field.type === "scale" && (
              <ScaleConfig field={field} onChange={onChange} />
            )}

            {/* Validation */}
            {!isSection && (
              <ValidationEditor field={field} onChange={onChange} />
            )}

            {/* Required + conditional */}
            {!isSection && (
              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-sbi-green size-4"
                  checked={field.required ?? false}
                  onChange={(e) => onChange({ required: e.target.checked })}
                />
                Required
              </label>
            )}

            <ConditionEditor
              field={field}
              referenceable={referenceable}
              onChange={onChange}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors disabled:opacity-30",
        danger
          ? "text-sbi-muted hover:text-red-400 hover:bg-red-500/10"
          : "text-sbi-muted hover:text-sbi-green hover:bg-sbi-green/10",
      )}
    >
      {children}
    </button>
  );
}

function OptionsEditor({
  field,
  onChange,
}: {
  field: FieldDef;
  onChange: (options: FieldDef["options"]) => void;
}) {
  const options = field.options ?? [];
  const update = (i: number, label: string) => {
    const next = options.map((o, idx) => (idx === i ? { ...o, label } : o));
    onChange(next);
  };
  const add = () =>
    onChange([
      ...options,
      {
        value: `option_${generateFieldId().slice(-5)}`,
        label: `Option ${options.length + 1}`,
      },
    ]);
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <span className={cn("block", labelClass)}>Options</span>
      {options.map((opt, i) => (
        <div key={opt.value} className="flex items-center gap-2">
          <input
            className={inputClass}
            value={opt.label}
            onChange={(e) => update(i, e.target.value)}
          />
          <IconBtn label="Remove option" onClick={() => remove(i)} danger>
            <Trash2 className="size-3.5" />
          </IconBtn>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className={cn(btnGhost, "h-8 self-start text-[11px]")}
      >
        <Plus className="size-3.5" /> Add option
      </button>
    </div>
  );
}

function ScaleConfig({
  field,
  onChange,
}: {
  field: FieldDef;
  onChange: (patch: Partial<FieldDef>) => void;
}) {
  const v = field.validation ?? {};
  const set = (patch: Partial<NonNullable<FieldDef["validation"]>>) =>
    onChange({ validation: { ...v, ...patch } });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <NumberInput
        label="Min"
        value={v.min ?? 1}
        onChange={(n) => set({ min: n })}
      />
      <NumberInput
        label="Max"
        value={v.max ?? 5}
        onChange={(n) => set({ max: n })}
      />
      <div>
        <span className={cn("block", labelClass)}>Min label</span>
        <input
          className={cn(inputClass, "mt-1.5")}
          value={v.minLabel ?? ""}
          onChange={(e) => set({ minLabel: e.target.value || undefined })}
        />
      </div>
      <div>
        <span className={cn("block", labelClass)}>Max label</span>
        <input
          className={cn(inputClass, "mt-1.5")}
          value={v.maxLabel ?? ""}
          onChange={(e) => set({ maxLabel: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}

function ValidationEditor({
  field,
  onChange,
}: {
  field: FieldDef;
  onChange: (patch: Partial<FieldDef>) => void;
}) {
  const v = field.validation ?? {};
  const set = (patch: Partial<NonNullable<FieldDef["validation"]>>) =>
    onChange({ validation: { ...v, ...patch } });

  if (field.type === "short_text" || field.type === "paragraph") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Min length"
          value={v.minLength}
          onChange={(n) => set({ minLength: n })}
          allowEmpty
        />
        <NumberInput
          label="Max length"
          value={v.maxLength}
          onChange={(n) => set({ maxLength: n })}
          allowEmpty
        />
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Min"
          value={v.min}
          onChange={(n) => set({ min: n })}
          allowEmpty
        />
        <NumberInput
          label="Max"
          value={v.max}
          onChange={(n) => set({ max: n })}
          allowEmpty
        />
      </div>
    );
  }
  return null;
}

function NumberInput({
  label,
  value,
  onChange,
  allowEmpty,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div>
      <span className={cn("block", labelClass)}>{label}</span>
      <input
        type="number"
        className={cn(inputClass, "mt-1.5")}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => {
          if (e.target.value === "") {
            onChange(allowEmpty ? undefined : 0);
          } else {
            onChange(Number(e.target.value));
          }
        }}
      />
    </div>
  );
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  is_answered: "is answered",
  is_empty: "is empty",
};

function ConditionEditor({
  field,
  referenceable,
  onChange,
}: {
  field: FieldDef;
  referenceable: FieldDef[];
  onChange: (patch: Partial<FieldDef>) => void;
}) {
  const rule = field.conditions?.[0];
  const enabled = !!rule;

  if (referenceable.length === 0) {
    return (
      <p className="text-[11px] text-sbi-muted-dark">
        Add a question above this one to enable conditional logic.
      </p>
    );
  }

  const refField = referenceable.find((f) => f.id === rule?.fieldId);
  const needsValue =
    rule && rule.operator !== "is_answered" && rule.operator !== "is_empty";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-sbi-dark-border/40 p-3">
      <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
        <input
          type="checkbox"
          className="accent-sbi-green size-4"
          checked={enabled}
          onChange={(e) => {
            if (e.target.checked) {
              onChange({
                conditions: [
                  {
                    fieldId: referenceable[0].id,
                    operator: "equals",
                    value: "",
                  },
                ],
              });
            } else {
              onChange({ conditions: undefined });
            }
          }}
        />
        Show only if…
      </label>

      {enabled && rule && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <SelectField
            value={rule.fieldId}
            onChange={(e) =>
              onChange({
                conditions: [{ ...rule, fieldId: e.target.value }],
              })
            }
          >
            {referenceable.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            value={rule.operator}
            onChange={(e) =>
              onChange({
                conditions: [
                  { ...rule, operator: e.target.value as ConditionOperator },
                ],
              })
            }
          >
            {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </SelectField>
          {needsValue &&
            (refField?.options && refField.options.length > 0 ? (
              <SelectField
                value={rule.value ?? ""}
                onChange={(e) =>
                  onChange({ conditions: [{ ...rule, value: e.target.value }] })
                }
              >
                <option value="">Select…</option>
                {refField.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <input
                className={inputClass}
                value={rule.value ?? ""}
                placeholder="value"
                onChange={(e) =>
                  onChange({ conditions: [{ ...rule, value: e.target.value }] })
                }
              />
            ))}
        </div>
      )}
    </div>
  );
}
