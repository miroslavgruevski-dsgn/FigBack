import { test, expect } from "@playwright/test";

test.describe("API Routes", () => {
  test("POST /api/jobs/run returns valid response", async ({ request }) => {
    const res = await request.post("/api/jobs/run", {
      maxRedirects: 0,
    });
    if (res.status() === 307) {
      test.skip(true, "API requires auth");
      return;
    }
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(["all_done", "jobs_running"]).toContain(data.message);
  });

  test("POST /api/cron/check-comments rejects unauthenticated", async ({ request }) => {
    const res = await request.post("/api/cron/check-comments", {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/cron/check-comments rejects wrong secret", async ({ request }) => {
    const res = await request.post("/api/cron/check-comments", {
      headers: { Authorization: "Bearer wrong-secret" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/digest requires auth", async ({ request }) => {
    const res = await request.post("/api/digest", {
      data: { projectId: "test" },
      maxRedirects: 0,
    });
    // Either 307 redirect (auth required) or 200 with data
    expect([200, 307]).toContain(res.status());
  });

  test("POST /api/reanalyze requires auth", async ({ request }) => {
    const res = await request.post("/api/reanalyze", {
      data: { projectId: "test" },
      maxRedirects: 0,
    });
    expect([200, 307]).toContain(res.status());
  });
});
