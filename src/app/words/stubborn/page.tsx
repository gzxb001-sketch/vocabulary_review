"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StubbornItem = {
  wordId: string;
  displayText: string;
  meaningZh?: string;
  phonetic?: string;
  reviewCount: number;
  easeScore: number;
  lastResult: "forgot" | "vague" | "known";
  nextReviewAt: string;
  recentResults: string[];
};

const RESULT_LABELS: Record<string, string> = {
  known: "认识",
  vague: "模糊",
  forgot: "不会",
};

export default function StubbornWordsPage() {
  const [items, setItems] = useState<StubbornItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/words/stubborn")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="container">
        <div className="card stack">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-card" />
        </div>
      </main>
    );
  }

  const difficultyLabel = (ease: number) => {
    if (ease <= 1.5) return { text: "很难", color: "#dc2626" };
    if (ease <= 2.0) return { text: "较难", color: "#ca8a04" };
    if (ease <= 2.3) return { text: "稍难", color: "#0891b2" };
    return { text: "一般", color: "#6b7280" };
  };

  return (
    <main className="container fade-in">
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="title">错词本</h1>
          <Link href="/" className="link-button secondary" style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-sm)" }}>
            返回首页
          </Link>
        </div>
        <p className="subtitle">
          集中攻克反复模糊或忘记的词，逐个点进去强化学习
        </p>
        {items.length > 0 && (
          <Link href="/review?mode=stubborn" className="button" style={{ textAlign: "center" }}>
            开始专项攻克（进入复习流，取最难 20 词）
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-state-icon">📚</span>
          <p className="empty-state-text">暂无顽固词，继续保持！</p>
        </div>
      ) : (
        <div className="stubborn-list">
          {items.map((item) => {
            const diff = difficultyLabel(item.easeScore);
            const lastLabel = RESULT_LABELS[item.lastResult] || item.lastResult;
            const lastColor = item.lastResult === "forgot" ? "#dc2626" : item.lastResult === "vague" ? "#ca8a04" : "#16a34a";
            return (
              <Link key={item.wordId} href={`/words/${item.wordId}`} className="card stubborn-card" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="stubborn-card-header">
                  <span className="stubborn-card-word">{item.displayText}</span>
                  {item.phonetic && <span className="stubborn-card-phonetic">{item.phonetic}</span>}
                </div>
                {item.meaningZh && (
                  <p className="muted" style={{ fontSize: "var(--text-sm)", margin: "var(--space-1) 0" }}>
                    {item.meaningZh}
                  </p>
                )}
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
                  <span className="meta-chip" style={{ color: diff.color }}>难度：{diff.text}</span>
                  <span className="meta-chip">复习 {item.reviewCount} 次</span>
                  <span className="meta-chip" style={{ color: lastColor }}>最近：{lastLabel}</span>
                  {item.recentResults.length > 0 && (
                    <span style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                      {item.recentResults.map((r, i) => {
                        const emoji = r === "known" ? "✅" : r === "vague" ? "⚠️" : "❌";
                        return <span key={i} style={{ fontSize: "var(--text-xs)" }} title={RESULT_LABELS[r]}>{emoji}</span>;
                      })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
