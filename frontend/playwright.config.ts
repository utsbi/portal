import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the UTSBI Portal frontend smoke suite.
 *
 * Specs live in ./e2e/ and use the *.spec.ts naming convention so Vitest
 * (which only picks up *.test.{ts,tsx}) never touches them.
 *
 * Before running locally:
 *   bunx playwright install   # one-time browser binary download
 *   bun test:e2e              # run the suite (starts bun dev automatically)
 *   bun test:e2e:ui           # interactive Playwright UI
 *
 * CI runs the suite against a production build. Local runs use the dev server.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run specs in parallel */
  fullyParallel: true,
  /* Fail the build on CI if a test was left with test.only */
  forbidOnly: !!process.env.CI,
  /* Deterministic suite: surface flakes instead of masking them with retries. */
  retries: 0,
  /* Single worker on CI to avoid port conflicts */
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? "PORT=3100 HOSTNAME=127.0.0.1 bun .next/standalone/server.js"
      : "bun dev -p 3100",
    url: "http://localhost:3100",
    /* Reuse an already-running dev server in local development */
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
