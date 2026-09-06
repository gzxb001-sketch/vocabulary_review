import { normalizeLemma, normalizeText } from "@/lib/normalize";
import { getKaoyanEntry } from "@/lib/kaoyan-words";
import { COMMON_DICT, CommonDictEntry } from "@/lib/common-dict";
import { lookupEcdict, ecdictMeanings } from "@/lib/ecdict";

/* ---- 带超时的 fetch 封装（Vercel serverless 有 10s 限制） ---- */

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export type EnrichedMeaning = {
  partOfSpeech: string;
  meaningZh: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  isObscure: boolean;
  isHighFreq: boolean;
  /** 英文释义原文（内部用：语境选义的打分 token 来源，不落库） */
  gloss?: string;
};

export type EnrichedWord = {
  text: string;
  lemma: string;
  meaningZh?: string;       // 最短中文义（列表展示用）
  phonetic?: string;
  partOfSpeech?: string;    // 最常见词性
  exampleSentence?: string; // 第一个例句
  meanings?: EnrichedMeaning[];
  provider: "kaoyan_local" | "ecdict" | "free_dictionary" | "free_dictionary_translated" | "smart_fallback" | "fallback";
  found: boolean;
  synonyms?: string[]; // 来自 Free Dictionary 的同义词
};

/* ---- Free Dictionary Types ---- */

type FDMeaning = { partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string; synonyms?: string[] }> };
type FDEntry = { word?: string; phonetic?: string; phonetics?: Array<{ text?: string }>; meanings?: FDMeaning[] };
type TransRes = { responseData?: { translatedText?: string } };

/* ---- Utilities ---- */

const transCache = new Map<string, string>();

function hasChinese(text: string) { return /[\u4e00-\u9fff]/.test(text); }
function decodeHtml(t: string) { return t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }
function cleanTrans(text: string) { return decodeHtml(text).replace(/\s+/g, " ").trim(); }

function shortenMeaning(text: string): string {
  // 中文文本：去括号、取第一句
  if (hasChinese(text)) {
    return text.replace(/\s*\([^)]*\)\s*/g, "").replace(/[；;].*$/, "").trim();
  }
  // 英文文本：去括号内容，取第一句（句号分隔），不用逗号截断
  const cleaned = text.replace(/\s*\([^)]*\)\s*/g, " ");
  const firstSentence = cleaned.split(/\.(?:\s+|$)/)[0];
  // 如果第一句仍然太长（>120字符），取前100字符并截断到单词边界
  if (firstSentence.length > 120) {
    const truncated = firstSentence.substring(0, 100).replace(/\s+\S*$/, "");
    return truncated || firstSentence;
  }
  return firstSentence || cleaned;
}

/* ---- 翻译：Google gtx（质量优于 MyMemory）→ MyMemory 兜底 ----
   服务端（Vercel 海外机房）调用，不受用户本地网络影响。
   仅用于 ECDICT 未收录词的英文释义汉化，属兜底路径。 */

async function translateGoogle(text: string): Promise<string> {
  const n = text.trim();
  if (!n || hasChinese(n)) return n;
  const cached = transCache.get(`g:${n}`);
  if (cached !== undefined) return cached;
  try {
    const res = await fetchWithTimeout(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(n)}`,
      4000,
    );
    if (!res.ok) { transCache.set(`g:${n}`, ""); return ""; }
    const data = await res.json();
    const segs = data?.[0];
    if (!Array.isArray(segs)) { transCache.set(`g:${n}`, ""); return ""; }
    const out = segs.map((s: unknown[]) => (Array.isArray(s) ? String(s[0] ?? "") : "")).join("").trim();
    transCache.set(`g:${n}`, out);
    return out;
  } catch {
    transCache.set(`g:${n}`, "");
    return "";
  }
}

async function translate(text: string): Promise<string> {
  const n = text.trim();
  if (!n || hasChinese(n)) return n;

  const google = await translateGoogle(n);
  if (google) return google;

  const cached = transCache.get(n);
  if (cached !== undefined) return cached;
  try {
    const res = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(n)}&langpair=en|zh-CN`);
    if (!res.ok) { transCache.set(n, ""); return ""; }
    const data = (await res.json()) as TransRes;
    const t = cleanTrans(data.responseData?.translatedText || "");
    if (!t || t.toLowerCase() === n.toLowerCase()) { transCache.set(n, ""); return ""; }
    transCache.set(n, t);
    return t;
  } catch { transCache.set(n, ""); return ""; }
}

/* ---- 语境选义：按用户遇到该词的原句对义项排序 ----
   打分依据：原句内容词 与（义项英文释义 + 例句）的内容词重合度。
   例：在 "The paper was abandoned halfway" 里遇到的 abandon，
   「中止/放弃（计划）」义项的例句词面与原句重合度高，会排到「放纵」前面。 */

