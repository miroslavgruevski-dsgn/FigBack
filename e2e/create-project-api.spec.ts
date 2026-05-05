import { expect, test } from "@playwright/test";

const secret = process.env.E2E_AUTH_SECRET;

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "x-e2e-auth": secret!,
  };
}

test.describe("POST /api/projects (E2E)", () => {
  test.skip(
    !secret,
    "Set E2E_AUTH_SECRET in .env.local for local runs. Do not set this in production."
  );

  test("201 then 409 duplicate file key", async ({ request }) => {
    const fileKey = `e2e${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
    const figmaUrl = `https://www.figma.com/design/${fileKey}/E2E-Test`;
    const body = { name: `E2E ${fileKey.slice(0, 8)}`, urls: [figmaUrl] };

    const res1 = await request.post("/api/projects", {
      headers: authHeaders(),
      data: body,
    });

    const text1 = await res1.text();
    expect(res1.status(), text1).toBe(201);
    const json1 = JSON.parse(text1) as { id: string; files?: unknown[] };
    expect(json1.id).toBeTruthy();

    const res2 = await request.post("/api/projects", {
      headers: authHeaders(),
      data: { name: "Duplicate attempt", urls: [figmaUrl] },
    });

    expect(res2.status()).toBe(409);
    const json2 = (await res2.json()) as { code?: string };
    expect(json2.code).toBe("duplicate_file");
  });
});
