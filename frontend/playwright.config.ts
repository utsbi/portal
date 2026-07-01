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
 * These tests are NOT wired into CI.  See CONTRIBUTING.md for details.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run specs in parallel */
  fullyParallel: true,
  /* Fail the build on CI if a test was left with test.only */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Single worker on CI to avoid port conflicts */
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun dev",
    url: "http://localhost:3000",
    /* Reuse an already-running dev server in local development */
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
