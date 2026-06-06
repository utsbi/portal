"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import {
  btnPrimary,
  inputClass,
  labelClass,
  Panel,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import { FieldRenderer } from "@/components/dashboard/questionnaire/field-renderer";
import {
  type AnswerMap,
  type AnswerValue,
  type FormSchema,
  type FormWindowState,
  isFieldVisible,
  validateAnswers,
} from "@/lib/questionnaire/schema";
import { cn } from "@/lib/utils";
import { submitPublicFormAction, unlockPublicFormAction } from "./actions";

interface PublicFormProps {
  token: string;
  title: string;
  description: string | null;
  requiresPassword: boolean;
  windowState: FormWindowState;
  schema: FormSchema | null;
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function PublicForm({
  token,
  title,
  description,
  requiresPassword,
  windowState,
  schema: initialSchema,
}: PublicFormProps) {
  const [schema, setSchema] = useState<FormSchema | null>(initialSchema);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setAnswer = (fieldId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const handleUnlock = async () => {
    if (!password.trim()) return;
    setUnlocking(true);
    setFormError(null);
    const res = await unlockPublicFormAction(token, password);
    setUnlocking(false);
    if ("error" in res) {
      setFormError(res.error);
      return;
    }
    setSchema(res.schema);
  };

  const handleSubmit = async () => {
    if (!schema) return;
    setFormError(null);
    if (!name.trim()) {
      setFormError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setFormError("Please enter your email.");
      return;
    }
    const validationErrors = validateAnswers(schema, answers);
    if (validationErrors.length > 0) {
      const map: Record<string, string> = {};
      for (const e of validationErrors) map[e.fieldId] = e.message;
      setErrors(map);
      setFormError("Please complete the highlighted fields.");
      return;
    }
    if (!turnstileToken) {
      setFormError("Please complete the captcha.");
      return;
    }
    setSubmitting(true);
    const res = await submitPublicFormAction({
      token,
      password: requiresPassword ? password : undefined,
      submitterName: name,
      submitterEmail: email,
      answers,
      turnstileToken,
    });
    setSubmitting(false);
    if ("error" in res) {
      setFormError(res.error);
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-sbi-dark text-white flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div>
          <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
            <span className="text-sbi-green">S</span>BI
          </span>
          <h1 className="mt-3 text-2xl md:text-3xl font-light tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-sbi-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {windowState !== "open" ? (
          <Panel className="flex flex-col items-center text-center gap-3 py-12">
            <Lock className="size-8 text-sbi-muted" />
            <h2 className="text-lg font-light">
              {windowState === "not_yet"
                ? "This form isn't open yet"
                : "This form is closed"}
            </h2>
            <p className="text-sm text-sbi-muted max-w-sm">
              {windowState === "not_yet"
                ? "Check back later. The form will accept responses once it opens."
                : "This form is no longer accepting responses."}
            </p>
          </Panel>
        ) : submitted ? (
          <Panel className="flex flex-col items-center text-center gap-3 py-12">
            <CheckCircle2 className="size-8 text-sbi-green" />
            <h2 className="text-lg font-light">Thank you</h2>
            <p className="text-sm text-sbi-muted max-w-sm">
              Your response has been submitted. You can close this page.
            </p>
          </Panel>
        ) : schema === null ? (
          <Panel className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-white/85">
              <Lock className="size-4 text-sbi-green" />
              This form is password protected.
            </div>
            <div>
              <label
                htmlFor="public-password"
                className={cn("block", labelClass)}
              >
                Password
              </label>
              <input
                id="public-password"
                type="password"
                className={cn(inputClass, "mt-1.5")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleUnlock();
                }}
              />
            </div>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <button
              type="button"
              className={cn(btnPrimary, "self-start")}
              disabled={unlocking || !password.trim()}
              onClick={handleUnlock}
            >
              {unlocking ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Unlocking
                </>
              ) : (
                "Unlock"
              )}
            </button>
          </Panel>
        ) : (
          <>
            <Panel className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span
                    className={cn(
                      "block",
                      labelClass,
                      "normal-case tracking-normal text-sm text-white/90",
                    )}
                  >
                    Your name <span className="text-amber-400">*</span>
                  </span>
                  <input
                    className={cn(inputClass, "mt-1.5")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <span
                    className={cn(
                      "block",
                      labelClass,
                      "normal-case tracking-normal text-sm text-white/90",
                    )}
                  >
                    Your email <span className="text-amber-400">*</span>
                  </span>
                  <input
                    type="email"
                    className={cn(inputClass, "mt-1.5")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="h-px bg-sbi-dark-border/40" />

              {schema.fields.map((field) => {
                if (field.type === "section") {
                  return (
                    <div key={field.id}>
                      <SectionLabel>{field.label}</SectionLabel>
                      {field.description && (
                        <p className="text-xs text-sbi-muted -mt-3">
                          {field.description}
                        </p>
                      )}
                    </div>
                  );
                }
                if (!isFieldVisible(field, answers)) return null;
                return (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={answers[field.id] ?? null}
                    error={errors[field.id]}
                    formId={0}
                    allowFileUpload={false}
                    onChange={(v) => setAnswer(field.id, v)}
                  />
                );
              })}
            </Panel>

            <div className="flex flex-col gap-3">
              {TURNSTILE_SITE_KEY && (
                <Turnstile
                  siteKey={TURNSTILE_SITE_KEY}
                  options={{ theme: "dark", appearance: "interaction-only" }}
                  onSuccess={(t) => setTurnstileToken(t)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              )}
              {formError && <p className="text-xs text-red-400">{formError}</p>}
              <button
                type="button"
                className={cn(btnPrimary, "self-start")}
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
