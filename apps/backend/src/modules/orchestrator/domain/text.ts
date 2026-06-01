/** Lowercases, trims and strips diacritics so matching is accent-insensitive. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Whether `text` contains any of `words` as a standalone word (word-boundary
 * match on the normalized text). "asesor" matches "quiero un asesor" but NOT
 * "asesoría"/"asesoramiento".
 */
export function containsWord(text: string, words: readonly string[]): boolean {
  const normalized = normalizeText(text);
  return words.some((word) => new RegExp(`\\b${word}\\b`).test(normalized));
}
