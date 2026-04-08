import { test, expect } from "@playwright/test";

test.describe("Digest Page (unauthenticated)", () => {
  test("redirects to sign-in", async ({ page }) => {
    await page.goto("/project/some-project/digest");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
