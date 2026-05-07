import { afterEach, describe, expect, it, vi } from "vitest";
import { testSlackWebhook } from "./slack";

describe("testSlackWebhook", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok on successful webhook call", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 })
    );
    const result = await testSlackWebhook("https://hooks.slack.com/services/test");
    expect(result.ok).toBe(true);
  });

  it("returns error when webhook fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("bad", { status: 400 })
    );
    const result = await testSlackWebhook("https://hooks.slack.com/services/test");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("400");
  });
});
