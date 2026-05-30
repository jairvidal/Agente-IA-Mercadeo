import { z } from "zod";

import {
	CATEGORIES,
	type Classification,
} from "@/modules/orchestrator/domain/entities/classification";
import type { ConversationTurn } from "@/modules/orchestrator/domain/entities/session";
import type { LlmError } from "@/modules/orchestrator/domain/errors";
import type {
	LlmMessage,
	LlmProviderPort,
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import type { Result } from "@/modules/orchestrator/domain/result";

export interface IntentClassifier {
	classify(
		userMessage: string,
		history: ConversationTurn[],
	): Promise<Result<Classification, LlmError>>;
}

export interface IntentClassifierServiceDeps {
	llm: LlmProviderPort;
	/** Override the temperature used for classification. Defaults to 0.1. */
	temperature?: number;
	/** Override the timeout for the LLM call. Defaults to 10s. */
	timeoutMs?: number;
	/** Override the max number of recent history turns sent to the classifier. */
	maxHistoryTurns?: number;
}

const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_HISTORY_TURNS = 4;

const ClassificationSchema = z.object({
	category: z.enum([
		"commercial_faq",
		"commercial_quotation",
		"non_commercial",
		"not_understood",
	]),
	confidence: z.number().min(0).max(1),
	reasoning: z.string().min(1).max(280),
});

const SYSTEM_PROMPT = [
	"Eres un clasificador de intenciones para el asistente conversacional de Sidoc S.A.",
	"(siderúrgica colombiana). Tu única tarea es asignar al mensaje del usuario UNA de",
	"las siguientes categorías. Devuelve el identificador EXACTO en inglés.",
	"",
	"CATEGORÍAS:",
	"- `commercial_faq`: preguntas comerciales sobre tienda, horario, dirección, teléfono,",
	"  servicios, productos, métodos de pago, despachos, portafolio.",
	"  Ej: '¿horario tienda Cali?', '¿qué productos venden?', '¿hacen domicilios?'.",
	"- `commercial_quotation`: solicitud de cotización con intención de compra. El usuario",
	"  pide precio, quiere cotizar, comprar, o menciona producto + cantidad.",
	"  Ej: 'quiero cotizar 50 toneladas de varilla 1/2', 'precio de malla electrosoldada',",
	"  'necesito 200 kg de alambre'.",
	"- `non_commercial`: temas que NO son comerciales: reclamos, proveedores, contabilidad,",
	"  gestión humana, chatarra, facturación, devoluciones, postulaciones de empleo.",
	"  Ej: 'soy proveedor y quiero ofrecer servicios', 'tengo un reclamo por una factura',",
	"  'busco empleo'.",
	"- `not_understood`: mensaje ambiguo, sin información suficiente, fuera de dominio,",
	"  o saludo aislado sin pregunta. Ej: 'hola', 'ok', 'asdf', 'cuánto cuesta?' (sin",
	"  producto), 'tienes algo?'.",
	"",
	"REGLAS:",
	"- Si el usuario hace una pregunta breve que claramente continúa una conversación",
	"  previa (referencia anafórica como '¿y el teléfono?'), úsala junto con el historial",
	"  para clasificar.",
	"- `confidence` ∈ [0, 1]: tu certeza real. Usa <0.6 cuando dudes entre categorías.",
	"- `reasoning`: máximo 1 oración en español explicando por qué.",
	"- NO inventes datos del negocio. Solo clasificas.",
].join("\n");

export class IntentClassifierService implements IntentClassifier {
	private readonly llm: LlmProviderPort;
	private readonly temperature: number;
	private readonly timeoutMs: number;
	private readonly maxHistoryTurns: number;

	constructor(deps: IntentClassifierServiceDeps) {
		this.llm = deps.llm;
		this.temperature = deps.temperature ?? DEFAULT_TEMPERATURE;
		this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.maxHistoryTurns = deps.maxHistoryTurns ?? DEFAULT_HISTORY_TURNS;
	}

	async classify(
		userMessage: string,
		history: ConversationTurn[],
	): Promise<Result<Classification, LlmError>> {
		const messages: LlmMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

		const recent = history.slice(-this.maxHistoryTurns);
		for (const turn of recent) {
			messages.push({ role: turn.role, content: turn.content });
		}
		messages.push({ role: "user", content: userMessage });

		const result = await this.llm.completeStructured<Classification>({
			messages,
			schema: ClassificationSchema,
			temperature: this.temperature,
			timeoutMs: this.timeoutMs,
		});

		if (!result.ok) return result;
		return { ok: true, value: result.value.object };
	}
}

export const CATEGORIES_REF = CATEGORIES;
