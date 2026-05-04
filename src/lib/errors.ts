export class FigmaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fileKey?: string
  ) {
    super(message);
    this.name = "FigmaApiError";
  }
}

/** Short copy for file card / token UI. No secrets. */
export function userMessageForFigmaHttpStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "Figma rejected the token. Create a new personal access token with file read and comment read (file_comments:read) and update it in settings or this project.";
  }
  if (status === 404) {
    return "Figma file not found. Check the file or branch link and that the token can access it.";
  }
  if (status === 429) {
    return "Figma rate limit. Wait a bit and sync again.";
  }
  return `Figma API error (${status}). Check the token and file access.`;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public provider: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export class JobError extends Error {
  constructor(
    message: string,
    public jobId: string
  ) {
    super(message);
    this.name = "JobError";
  }
}
