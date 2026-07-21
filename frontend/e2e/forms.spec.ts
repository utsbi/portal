import { expect, test } from "@playwright/test";

/**
 * Smoke: public form not-found behavior.
 *
 * A URL with an invalid/nonexistent token should resolve to Next.js's
 * not-found handler (HTTP 404 + not-found page content).
 *
 * Prerequisites: dev server running with Supabase env vars set.
 * No Supabase fixtures are required — an unknown token naturally returns
 * null from getPublicForm() which triggers Next.js notFound().
 */

test.describe("Public form — not-found", () => {
  test("invalid form token returns 404 status", async ({ page }) => {
    const response = await page.goto(
      "/forms/smoke-test-nonexistent-token-abc123xyz",
    );
    expect(response?.status()).toBe(404);
  });

  test("invalid form token renders a not-found page, not a crash", async ({
    page,
  }) => {
    await page.goto("/forms/smoke-test-nonexistent-token-abc123xyz");

    // Next.js not-found pages must not contain unhandled error UI.
    // Check there is no "Application error" text (Next.js 500 indicator).
    await expect(page.getByText(/application error/i)).not.toBeVisible();

    // The page should contain something — confirm the <body> has content.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });
});

/**
 * Smoke: Next.js global not-found page.
 *
 * Hitting any completely unknown route must return 404 without crashing.
 * This is independent of Supabase and always safe to run.
 */
test.describe("Global 404", () => {
  test("unknown route returns 404 status", async ({ page }) => {
    const response = await page.goto(
      "/this-route-definitely-does-not-exist-xyz",
    );
    expect(response?.status()).toBe(404);
  });

  test("unknown route renders a page, not a blank screen", async ({ page }) => {
    await page.goto("/this-route-definitely-does-not-exist-xyz");
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });
});
