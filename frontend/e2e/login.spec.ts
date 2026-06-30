import { expect, test } from "@playwright/test";

/**
 * Smoke: login page renders the sign-in form and enforces HTML5 validation
 * on empty submit.
 *
 * Prerequisites: the dev server must be running with NEXT_PUBLIC_SUPABASE_URL
 * and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY set (so checkAuthAction() can
 * resolve).  No authenticated user or database fixtures are required — an
 * unauthenticated request to Supabase returns quickly with {user: null}.
 */

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    // The page shows <BrandLoader> while checkAuthAction() runs, then reveals
    // the form.  Wait for the form to become visible (up to 15 s).
    await page.waitForSelector("form", { timeout: 15_000 });
  });

  test("renders the sign-in heading", async ({ page }) => {
    await expect(page.getByText("Sign In", { exact: true })).toBeVisible();
  });

  test("has email and password fields", async ({ page }) => {
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("submit button is present and initially enabled", async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test("empty submit triggers HTML5 required validation — page stays on /login", async ({
    page,
  }) => {
    // Both email and password have the `required` attribute; clicking submit
    // with empty fields must not navigate away.
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("email field is marked required", async ({ page }) => {
    const emailInput = page.locator("#email");
    await expect(emailInput).toHaveAttribute("required");
  });

  test("password field is marked required", async ({ page }) => {
    const passwordInput = page.locator("#password");
    await expect(passwordInput).toHaveAttribute("required");
  });

  test("shows forgot-password link", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /forgot your password/i }),
    ).toBeVisible();
  });

  test("back-to-home link points to /", async ({ page }) => {
    const homeLink = page.getByRole("link", { name: /back to home/i });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute("href", "/");
  });
});
