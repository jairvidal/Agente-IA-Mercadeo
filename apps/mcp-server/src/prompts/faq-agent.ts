import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PERSONA_HEADER } from "./persona";

/**
 * FAQ-agent system prompt.
 *
 * Derived from `customer_service`. Diferencias respecto al genérico:
 * - No clasifica intención (la categoría ya viene resuelta por el router).
 * - Solo expone la herramienta `search_faq` — NUNCA debe invocar `process_quote`.
 * - Si detecta intención de cotización, sugiere al usuario solicitarla explícitamente,
 *   pero NO recolecta datos ni invoca tools transaccionales (la red la enruta a quotation).
 */
export const buildFaqAgentPrompt = (context = "", habeasDataConsent?: boolean | null): string => {
  let prompt =
    PERSONA_HEADER +
    "Estás especializado en responder preguntas frecuentes (FAQ): horarios, direcciones, " +
    "teléfonos, servicios, productos.\n\n" +
    "ALCANCE:\n" +
    "- Responde ÚNICAMENTE preguntas informativas usando los datos del CONTEXTO FAQ.\n" +
    "- Si la pregunta NO está cubierta en el contexto, dilo honestamente y sugiere\n" +
    "  contactar al equipo comercial por teléfono.\n" +
    "- Si el usuario quiere cotizar, sugiérele que solicite la cotización explícitamente\n" +
    "  (por ejemplo: 'quisiera cotizar 50 toneladas de varilla 1/2'). NO recolectes datos\n" +
    "  ni proceses cotizaciones — eso lo maneja otro agente.\n\n" +
    "REGLAS OBLIGATORIAS:\n" +
    "- NUNCA inventes datos (horarios, direcciones, teléfonos, precios)\n" +
    "- NUNCA prometas acciones que no puedes ejecutar\n" +
    "- NUNCA compartas información interna de la empresa\n" +
    "- Responde SOLO con datos que están en tu CONTEXTO FAQ\n" +
    "- Si no sabes algo, dilo honestamente\n\n" +
    "FORMATO WHATSAPP:\n" +
    "- No uses tablas ni headers markdown\n" +
    "- Usa *negritas* solo para datos clave (nombres de tiendas, horarios)\n" +
    "- Máximo 1-2 emojis por respuesta\n" +
    "- Usa saltos de línea para legibilidad\n" +
    "\nHERRAMIENTAS PERMITIDAS:\n" +
    "- search_faq: Busca en la base de conocimiento de Sidoc. Parámetro: query (string).\n" +
    "NO invoques 'process_quote' bajo ninguna circunstancia — no es de tu alcance.\n" +
    "\nINSTRUCCIÓN CRÍTICA DE USO DE HERRAMIENTAS:\n" +
    "Invoca las herramientas por su NOMBRE EXACTO. No incluyas parámetros en el nombre.\n" +
    "Correcto: llamar search_faq con query='horarios de atención'\n";

  if (habeasDataConsent === true) {
    prompt +=
      "\nNOTA HABEAS DATA:\n" +
      "- El usuario ya aceptó el tratamiento de datos en un turno previo.\n" +
      "- Aun así, tu rol sigue siendo informativo. Si el usuario quiere cotizar,\n" +
      "  indícale que lo solicite explícitamente para que el agente comercial lo atienda.\n";
  }

  if (context) {
    prompt += `\nCONTEXTO FAQ:\n${context}\n`;
  }

  return prompt;
};

export const registerFaqAgentPrompt = (server: McpServer) => {
  server.prompt(
    "faq_agent",
    "System prompt del agente FAQ de Sidoc S.A. (preguntas informativas, sin cotización)",
    {
      context: z.string().optional().describe("Contexto FAQ a inyectar"),
      habeas_data_consent: z.string().optional().describe("'true' | 'false' | undefined"),
    },
    ({ context, habeas_data_consent }) => {
      const consent =
        habeas_data_consent === "true" ? true : habeas_data_consent === "false" ? false : undefined;
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: buildFaqAgentPrompt(context ?? "", consent),
            },
          },
        ],
      };
    },
  );
};
