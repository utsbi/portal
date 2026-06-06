"use server";

import {
  type PublicSubmitInput,
  submitPublicForm,
  unlockPublicForm,
} from "@/lib/questionnaire/public";

// Thin "use server" wrappers so the public client component can call into the
// server-only public logic. All gating (token, password, Turnstile) happens in
// lib/questionnaire/public.ts; nothing here trusts the client.

export async function unlockPublicFormAction(token: string, password: string) {
  return unlockPublicForm(token, password);
}

export async function submitPublicFormAction(input: PublicSubmitInput) {
  return submitPublicForm(input);
}
