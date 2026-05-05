import { test, expect } from "@playwright/test";

test.describe("Navigation (unauthenticated)", () => {
  test("protected routes redirect to sign-in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("sign-in page shows brand", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByText("FigBack", { exact: true })).toBeVisible();
  });
});
