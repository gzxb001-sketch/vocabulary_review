import { describe, it, expect } from "vitest";
import { extractCandidatesFromRawText } from "./ocr-cleaner";

function texts(results: { text: string }[]): string[] {
  return results.map((r) => r.text);
}

describe("extractCandidatesFromRawText — 词级分词", () => {
  it("整句 OCR 时按词提取，而非把整行当作一个候选", () => {
    const out = extractCandidatesFromRawText("The environment is significant");
    const words = texts(out);
    expect(words).toContain("environment");
    expect(words).toContain("significant");
    // 不应把整句作为一个候选
    expect(words).not.toContain("The environment is significant");
  });

  it("过滤停用词 the/of/and 等虚词", () => {
    const out = extractCandidatesFromRawText("the of and to in");
    expect(out).toHaveLength(0);
  });

  it("双语行（英文+中文）只保留英文词", () => {
    const out = extractCandidatesFromRawText("abandon 放弃；抛弃");
    const words = texts(out);
    expect(words).toContain("abandon");
    expect(words.some((w) => /[\u4e00-\u9fa5]/.test(w))).toBe(false);
  });
});

describe("extractCandidatesFromRawText — 纠错", () => {
  it("数字混淆纠错：aband0n → abandon 且标记已验证", () => {
    const out = extractCandidatesFromRawText("aband0n");
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("abandon");
    expect(out[0].isVerified).toBe(true);
  });

  it("手写纠错表：concluslon → conclusion", () => {
    const out = extractCandidatesFromRawText("concluslon");
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("conclusion");
  });

  it("手写纠错表：consequnence → consequence 且已验证", () => {
    const out = extractCandidatesFromRawText("consequnence");
    expect(out[0].text).toBe("consequence");
    expect(out[0].isVerified).toBe(true);
  });

  it("易混字母纠错：acknovvledge → acknowledge", () => {
    const out = extractCandidatesFromRawText("acknovvledge");
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("acknowledge");
  });
});

describe("extractCandidatesFromRawText — 去重与大小写", () => {
  it("大小写不敏感去重，保留首次出现的词形", () => {
    const out = extractCandidatesFromRawText("Abandon\nabandon");
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Abandon");
  });

  it("已知词保留原大小写，不做多余改写", () => {
    const out = extractCandidatesFromRawText("Abandon");
    expect(out[0].text).toBe("Abandon");
    expect(out[0].isVerified).toBe(true);
  });
});

describe("extractCandidatesFromRawText — 噪声与上下文", () => {
  it("纯数字行被忽略", () => {
    expect(extractCandidatesFromRawText("12\n2024\n1.")).toHaveLength(0);
  });

  it("多词行提取出 sourceContext（整行出处）", () => {
    const out = extractCandidatesFromRawText("Researchers abandon the old approach");
    const item = out.find((r) => r.text === "abandon");
    expect(item).toBeDefined();
    expect(item!.sourceContext).toBe("Researchers abandon the old approach");
  });

  it("空输入返回空数组", () => {
    expect(extractCandidatesFromRawText("")).toHaveLength(0);
    expect(extractCandidatesFromRawText("   \n  ")).toHaveLength(0);
  });
});

describe("extractCandidatesFromRawText — 词级置信度", () => {
  it("置信度 <60 的词标记 lowConfidence（含自动纠错后继承）", () => {
    const conf = new Map([["sign1ficant", 40], ["significant", 45]]);
    const out = extractCandidatesFromRawText("The sign1ficant result", conf);
    const low = out.find((r) => r.text === "significant");
    expect(low?.lowConfidence).toBe(true);
  });

  it("置信度 ≥60 或不在映射中的词不标记", () => {
    const conf = new Map([["environment", 88], ["sig", 95]]);
    const out = extractCandidatesFromRawText("The environment is significant", conf);
    expect(out.find((r) => r.text === "environment")?.lowConfidence).toBe(false);
    // significant 不在映射里：默认视为高置信（不标记）
    expect(out.find((r) => r.text === "significant")?.lowConfidence).toBe(false);
  });

  it("不传置信度映射时 lowConfidence 为 undefined（兼容旧行为）", () => {
    const out = extractCandidatesFromRawText("The environment is significant");
    expect(out.every((r) => r.lowConfidence === undefined)).toBe(true);
  });

  it("纠错后的词继承原 token 的低置信状态", () => {
    // "1mportant" 被自动纠错为 important，应继承 "1mportant" 的低置信
    const conf = new Map([["1mportant", 35]]);
    const out = extractCandidatesFromRawText("1mportant", conf);
    expect(out.find((r) => r.text === "important")?.lowConfidence).toBe(true);
  });
});
