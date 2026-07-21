import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Match dashboard routes (session-based, no slug)
    "/dashboard/:path*",
    // Match auth routes
    "/auth/:path*",
    // Match login so authed users are redirected at the edge (no layout flash)
    "/login",
  ],
};
