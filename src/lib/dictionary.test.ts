import { describe, it, expect } from "vitest";
import { rankMeaningsByContext } from "./dictionary";
import { ecdictMeanings, hasEcdictData, lookupEcdict } from "./ecdict";

describe("rankMeaningsByContext — 语境选义", () => {
  const senses = [
    {
      partOfSpeech: "n.",
      meaningZh: "放纵；纵情",
      exampleSentence: "He danced with wild abandon at the celebration.",
      isObscure: true,
      isHighFreq: false,
    },
    {
      partOfSpeech: "vt.",
      meaningZh: "放弃；中止",
      gloss: "cease to support or look after; withdraw from",
      exampleSentence: "The paper was abandoned halfway through the experiment.",
      isObscure: false,
      isHighFreq: true,
    },
  ];

  it("语境词面与「中止」义项例句重合度高 → 该义项排第一", () => {
    const ranked = rankMeaningsByContext(senses, "The paper was abandoned halfway because the funding ran out.");
    expect(ranked[0].meaningZh).toBe("放弃；中止");
  });

  it("语境与「放纵」例句重合时 → 放义义项提前", () => {
    const ranked = rankMeaningsByContext(senses, "He danced with wild abandon at the party all night.");
    expect(ranked[0].meaningZh).toBe("放纵；纵情");
  });

  it("无语境：保持原排序不变", () => {
    const ranked = rankMeaningsByContext(senses, undefined);
    expect(ranked[0].meaningZh).toBe("放纵；纵情");
    expect(ranked[1].meaningZh).toBe("放弃；中止");
  });

  it("语境与任何义项都无重合：稳定保持原排序", () => {
    const ranked = rankMeaningsByContext(senses, "Quantum chromodynamics describes gluon interactions.");
    expect(ranked[0]).toBe(senses[0]);
    expect(ranked[1]).toBe(senses[1]);
  });

  it("单项义项不重排", () => {
    const single = [senses[0]];
    expect(rankMeaningsByContext(single, "The paper was abandoned halfway.")).toBe(single);
  });

  it("不修改原数组（返回新数组）", () => {
    const original = [...senses];
    rankMeaningsByContext(senses, "The paper was abandoned halfway through the experiment.");
    expect(senses).toEqual(original);
  });
});

describe("ecdictMeanings — ECDICT 释义解析", () => {
  it("解析 \"n. 释义\\nv. 释义\" 多义项格式", () => {
    const senses = ecdictMeanings("n. 放弃\nv. 抛弃；舍弃");
    expect(senses).toEqual([
      { partOfSpeech: "n.", meaningZh: "放弃" },
      { partOfSpeech: "v.", meaningZh: "抛弃；舍弃" },
    ]);
  });

  it("无词性前缀的行整行作为释义", () => {
    expect(ecdictMeanings("放弃；遗弃")).toEqual([
      { partOfSpeech: "", meaningZh: "放弃；遗弃" },
    ]);
  });

  it("空串与空行被过滤", () => {
    expect(ecdictMeanings("n. 放弃\n\n\nv. 抛弃")).toHaveLength(2);
    expect(ecdictMeanings("")).toEqual([]);
  });
});

describe("ecdict 数据加载（占位状态）", () => {
  it("占位空数据：hasEcdictData 为 false，查询返回 null", () => {
    // ecdict-data.json 尚未由 build-ecdict.mjs 生成真实数据
    if (!hasEcdictData()) {
      expect(lookupEcdict("abandon")).toBeNull();
    }
  });
});
