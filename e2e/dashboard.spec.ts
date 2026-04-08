import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders projects heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("new project button navigates to create form", async ({ page }) => {
    await page.getByRole("link", { name: /New Project/i }).click();
    await expect(page).toHaveURL("/project/new");
  });
});
