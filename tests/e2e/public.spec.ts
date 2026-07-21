import { test, expect } from "@playwright/test";

test.describe("public pages", () => {
  test("role picker loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveTitle(/error/i);
    // Two role cards must be present
    await expect(page.locator('a[href="/for-venues"]')).toBeVisible();
    await expect(page.locator('a[href="/for-waiters"]')).toBeVisible();
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
    // Verification section anchor — replaced the old #tierovi paid-tier ladder
    await expect(page.locator("#verifikacija")).toBeVisible();
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.getByRole("button", { name: /prijavi se|login/i })).toBeVisible();
  });
});
