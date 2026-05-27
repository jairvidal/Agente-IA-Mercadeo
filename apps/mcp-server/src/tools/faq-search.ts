import { readFileSync } from "fs";
import { join } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const FAQ_PATH = join(import.meta.dirname, "../../data/faq.json");

interface Tienda {
  ciudad: string;
  nombre: string;
  direccion: string;
  horario: string;
  telefono: string;
}

interface Servicio {
  nombre: string;
  descripcion: string;
}

interface Pregunta {
  pregunta: string;
  respuesta: string;
}

interface FaqData {
  empresa: { nombre: string; descripcion: string };
  tiendas: Tienda[];
  servicios: Servicio[];
  preguntas_frecuentes: Pregunta[];
}

const loadFaq = (): FaqData => JSON.parse(readFileSync(FAQ_PATH, "utf-8"));

const KEYWORDS_SERVICIOS = ["corte", "envío", "envio", "despacho", "asesor", "servicio"];

export const searchFaq = (query: string): string => {
  if (!query || !query.trim()) {
    return "Por favor, escribe tu consulta para que pueda ayudarte.";
  }

  const data = loadFaq();
  const queryLower = query.toLowerCase();
  const results: string[] = [];

  for (const tienda of data.tiendas) {
    if (queryLower.includes(tienda.ciudad.toLowerCase()) || queryLower.includes(tienda.nombre.toLowerCase())) {
      results.push(
        `Tienda: ${tienda.nombre} (${tienda.ciudad})\n` +
          `Dirección: ${tienda.direccion}\n` +
          `Horario: ${tienda.horario}\n` +
          `Teléfono: ${tienda.telefono}`
      );
    }
  }

  if (KEYWORDS_SERVICIOS.some((kw) => queryLower.includes(kw))) {
    for (const svc of data.servicios) {
      const svcText = `${svc.nombre.toLowerCase()} ${svc.descripcion.toLowerCase()}`;
      if (queryLower.split(" ").some((w) => svcText.includes(w))) {
        results.push(`Servicio: ${svc.nombre}\n${svc.descripcion}`);
      }
    }
  }

  for (const faq of data.preguntas_frecuentes) {
    const faqText = `${faq.pregunta} ${faq.respuesta}`.toLowerCase();
    const queryWords = queryLower.split(" ").filter((w) => w.length > 2);
    if (queryWords.some((word) => faqText.includes(word))) {
      results.push(`P: ${faq.pregunta}\nR: ${faq.respuesta}`);
    }
  }

  if (results.length > 0) {
    return results.join("\n\n---\n\n");
  }

  const allInfo: string[] = [];
  allInfo.push(`Empresa: ${data.empresa.nombre} - ${data.empresa.descripcion}`);
  for (const tienda of data.tiendas) {
    allInfo.push(
      `Tienda: ${tienda.nombre} (${tienda.ciudad}) - ` +
        `Dir: ${tienda.direccion} - Horario: ${tienda.horario} - ` +
        `Tel: ${tienda.telefono}`
    );
  }
  for (const svc of data.servicios) {
    allInfo.push(`Servicio: ${svc.nombre} - ${svc.descripcion}`);
  }

  return "No encontré una respuesta exacta, pero aquí está la información disponible:\n\n" + allInfo.join("\n");
};

export const registerFaqSearchTool = (server: McpServer) => {
  server.tool(
    "search_faq",
    "Busca en la base de conocimiento de Sidoc S.A. (tiendas, horarios, servicios, preguntas frecuentes)",
    { query: z.string().describe("Texto de búsqueda del usuario en lenguaje natural") },
    async ({ query }) => ({
      content: [{ type: "text", text: searchFaq(query) }],
    })
  );
};
