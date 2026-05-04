const UNKNOWN = new Set(["unknown", "Uncategorized", "uncategorized"]);

export function isPlaceholderLabel(name: string | null | undefined): boolean {
  if (name == null || name.trim() === "") return true;
  return UNKNOWN.has(name.trim()) || name.trim().toLowerCase() === "unknown";
}

/** Section headings (page group in digest). */
export function displayPageSection(name: string): string {
  const k = name.trim();
  if (k === "" || isPlaceholderLabel(k)) return "Unnamed page";
  return k;
}

/** Frame row label under a page section. */
export function displayFrameSection(name: string): string {
  if (isPlaceholderLabel(name)) return "Unnamed frame";
  return name;
}

/** Issue card top-right metadata (frame · page). */
export function formatFramePageLine(frameName: string, pageName?: string): string {
  const f = isPlaceholderLabel(frameName) ? "Unnamed frame" : frameName;
  if (pageName && !isPlaceholderLabel(pageName)) {
    return `${f} · ${pageName}`;
  }
  return f;
}

/** Stable keys so placeholder page/frame names group together. */
export function pageGroupKey(name: string | null | undefined): string {
  return isPlaceholderLabel(name ?? "") ? "__page_unknown__" : (name ?? "__page_unknown__");
}

export function frameGroupKey(name: string | null | undefined): string {
  return isPlaceholderLabel(name ?? "") ? "__frame_unknown__" : (name ?? "__frame_unknown__");
}
