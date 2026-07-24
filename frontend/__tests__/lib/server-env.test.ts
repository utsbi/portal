import { afterEach, describe, expect, it, vi } from "vitest";
import { getBackendUrl, getPortalOrigin } from "@/lib/env/server";

function clearDeploymentUrls() {
  vi.stubEnv("BACKEND_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_URL", "");
}

describe("server environment URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses localhost defaults only in development", () => {
    clearDeploymentUrls();
    vi.stubEnv("NODE_ENV", "development");

    expect(getBackendUrl()).toBe("http://localhost:8000");
    expect(getPortalOrigin()).toBe("http://localhost:3000");
  });

  it("requires backend and portal URLs in production", () => {
    clearDeploymentUrls();
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getBackendUrl()).toThrow("BACKEND_URL is required");
    expect(() => getPortalOrigin()).toThrow("required in production");
  });

  it("requires an HTTPS portal origin in production", () => {
    clearDeploymentUrls();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://portal.example.com");

    expect(() => getPortalOrigin()).toThrow("must use HTTPS");
  });

  it("normalizes configured deployment URLs", () => {
    clearDeploymentUrls();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BACKEND_URL", "http://backend.internal:8000/path");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "portal.example.com/path");

    expect(getBackendUrl()).toBe("http://backend.internal:8000");
    expect(getPortalOrigin()).toBe("https://portal.example.com");
  });
});
