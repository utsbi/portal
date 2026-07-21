import { expect, test } from "@playwright/test";

/**
 * Smoke: public static pages return 200 and render key text.
 *
 * These pages are pure client-side React (no Supabase data fetching)
 * so they run without any auth or database fixtures.
 */

test.describe("Public static pages", () => {
  test("home page returns 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    // The page shows a LoadingScreen on first paint; confirm HTML is present.
    await expect(page.locator("html")).toBeAttached();
  });

  test("about page returns 200 and shows primary heading", async ({ page }) => {
    const response = await page.goto("/about");
    expect(response?.status()).toBe(200);
    // "Who We Are" is the PageHero title rendered server-side — no auth needed.
    await expect(page.getByText("Who We Are")).toBeVisible({ timeout: 10_000 });
  });

  test("about page contains organisation name", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.getByText("The Sustainable Building Initiative", { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
