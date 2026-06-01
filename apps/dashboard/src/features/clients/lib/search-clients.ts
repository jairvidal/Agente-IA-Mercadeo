import type { Client } from "../schemas/client-schema";

// NFD decomposes characters with diacritics into base + combining marks
// (e.g. "é" → "e" + U+0301), then we strip the combining marks range
// U+0300–U+036F. Lowercasing makes the comparison case-insensitive.
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Searches over name, email, and company. Phone is intentionally excluded.
// Trim only applies to the user's query; client values stay literal so that
// internal whitespace (e.g. "Pedro  Gómez") keeps its original meaning.
export function searchClients(clients: Client[], query: string): Client[] {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) return clients;

  return clients.filter(
    (c) =>
      normalize(c.name).includes(normalizedQuery) ||
      normalize(c.email ?? "").includes(normalizedQuery) ||
      normalize(c.company ?? "").includes(normalizedQuery),
  );
}
