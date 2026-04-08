import { test, expect } from "@playwright/test";

test.describe("Settings Page (unauthenticated)", () => {
  test("redirects to sign-in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
