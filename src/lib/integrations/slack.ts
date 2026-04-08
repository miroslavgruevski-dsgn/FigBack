interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: { type: string; text: { type: string; text: string }; url?: string }[];
  accessory?: Record<string, unknown>;
}

interface DigestPayload {
  projectName: string;
  roundName: string;
  totalComments: number;
  totalClusters: number;
  criticalCount: number;
  digestUrl: string;
  topIssues: { title: string; priority: string }[];
}

export async function postSlackDigest(
  webhookUrl: string,
  payload: DigestPayload
): Promise<{ ok: boolean; error?: string }> {
  const blocks = buildBlocks(payload);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!res.ok) {
      return { ok: false, error: `Slack responded with ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function buildBlocks(payload: DigestPayload): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `FigBack: ${payload.projectName}`, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${payload.roundName}* \u2014 ${payload.totalComments} comments \u2192 ${payload.totalClusters} issues${
          payload.criticalCount > 0 ? ` (${payload.criticalCount} critical)` : ""
        }`,
      },
    },
  ];

  if (payload.topIssues.length > 0) {
    blocks.push({
      type: "section",
      fields: payload.topIssues.slice(0, 5).map((issue) => ({
        type: "mrkdwn",
        text: `*${issue.priority.toUpperCase()}* ${issue.title}`,
      })),
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View Digest" },
        url: payload.digestUrl,
      },
    ],
  });

  return blocks;
}

export async function postSlackNewComments(
  webhookUrl: string,
  projectName: string,
  newCount: number,
  projectUrl: string
) {
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${newCount} new comment${newCount !== 1 ? "s" : ""}* on *${projectName}* in Figma`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View in FigBack" },
          url: projectUrl,
        },
      ],
    },
  ];

  return fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
}
