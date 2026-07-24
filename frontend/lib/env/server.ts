import "server-only";

function normalizeHttpOrigin(value: string, variableName: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`${variableName} must be a valid HTTP(S) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${variableName} must use HTTP or HTTPS`);
  }
  return url.origin;
}

export function getBackendUrl(): string {
  const configured = process.env.BACKEND_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BACKEND_URL is required in production");
    }
    return "http://localhost:8000";
  }
  return normalizeHttpOrigin(configured, "BACKEND_URL");
}

export function getPortalOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL or a Vercel production URL is required in production",
      );
    }
    return "http://localhost:3000";
  }

  const origin = normalizeHttpOrigin(configured, "NEXT_PUBLIC_SITE_URL");
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("The portal origin must use HTTPS in production");
  }
  return origin;
}
