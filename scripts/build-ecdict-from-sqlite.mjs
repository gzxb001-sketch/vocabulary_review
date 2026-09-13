#!/usr/bin/env node
// ECDICT 词库构建脚本（Plan B：SQLite 数据源）。
//
// 与 build-ecdict.mjs 的筛选逻辑完全一致（考研词全保留 + 高频词按词频补充，
// 上限 60000），区别只在数据来源：当 GitHub 下载不了 CSV 时，可改用
// HuggingFace 镜像（hf-mirror.com）上的 ECDICT SQLite 打包，例如：
//   https://hf-mirror.com/datasets/iamzhangship/fluency-ecdict-offline
// 用 Node 24 内置的 node:sqlite 读取，无需安装任何依赖。
//
// 用法：node scripts/build-ecdict-from-sqlite.mjs <sqlite路径>

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const INPUT = process.argv[2] || path.join(process.cwd(), "data", "ecdict-sqlite", "ecdict.sqlite");
const OUTPUT = path.join(process.cwd(), "src", "lib", "ecdict-data.json");
const MAX_WORDS = 60000;
const FREQ_LIMIT = 40000;

// ECDICT pos 形如 "n:46/v:30/a:12"，取占比最高的前两个转成简写（与 CSV 脚本一致）
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
  console.error(`未找到 SQLite 文件: ${INPUT}`);
  console.error("可从 hf-mirror.com 搜索 fluency-ecdict-offline 下载 ECDICT SQLite 打包。");
  process.exit(1);
}

const db = new DatabaseSync(INPUT, { readOnly: true });
const rows = db
  .prepare("SELECT word, phonetic, definition, translation, pos, tag, bnc, frq FROM entries")
  .iterate();

// word -> { entry, kaoyan, freqRank }
const collected = new Map();
let scanned = 0;

for (const row of rows) {
  scanned++;
  const word = String(row.word || "").toLowerCase();
  // 与 CSV 脚本一致：只收纯英文小写单词（跳过短语、大写专有名词、数字开头）
  if (!word || !/^[a-z][a-z'-]*$/.test(word)) continue;
  const translation = String(row.translation || "");
  if (!translation) continue;

  const tag = String(row.tag || "");
  const frq = parseInt(String(row.frq || "0"), 10);
  const bnc = parseInt(String(row.bnc || "0"), 10);
  const kaoyan = /\bky\b/.test(tag);
  const freqRank = Math.min(frq > 0 ? frq : Infinity, bnc > 0 ? bnc : Infinity);
  const isHighFreq = freqRank <= FREQ_LIMIT;
  if (!kaoyan && !isHighFreq) continue;

  const entry = [String(row.phonetic || ""), compactPos(String(row.pos || "")), translation, String(row.definition || "")];
  // 同一词重复出现时保留优先级更高的记录
  const prev = collected.get(word);
  if (prev && prev.kaoyan >= kaoyan && prev.freqRank <= freqRank) continue;
  collected.set(word, { entry, kaoyan, freqRank: Number.isFinite(freqRank) ? freqRank : FREQ_LIMIT * 10 });
}

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
console.log(`  扫描 ${scanned} 条，收词 ${count}，文件大小: ${sizeMB}MB`);
console.log(`  其中考研词: ${sorted.slice(0, count).filter(([, v]) => v.kaoyan).length}`);
if (count === 0) {
  console.log("  （0 条——请确认 SQLite 含 entries 表及 word/translation 列）");
}
