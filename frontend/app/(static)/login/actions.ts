"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { success: false, error: 'Invalid email or password' };
    }
    if (error.message.includes('Email not confirmed')) {
      return { success: false, error: 'Please verify your email address' };
    }
    return { success: false, error: 'An error occurred. Please try again.' };
  }

  if (!data.user) {
    return { success: false, error: 'An error occurred. Please try again.' };
  }

  // Verify user has a profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('uid', data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { success: false, error: 'Invalid email or password' };
  }

  // Set active project from first membership
  const { data: membership } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('profile_id', profile.id)
    .limit(1)
    .single();

  if (membership) {
    const cookieStore = await cookies();
    cookieStore.set('active_project_id', String(membership.project_id), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return { success: true };
}

export async function checkAuthAction(): Promise<{ authenticated: boolean }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false };
  }

  // Verify user has a profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('uid', user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { authenticated: false };
  }

  return { authenticated: true };
}
