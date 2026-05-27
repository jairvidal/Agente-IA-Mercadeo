import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";

const quoteSchema = {
  product: z.string().describe("Producto que el cliente desea cotizar"),
  quantity: z.number().int().positive().describe("Cantidad solicitada (> 0)"),
  location: z.string().describe("Ciudad o ubicación de entrega"),
  contact_name: z.string().describe("Nombre del cliente o contacto"),
  company_name: z.string().describe("Nombre de la empresa constructora o negocio"),
};

export const processQuote = (params: {
  product: string;
  quantity: number;
  location: string;
  contact_name: string;
  company_name: string;
}): string => {
  const ticketId = `TICKET-${randomUUID().slice(0, 8).toUpperCase()}`;
  console.log(`[QUOTE_LEAD_MOCK] New Quote Request: ${JSON.stringify(params)} -> ${ticketId}`);
  return (
    `Cotización procesada exitosamente. Se ha generado el caso ${ticketId}. ` +
    "Un asesor comercial de Sidoc se pondrá en contacto pronto."
  );
};

export const registerProcessQuoteTool = (server: McpServer) => {
  server.tool(
    "process_quote",
    "Procesa una solicitud de cotización capturando los datos estructurados del cliente (Mock — Sprint 2)",
    quoteSchema,
    async (params) => ({
      content: [{ type: "text", text: processQuote(params) }],
    })
  );
};
