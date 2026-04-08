import { test, expect } from "@playwright/test";

test.describe("Project Page", () => {
  test("404 for non-existent project", async ({ page }) => {
    const res = await page.goto("/project/non-existent-id");
    expect(res?.status()).toBe(404);
  });
});
