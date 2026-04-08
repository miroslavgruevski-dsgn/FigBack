import { test, expect } from "@playwright/test";

test.describe("Navigation (unauthenticated)", () => {
  test("protected routes redirect to sign-in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("sign-in page has brand link", async ({ page }) => {
    await page.goto("/auth/signin");
    const brand = page.getByRole("link", { name: /FigBack/i });
    await expect(brand).toBeVisible();
  });
});
