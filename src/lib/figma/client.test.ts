import { describe, expect, it } from "vitest";
import { extractFileKey } from "./client";

describe("extractFileKey", () => {
  it("parses design URL file key", () => {
    expect(
      extractFileKey(
        "https://www.figma.com/design/lOh0TGH6s0scLYKuVTTwOm/NSRL-Form"
      )
    ).toBe("lOh0TGH6s0scLYKuVTTwOm");
  });

  it("parses file URL", () => {
    expect(
      extractFileKey("https://www.figma.com/file/abc123XYZ/name")
    ).toBe("abc123XYZ");
  });

  it("returns null for invalid URL", () => {
    expect(extractFileKey("https://example.com/page")).toBeNull();
  });
});
