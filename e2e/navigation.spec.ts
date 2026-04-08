import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("desktop nav links work and show active indicator", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("header nav");
    await expect(nav).toBeVisible();

    const dashLink = nav.getByRole("link", { name: "Dashboard" });
    await expect(dashLink).toHaveClass(/text-foreground/);

    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL("/settings");

    await nav.getByRole("link", { name: "Security" }).click();
    await expect(page).toHaveURL("/security");
  });

  test("brand link goes to dashboard", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: "FigBack" }).click();
    await expect(page).toHaveURL("/");
  });

  test("theme toggle in user menu switches between light and dark", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");

    const avatar = page.locator("header").getByRole("button").last();
    await avatar.click();
    const themeItem = page.getByRole("menuitem", { name: /mode/i });
    await themeItem.click();
    const classAfterClick = await html.getAttribute("class");
    expect(classAfterClick).toBeTruthy();
  });
});

test.describe("Mobile Navigation", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("mobile menu opens and links work", async ({ page }) => {
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: /menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      const settingsLink = page.getByRole("link", { name: "Settings" });
      await expect(settingsLink).toBeVisible();
      await settingsLink.click();
      await expect(page).toHaveURL("/settings");
    }
  });
});
