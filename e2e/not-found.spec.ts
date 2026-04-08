import { test, expect } from "@playwright/test";

test.describe("Not Found Page", () => {
  test("unknown route redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/some-random-path-that-does-not-exist");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
