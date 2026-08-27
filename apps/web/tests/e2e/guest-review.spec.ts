import { test, expect } from "@playwright/test";

// These tests need a seeded venue — the seed script creates one with a known ID.
// Run `npm run db:seed` before running E2E tests locally.
const SEEDED_VENUE_ID = process.env.E2E_VENUE_ID ?? "seed-venue-1";

test.describe("Guest review flow", () => {
  test("review page loads and shows choice step", async ({ page }) => {
    await page.goto(`/review/${SEEDED_VENUE_ID}`);
    // Must show the three-way choice, not a 404
    await expect(page.getByText(/šta biste ocenili/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /oceni restoran/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /oceni konobara/i })).toBeVisible();
  });

  test("unknown venue ID shows 404 state", async ({ page }) => {
    await page.goto("/review/definitely-not-a-real-id");
    await expect(page.getByText(/nije pronađen|ne postoji|not found|404/i)).toBeVisible({ timeout: 5000 });
  });

  test("selecting venue review shows GUEST_TO_VENUE form", async ({ page }) => {
    await page.goto(`/review/${SEEDED_VENUE_ID}`);
    await page.getByRole("button", { name: /oceni restoran/i }).click();
    // Venue-specific rating fields must appear
    await expect(page.getByText(/atmosfera/i)).toBeVisible();
    await expect(page.getByText(/organizacija/i)).toBeVisible();
  });

  test("selecting waiter review shows GUEST_TO_WAITER form", async ({ page }) => {
    await page.goto(`/review/${SEEDED_VENUE_ID}`);
    await page.getByRole("button", { name: /oceni konobara/i }).click();
    // Waiter-specific rating fields must appear
    await expect(page.getByText(/ljubaznost|friendli/i)).toBeVisible();
  });
});
