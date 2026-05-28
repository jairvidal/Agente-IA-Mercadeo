import {
  AGENT_FALLBACK_REPLY,
  MAX_AGENT_ITERATIONS,
} from "@/modules/orchestrator/domain/constants";
import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import {
  LlmInvalidResponseError,
  LlmRateLimitError,
  LlmTimeoutError,
  type MessageChannelError,
  type SessionRepositoryError,
} from "@/modules/orchestrator/domain/errors";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";
import type { KnowledgeBasePort } from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type {
  LlmMessage,
  LlmProviderPort,
  LlmToolCall,
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import type { MessageChannelPort } from "@/modules/orchestrator/domain/ports/message-channel.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { ok, type Result } from "@/modules/orchestrator/domain/result";
import { logger } from "@sidoc/observability";

export type ProcessTelegramMessageError =
  | SessionRepositoryError
  | MessageChannelError;

export interface ProcessTelegramMessageDeps {
  channel: MessageChannelPort;
  sessions: SessionRepositoryPort;
  knowledgeBase: KnowledgeBasePort;
  llm: LlmProviderPort;
  agentTools: AgentToolPort;
  /** Tools the LLM is permitted to call. Other tool calls are dropped silently. */
  allowedTools: readonly string[];
  /** Override the loop cap (mostly for tests). */
  maxIterations?: number;
}

interface DraftedReply {
  text: string;
  metadata: Record<string, unknown>;
}

export class ProcessTelegramMessageUseCase {
  private readonly channel: MessageChannelPort;
  private readonly sessions: SessionRepositoryPort;
  private readonly knowledgeBase: KnowledgeBasePort;
  private readonly llm: LlmProviderPort;
  private readonly agentTools: AgentToolPort;
  private readonly allowedTools: ReadonlySet<string>;
  private readonly maxIterations: number;

  constructor(deps: ProcessTelegramMessageDeps) {
    this.channel = deps.channel;
    this.sessions = deps.sessions;
    this.knowledgeBase = deps.knowledgeBase;
    this.llm = deps.llm;
    this.agentTools = deps.agentTools;
    this.allowedTools = new Set(deps.allowedTools);
    this.maxIterations = deps.maxIterations ?? MAX_AGENT_ITERATIONS;
  }

  async execute(
    message: IncomingMessage,
  ): Promise<Result<void, ProcessTelegramMessageError>> {
    const sessionResult = await this.sessions.getOrCreate(
      message.userId,
      message.channel,
    );
    if (!sessionResult.ok) return sessionResult;

    const withUserResult = await this.sessions.appendTurn(sessionResult.value, {
      role: "user",
      content: message.text,
    });
    if (!withUserResult.ok) return withUserResult;

    const drafted = await this.draftAgenticReply(message);

    const withAssistantResult = await this.sessions.appendTurn(
      withUserResult.value,
      { role: "assistant", content: drafted.text },
    );
    if (!withAssistantResult.ok) return withAssistantResult;

    const reply: OutgoingReply = {
      sessionId: sessionResult.value.id,
      text: drafted.text,
      metadata: { chatId: message.metadata.chatId },
    };

    const sendResult = await this.channel.send(reply);
    if (!sendResult.ok) return sendResult;

    return ok(undefined);
  }

  /**
   * Runs the agentic loop and returns the reply to send to the user.
   *
   * Failure modes are absorbed into a fallback reply — the public failure
   * channel of this use case is HTTP/session/transport errors, not LLM
   * unhappy paths. LLM failures are logged via `metadata.intent` so the
   * route layer / observability can pick them up.
   */
  private async draftAgenticReply(
    message: IncomingMessage,
  ): Promise<DraftedReply> {
    const catalogResult = await this.knowledgeBase.getFaqCatalog();
    if (!catalogResult.ok) {
      // TODO: alert to the team that the KB is down, the human support is needed
      logger.error(
        `Failed to retrieve FAQ catalog from KB, falling back to static reply: ${JSON.stringify(
          catalogResult.error,
        )}`,
      );
      return {
        text: AGENT_FALLBACK_REPLY,
        metadata: { intent: "kb_unavailable" },
      };
    }

    const promptResult = await this.knowledgeBase.getSystemPrompt({
      context: catalogResult.value,
    });
    if (!promptResult.ok) {
      // TODO: alert to the team that the KB is down, the human support is needed
      logger.error(
        `Failed to retrieve system prompt from KB, falling back to static reply: ${JSON.stringify(
          promptResult.error,
        )}`,
      );
      return {
        text: AGENT_FALLBACK_REPLY,
        metadata: { intent: "kb_unavailable" },
      };
    }

    const messages: LlmMessage[] = [
      { role: "system", content: promptResult.value },
      { role: "user", content: message.text },
    ];

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      const completionResult = await this.llm.complete({ messages });

      if (!completionResult.ok) {
        if (completionResult.error instanceof LlmInvalidResponseError) {
          // TODO: alert to the team that the KB is down, the human support is needed
          logger.error(
            `LLM returned an invalid response, falling back to static reply: ${JSON.stringify(
              completionResult.error,
            )}`,
          );

          // Schema mismatch / parse failure — almost always a bug. Don't retry.
          return {
            text: AGENT_FALLBACK_REPLY,
            metadata: { intent: "llm_invalid_response" },
          };
        }
        if (
          completionResult.error instanceof LlmTimeoutError ||
          completionResult.error instanceof LlmRateLimitError
        ) {
          // Transient — retry once more by continuing the loop iteration. If
          // we're already on the last iteration, fall through to the cap.
          if (iteration < this.maxIterations - 1) continue;
        }
        // TODO: alert to the team that the LLM is having issues, the human support is needed
        logger.error(
          `LLM completion error, falling back to static reply: ${JSON.stringify(
            completionResult.error,
          )}`,
        );
        // Other LLM errors (e.g. connectivity) — log and fall back immediately
        return {
          text: AGENT_FALLBACK_REPLY,
          metadata: { intent: "llm_unavailable" },
        };
      }

      const { content, toolCalls } = completionResult.value;
      const callsToExecute = (toolCalls ?? []).filter((tc) =>
        this.allowedTools.has(tc.name),
      );

      if (callsToExecute.length === 0) {
        return { text: content, metadata: { intent: "direct_response" } };
      }

      // If there are tool calls, execute them and continue the loop to get the next response from the LLM,
      // which may or may not include another direct response.
      // This allows for more complex interactions where the LLM can call multiple tools in sequence before giving a final answer.
      messages.push({ role: "assistant", content });
      for (const tc of callsToExecute) {
        await this.executeToolCall(tc, messages);
      }
    }

    // TODO: alert to the team that the agent is stuck in a loop, the human support is needed
    logger.error(
      `LLM exceeded max iterations (${this.maxIterations}), falling back to static reply`,
    );

    return {
      text: AGENT_FALLBACK_REPLY,
      metadata: { intent: "max_iterations_exceeded" },
    };
  }

  private async executeToolCall(
    tc: LlmToolCall,
    messages: LlmMessage[],
  ): Promise<void> {
    const toolResult = await this.agentTools.invoke(tc.name, tc.arguments);
    if (toolResult.ok) {
      messages.push({
        role: "user",
        content: `[Tool result for ${tc.name}]: ${toolResult.value}`,
      });
      return;
    }

    logger.error(
      `Error invoking tool ${tc.name}: ${JSON.stringify(toolResult.error)}`,
    );

    messages.push({
      role: "user",
      content: `[Tool error for ${tc.name}]: ${toolResult.error.message}`,
    });
  }
}
