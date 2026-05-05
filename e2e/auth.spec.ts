import { test, expect } from "@playwright/test";

test.describe("Auth Pages", () => {
  test("sign-in page shows Google button", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  });

  test("error page shows message and retry link", async ({ page }) => {
    await page.goto("/auth/error");
    await expect(page.getByRole("heading", { name: /Access Denied/i })).toBeVisible();
    await expect(page.getByText(/restricted to the Symphony team/i)).toBeVisible();

    const retryLink = page.getByRole("link", { name: /Try with a different account/i });
    await expect(retryLink).toBeVisible();
    await retryLink.click();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("unauthenticated users are redirected to sign-in from dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("unauthenticated users are redirected from settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("unauthenticated users are redirected from project/new", async ({ page }) => {
    await page.goto("/project/new");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("redirect preserves callback URL", async ({ page }) => {
    await page.goto("/project/new");
    await expect(page).toHaveURL(/callbackUrl/);
  });
});
