import { expect, type Page, test } from "@playwright/test";

/**
 * Smoke: contact page form renders and client-side validation works.
 *
 * Cloudflare Turnstile is MOCKED — no external network request is made.
 * No Supabase calls occur on this page (it is a pure client component).
 * No webhook URL needs to be set to run these checks.
 */

/**
 * Stub window.turnstile before any page script runs so @marsidev/react-turnstile
 * receives a mock implementation that immediately fires the success callback.
 * The actual Cloudflare script is intercepted and replaced with a tiny stub
 * that triggers the library's onload hook.
 */
async function mockTurnstile(page: Page): Promise<void> {
  // Inject the mock global before the page's own scripts execute.
  await page.addInitScript(() => {
    type TurnstileOpts = {
      callback?: (token: string) => void;
      "error-callback"?: () => void;
    };

    (window as unknown as Record<string, unknown>).turnstile = {
      render(_el: Element, opts: TurnstileOpts): string {
        // Fire the success callback asynchronously, as the real widget would.
        setTimeout(() => opts.callback?.("mock-turnstile-token-smoke"), 50);
        return "mock-widget-0";
      },
      reset: () => {},
      remove: () => {},
      isExpired: () => false,
    };
  });

  // Intercept the Cloudflare challenges script and return a stub that fires
  // the library's registered onload callback (onloadTurnstileCallback).
  await page.route("**/challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "if(typeof window.onloadTurnstileCallback==='function')window.onloadTurnstileCallback();",
    }),
  );
}

test.describe("Contact page", () => {
  test.beforeEach(async ({ page }) => {
    await mockTurnstile(page);
    await page.goto("/contact");
  });

  test("page loads and shows contact heading", async ({ page }) => {
    // PageHero renders a heading — confirm it is present.
    await expect(page.getByText(/contact|get in touch/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("name field is present", async ({ page }) => {
    await expect(page.locator('input[name="name"], #name')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("email field is present", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("message textarea is present", async ({ page }) => {
    await expect(
      page.locator('textarea[name="message"], #message'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("submit button is present", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /send|submit/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Turnstile mock fires — submit does not show Turnstile error on filled form", async ({
    page,
  }) => {
    // Wait for the mock Turnstile callback to fire (turnstileToken state set).
    await page.waitForTimeout(200);

    // Fill required fields.
    const nameInput = page.locator('input[name="name"], #name').first();
    const emailInput = page.locator('input[type="email"]').first();
    const messageInput = page
      .locator('textarea[name="message"], #message')
      .first();

    await nameInput.fill("Smoke Test");
    await emailInput.fill("smoke@example.com");
    await messageInput.fill("This is an automated smoke test message.");

    // Click submit — Turnstile token is already mocked so the client-side
    // guard (`if (!turnstileToken)`) must not set an error.
    const submitBtn = page.getByRole("button", { name: /send|submit/i });
    await submitBtn.click();

    // The Turnstile-missing error text must not appear.
    await expect(
      page.getByText(/complete the turnstile|verification required/i),
    ).not.toBeVisible();
  });
});
