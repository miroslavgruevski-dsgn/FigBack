interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: (
    | { type: "button"; text: { type: string; text: string }; url?: string }
    | { type: "mrkdwn"; text: string }
    | { type: "plain_text"; text: string }
  )[];
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

const PRIORITY_EMOJI: Record<string, string> = {
  critical: ":red_circle:",
  high: ":large_orange_circle:",
  medium: ":large_yellow_circle:",
  low: ":white_circle:",
};

export async function postSlackDigest(
  webhookUrl: string,
  payload: DigestPayload
): Promise<{ ok: boolean; error?: string }> {
  const blocks = buildDigestBlocks(payload);
  const fallback = `FigBack: ${payload.projectName} \u2014 ${payload.totalComments} comments \u2192 ${payload.totalClusters} issues`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fallback, blocks }),
    });

    if (!res.ok) {
      return { ok: false, error: `Slack responded with ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function buildDigestBlocks(payload: DigestPayload): SlackBlock[] {
  const criticalNote =
    payload.criticalCount > 0 ? `  \u2022  :rotating_light: *${payload.criticalCount} critical*` : "";

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `FigBack: ${payload.projectName}`, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${payload.roundName}*`,
          `${payload.totalComments} comments \u2192 ${payload.totalClusters} issue${payload.totalClusters !== 1 ? "s" : ""}${criticalNote}`,
        ].join("\n"),
      },
    },
  ];

  if (payload.topIssues.length > 0) {
    blocks.push({ type: "divider" });

    const lines = payload.topIssues.slice(0, 5).map((issue) => {
      const emoji = PRIORITY_EMOJI[issue.priority] ?? PRIORITY_EMOJI.medium;
      return `${emoji}  ${issue.title}`;
    });

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
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

  const now = new Date();
  const ts = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " at "
    + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `Posted via FigBack  \u2022  ${ts}` },
    ],
  });

  return blocks;
}

export async function postSlackSyncSummary(
  webhookUrl: string,
  projects: { name: string; url: string }[]
): Promise<{ ok: boolean; error?: string }> {
  const count = projects.length;
  const fallback = `FigBack: checking ${count} project${count !== 1 ? "s" : ""} for new comments`;

  const projectList = projects
    .slice(0, 10)
    .map((p) => `\u2022 <${p.url}|${p.name}>`)
    .join("\n");

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:mag: *Checking ${count} project${count !== 1 ? "s" : ""} for new Figma comments*`,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: projectList },
    },
  ];

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fallback, blocks }),
    });

    if (!res.ok) {
      return { ok: false, error: `Slack responded with ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
