import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Service-role Supabase client. Bypasses RLS, so it is SERVER-ONLY and must
// never be imported into client code (enforced by "server-only" above). Used to
// mediate public/anonymous questionnaire access: the browser never touches the
// DB on the public path; this client does, only after the server has verified
// the token / password / Turnstile.
// ---------------------------------------------------------------------------

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("Supabase admin client is not configured");
  }
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
