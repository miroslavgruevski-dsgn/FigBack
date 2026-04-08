import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  { name: "Sign In", path: "/auth/signin" },
  { name: "Auth Error", path: "/auth/error" },
  { name: "Onboarding", path: "/onboarding" },
];

for (const { name, path } of pages) {
  test(`${name} page has no critical accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (critical.length > 0) {
      const summary = critical.map(
        (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`
      );
      expect(critical, `A11y violations on ${name}:\n${summary.join("\n")}`).toHaveLength(0);
    }
  });
}
