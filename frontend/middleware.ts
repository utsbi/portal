import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
	return await updateSession(request);
}

export const config = {
	matcher: [
		/*
		 * Match only protected routes that require authentication:
		 * - /dashboard and all its sub-routes
		 * - /auth (for auth callbacks)
		 */
		"/dashboard/:path*",
		"/auth/:path*",
	],
};
