import { summarizeIntegrationError } from "./error-summary";

interface ConfluenceConfig {
  baseUrl: string;
  email: string;
  token: string;
  spaceKey: string;
  parentId?: string | null;
}

interface DigestContent {
  title: string;
  summary: string;
  clusters: {
    title: string;
    summary: string;
    priority: string;
    commentCount: number;
    status: string;
  }[];
}

export async function pushToConfluence(
  config: ConfluenceConfig,
  content: DigestContent
): Promise<{ ok: boolean; pageUrl?: string; error?: string }> {
  const html = buildConfluenceHtml(content);
  const auth = Buffer.from(`${config.email}:${config.token}`).toString("base64");

  const body: Record<string, unknown> = {
    type: "page",
    title: content.title,
    space: { key: config.spaceKey },
    body: { storage: { value: html, representation: "storage" } },
  };

  if (config.parentId) {
    body.ancestors = [{ id: config.parentId }];
  }

  try {
    const res = await fetch(`${config.baseUrl}/rest/api/content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: summarizeIntegrationError(`Confluence error ${res.status}: ${text}`),
      };
    }

    const data = await res.json();
    const pageUrl = `${config.baseUrl}${data._links?.webui ?? ""}`;
    return { ok: true, pageUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function testConfluenceConnection(
  config: ConfluenceConfig
): Promise<{ ok: boolean; error?: string }> {
  const auth = Buffer.from(`${config.email}:${config.token}`).toString("base64");
  const url = `${config.baseUrl}/rest/api/space/${encodeURIComponent(config.spaceKey)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: summarizeIntegrationError(`Confluence error ${res.status}: ${text}`),
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function buildConfluenceHtml(content: DigestContent): string {
  let html = `<h2>Executive Summary</h2><p>${escapeHtml(content.summary)}</p>`;
  html += `<h2>Issues (${content.clusters.length})</h2>`;
  html += `<table><thead><tr><th>Issue</th><th>Priority</th><th>Status</th><th>Comments</th></tr></thead><tbody>`;

  for (const cluster of content.clusters) {
    html += `<tr>`;
    html += `<td><strong>${escapeHtml(cluster.title)}</strong><br/>${escapeHtml(cluster.summary)}</td>`;
    html += `<td>${escapeHtml(cluster.priority)}</td>`;
    html += `<td>${escapeHtml(cluster.status)}</td>`;
    html += `<td>${cluster.commentCount}</td>`;
    html += `</tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
