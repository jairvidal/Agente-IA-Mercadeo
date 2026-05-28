import type { LlmError } from "@/modules/orchestrator/domain/errors";
import type { Result } from "@/modules/orchestrator/domain/result";

/**
 * Domain-level types for talking to an LLM. The domain MUST NOT know about
 * Vercel AI SDK, OpenAI, Anthropic, or Gemini — the adapter in `infrastructure/llm`
 * is responsible for mapping these into the SDK call shape and back.
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Tool exposed to the LLM. `parameters` is a JSON Schema object. */
export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Tool call returned by the LLM in a completion. */
export interface LlmToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  temperature?: number;
  timeoutMs?: number;
}

export interface LlmCompletionResponse {
  content: string;
  toolCalls?: LlmToolCall[];
  usage: LlmUsage;
}

/**
 * Structured-output request. The `schema` is opaque to the domain: the caller
 * (e.g. the intent classifier in E-02) supplies a Zod schema, the adapter
 * forwards it to `generateObject`, and the domain treats the resulting object
 * as `unknown` until the caller narrows it via the schema.
 */
export interface LlmStructuredRequest<TSchema> {
  messages: LlmMessage[];
  schema: TSchema;
  temperature?: number;
  timeoutMs?: number;
}

export interface LlmStructuredResponse<T> {
  object: T;
  usage: LlmUsage;
}

export interface LlmProviderPort {
  /** Returns the LLM's response, or an LLM-related error if the operation failed. */
  complete(
    req: LlmCompletionRequest,
  ): Promise<Result<LlmCompletionResponse, LlmError>>;

  /** Like `complete`, but for structured output. The domain layer doesn't know the shape of `TSchema` or `T`. */
  completeStructured<T>(
    req: LlmStructuredRequest<unknown>,
  ): Promise<Result<LlmStructuredResponse<T>, LlmError>>;
}
