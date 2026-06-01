import { logger } from "@sidoc/observability";
import type { AgentRegistry } from "@/modules/orchestrator/application/agents/agent-registry";
import type { IntentClassifier } from "@/modules/orchestrator/application/services/intent-classifier.service";
import type { HandleHabeasDataConsentUseCase } from "@/modules/orchestrator/application/use-cases/handle-habeas-data-consent.use-case";
import { isWithinBusinessHours } from "@/modules/orchestrator/domain/business-hours";
import {
  ADVISOR_KEYWORDS,
  ADVISOR_TRANSFER_REPLY,
  AGENT_FALLBACK_REPLY,
  CLARIFICATION_PROMPTS,
  HUMAN_ADVISOR_REPLY,
  MAX_CLARIFICATION_ATTEMPTS,
  NON_COMMERCIAL_REPLY,
  OFF_HOURS_REPLY,
} from "@/modules/orchestrator/domain/constants";
import type { Category } from "@/modules/orchestrator/domain/entities/classification";
import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import type { ConversationTurn, Session } from "@/modules/orchestrator/domain/entities/session";
import type {
  MessageChannelError,
  SessionRepositoryError,
} from "@/modules/orchestrator/domain/errors";
import type { AgentPort, AgentRunContext } from "@/modules/orchestrator/domain/ports/agent.port";
import type { MessageChannelPort } from "@/modules/orchestrator/domain/ports/message-channel.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { ok, type Result } from "@/modules/orchestrator/domain/result";
import { containsWord } from "@/modules/orchestrator/domain/text";

export type ProcessTelegramMessageError = SessionRepositoryError | MessageChannelError;

export interface ProcessTelegramMessageDeps {
  channel: MessageChannelPort;
  sessions: SessionRepositoryPort;
  classifier: IntentClassifier;
  registry: AgentRegistry;
  habeasDataConsent: HandleHabeasDataConsentUseCase;
  /** Injectable clock so the business-hours gate is deterministic in tests. */
  clock?: () => Date;
  /**
   * When true, messages received outside business hours are intercepted (gate
   * total): captured for follow-up and answered with `OFF_HOURS_REPLY`, without
   * running consent/classification/agents. Defaults to true.
   */
  businessHoursGateEnabled?: boolean;
}

interface DraftedReply {
  text: string;
  metadata: Record<string, unknown>;
  /**
   * Set when a commercial agent produced the reply. Used to persist
   * `session.metadata.lastAgent` for observability + future soft handoff.
   */
  lastAgent?: "faq" | "quotation";
}

export class ProcessTelegramMessageUseCase {
  private readonly channel: MessageChannelPort;
  private readonly sessions: SessionRepositoryPort;
  private readonly classifier: IntentClassifier;
  private readonly registry: AgentRegistry;
  private readonly habeasDataConsent: HandleHabeasDataConsentUseCase;
  private readonly clock: () => Date;
  private readonly businessHoursGateEnabled: boolean;

  constructor(deps: ProcessTelegramMessageDeps) {
    this.channel = deps.channel;
    this.sessions = deps.sessions;
    this.classifier = deps.classifier;
    this.registry = deps.registry;
    this.habeasDataConsent = deps.habeasDataConsent;
    this.clock = deps.clock ?? (() => new Date());
    this.businessHoursGateEnabled = deps.businessHoursGateEnabled ?? true;
  }

