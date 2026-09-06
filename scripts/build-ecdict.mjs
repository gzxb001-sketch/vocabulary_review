#!/usr/bin/env node
// ECDICT 词库构建脚本：从 ECDICT 的 CSV 生成精简离线词库。
//
// 用法：
//   1. 下载 ECDICT 数据（任选其一）：
//      - GitHub Releases: https://github.com/skywind3000/ECDICT/releases (ecdict-csv.zip)
//      - 或仓库内精简版 ecdict.min.csv
//   2. 运行: node scripts/build-ecdict.mjs <csv路径>
//   3. 重新构建应用即可生效（数据写入 src/lib/ecdict-data.json）
//
// 筛选策略：考研词（tag 含 ky）优先全保留，其余按词频（frq/bnc 取最小排名）
// 降序补充，总量上限 60000，平衡覆盖率与包体积（产物约 3~6MB）。

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const INPUT = process.argv[2] || path.join(process.cwd(), "data", "ecdict.csv");
const OUTPUT = path.join(process.cwd(), "src", "lib", "ecdict-data.json");
const MAX_WORDS = 60000;
const FREQ_LIMIT = 40000;

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

// ECDICT pos 形如 "n:46/v:30/a:12"，取占比最高的前两个转成简写
function compactPos(pos) {
  if (!pos) return "";
  return pos
    .split("/")
    .slice(0, 2)
    .map((p) => {
      const kind = p.split(":")[0];
      const map = { n: "n.", v: "v.", a: "adj.", adv: "adv.", prep: "prep.", conj: "conj.", pron: "pron.", interj: "interj.", num: "num.", art: "art." };
      return map[kind] || `${kind}.`;
    })
    .join(" / ");
}

if (!fs.existsSync(INPUT)) {
  console.error(`未找到输入文件: ${INPUT}`);
  console.error("请先下载 ECDICT 数据: https://github.com/skywind3000/ECDICT/releases");
  process.exit(1);
}

const rl = readline.createInterface({ input: fs.createReadStream(INPUT, "utf8"), crlfDelay: Infinity });

// word -> { entry, kaoyan, freqRank }
const collected = new Map();
let header = null;

rl.on("line", (line) => {
  if (!header) {
    header = parseCsvLine(line).map((h) => h.trim().toLowerCase());
    return;
  }
  const cells = parseCsvLine(line);
  const get = (name) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? (cells[idx] || "").trim() : "";
  };

  const word = get("word").toLowerCase();
  // 只收纯英文小写单词（跳过短语、大写专有名词、数字开头）
  if (!word || !/^[a-z][a-z'-]*$/.test(word)) return;
  const translation = get("translation");
  if (!translation) return;

  const tag = get("tag");
  const frq = parseInt(get("frq") || "0", 10);
  const bnc = parseInt(get("bnc") || "0", 10);
  const kaoyan = /\bky\b/.test(tag);
  const freqRank = Math.min(frq > 0 ? frq : Infinity, bnc > 0 ? bnc : Infinity);
  const isHighFreq = freqRank <= FREQ_LIMIT;
  if (!kaoyan && !isHighFreq) return;

  const entry = [get("phonetic"), compactPos(get("pos")), translation, get("definition")];
  // 同一词重复出现时保留优先级更高的记录
  const prev = collected.get(word);
  if (prev && prev.kaoyan >= kaoyan && prev.freqRank <= freqRank) return;
  collected.set(word, { entry, kaoyan, freqRank: Number.isFinite(freqRank) ? freqRank : FREQ_LIMIT * 10 });
});

rl.on("close", () => {
  // 排序：考研词优先，其余按词频排名升序（越小越高频）
  const sorted = Array.from(collected.entries()).sort((a, b) => {
    if (a[1].kaoyan !== b[1].kaoyan) return a[1].kaoyan ? -1 : 1;
    return a[1].freqRank - b[1].freqRank;
  });

  const out = {};
  let count = 0;
  for (const [word, { entry }] of sorted) {
    if (count >= MAX_WORDS) break;
    out[word] = entry;
    count++;
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(out));
  const sizeMB = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
  console.log(`✓ 已生成 ${OUTPUT}`);
  console.log(`  词条数: ${count}，文件大小: ${sizeMB}MB`);
  console.log(`  其中考研词: ${sorted.slice(0, count).filter(([, v]) => v.kaoyan).length}`);
  if (count === 0) {
    console.log("  （0 条——请确认输入的是 ECDICT 的 CSV 且包含 word/translation 列）");
  }
});
