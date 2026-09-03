// CSV 解析：支持带引号字段、引号内逗号/换行、"" 转义，兼容 \r\n 与 \n。
// 用于词库导入：既兼容本产品导出的 CSV（17 列），也兼容简单格式。

/** 解析 CSV 文本为二维数组（保留原始单元格，含空串）；分隔符可指定（逗号或 Tab） */
export function parseCsv(text: string, delimiter: string = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // 跳过纯空行
    if (row.length > 1 || row[0]?.trim() !== "") rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushCell();
    } else if (ch === "\n") {
      pushCell();
      pushRow();
    } else if (ch === "\r") {
      // \r\n：跳过 \r，交给 \n 处理；单独的 \r 也当作换行
      if (text[i + 1] === "\n") continue;
      pushCell();
      pushRow();
    } else {
      cell += ch;
    }
  }

  // 收尾：最后仍有内容时入列
  if (cell !== "" || row.length > 0) {
    pushCell();
    pushRow();
  }

  return rows;
}

export type CsvImportRow = {
  displayText: string;
  lemma?: string;
  meaningZh?: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  note?: string;
};

const EXPORT_HEADER = [
  "displaytext", "lemma", "meaningzh", "phonetic", "partofspeech",
  "examplesentence", "note", "status", "sourcetypes", "sourcenotes",
  "nextreviewat", "reviewcount", "intervaldays", "easescore", "lastresult",
  "createdat", "updatedat",
];

/**
 * 把 CSV 文本解析为可导入的词条列表：
 * - 带本产品导出表头：按列名取前 7 个字段（round-trip）；
 * - 无表头：按「单词, 释义, 音标, 词性, 例句」或 Tab 分隔的简单格式，
 *   也兼容 Anki 导出的「正面<tab>背面」（背面视为释义）。
 * 单元格数不足时缺省，displayText 为空的行丢弃。上限 500 行防误导入超大文件。
 */
export function parseImportRows(csvText: string, maxRows = 500): CsvImportRow[] {
  // 自动探测分隔符：首行含 Tab 视为 Anki 风格导出，否则按逗号
  const firstLine = csvText.split(/\r?\n/).find((l) => l.trim() !== "") || "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const grid = parseCsv(csvText, delimiter);
  if (grid.length === 0) return [];

  const first = grid[0].map((c) => c.trim().toLowerCase());
  const hasHeader = first[0] === "displaytext" || first[0] === "word" || first[0] === "front";

  const dataRows = hasHeader ? grid.slice(1) : grid;
  const col = (name: string): number => {
    const idx = first.indexOf(name);
    return idx >= 0 ? idx : -1;
  };

  // 表头模式下的列位（本产品导出为精确列序；word/front 等别名做兜底映射）
  const idxDisplay = hasHeader ? (col("displaytext") >= 0 ? col("displaytext") : col("word") >= 0 ? col("word") : col("front")) : 0;
  const idxMeaning = hasHeader ? (col("meaningzh") >= 0 ? col("meaningzh") : col("back") >= 0 ? col("back") : 1) : 1;
  const idxPhonetic = hasHeader ? (col("phonetic") >= 0 ? col("phonetic") : 2) : 2;
  const idxPos = hasHeader ? (col("partofspeech") >= 0 ? col("partofspeech") : 3) : 3;
  const idxExample = hasHeader ? (col("examplesentence") >= 0 ? col("examplesentence") : 4) : 4;
  const idxLemma = hasHeader ? col("lemma") : -1;
  const idxNote = hasHeader ? col("note") : -1;

  const isKnownHeader = hasHeader && first.join(",") === EXPORT_HEADER.join(",");

  const out: CsvImportRow[] = [];
  for (const cells of dataRows) {
    if (out.length >= maxRows) break;
    const displayText = (cells[idxDisplay] || "").trim();
    if (!displayText) continue;

    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i]?.trim() || "" : "");

    // 简单格式：仅当第二列看起来像释义（含中文）才作为释义，否则视为纯单词行
    const rawSecond = get(idxMeaning);
    const meaningZh = isKnownHeader || hasHeader || /[\u4e00-\u9fff]/.test(rawSecond) ? rawSecond : "";

    out.push({
      displayText,
      lemma: isKnownHeader ? get(idxLemma) || displayText.toLowerCase() : displayText.toLowerCase(),
      meaningZh,
      phonetic: isKnownHeader ? get(idxPhonetic) : "",
      partOfSpeech: isKnownHeader ? get(idxPos) : "",
      exampleSentence: isKnownHeader ? get(idxExample) : "",
      note: isKnownHeader ? get(idxNote) : undefined,
    });
  }

  return out;
}
