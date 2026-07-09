function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function stripNoise(text: string) {
  return text
    .replace(/[|]/g, " ")
    .replace(/[“”"'`]/g, "")
    .replace(/[，。；：？！,.;:!?()[\]{}<>]/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyEnglishChunk(text: string) {
  return /^[A-Za-z][A-Za-z\s-]*[A-Za-z]$/.test(text);
}

function splitRawText(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);
}

function dedupe(items: string[]) {
  const map = new Map<string, string>();

  for (const item of items) {
    const key = item.toLowerCase();
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

export function extractCandidatesFromRawText(rawText: string) {
  const lines = splitRawText(rawText);

  const cleaned = lines
    .map(stripNoise)
    .map(normalizeSpaces)
    .filter((text) => text.length >= 2)
    .filter((text) => isLikelyEnglishChunk(text));

  return dedupe(cleaned).map((text) => ({
    text,
  }));
}
