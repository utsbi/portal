import { expect, test } from "@playwright/test";

test("page scripts carry the request CSP nonce", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();

  const csp = response?.headers()["content-security-policy"] ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();

  const scriptNonces = await page
    .locator("script")
    .evaluateAll((scripts) => scripts.map((script) => script.nonce));
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.some((scriptNonce) => scriptNonce === nonce)).toBe(true);

  if (process.env.CI) {
    expect(scriptNonces.every((scriptNonce) => scriptNonce === nonce)).toBe(
      true,
    );
    expect(csp).not.toContain("'unsafe-eval'");
  }
});
