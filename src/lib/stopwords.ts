// 共享停用词表：语境打分与 OCR 候选过滤共用同一套核心虚词，避免两份清单各自漂移。
// - EN_STOPWORDS：语境选义打分（dictionary.ts）——提取内容词时剔除虚词。
// - OCR_STOPWORDS：OCR 候选过滤（ocr-cleaner.ts）——整句识别时不把虚词当候选词。

// 两场景共用的核心虚词
const CORE_STOPWORDS: readonly string[] = [
  "the", "a", "an", "of", "and", "or", "to", "in", "is", "are", "was", "were",
  "be", "been", "being", "for", "with", "as", "at", "by", "on", "from",
  "it", "its", "that", "this", "these", "those", "there", "here",
  "he", "she", "they", "we", "you", "i", "me", "his", "her", "our", "their", "them",
  "not", "no", "but", "if", "so", "than", "then", "will", "would", "can", "could",
  "should", "may", "might", "must", "shall", "have", "has", "had", "do", "does", "did",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
  "also", "very", "just", "only", "more", "most", "some", "any", "each", "every",
];

/** 语境打分用：核心表 + 打分场景补充的介词/代词/数词等 */
export const EN_STOPWORDS = new Set([
  ...CORE_STOPWORDS,
  "about", "into", "onto", "am", "nor", "him", "us", "your",
  "all", "both", "such", "one", "two", "other", "another",
  "up", "down", "out", "over", "under", "between", "because", "while", "after", "before",
]);

/** OCR 候选过滤用：核心表 + my */
export const OCR_STOPWORDS = new Set([...CORE_STOPWORDS, "my"]);