const EN_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "so", "as", "at", "by", "for", "with", "about",
  "into", "onto", "from", "to", "in", "on", "of", "is", "are", "was", "were", "be", "been", "being", "am",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should", "can", "could", "may",
  "might", "must", "not", "no", "nor", "it", "its", "this", "that", "these", "those", "there", "here",
  "he", "she", "they", "we", "you", "i", "me", "him", "her", "us", "them", "his", "their", "our", "your",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how", "also", "very", "just", "only",
  "more", "most", "some", "any", "each", "every", "all", "both", "such", "one", "two", "other", "another",
  "up", "down", "out", "over", "under", "between", "because", "while", "after", "before",
]);

function contentTokens(text?: string): Set<string> {
  if (!text) return new Set();
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((t) => !EN_STOPWORDS.has(t)),
  );
}

function rankMeaningsByContext<T extends { gloss?: string; exampleSentence?: string }>(
  meanings: T[],
  context?: string | null,
): T[] {
  if (!context || meanings.length <= 1) return meanings;
  const ctx = contentTokens(context);
  if (ctx.size === 0) return meanings;

  const scored = meanings.map((m, i) => {
    const tokens = new Set([...contentTokens(m.gloss), ...contentTokens(m.exampleSentence)]);
    let hit = 0;
    for (const t of tokens) if (ctx.has(t)) hit++;
    return { i, m, score: hit / Math.sqrt(tokens.size || 1) };
  });

  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((s) => s.m);
}

/* ---- POS priority ---- */

const POS_RANK: Record<string, number> = { verb: 1, noun: 2, adjective: 3, adverb: 4, preposition: 5, conjunction: 6, interjection: 7, pronoun: 8 };

function posRank(pos?: string): number {
  if (!pos) return 99;
  const l = pos.toLowerCase().trim();
  for (const [k, v] of Object.entries(POS_RANK)) { if (l.startsWith(k)) return v; }
  return 50;
}

function beautifyPos(raw: string): string {
  if (!raw) return "";
  const l = raw.toLowerCase().trim();
  const m: Record<string, string> = { verb: "v.", noun: "n.", adjective: "adj.", adverb: "adv.", preposition: "prep.", conjunction: "conj.", interjection: "interj.", pronoun: "pron." };
  for (const [k, v] of Object.entries(m)) { if (l.startsWith(k)) return v; }
  return raw;
}

/* ---- 通用词库匹配中文释义 ---- */

function lookupCommon(word: string, pos: string): string {
  const l = word.toLowerCase().trim();
  const entries = COMMON_DICT[l];
  if (!entries || !entries.length) return "";

  // 精确匹配词性
  const posShort = pos.toLowerCase().replace(/\./g, "").trim();
  const exact = entries.find((e) => {
    const ePos = e.pos.toLowerCase().replace(/\./g, "").trim();
    return ePos === posShort || ePos.startsWith(posShort) || posShort.startsWith(ePos);
  });
  if (exact) return exact.zh;

  // 第一个匹配的作为 fallback
  return entries[0].zh;
}

function lookupCommonMeanings(word: string): { pos: string; zh: string }[] {
  const l = word.toLowerCase().trim();
  return COMMON_DICT[l] || [];
}

/* ---- 从 Free Dictionary 所有义项构建 meanings 列表 ----
   英文释义保留原文（不机翻），中文义优先取 ECDICT，未收录时整词汉化。 */

