"use server";

import type { LoginResult } from "@/lib/auth/login";
import { getPortalOrigin } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export async function checkAuthAction(): Promise<{ authenticated: boolean }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false };
  }

  // Verify user has a profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("uid", user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { authenticated: false };
  }

  return { authenticated: true };
}

/**
 * Request a password reset without exposing whether an address has an account.
 * Supabase owns the recovery token and enforces its own email rate limits.
 */
export async function requestPasswordResetAction(
  email: string,
): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return { success: false, error: "Enter a valid email address." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${getPortalOrigin()}/auth/update-password`,
      },
    );
    if (error) {
      console.error("password reset request failed:", error.message);
      return {
        success: false,
        error: "We couldn't send a reset email. Please try again shortly.",
      };
    }
  } catch (error) {
    console.error("password reset request failed:", error);
    return {
      success: false,
      error: "We couldn't send a reset email. Please try again shortly.",
    };
  }

  return { success: true };
}
