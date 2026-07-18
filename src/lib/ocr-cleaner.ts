import { COMMON_DICT } from "@/lib/common-dict";

function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function stripNoise(text: string) {
  return text
    .replace(/[|]/g, " ")
    .replace(/[""'`]/g, "")
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

// OCR 常见识别错误自动修正映射
const OCR_FIXES: Record<string, string> = {
  "concluslon": "conclusion", "deve1opment": "development",
  "env1ronment": "environment", "1mportant": "important",
  "compu1sory": "compulsory", "compuls0ry": "compulsory",
  "techmque": "technique", "sign1ficant": "significant",
  "commumcation": "communication", "reqmrement": "requirement",
  "mdependent": "independent", "mdustry": "industry",
  "mterpret": "interpret", "cnteria": "criteria",
  "prehmmary": "preliminary", "consequence": "consequence",
  "0ccurrence": "occurrence", "rec0gnize": "recognize",
};

// OCR 通用字符混淆纠正
function autoCorrectOcr(word: string): string {
  const lower = word.toLowerCase();
  if (OCR_FIXES[lower]) return OCR_FIXES[lower];
  return word;
}

// 通过通用词库验证词是否是真实英文单词
function isKnownWord(word: string): boolean {
  return COMMON_DICT[word.toLowerCase()] !== undefined;
}

export type OcrCleanResult = {
  text: string;
  isVerified: boolean; // true = 在通用词库中找到，准确性高
};

export function extractCandidatesFromRawText(rawText: string): OcrCleanResult[] {
  const lines = splitRawText(rawText);

  const cleaned = lines
    .map(stripNoise)
    .map(normalizeSpaces)
    .filter((text) => text.length >= 2)
    .filter((text) => isLikelyEnglishChunk(text));

  const deduped = dedupe(cleaned);

  // 先做 OCR 自动纠正，再做词库验证
  return deduped.map((text) => {
    const corrected = autoCorrectOcr(text);
    return {
      text: corrected,
      isVerified: isKnownWord(corrected),
    };
  });
}
