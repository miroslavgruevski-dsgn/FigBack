import { test, expect } from "@playwright/test";

test.describe("Not Found Page", () => {
  test("unknown route shows 404 with back link", async ({ page }) => {
    await page.goto("/some-random-path-that-does-not-exist");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("Page not found")).toBeVisible();

    const homeLink = page.getByRole("link", { name: /Back to dashboard/i });
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await expect(page).toHaveURL("/");
  });
});
