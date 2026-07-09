import { normalizeLemma, normalizeText } from "@/lib/normalize";

export type EnrichedWord = {
  text: string;
  lemma: string;
  meaningZh?: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  provider: "free_dictionary" | "free_dictionary_translated" | "fallback";
  found: boolean;
};

const LOCAL_WORD_MAP: Record<
  string,
  Pick<EnrichedWord, "meaningZh" | "phonetic" | "partOfSpeech" | "exampleSentence">
> = {
  abandon: {
    meaningZh: "放弃",
    phonetic: "/əˈbændən/",
    partOfSpeech: "verb",
    exampleSentence: "He abandoned the plan.",
  },
  compulsory: {
    meaningZh: "强制的；必修的",
    phonetic: "/kəmˈpʌlsəri/",
    partOfSpeech: "adjective",
    exampleSentence: "English is a compulsory subject.",
  },
  derive: {
    meaningZh: "获得；源于",
    phonetic: "/dɪˈraɪv/",
    partOfSpeech: "verb",
    exampleSentence: "Many words derive from Latin.",
  },
};

type FreeDictionaryMeaning = {
  partOfSpeech?: string;
  definitions?: Array<{
    definition?: string;
    example?: string;
  }>;
};

type FreeDictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string }>;
  meanings?: FreeDictionaryMeaning[];
};

type TranslationResponse = {
  responseData?: {
    translatedText?: string;
  };
};

const translationCache = new Map<string, string>();

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanTranslatedText(text: string) {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

function buildFallbackWord(text: string): EnrichedWord {
  const normalizedText = normalizeText(text);
  const lemma = normalizeLemma(normalizedText);
  const local = LOCAL_WORD_MAP[lemma];

  return {
    text: normalizedText,
    lemma,
    meaningZh: local?.meaningZh || "",
    phonetic: local?.phonetic || "",
    partOfSpeech: local?.partOfSpeech || "",
    exampleSentence: local?.exampleSentence || "",
    provider: "fallback",
    found: Boolean(local),
  };
}

function pickFirstMeaning(meanings?: FreeDictionaryMeaning[]) {
  if (!meanings?.length) {
    return {
      partOfSpeech: "",
      meaningZh: "",
      exampleSentence: "",
    };
  }

  const firstMeaning = meanings[0];
  const firstDef = firstMeaning.definitions?.[0];

  return {
    partOfSpeech: firstMeaning.partOfSpeech || "",
    meaningZh: firstDef?.definition || "",
    exampleSentence: firstDef?.example || "",
  };
}

function pickPhonetic(entry?: FreeDictionaryEntry) {
  if (!entry) {
    return "";
  }

  return entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || "";
}

async function translateToChinese(text: string): Promise<string> {
  const normalized = text.trim();

  if (!normalized) {
    return "";
  }

  if (hasChinese(normalized)) {
    return normalized;
  }

  const cached = translationCache.get(normalized);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=en|zh-CN`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    if (!res.ok) {
      translationCache.set(normalized, "");
      return "";
    }

    const data = (await res.json()) as TranslationResponse;
    const translated = cleanTranslatedText(data.responseData?.translatedText || "");

    if (!translated || translated.toLowerCase() === normalized.toLowerCase()) {
      translationCache.set(normalized, "");
      return "";
    }

    translationCache.set(normalized, translated);
    return translated;
  } catch {
    translationCache.set(normalized, "");
    return "";
  }
}

async function queryFreeDictionary(text: string): Promise<EnrichedWord | null> {
  const normalizedText = normalizeText(text);
  const lemma = normalizeLemma(normalizedText);

  if (lemma.includes(" ")) {
    return null;
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lemma)}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as FreeDictionaryEntry[];
    const entry = data?.[0];

    if (!entry) {
      return null;
    }

    const meaning = pickFirstMeaning(entry.meanings);
    const local = LOCAL_WORD_MAP[lemma];
    const translatedMeaning = local?.meaningZh || (await translateToChinese(meaning.meaningZh));
    const hasTranslatedMeaning = Boolean(translatedMeaning);

    return {
      text: normalizedText,
      lemma,
      meaningZh: translatedMeaning || meaning.meaningZh || "",
      phonetic: local?.phonetic || pickPhonetic(entry),
      partOfSpeech: local?.partOfSpeech || meaning.partOfSpeech || "",
      exampleSentence: local?.exampleSentence || meaning.exampleSentence || "",
      provider: hasTranslatedMeaning ? "free_dictionary_translated" : "free_dictionary",
      found: true,
    };
  } catch {
    return null;
  }
}

export async function enrichWord(text: string): Promise<EnrichedWord> {
  const remote = await queryFreeDictionary(text);

  if (remote) {
    return remote;
  }

  return buildFallbackWord(text);
}

export async function enrichWords(texts: string[]): Promise<EnrichedWord[]> {
  const uniqueTexts = Array.from(new Set(texts.map((item) => normalizeText(item)).filter(Boolean)));
  return Promise.all(uniqueTexts.map((text) => enrichWord(text)));
}
