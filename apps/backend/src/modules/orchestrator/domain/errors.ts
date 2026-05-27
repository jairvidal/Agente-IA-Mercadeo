export class InvalidMessageError extends Error {
  constructor(reason: string) {
    super(`Invalid message: ${reason}`);
    this.name = "InvalidMessageError";
  }
}

export class KnowledgeBaseUnavailableError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Knowledge base unavailable: ${operation}`);
    this.name = "KnowledgeBaseUnavailableError";
    if (cause !== undefined) this.cause = cause;
  }
}

export class ToolInvocationError extends Error {
  constructor(tool: string, cause?: unknown) {
    super(`Tool invocation failed: ${tool}`);
    this.name = "ToolInvocationError";
    if (cause !== undefined) this.cause = cause;
  }
}
