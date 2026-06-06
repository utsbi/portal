"use client";

import { Download, Loader2, Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  btnGhost,
  inputClass,
  labelClass,
  SelectField,
} from "@/components/dashboard/common/ui";
import {
  createAttachmentSignedUrl,
  fileNameFromPath,
  removeQuestionnaireFile,
  uploadQuestionnaireFile,
} from "@/lib/questionnaire/file-upload";
import type { AnswerValue, FieldDef } from "@/lib/questionnaire/schema";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Renders a single answerable field for the client fill-out UI. Pure controlled
// component: receives the current value + onChange. Section dividers are handled
// by the parent (FillOutForm), not here. The `file` type is the one stateful
// case — it uploads to Supabase Storage and stores the object path as its value.
// ---------------------------------------------------------------------------

interface FieldRendererProps {
  field: FieldDef;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  error?: string;
  disabled?: boolean;
  /** Required by the `file` type to namespace uploads under the form. */
  formId: number;
  /** File uploads need an authed user (storage RLS); off for public forms. */
  allowFileUpload?: boolean;
}

export function FieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled,
  formId,
  allowFileUpload = true,
}: FieldRendererProps) {
  const selectedArray = Array.isArray(value) ? value : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            labelClass,
            "normal-case tracking-normal text-sm text-white/90",
          )}
        >
          {field.label}
        </span>
        {field.required && <span className="text-amber-400 text-xs">*</span>}
      </div>
      {field.description && (
        <p className="text-xs text-sbi-muted leading-relaxed -mt-1">
          {field.description}
        </p>
      )}

      {field.type === "short_text" && (
        <input
          type="text"
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "paragraph" && (
        <textarea
          className={cn(inputClass, "min-h-24 resize-y")}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "number" && (
        <input
          type="number"
          className={inputClass}
          value={value === null || value === undefined ? "" : String(value)}
          placeholder={field.placeholder}
          min={field.validation?.min}
          max={field.validation?.max}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      )}

      {field.type === "date" && (
        <input
          type="date"
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "time" && (
        <input
          type="time"
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "dropdown" && (
        <SelectField
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
      )}

      {field.type === "radio" && (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 cursor-pointer text-sm text-white/85"
            >
              <input
                type="radio"
                name={field.id}
                className="accent-sbi-green size-4"
                checked={value === opt.value}
                disabled={disabled}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {field.type === "checkboxes" && (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((opt) => {
            const checked = selectedArray.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 cursor-pointer text-sm text-white/85"
              >
                <input
                  type="checkbox"
                  className="accent-sbi-green size-4"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    const next = checked
                      ? selectedArray.filter((v) => v !== opt.value)
                      : [...selectedArray, opt.value];
                    onChange(next);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}

      {field.type === "scale" && (
        <ScaleField
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}

      {field.type === "file" &&
        (allowFileUpload ? (
          <FileField
            value={value}
            onChange={onChange}
            disabled={disabled}
            formId={formId}
          />
        ) : (
          <p className="text-xs text-sbi-muted border border-dashed border-sbi-dark-border/60 rounded-md px-3 py-3">
            File uploads aren't available on this form.
          </p>
        ))}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ScaleField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
}) {
  const min = field.validation?.min ?? 1;
  const max = field.validation?.max ?? 5;
  const step = field.validation?.step ?? 1;
  const points: number[] = [];
  for (let n = min; n <= max; n += step) points.push(n);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        {field.validation?.minLabel && (
          <span className="text-[11px] text-sbi-muted shrink-0">
            {field.validation.minLabel}
          </span>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {points.map((n) => {
            const active = Number(value) === n;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onChange(n)}
                className={cn(
                  "h-9 min-w-9 px-2 rounded-md border text-sm tabular-nums transition-colors",
                  active
                    ? "bg-sbi-green text-sbi-dark border-sbi-green"
                    : "bg-sbi-dark-card text-white/80 border-sbi-dark-border/50 hover:border-sbi-green/40",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        {field.validation?.maxLabel && (
          <span className="text-[11px] text-sbi-muted">
            {field.validation.maxLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function FileField({
  value,
  onChange,
  disabled,
  formId,
}: {
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
  formId: number;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const path = typeof value === "string" && value ? value : null;

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setLocalError(null);
    setUploading(true);
    const res = await uploadQuestionnaireFile(formId, file);
    setUploading(false);
    if (!res.data) {
      setLocalError(res.error);
      return;
    }
    onChange(res.data.path);
  };

  const handleDownload = async () => {
    if (!path) return;
    setDownloading(true);
    const url = await createAttachmentSignedUrl(path);
    setDownloading(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setLocalError("Couldn't open the file. Try again.");
  };

  const handleRemove = async () => {
    if (path) void removeQuestionnaireFile(path);
    onChange(null);
  };

  if (path) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-md border border-sbi-dark-border/50 bg-sbi-dark-card px-3 py-2">
          <Paperclip className="size-3.5 text-sbi-muted shrink-0" />
          <span className="flex-1 truncate text-sm text-white/85">
            {fileNameFromPath(path)}
          </span>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Download file"
            title="Download"
            className="p-1.5 rounded-md text-sbi-muted hover:text-sbi-green hover:bg-sbi-green/10 transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove file"
              title="Remove"
              className="p-1.5 rounded-md text-sbi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {localError && <p className="text-xs text-red-400">{localError}</p>}
      </div>
    );
  }

  if (disabled) {
    return <p className="text-sm text-sbi-muted">No file uploaded.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="hidden"
        disabled={uploading}
        onChange={handleSelect}
      />
      <label
        htmlFor={inputId}
        className={cn(
          btnGhost,
          "h-9 self-start cursor-pointer",
          uploading && "pointer-events-none opacity-50",
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Uploading…
          </>
        ) : (
          <>
            <Paperclip className="size-4" /> Upload file
          </>
        )}
      </label>
      <span className="text-[11px] text-sbi-muted-dark">
        Up to 25 MB. PDF, images, and Office documents.
      </span>
      {localError && <p className="text-xs text-red-400">{localError}</p>}
    </div>
  );
}
