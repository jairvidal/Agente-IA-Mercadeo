import type { IntentClassifier } from "@/modules/orchestrator/application/services/intent-classifier.service";
import {
  AGENT_FALLBACK_REPLY,
  CLARIFICATION_PROMPTS,
  HUMAN_ADVISOR_REPLY,
  MAX_AGENT_ITERATIONS,
  MAX_CLARIFICATION_ATTEMPTS,
  NON_COMMERCIAL_REPLY,
} from "@/modules/orchestrator/domain/constants";
import type { Category } from "@/modules/orchestrator/domain/entities/classification";
import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import type {
  ConversationTurn,
  Session,
} from "@/modules/orchestrator/domain/entities/session";
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
  classifier: IntentClassifier;
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
  private readonly classifier: IntentClassifier;
  private readonly allowedTools: ReadonlySet<string>;
  private readonly maxIterations: number;

  constructor(deps: ProcessTelegramMessageDeps) {
    this.channel = deps.channel;
    this.sessions = deps.sessions;
    this.knowledgeBase = deps.knowledgeBase;
    this.llm = deps.llm;
    this.agentTools = deps.agentTools;
    this.classifier = deps.classifier;
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

    let session: Session = withUserResult.value;

    const classifyResult = await this.classifier.classify(
      message.text,
      sessionResult.value.history,
    );

    let drafted: DraftedReply;
    if (!classifyResult.ok) {
      logger.error(
        `Intent classification failed, falling back to static reply: ${JSON.stringify(classifyResult.error)}`,
      );
      drafted = {
        text: AGENT_FALLBACK_REPLY,
        metadata: { intent: "classifier_unavailable" },
      };
    } else {
      const { category, confidence } = classifyResult.value;
      const counterUpdate = await this.updateClarificationCounter(
        session,
        category,
      );
      if (counterUpdate.ok) {
        session = counterUpdate.value.session;
      }
      const attemptsAfter = counterUpdate.ok
        ? counterUpdate.value.attemptsAfter
        : ((session.metadata.clarificationAttempts as number | undefined) ?? 0);

      drafted = await this.draftReplyByCategory({
        category,
        message,
        session,
        attemptsAfter,
        previousHistory: sessionResult.value.history,
      });
      drafted.metadata = {
        ...drafted.metadata,
        category,
        confidence,
      };
    }

    const withAssistantResult = await this.sessions.appendTurn(session, {
      role: "assistant",
      content: drafted.text,
    });
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
   * Updates `session.metadata.clarificationAttempts` based on the classified
   * category. Returns the updated session and the post-update counter value.
   *
   * Why apply it before dispatch: handlers (notably `not_understood`) need to
   * see the post-increment value to decide between asking another clarification
   * and offering a human advisor.
   */
  private async updateClarificationCounter(
    session: Session,
    category: Category,
  ): Promise<
    Result<{ session: Session; attemptsAfter: number }, SessionRepositoryError>
  > {
    const current =
      (session.metadata.clarificationAttempts as number | undefined) ?? 0;

    let attemptsAfter: number;
    if (category !== "not_understood") {
      if (current === 0) return ok({ session, attemptsAfter: 0 });
      attemptsAfter = 0;
    } else if (current >= MAX_CLARIFICATION_ATTEMPTS) {
      attemptsAfter = 0;
    } else {
      attemptsAfter = current + 1;
    }

    const updated = await this.sessions.updateMetadata(session, {
      ...session.metadata,
      clarificationAttempts: attemptsAfter,
    });
    if (!updated.ok) return updated;
    return ok({ session: updated.value, attemptsAfter });
  }

  private async draftReplyByCategory(args: {
    category: Category;
    message: IncomingMessage;
    session: Session;
    attemptsAfter: number;
    previousHistory: ConversationTurn[];
  }): Promise<DraftedReply> {
    switch (args.category) {
      case "commercial_faq":
      case "commercial_quotation":
        return this.draftAgenticReply(args.message, args.previousHistory);

      case "non_commercial":
        return {
          text: NON_COMMERCIAL_REPLY,
          metadata: { intent: "non_commercial" },
        };

      case "not_understood": {
        // attemptsAfter is the post-increment counter coming from
        // `updateClarificationCounter`. For `not_understood`, the only path to
        // `attemptsAfter === 0` is "we hit MAX_CLARIFICATION_ATTEMPTS and reset"
        // → offer a human advisor.
        if (args.attemptsAfter === 0) {
          return {
            text: HUMAN_ADVISOR_REPLY,
            metadata: { intent: "not_understood_human_advisor" },
          };
        }
        const promptIndex = Math.min(
          args.attemptsAfter - 1,
          CLARIFICATION_PROMPTS.length - 1,
        );
        return {
          text: CLARIFICATION_PROMPTS[promptIndex]!,
          metadata: {
            intent: "not_understood",
            attempt: args.attemptsAfter,
          },
        };
      }
    }
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
    previousHistory: ConversationTurn[],
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
      ...previousHistory.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
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
