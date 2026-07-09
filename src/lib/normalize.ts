export function normalizeText(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

export function normalizeLemma(input: string) {
  return normalizeText(input).toLowerCase();
}
