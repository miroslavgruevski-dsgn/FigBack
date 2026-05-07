import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfluenceConnection } from "./confluence";

describe("testConfluenceConnection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok when space lookup succeeds", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ key: "DESIGN" }), { status: 200 })
    );
    const result = await testConfluenceConnection({
      baseUrl: "https://team.atlassian.net/wiki",
      email: "a@b.com",
      token: "token",
      spaceKey: "DESIGN",
    });
    expect(result.ok).toBe(true);
  });

  it("summarizes server errors", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("<html><body>not found</body></html>", { status: 404 })
    );
    const result = await testConfluenceConnection({
      baseUrl: "https://team.atlassian.net/wiki",
      email: "a@b.com",
      token: "token",
      spaceKey: "DESIGN",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.toLowerCase()).toContain("not found");
  });
});
