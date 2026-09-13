// ECDICT 开源离线词典（MIT, github.com/skywind3000/ECDICT）精简数据加载器。
// 数据文件 src/lib/ecdict-data.json 由 scripts/build-ecdict.mjs 从 ECDICT CSV 生成：
//   { word: [phonetic, pos, translation, gloss] }
// translation 为人工编写的中文释义（\n 分隔多义项），质量远高于机器翻译。
// 数据文件为空（尚未生成）时本层静默禁用，词典链自动跳过。

import raw from "./ecdict-data.json";

export type EcdictEntry = {
  phonetic: string;
  pos: string;
  translation: string;
  gloss: string;
};

// 紧凑元组: [音标, 词性, 中文释义, 英文释义]
// 经 unknown 中转：真实数据的 JSON 类型推断是 string[]，与定长元组不直接兼容
const INDEX = raw as unknown as Record<string, [string, string, string, string]>;

export function hasEcdictData(): boolean {
  return Object.keys(INDEX).length > 0;
}

export function lookupEcdict(word: string): EcdictEntry | null {
  const hit = INDEX[word.toLowerCase()];
  if (!hit) return null;
  return { phonetic: hit[0] || "", pos: hit[1] || "", translation: hit[2] || "", gloss: hit[3] || "" };
}

/** 把 ECDICT 的中文释义（换行分隔，常见 "n. 释义" 格式）拆成义项列表。
 *  注意：ECDICT 源数据（CSV/SQLite）里的换行是字面的 "\n" 两个字符而非真实换行，需先还原。 */
export function ecdictMeanings(translation: string): Array<{ partOfSpeech: string; meaningZh: string }> {
  return translation
    .replace(/\\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([a-z]+\.\s*)(.+)$/i);
      return m
        ? { partOfSpeech: m[1].trim(), meaningZh: m[2].trim() }
        : { partOfSpeech: "", meaningZh: line };
    });
}
