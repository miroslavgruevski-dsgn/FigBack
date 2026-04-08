import { test, expect } from "@playwright/test";

test.describe("New Project Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/project/new");
  });

  test("renders form with name field and one URL row", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "New Project" })).toBeVisible();
    await expect(page.getByLabel("Project name")).toBeVisible();
    await expect(page.getByPlaceholder(/figma.com/i)).toBeVisible();
  });

  test("add another file button adds a row", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /Add another file/i });
    await addBtn.click();
    const urlInputs = page.getByPlaceholder(/figma.com/i);
    expect(await urlInputs.count()).toBe(2);
  });

  test("remove button removes a row when more than one exists", async ({ page }) => {
    await page.getByRole("button", { name: /Add another file/i }).click();
    expect(await page.getByPlaceholder(/figma.com/i).count()).toBe(2);

    await page.getByRole("button", { name: /Remove URL/i }).first().click();
    expect(await page.getByPlaceholder(/figma.com/i).count()).toBe(1);
  });

  test("back to dashboard link works", async ({ page }) => {
    await page.getByRole("link", { name: /Back to dashboard/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("create project button is present", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Create Project/i })).toBeVisible();
  });
});
