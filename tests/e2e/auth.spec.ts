import { test, expect } from "@playwright/test";

test.describe("authentication", () => {
  test("wrong credentials show error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "notreal@example.com");
    await page.fill("input[type='password']", "wrongpassword");
    await page.getByRole("button", { name: /prijava|login/i }).click();
    // Should stay on login page and show an error
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("text=/greška|error|neispravni|invalid/i")).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated /venue redirects to login", async ({ page }) => {
    await page.goto("/venue");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated /waiter redirects to login", async ({ page }) => {
    await page.goto("/waiter");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated /admin redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/login/);
  });
});
