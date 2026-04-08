import { test, expect } from "@playwright/test";

test.describe("Digest Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/project/proj-checkout/digest?roundId=round-3");
  });

  test("renders digest header with round name", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Apr 6, 2026" })).toBeVisible();
    await expect(page.getByText("Demo")).toBeVisible();
  });

  test("stats bar renders stat cards", async ({ page }) => {
    await expect(page.getByText("Comments", { exact: true })).toBeVisible();
    await expect(page.getByText("Issues", { exact: true })).toBeVisible();
  });

  test("at a glance summary card is visible", async ({ page }) => {
    await expect(page.getByText(/progressing well/i)).toBeVisible();
  });

  test("issues grouped by page sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  });

  test("issue card shows title, priority badge, and suggested action", async ({ page }) => {
    await expect(page.getByText("Bug: Payment form validation")).toBeVisible();
    await expect(page.getByText(/critical/i).first()).toBeVisible();
  });

  test("issue cards have open in figma links", async ({ page }) => {
    const figmaLinks = page.locator('a[href*="figma.com"]');
    expect(await figmaLinks.count()).toBeGreaterThan(0);
  });

  test("back link navigates to project", async ({ page }) => {
    await page.getByRole("link", { name: /Back to project/i }).click();
    await expect(page).toHaveURL(/\/project\/proj-checkout/);
  });
});

test.describe("Digest Page - No Round", () => {
  test("shows empty state when no roundId", async ({ page }) => {
    await page.goto("/project/proj-checkout/digest");
    await expect(page.getByText("No digest yet")).toBeVisible();
  });
});
