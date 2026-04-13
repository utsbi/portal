"use server";

import { createClient } from "@/lib/supabase/server";

export interface LoginResult {
  success: boolean;
  error?: string;
  urlSlug?: string;
}

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  const supabase = await createClient();

  // Attempt to sign in
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

  // Check clients first, then members (e.g. directors)
  const { data: clientData } = await supabase
    .from('clients')
    .select('url_slug')
    .eq('uid', data.user.id)
    .single();

  if (clientData?.url_slug) {
    return { success: true, urlSlug: clientData.url_slug };
  }

  const { data: memberData } = await supabase
    .from('members')
    .select('url_slug')
    .eq('uid', data.user.id)
    .single();

  if (memberData?.url_slug) {
    return { success: true, urlSlug: memberData.url_slug };
  }

  // Not in clients or members - sign out and reject
  await supabase.auth.signOut();
  return { success: false, error: 'Invalid email or password' };
}

export async function checkAuthAction(): Promise<{ authenticated: boolean; urlSlug?: string }> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { authenticated: false };
  }

  // Check clients first, then members (e.g. directors)
  const { data: clientData } = await supabase
    .from('clients')
    .select('url_slug')
    .eq('uid', user.id)
    .single();

  if (clientData?.url_slug) {
    return { authenticated: true, urlSlug: clientData.url_slug };
  }

  const { data: memberData } = await supabase
    .from('members')
    .select('url_slug')
    .eq('uid', user.id)
    .single();

  if (memberData?.url_slug) {
    return { authenticated: true, urlSlug: memberData.url_slug };
  }

  await supabase.auth.signOut();
  return { authenticated: false };
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
