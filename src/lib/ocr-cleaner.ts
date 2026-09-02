import { COMMON_DICT } from "@/lib/common-dict";

function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

// 停用词：常见虚词/代词/助动词，整句 OCR 时不作为候选词，避免刷屏。
const STOPWORDS = new Set<string>([
  "the", "a", "an", "of", "and", "or", "to", "in", "is", "are", "was", "were",
  "be", "been", "being", "for", "with", "as", "at", "by", "on", "from",
  "it", "its", "that", "this", "these", "those", "there", "here",
  "he", "she", "they", "we", "you", "i", "me", "my", "his", "her", "our", "their", "them",
  "not", "no", "but", "if", "so", "than", "then", "will", "would", "can", "could",
  "should", "may", "might", "must", "shall", "have", "has", "had", "do", "does", "did",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
  "also", "very", "just", "only", "more", "most", "some", "any", "each", "every",
]);

// 数字 → 字母 混淆映射（OCR 最常见的错误类别：把 l/o/s 等识别成数字）
const DIGIT_CONFUSIONS: Record<string, string[]> = {
  "0": ["o"],
  "1": ["l", "i"],
  "2": ["z", "s"],
  "3": ["e"],
  "4": ["a"],
  "5": ["s"],
  "6": ["g", "b"],
  "7": ["t"],
  "8": ["b"],
  "9": ["g", "q"],
};

// 易混字母组合（OCR 连写/断字错误）
const LETTER_CONFUSIONS: [string, string][] = [
  ["rn", "m"],
  ["cl", "d"],
  ["vv", "w"],
  ["ii", "n"],
];

// 高频手写纠错表（最高优先级，覆盖词典校验覆盖不到的常见错别字）
const OCR_FIXES: Record<string, string> = {
  "concluslon": "conclusion", "consequnence": "consequence",
  "deve1opment": "development", "env1ronment": "environment",
  "1mportant": "important", "compu1sory": "compulsory", "compuls0ry": "compulsory",
  "techmque": "technique", "sign1ficant": "significant",
  "commumcation": "communication", "reqmrement": "requirement",
  "mdependent": "independent", "mdustry": "industry",
  "mterpret": "interpret", "cnteria": "criteria",
  "prehmmary": "preliminary", "0ccurrence": "occurrence", "rec0gnize": "recognize",
};

// 通过通用词库验证词是否是真实英文单词
function isKnownWord(word: string): boolean {
  return COMMON_DICT[word.toLowerCase()] !== undefined;
}

// 枚举数字→字母的全部替换组合，返回第一个命中词典的结果
function correctDigits(word: string): string {
  const chars = word.split("");
  const positions: { idx: number; options: string[] }[] = [];

  for (let i = 0; i < chars.length; i++) {
    const options = DIGIT_CONFUSIONS[chars[i]];
    if (options) positions.push({ idx: i, options });
  }
  if (positions.length === 0) return word;

  let found: string | undefined;
  const walk = (p: number) => {
    if (found) return;
    if (p === positions.length) {
      const candidate = chars.join("");
      if (isKnownWord(candidate)) found = candidate;
      return;
    }
    const { idx, options } = positions[p];
    const original = chars[idx];
    for (const opt of options) {
      chars[idx] = opt;
      walk(p + 1);
      chars[idx] = original;
    }
  };
  walk(0);
  return found ?? word;
}

// OCR 自动纠错：精确表 > 词典命中 > 数字混淆 > 易混字母，逐级尝试
function autoCorrectOcr(word: string): string {
  const lower = word.toLowerCase();
  if (OCR_FIXES[lower]) return OCR_FIXES[lower];
  // 已是词典词：保留原样（含大小写）
  if (isKnownWord(lower)) return word;

  if (/\d/.test(lower)) {
    const corrected = correctDigits(lower);
    if (corrected !== lower && isKnownWord(corrected)) return corrected;
  }

  for (const [from, to] of LETTER_CONFUSIONS) {
    if (!lower.includes(from)) continue;
    const candidate = lower.split(from).join(to);
    if (isKnownWord(candidate)) return candidate;
  }

  return word;
}

// 从一行文本中切出候选词：按空白切分，去掉首尾标点，必须含字母且长度 ≥2
function tokenizeLine(line: string): string[] {
  return line
    .split(/\s+/)
    .map((t) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""))
    .filter((t) => t.length >= 2)
    .filter((t) => /[A-Za-z]/.test(t));
}

// 在原始文本中查找包含该词的那一行，作为复习时的上下文出处
function extractContext(rawText: string, word: string): string | undefined {
  const lines = rawText.split(/\r?\n/).map((l) => normalizeSpaces(l)).filter(Boolean);
  const escapedWord = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const line of lines) {
    const regex = new RegExp(`\\b${escapedWord}\\b`, "i");
    if (regex.test(line) && line.length > word.length + 3) {
      return line.length > 200 ? line.slice(0, 197) + "..." : line;
    }
  }
  return undefined;
}

export type OcrCleanResult = {
  text: string;
  isVerified: boolean; // true = 在通用词库中找到，准确性高
  sourceContext?: string; // 原句中包含该单词的那行文本
};

export function extractCandidatesFromRawText(rawText: string): OcrCleanResult[] {
  const lines = rawText.split(/\r?\n/);
  const seen = new Map<string, OcrCleanResult>();

  for (const rawLine of lines) {
    const line = normalizeSpaces(rawLine);
    if (!line) continue;

    for (const token of tokenizeLine(line)) {
      const lowerToken = token.toLowerCase();
      // 过滤停用词（但保留词典里确实收录的词）
      if (STOPWORDS.has(lowerToken) && !isKnownWord(lowerToken)) continue;

      const corrected = autoCorrectOcr(token);
      const key = corrected.toLowerCase();
      if (seen.has(key)) continue;

      seen.set(key, {
        text: corrected,
        isVerified: isKnownWord(corrected),
        sourceContext: extractContext(rawText, token),
      });
    }
  }

  return Array.from(seen.values());
}
