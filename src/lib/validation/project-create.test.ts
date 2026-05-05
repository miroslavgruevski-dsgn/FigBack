import { describe, expect, it } from "vitest";
import { createProjectBodySchema } from "./project-create";

describe("createProjectBodySchema", () => {
  it("accepts name and figma design URL", () => {
    const r = createProjectBodySchema.safeParse({
      name: "My project",
      urls: ["https://www.figma.com/design/AbCdEfGhIjKl/Test"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty urls", () => {
    const r = createProjectBodySchema.safeParse({
      name: "A",
      urls: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid url string", () => {
    const r = createProjectBodySchema.safeParse({
      name: "A",
      urls: ["not-a-url"],
    });
    expect(r.success).toBe(false);
  });
});
