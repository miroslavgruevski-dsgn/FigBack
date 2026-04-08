import { test, expect } from "@playwright/test";

test.describe("Project Page (unauthenticated)", () => {
  test("redirects to sign-in for any project", async ({ page }) => {
    await page.goto("/project/some-project-id");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
