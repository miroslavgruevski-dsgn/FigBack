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
