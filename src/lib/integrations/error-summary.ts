function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(input).replace(/<[^>]*>/g, " ");
}

export function summarizeIntegrationError(raw: string, maxLen = 240): string {
  const compact = stripHtml(raw).replace(/\s+/g, " ").trim();
  if (!compact) return "Unknown integration error";

  const lower = compact.toLowerCase();
  if (
    lower.includes("confluence error 404") &&
    (lower.includes("page unavailable") || lower.includes("atlassian cloud notifications"))
  ) {
    return "Confluence returned 404 Page Unavailable. Check Confluence URL (/wiki), space key, and page permissions.";
  }

  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 1).trimEnd()}…`;
}
