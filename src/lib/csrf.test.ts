import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isCsrfOriginAllowed, normalizeHostForCsrf } from "./csrf";

function req(url: string, headers: Record<string, string>) {
  return new NextRequest(url, { headers: new Headers(headers) });
}

describe("normalizeHostForCsrf", () => {
  it("strips leading www", () => {
    expect(normalizeHostForCsrf("www.example.com")).toBe("example.com");
  });

  it("normalizes loopback", () => {
    expect(normalizeHostForCsrf("127.0.0.1:3000")).toBe("localhost:3000");
  });
});

describe("isCsrfOriginAllowed", () => {
  it("allows matching origin and host", () => {
    const r = req("http://localhost:3000/api/projects", {
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });
    expect(isCsrfOriginAllowed(r)).toBe(true);
  });

  it("allows localhost origin against 127.0.0.1 host", () => {
    const r = req("http://127.0.0.1:3000/api/projects", {
      origin: "http://localhost:3000",
      host: "127.0.0.1:3000",
    });
    expect(isCsrfOriginAllowed(r)).toBe(true);
  });

  it("allows www origin when apex is on host and forwarded matches www", () => {
    const r = req("https://example.com/api/projects", {
      origin: "https://www.example.com",
      host: "example.com",
      "x-forwarded-host": "www.example.com",
    });
    expect(isCsrfOriginAllowed(r)).toBe(true);
  });

  it("allows www and apex when both normalize to same apex", () => {
    const r = req("https://www.example.com/api/projects", {
      origin: "https://www.example.com",
      host: "www.example.com",
    });
    expect(isCsrfOriginAllowed(r)).toBe(true);
  });

  it("matches req.url host candidate", () => {
    const r = req("http://localhost:3000/api/projects", {
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });
    expect(isCsrfOriginAllowed(r)).toBe(true);
  });

  it("rejects unrelated origin", () => {
    const r = req("http://localhost:3000/api/projects", {
      origin: "https://evil.example",
      host: "localhost:3000",
    });
    expect(isCsrfOriginAllowed(r)).toBe(false);
  });

  it("allows missing origin", () => {
    const r = req("http://localhost:3000/api/projects", {
      host: "localhost:3000",
    });
    expect(isCsrfOriginAllowed(r)).toBe(true);
  });
});
