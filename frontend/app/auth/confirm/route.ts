import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const target = new URL("/auth/continue", request.url);
  if (token_hash) target.searchParams.set("token_hash", token_hash);
  if (type) target.searchParams.set("type", type);
  return NextResponse.redirect(target);
}
