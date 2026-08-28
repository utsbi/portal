import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticateLogin } from "@/lib/auth/login";

export const runtime = "nodejs";

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
}

/**
 * Credential boundary for the login form.
 *
 * Do not add request-body logging here. In particular, never include the
 * password in errors, traces, analytics, or structured request metadata.
 */
export async function POST(request: NextRequest) {
  let body: LoginRequestBody;
  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }

  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json(
      { success: false, error: "Email and password are required" },
      { status: 400 },
    );
  }

  const result = await authenticateLogin(body.email, body.password);
  return NextResponse.json(result, {
    status: result.success ? 200 : 401,
  });
}
