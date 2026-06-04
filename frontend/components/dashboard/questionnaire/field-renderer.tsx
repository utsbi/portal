"use client";

import { inputClass, labelClass } from "@/components/dashboard/common/ui";
import type { AnswerValue, FieldDef } from "@/lib/questionnaire/schema";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Renders a single answerable field for the client fill-out UI. Pure controlled
// component: receives the current value + onChange. Section dividers are handled
// by the parent (FillOutForm), not here.
// ---------------------------------------------------------------------------

interface FieldRendererProps {
  field: FieldDef;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  error?: string;
  disabled?: boolean;
}

export function FieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled,
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
        <select
          className={inputClass}
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
        </select>
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

      {field.type === "file" && (
        <div className="text-xs text-sbi-muted border border-dashed border-sbi-dark-border/60 rounded-md px-3 py-4 text-center">
          File upload — capture the file name/reference (storage wiring is a v2
          item).
          <input
            type="text"
            className={cn(inputClass, "mt-2")}
            placeholder="Paste a link or describe the file"
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}

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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {field.validation?.minLabel && (
          <span className="text-[11px] text-sbi-muted">
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
