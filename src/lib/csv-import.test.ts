import { describe, it, expect } from "vitest";
import { parseCsv, parseImportRows } from "./csv-import";

describe("parseCsv", () => {
  it("基础逗号分隔", () => {
    expect(parseCsv("a,b,c\nd,e,f")).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("引号字段内可含逗号与换行", () => {
    expect(parseCsv('"a,x","b\ny",c')).toEqual([["a,x", "b\ny", "c"]]);
  });

  it("双引号转义", () => {
    expect(parseCsv('"he said ""hi""",b')).toEqual([['he said "hi"', "b"]]);
  });

  it("兼容 \\r\\n 换行", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("跳过纯空行", () => {
    expect(parseCsv("a,b\n\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseImportRows", () => {
  it("识别本产品导出的 CSV 表头（round-trip）", () => {
    const csv = [
      "displayText,lemma,meaningZh,phonetic,partOfSpeech,exampleSentence,note,status,sourceTypes,sourceNotes,nextReviewAt,reviewCount,intervalDays,easeScore,lastResult,createdAt,updatedAt",
      '"abandon","abandon","放弃","/əˈbændən/","v.","He abandoned the plan.","",active,"exam","",2026-01-01,3,25,2.4,known,2026-01-01,2026-01-02',
      '"derive","derive","推导","/dɪˈraɪv/","v.","","","",admin,"","","","","","","","',
    ].join("\n");

    const rows = parseImportRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      displayText: "abandon",
      lemma: "abandon",
      meaningZh: "放弃",
      phonetic: "/əˈbændən/",
      partOfSpeech: "v.",
      exampleSentence: "He abandoned the plan.",
      note: "",
    });
    expect(rows[1].meaningZh).toBe("推导");
  });

  it("无表头：单词,中文释义 简单格式", () => {
    const rows = parseImportRows("resilient,有弹性的\nambiguous,模糊的");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ displayText: "resilient", meaningZh: "有弹性的" });
  });

  it("无表头：Anki 风格 Tab 分隔（背面视为释义）", () => {
    const rows = parseImportRows("compulsory\t强制的\nscene\t场面");
    expect(rows[0]).toMatchObject({ displayText: "compulsory", meaningZh: "强制的" });
  });

  it("无表头：第二列无中文时不误当释义", () => {
    const rows = parseImportRows("hello,world");
    expect(rows[0]).toMatchObject({ displayText: "hello", meaningZh: "" });
  });

  it("丢弃空行与空词行", () => {
    const rows = parseImportRows("resilient,有弹性的\n,\n\n");
    expect(rows).toHaveLength(1);
  });

  it("遵守 maxRows 上限", () => {
    const csv = Array.from({ length: 50 }, (_, i) => `word${i},词${i}`).join("\n");
    expect(parseImportRows(csv, 10)).toHaveLength(10);
  });
});