async function buildMeaningsFromFD(word: string, meanings?: FDMeaning[]): Promise<EnrichedMeaning[]> {
  if (!meanings?.length) return [];

  const sorted = [...meanings].sort((a, b) => posRank(a.partOfSpeech) - posRank(b.partOfSpeech));

  const candidates: Array<{ pos: string; definition: string; example: string }> = [];
  const seen = new Set<string>();

  for (const m of sorted) {
    const pos = beautifyPos(m.partOfSpeech || "");
    const defs = m.definitions || [];
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      if (!def.definition?.trim()) continue;
      const key = `${pos}::${def.definition}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        pos,
        definition: shortenMeaning(def.definition),
        example: def.example?.trim() || "",
      });

      if (candidates.length >= 5) break;
    }
    if (candidates.length >= 5) break;
  }

  return candidates.map((c, i) => ({
    partOfSpeech: c.pos,
    meaningZh: c.definition,
    exampleSentence: c.example || undefined,
    isObscure: i > 0,
    isHighFreq: false,
    gloss: c.definition,
  }));
}

function pickPhonetic(entry?: FDEntry): string {
  if (!entry) return "";
  return entry.phonetic || entry.phonetics?.find((i) => i.text)?.text || "";
}

/* ---- 本地考研精解词库 ---- */

function lookupKaoyan(text: string): EnrichedWord | null {
  const normalizedText = normalizeText(text);
  const lemma = normalizeLemma(normalizedText);
  const local = getKaoyanEntry(lemma);
  if (!local) return null;

  const meanings: EnrichedMeaning[] = local.meanings.map((m) => ({
    partOfSpeech: m.partOfSpeech,
    meaningZh: m.meaningZh,
    exampleSentence: m.exampleSentence || undefined,
    exampleTranslation: m.exampleTranslation || undefined,
    isObscure: m.isObscure,
    isHighFreq: m.isHighFreq,
  }));

  const primary = local.meanings[0];

  return {
    text: normalizedText,
    lemma,
    meaningZh: primary.meaningZh,
    phonetic: local.phonetic,
    partOfSpeech: primary.partOfSpeech,
    exampleSentence: primary.exampleSentence,
    meanings,
    provider: "kaoyan_local",
    found: true,
  };
}

/* ---- ECDICT 离线词典（人工编写中文释义，覆盖高频 6 万词） ---- */

function lookupEcdictWord(text: string): EnrichedWord | null {
  const normalizedText = normalizeText(text);
  const lemma = normalizeLemma(normalizedText);
  const hit = lookupEcdict(lemma);
  if (!hit || !hit.translation) return null;

  const senseLines = ecdictMeanings(hit.translation);
  if (senseLines.length === 0) return null;

  const meanings: EnrichedMeaning[] = senseLines.map((s, i) => ({
    partOfSpeech: s.partOfSpeech,
    meaningZh: s.meaningZh,
    isObscure: i > 0,
    isHighFreq: false,
    gloss: hit.gloss || undefined,
  }));

  return {
    text: normalizedText,
    lemma,
    meaningZh: senseLines[0].meaningZh,
    phonetic: hit.phonetic || undefined,
    partOfSpeech: hit.pos || senseLines[0].partOfSpeech || undefined,
    meanings,
    provider: "ecdict",
    found: true,
  };
}

/* ---- Free Dictionary 查询（音标/同义词/英文释义） ---- */

async function queryFD(text: string): Promise<EnrichedWord | null> {
  const n = normalizeText(text);
  const l = normalizeLemma(n);
  if (l.includes(" ")) return null;

  try {
    const res = await fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(l)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as FDEntry[];
    const entry = data?.[0];
    if (!entry) return null;

    const phonetic = pickPhonetic(entry);
    const meanings = await buildMeaningsFromFD(n, entry.meanings);

    // 提取同义词（去重，取前 8 个）
    const seenSynonyms = new Set<string>();
    for (const m of entry.meanings || []) {
      for (const d of m.definitions || []) {
        for (const s of d.synonyms || []) {
          const clean = s.trim().toLowerCase();
          if (clean && clean !== l && !seenSynonyms.has(clean)) {
            seenSynonyms.add(clean);
          }
        }
      }
    }
    const synonyms = Array.from(seenSynonyms).slice(0, 8);

    // 中文义：优先 ECDICT（人工释义）；未收录时把首条英文释义汉化
    const ecdictHit = lookupEcdict(l);
    let meaningZh = ecdictHit?.translation.split(/\n+/)[0]?.trim() || "";
    if (!meaningZh && meanings[0]) {
      meaningZh = await translate(meanings[0].meaningZh);
    }

    const first = meanings[0];

    return {
      text: n,
      lemma: l,
      meaningZh,
      phonetic,
      partOfSpeech: first?.partOfSpeech || "",
      exampleSentence: first?.exampleSentence || undefined,
      meanings: meanings.length > 0 ? meanings : undefined,
      synonyms: synonyms.length > 0 ? synonyms : undefined,
      provider: ecdictHit ? "free_dictionary" : "free_dictionary_translated",
      found: true,
    };
  } catch {
    return null;
  }
}

/* ---- Fallback ---- */

function buildFallback(text: string): EnrichedWord {
  const n = normalizeText(text);
  const l = normalizeLemma(n);
  return { text: n, lemma: l, provider: "fallback", found: false };
}

function buildCommonFallback(text: string): EnrichedWord {
  const n = normalizeText(text);
  const l = normalizeLemma(n);
  const commonMeanings = lookupCommonMeanings(n);
  if (commonMeanings.length > 0) {
    const first = commonMeanings[0];
    return {
      text: n, lemma: l,
      meaningZh: first.zh,
      partOfSpeech: first.pos,
      phonetic: "",
      provider: "smart_fallback",
      found: true,
      meanings: commonMeanings.map((m) => ({
        partOfSpeech: m.pos,
        meaningZh: m.zh,
        isObscure: false,
        isHighFreq: false,
      })),
    };
  }
  return buildFallback(text);
}

/* ---- Public API ---- */

export async function enrichWord(text: string, sourceContext?: string | null): Promise<EnrichedWord> {
  const kaoyan = lookupKaoyan(text);
  if (kaoyan) {
    return { ...kaoyan, meanings: kaoyan.meanings ? rankMeaningsByContext(kaoyan.meanings, sourceContext) : undefined };
  }

  const ecdict = lookupEcdictWord(text);
  if (ecdict) {
    return { ...ecdict, meanings: ecdict.meanings ? rankMeaningsByContext(ecdict.meanings, sourceContext) : undefined };
  }

  const remote = await queryFD(text);
  if (remote && remote.found) {
    return { ...remote, meanings: remote.meanings ? rankMeaningsByContext(remote.meanings, sourceContext) : undefined };
  }

  return buildCommonFallback(text);
}

export async function enrichWords(
  items: Array<{ text: string; sourceContext?: string | null }>,
): Promise<EnrichedWord[]> {
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const n = normalizeText(item.text);
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  return Promise.all(unique.map((item) => enrichWord(item.text, item.sourceContext).catch(() => buildCommonFallback(item.text))));
}
