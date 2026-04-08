import { test, expect } from "@playwright/test";

test.describe("New Project Page (unauthenticated)", () => {
  test("redirects to sign-in", async ({ page }) => {
    await page.goto("/project/new");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
