import { createBrowserClient } from "@supabase/ssr";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    { cookieOptions: authCookieOptions },
  );
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" });
}
