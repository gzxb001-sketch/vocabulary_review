import { describe, it, expect } from "vitest";
import { resumeIndex } from "./review-offline";

// 会话接续对齐算法：复习中途退出后，重开页面从哪里继续
describe("resumeIndex — 复习进度接续对齐", () => {
  const list = ["w1", "w2", "w3", "w4", "w5"];

  it("列表未收缩（队列未同步）：直接恢复到上次的位置", () => {
    // 上次会话答到第 3 个（w1 w2 w3 已答），列表原样返回
    expect(resumeIndex(list, list, 3)).toBe(3);
  });

  it("列表已收缩（已答前缀被服务端移除）：从第一个未答词继续", () => {
    // w1 w2 已同步到服务端，新列表不再包含它们
    expect(resumeIndex(["w3", "w4", "w5"], ["w1", "w2", "w3", "w4", "w5"], 2)).toBe(0);
    // 部分收缩：新列表还剩 w3 w4 w5，其中 w3 也已答
    expect(resumeIndex(["w3", "w4", "w5"], ["w1", "w2", "w3", "w4", "w5"], 3)).toBe(1);
  });

  it("全部已答：返回列表长度（本轮完成）", () => {
    expect(resumeIndex(["w3"], ["w1", "w2", "w3"], 3)).toBe(1);
    expect(resumeIndex(list, list, 5)).toBe(5);
  });

  it("全新会话（没答过）：返回 0", () => {
    expect(resumeIndex(list, list, 0)).toBe(0);
    expect(resumeIndex(list, [], 0)).toBe(0);
  });

  it("重学追加的重复词：词表一致时按位置精确恢复，保留待重学副本", () => {
    // 会话内 w2 被重学追加到尾部：items 含重复 wordId
    const withRelearn = ["w1", "w2", "w3", "w2"];
    // 答到 w3（index 3，w2 的重学副本尚未答）——列表未收缩，位置精确恢复
    expect(resumeIndex(withRelearn, withRelearn, 3)).toBe(3);
  });

  it("列表收缩后重学副本按已答词集合跳过（可接受：重学结果已提交）", () => {
    // w1 w2 w3 已答并同步，w2 的重学副本虽未答但已在服务端计过分，
    // 新列表只剩 w4 w5 → 直接从 w4 继续
    const withRelearn = ["w1", "w2", "w3", "w2", "w4", "w5"];
    expect(resumeIndex(["w4", "w5"], withRelearn, 3)).toBe(0);
  });
});
