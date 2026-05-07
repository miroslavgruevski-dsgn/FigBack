import { describe, expect, it } from "vitest";
import { buildClusterCanonicalKey, computeClusterPriorityScore, rankIssueClusters } from "./cluster";

describe("cluster ranking", () => {
  it("prioritizes severity and frequency", () => {
    const critical = computeClusterPriorityScore(["critical", "high"], 2, new Date());
    const low = computeClusterPriorityScore(["low"], 4, new Date());
    expect(critical).toBeGreaterThan(low);
  });

  it("sorts clusters by aggregate score", () => {
    const now = new Date();
    const items = rankIssueClusters([
      {
        firstSeenAt: now,
        cards: [{ assessment: { priorityHint: "low" } }],
      },
      {
        firstSeenAt: now,
        cards: [
          { assessment: { priorityHint: "high" } },
          { assessment: { priorityHint: "high" } },
        ],
      },
    ]);
    expect(items[0].cards.length).toBe(2);
  });

  it("builds stable canonical keys with normalization", () => {
    const key = buildClusterCanonicalKey({
      id: "card_1",
      frameName: "Settings",
      pageName: "Main",
      comment: { frameId: "FRAME_ABC", nodeId: null, pageId: "PAGE_1" },
      assessment: {
        issueType: "copy",
        elementTarget: "  Primary Button  ",
        priorityHint: "medium",
        suggestedAction: "Update copy",
      },
    });
    expect(key).toBe("frame_abc::copy::primary button");
  });
});
