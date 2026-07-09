import { normalizeLemma, normalizeText } from "@/lib/normalize";
import { KAOYAN_WORD_MAP, MeaningEntry, getKaoyanEntry } from "@/lib/kaoyan-words";
import { COMMON_DICT, CommonDictEntry } from "@/lib/common-dict";

export type EnrichedMeaning = {
  partOfSpeech: string;
  meaningZh: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  isObscure: boolean;
  isHighFreq: boolean;
};

export type EnrichedWord = {
  text: string;
  lemma: string;
  meaningZh?: string;       // 最短中文义（列表展示用）
  phonetic?: string;
  partOfSpeech?: string;    // 最常见词性
  exampleSentence?: string; // 第一个例句
  meanings?: EnrichedMeaning[];
  provider: "kaoyan_local" | "free_dictionary" | "free_dictionary_translated" | "smart_fallback" | "fallback";
  found: boolean;
};

/* ---- 考研真题风格例句生成 ---- */

const VERB_TEMPLATES = [
  (w: string) => `Researchers have increasingly ${w}ed the importance of interdisciplinary collaboration.`,
  (w: string) => `The study ${w}s that environmental factors play a decisive role in child development.`,
  (w: string) => `Economists have long ${w}ed that innovation drives long-term economic growth.`,
  (w: string) => `The findings ${w} the hypothesis proposed by earlier studies in the 1990s.`,
];

const NOUN_TEMPLATES = [
  (w: string) => `The ${w} of digital technology has fundamentally reshaped modern education.`,
  (w: string) => `${w.charAt(0).toUpperCase() + w.slice(1)} has been a defining feature of the twenty-first century.`,
  (w: string) => `A deep understanding of ${w} is essential for anyone engaged in academic research.`,
  (w: string) => `Without sufficient ${w}, even the most well-intentioned policies are doomed to fail.`,
];

const ADJ_TEMPLATES = [
  (w: string) => `This is a particularly ${w} issue in developing countries where resources are limited.`,
  (w: string) => `The most ${w} factor in determining student success turned out to be parental involvement.`,
  (w: string) => `The report presents ${w} evidence that climate change is accelerating at an alarming rate.`,
];

const ADV_TEMPLATES = [
  (w: string) => `The policy has been ${w} successful in reducing urban unemployment.`,
  (w: string) => `The results, ${w}, confirmed what earlier studies had only suggested.`,
  (w: string) => `The economy has grown ${w} over the past decade, outpacing all predictions.`,
];

function generateExample(w: string, pos: string): string {
  if (!w) return "";
  const lc = w.toLowerCase();
  if (/^v/i.test(pos)) return VERB_TEMPLATES[Math.floor(Math.random() * VERB_TEMPLATES.length)](lc);
  if (/^n/i.test(pos)) return NOUN_TEMPLATES[Math.floor(Math.random() * NOUN_TEMPLATES.length)](lc);
  if (/^adj/i.test(pos)) return ADJ_TEMPLATES[Math.floor(Math.random() * ADJ_TEMPLATES.length)](lc);
  if (/^adv/i.test(pos)) return ADV_TEMPLATES[Math.floor(Math.random() * ADV_TEMPLATES.length)](lc);
  return `The concept of ${lc} has been widely discussed in academic circles.`;
}

/* ---- Free Dictionary Types ---- */

type FDMeaning = { partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> };
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

async function translate(text: string): Promise<string> {
  const n = text.trim();
  if (!n || hasChinese(n)) return n;
  const cached = transCache.get(n);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(n)}&langpair=en|zh-CN`, { method: "GET", cache: "no-store" });
    if (!res.ok) { transCache.set(n, ""); return ""; }
    const data = (await res.json()) as TransRes;
    const t = cleanTrans(data.responseData?.translatedText || "");
    if (!t || t.toLowerCase() === n.toLowerCase()) { transCache.set(n, ""); return ""; }
    transCache.set(n, t);
    return t;
  } catch { transCache.set(n, ""); return ""; }
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

/* ---- 从 Free Dictionary 所有义项构建 meanings 列表 ---- */

async function buildMeaningsFromFD(word: string, meanings?: FDMeaning[]): Promise<EnrichedMeaning[]> {
  if (!meanings?.length) return [];
  const sorted = [...meanings].sort((a, b) => posRank(a.partOfSpeech) - posRank(b.partOfSpeech));
  const result: EnrichedMeaning[] = [];

  for (const m of sorted) {
    const pos = beautifyPos(m.partOfSpeech || "");
    const defs = m.definitions || [];
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      if (!def.definition?.trim()) continue;

      // 优先从通用词库获取精确中文释义
      let finalZh = lookupCommon(word, m.partOfSpeech || "");
      if (!finalZh) {
        // 词库没有 → 翻译单词本身获取中文
        const wordTrans = await translate(word);
        if (def.definition.length > 80 && wordTrans) {
          finalZh = shortenMeaning(wordTrans);
        } else {
          const defZh = await translate(def.definition);
          finalZh = defZh ? shortenMeaning(defZh) : (wordTrans || shortenMeaning(def.definition));
        }
      }

      // 跳过重复释义
      if (result.some((r) => r.meaningZh === finalZh && r.partOfSpeech === pos)) continue;

      const example = def.example?.trim() || "";
      let exampleTrans: string | undefined;
      if (example) {
        exampleTrans = await translate(example);
        if (exampleTrans) exampleTrans = cleanTrans(exampleTrans);
      }
      if (result.length >= 8) break;
      result.push({
        partOfSpeech: pos,
        meaningZh: finalZh,
        exampleSentence: example || undefined,
        exampleTranslation: exampleTrans || undefined,
        isObscure: i > 0,
        isHighFreq: false,
      });
    }
    if (result.length >= 8) break;
  }

  return result;
}

function pickPhonetic(entry?: FDEntry): string {
  if (!entry) return "";
  return entry.phonetic || entry.phonetics?.find((i) => i.text)?.text || "";
}

/* ---- 本地词库查询 ---- */

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

/* ---- Free Dictionary 查询 ---- */

async function queryFD(text: string): Promise<EnrichedWord | null> {
  const n = normalizeText(text);
  const l = normalizeLemma(n);
  if (l.includes(" ")) return null;

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(l)}`, { method: "GET", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as FDEntry[];
    const entry = data?.[0];
    if (!entry) return null;

    const phonetic = pickPhonetic(entry);
    const meanings = await buildMeaningsFromFD(n, entry.meanings);

    const first = meanings[0];

    return {
      text: n,
      lemma: l,
      meaningZh: first?.meaningZh || "",
      phonetic,
      partOfSpeech: first?.partOfSpeech || "",
      exampleSentence: first?.exampleSentence || undefined,
      meanings: meanings.length > 0 ? meanings : undefined,
      provider: "free_dictionary_translated",
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

/* ---- Public API ---- */

export async function enrichWord(text: string): Promise<EnrichedWord> {
  const local = lookupKaoyan(text);
  if (local) return local;
  const remote = await queryFD(text);
  if (remote && remote.found) return remote;
  return buildFallback(text);
}

export async function enrichWords(texts: string[]): Promise<EnrichedWord[]> {
  const unique = Array.from(new Set(texts.map((t) => normalizeText(t)).filter(Boolean)));
  return Promise.all(unique.map((t) => enrichWord(t)));
}
