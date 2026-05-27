import { readFileSync } from "fs";
import { join } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const FAQ_PATH = join(import.meta.dirname, "../../data/faq.json");

let catalogCache: string | null = null;

interface Tienda {
  nombre: string;
  ciudad: string;
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
  empresa: { nombre: string; sector: string; descripcion: string };
  tiendas: Tienda[];
  servicios: Servicio[];
  preguntas_frecuentes: Pregunta[];
}

export const getFaqCatalog = (): string => {
  if (catalogCache !== null) return catalogCache;

  const data: FaqData = JSON.parse(readFileSync(FAQ_PATH, "utf-8"));
  const lines: string[] = [];

  lines.push(`=== ${data.empresa.nombre} ===`);
  lines.push(`Sector: ${data.empresa.sector}`);
  lines.push(data.empresa.descripcion);
  lines.push("");

  lines.push("--- Tiendas ---");
  for (const tienda of data.tiendas) {
    lines.push(`* ${tienda.nombre} (${tienda.ciudad})`);
    lines.push(`  Dirección: ${tienda.direccion}`);
    lines.push(`  Horario: ${tienda.horario}`);
    lines.push(`  Teléfono: ${tienda.telefono}`);
  }
  lines.push("");

  lines.push("--- Servicios ---");
  for (const svc of data.servicios) {
    lines.push(`* ${svc.nombre}: ${svc.descripcion}`);
  }
  lines.push("");

  lines.push("--- Preguntas Frecuentes ---");
  for (const faq of data.preguntas_frecuentes) {
    lines.push(`P: ${faq.pregunta}`);
    lines.push(`R: ${faq.respuesta}`);
    lines.push("");
  }

  catalogCache = lines.join("\n");
  return catalogCache;
};

export const registerFaqCatalogResource = (server: McpServer) => {
  server.resource(
    "faq-catalog",
    new ResourceTemplate("faq://catalog", { list: undefined }),
    async () => ({
      contents: [
        {
          uri: "faq://catalog",
          mimeType: "text/plain",
          text: getFaqCatalog(),
        },
      ],
    })
  );
};
