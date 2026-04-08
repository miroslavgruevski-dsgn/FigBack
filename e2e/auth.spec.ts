import { test, expect } from "@playwright/test";

test.describe("Auth Pages", () => {
  test("sign-in page shows Google button", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByRole("heading", { name: /Welcome to FigBack/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  });

  test("error page shows message and retry link", async ({ page }) => {
    await page.goto("/auth/error");
    await expect(page.getByRole("heading", { name: /Access Denied/i })).toBeVisible();
    await expect(page.getByText(/not authorized/i)).toBeVisible();

    const retryLink = page.getByRole("link", { name: /Try again/i });
    await expect(retryLink).toBeVisible();
    await retryLink.click();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