  async execute(message: IncomingMessage): Promise<Result<void, ProcessTelegramMessageError>> {
    const sessionResult = await this.sessions.getOrCreate(message.userId, message.channel);
    if (!sessionResult.ok) return sessionResult;

    // Business-hours gate (gate total): outside service hours we only capture
    // the message for next-day follow-up and reply with the off-hours notice.
    // Nothing else runs — not even the consent flow.
    if (this.businessHoursGateEnabled && !isWithinBusinessHours(this.clock())) {
      const flagged = await this.sessions.updateMetadata(sessionResult.value, {
        ...sessionResult.value.metadata,
        pendingFollowUp: true,
        pendingFollowUpSince: this.clock().toISOString(),
      });
      if (!flagged.ok) return flagged;
      return this.replyAndPersist(flagged.value, OFF_HOURS_REPLY, message);
    }

    // Explicit handoff: if the user asks for a human advisor by keyword, escalate
    // immediately — this takes priority over the consent flow so a user wanting a
    // person always reaches one.
    if (containsWord(message.text, ADVISOR_KEYWORDS)) {
      return this.replyAndPersist(sessionResult.value, ADVISOR_TRANSFER_REPLY, message);
    }

    // Handle habeas data consent first, before doing anything else with the message.
    const consentResult = await this.habeasDataConsent.execute(sessionResult.value, message.text);
    if (!consentResult.ok) return consentResult;

    // If the consent was given or denied with a specific response,
    // reply immediately and skip the rest of the pipeline.
    // This ensures we respect the user's choice without unnecessary processing.
    if (consentResult.value.intercepted) {
      return this.replyAndPersist(
        consentResult.value.session,
        consentResult.value.response,
        message,
      );
    }

    // Use the (possibly updated) session returned by the consent use-case to
    // avoid clobbering metadata writes done in the no-op consent paths.
    const sessionForClassifier = consentResult.value.session;

    const withUserResult = await this.sessions.appendTurn(sessionForClassifier, {
      role: "user",
      content: message.text,
    });
    if (!withUserResult.ok) return withUserResult;

    let session: Session = withUserResult.value;

    const classifyResult = await this.classifier.classify(
      message.text,
      sessionForClassifier.history,
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
      const counterUpdate = await this.updateClarificationCounter(session, category);
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

    // Persist lastAgent BEFORE appending the assistant turn so an appendTurn
    // failure doesn't leave us with a half-updated session.
    if (drafted.lastAgent) {
      const updated = await this.sessions.updateMetadata(session, {
        ...session.metadata,
        lastAgent: drafted.lastAgent,
      });
      if (updated.ok) session = updated.value;
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
   * Persists the turn (user + assistant) and replies immediately, short-circuiting
   * the rest of the pipeline. Shared by the consent gate, the business-hours gate
   * and the explicit advisor handoff.
   */
  private async replyAndPersist(
    session: Session,
    response: string,
    message: IncomingMessage,
  ): Promise<Result<void, ProcessTelegramMessageError>> {
    const withUser = await this.sessions.appendTurn(session, {
      role: "user",
      content: message.text,
    });
    if (!withUser.ok) return withUser;
    const withAssistant = await this.sessions.appendTurn(withUser.value, {
      role: "assistant",
      content: response,
    });
    if (!withAssistant.ok) return withAssistant;

    // Build the outgoing message with the consent response.
    const reply: OutgoingReply = {
      sessionId: session.id,
      text: response,
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
  ): Promise<Result<{ session: Session; attemptsAfter: number }, SessionRepositoryError>> {
    const current = (session.metadata.clarificationAttempts as number | undefined) ?? 0;

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
      case "commercial_quotation": {
        const agent = this.registry.resolve(args.category);
        if (!agent) {
          // Should be unreachable: the registry maps both commercial categories.
          // If it ever returns null, fail closed to the static fallback.
          logger.error(`No agent resolved for commercial category ${args.category}`);
          return {
            text: AGENT_FALLBACK_REPLY,
            metadata: { intent: "no_agent_resolved" },
          };
        }
        return this.runAgent(agent, args.message, args.previousHistory);
      }

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
        const promptIndex = Math.min(args.attemptsAfter - 1, CLARIFICATION_PROMPTS.length - 1);
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
   * Delegates the turn to a specialized agent and absorbs any `AgentError`
   * into the static fallback reply. Error -> reply mapping lives here, not
   * in the agent, so each agent stays pure on its happy/Err shape.
   */
  private async runAgent(
    agent: AgentPort,
    message: IncomingMessage,
    previousHistory: ConversationTurn[],
  ): Promise<DraftedReply> {
    const ctx: AgentRunContext = { message, history: previousHistory };
    const result = await agent.run(ctx);

    if (!result.ok) {
      const intent = this.intentForAgentError(result.error);
      return {
        text: AGENT_FALLBACK_REPLY,
        metadata: { intent, agent: agent.name },
        // Record the agent even on failure for observability.
        lastAgent: agent.name,
      };
    }

    return {
      text: result.value.text,
      metadata: { ...result.value.metadata, agent: agent.name },
      lastAgent: agent.name,
    };
  }

  private intentForAgentError(error: { name: string; message: string }): string {
    switch (error.name) {
      case "KnowledgeBaseUnavailableError":
        return "kb_unavailable";
      case "LlmInvalidResponseError":
        return error.message.includes("max_iterations_exceeded")
          ? "max_iterations_exceeded"
          : "llm_invalid_response";
      case "LlmTimeoutError":
      case "LlmRateLimitError":
      case "LlmProviderUnavailableError":
        return "llm_unavailable";
      default:
        return "agent_failure";
    }
  }
}
