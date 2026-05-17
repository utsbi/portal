import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) =>
						request.cookies.set(name, value),
					);
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options),
					);
				},
			},
		},
	);

	// Do not run code between createServerClient and
	// supabase.auth.getClaims(). A simple mistake could make it very hard to debug
	// issues with users being randomly logged out.

	// getClaims() validates the JWT locally (faster than getUser() network call)
	const { data } = await supabase.auth.getClaims();
	const user = data?.claims;

	// Redirect to login if not authenticated and on a protected route
	if (
		!user &&
		request.nextUrl.pathname.startsWith("/dashboard") &&
		!request.nextUrl.pathname.startsWith("/login") &&
		!request.nextUrl.pathname.startsWith("/auth")
	) {
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		return NextResponse.redirect(url);
	}

	// Already-authenticated users hitting /login: resolve the redirect here at
	// the edge, before the (static) layout (Navbar + Footer) ever ships. Doing
	// it at the page level instead leaves a one-frame navbar/footer flash when
	// the login RSC resolves into a redirect. Mirrors the profile guard in
	// resolve-actor so an auth session without a profile doesn't loop
	// (/login -> /dashboard -> /login).
	if (user && request.nextUrl.pathname.startsWith("/login")) {
		const { data: profile, error: profileErr } = await supabase
			.from("profiles")
			.select("id")
			.eq("uid", user.sub as string)
			.maybeSingle();

		if (profile) {
			const url = request.nextUrl.clone();
			url.pathname = "/dashboard";
			return NextResponse.redirect(url);
		}

		if (!profileErr) {
			// Confirmed no profile row: clear the orphan session so the
			// login form is usable instead of bouncing. Falls through to
			// /login.
			await supabase.auth.signOut();
		}
		// On a transient query error we can't confirm eligibility: fail
		// open. Don't sign the user out, don't redirect — fall through to
		// /login so a DB/RLS blip never logs out a valid session.
	}

	// IMPORTANT: You *must* return the supabaseResponse object as it is.
	// If you're creating a new response object with NextResponse.next() make sure to:
	// 1. Pass the request in it, like so:
	//    const myNewResponse = NextResponse.next({ request })
	// 2. Copy over the cookies, like so:
	//    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
	// 3. Change the myNewResponse object to fit your needs, but avoid changing
	//    the cookies!
	// 4. Finally:
	//    return myNewResponse
	// If this is not done, you may be causing the browser and server to go out
	// of sync and terminate the user's session prematurely!

	return supabaseResponse;
}
