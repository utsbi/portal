// Shared (non-"use server") types + guards for questionnaire server actions.
// Server Action modules ("use server") may only export async functions, so the
// ActionResult discriminant and its type guard live here.

export type ActionError = { error: string };
export type ActionResult<T = Record<string, never>> = T | ActionError;

/** Type guard: narrow an ActionResult to its error member. */
export function isActionError<T>(res: T | ActionError): res is ActionError {
  return (
    typeof res === "object" &&
    res !== null &&
    typeof (res as ActionError).error === "string"
  );
}
