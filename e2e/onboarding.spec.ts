import { test, expect } from "@playwright/test";

test.describe("Onboarding Page", () => {
  test("renders onboarding content", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL("/onboarding");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
