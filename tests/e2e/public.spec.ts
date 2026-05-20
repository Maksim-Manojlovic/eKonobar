import { test, expect } from "@playwright/test";

test.describe("public pages", () => {
  test("role picker loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveTitle(/error/i);
    // Two role cards must be present
    await expect(page.getByRole("link", { name: /lokali|venue/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /konobar|waiter/i })).toBeVisible();
  });

  test("for-venues landing loads", async ({ page }) => {
    await page.goto("/for-venues");
    await expect(page.locator("nav")).toBeVisible();
    // Pricing section anchor must exist
    await expect(page.locator("#cenovnik")).toBeVisible();
  });

  test("for-waiters landing loads", async ({ page }) => {
    await page.goto("/for-waiters");
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("#tierovi")).toBeVisible();
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.getByRole("button", { name: /prijava|login/i })).toBeVisible();
  });
});
