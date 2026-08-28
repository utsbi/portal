"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const AUTH_CONTINUE_DESTINATIONS = {
  invite: "/auth/update-password?flow=invite",
  recovery: "/auth/update-password?flow=recovery",
  signup: "/login?confirmed=1",
  magiclink: "/dashboard",
  email_change: "/dashboard/settings?email=confirmed",
  email: "/dashboard",
} as const satisfies Partial<Record<EmailOtpType, string>>;

export type AuthContinueType = keyof typeof AUTH_CONTINUE_DESTINATIONS;

export interface AuthContinueState {
  error: string | null;
}

function isSupportedType(value: string): value is AuthContinueType {
  return value in AUTH_CONTINUE_DESTINATIONS;
}

/**
 * Verify an auth token only after the recipient explicitly submits the
 * continue form. Email clients are allowed to prefetch GET links, so this
 * action deliberately does not run during page rendering.
 */
export async function continueAuthAction(
  _previousState: AuthContinueState,
  formData: FormData,
): Promise<AuthContinueState> {
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  const rawType = String(formData.get("type") ?? "").trim();

  if (!tokenHash || !isSupportedType(rawType)) {
    return {
      error:
        "This link is incomplete or no longer available. Request a new one.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: rawType as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) {
    return {
      error:
        "This link has expired or has already been used. Request a new one.",
    };
  }

  redirect(AUTH_CONTINUE_DESTINATIONS[rawType]);
}
