"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ReviewMeaning = {
  partOfSpeech: string;
  meaningZh: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  isObscure: boolean;
  isHighFreq: boolean;
};

type ReviewItem = {
  wordId: string;
  displayText: string;
  meaningZh?: string;
  phonetic?: string;
  exampleSentence?: string;
  sourceType?: string | null;
  sourceNote?: string | null;
  meanings?: ReviewMeaning[];
};

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题", reading: "阅读", lecture: "听课", manual: "手动", other: "其他",
};

type TodayResponse = { count: number; items: ReviewItem[] };

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/review/today")
      .then((res) => res.json())
      .then((data: TodayResponse) => { setItems(data.items || []); setLoading(false); });
  }, []);

  async function submit(result: "known" | "vague" | "forgot") {
    const current = items[index];
    if (!current) return;
    setSubmitting(true);
    await fetch("/api/review/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: current.wordId, result }),
    });
    setSubmitting(false);
    setRevealed(false);
    setIndex((prev) => prev + 1);
  }

  if (loading) {
    return (
      <main className="container">
        <div className="card stack">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-text" />
        </div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="container fade-in">
        <div className="card empty-state">
          <span className="empty-state-icon">✅</span>
          <h1 className="empty-state-title">今天没有待复习的词</h1>
          <p className="empty-state-text">可以先去录入几个今天遇到的生词。</p>
          <div className="link-row">
            <Link href="/" className="link-button secondary">返回首页</Link>
          </div>
        </div>
      </main>
    );
  }

  if (index >= items.length) {
    return (
      <main className="container fade-in">
        <div className="card empty-state">
          <span className="empty-state-icon">🎉</span>
          <h1 className="empty-state-title">今天复习完成</h1>
          <p className="empty-state-text">这一轮已经结束，明天再继续。</p>
          <div className="link-row">
            <Link href="/" className="link-button">返回首页</Link>
          </div>
        </div>
      </main>
    );
  }

  const current = items[index];
  const commonMeanings = (current.meanings || []).filter((m) => !m.isObscure);
  const obscureMeanings = (current.meanings || []).filter((m) => m.isObscure);

  return (
    <main className="container fade-in">
      <div className="card stack">
        <div className="progress-badge">{index + 1} / {items.length}</div>

        <h1 className="flashcard-word">{current.displayText}</h1>

        {!revealed ? (
          <button className="button" onClick={() => setRevealed(true)} style={{ marginTop: "var(--space-4)" }}>
            点击显示答案
          </button>
        ) : (
          <div className="stack">
            <div className="flashcard-reveal">
              {current.meaningZh && <p className="flashcard-meaning">{current.meaningZh}</p>}
              {current.phonetic && <p className="word-phonetic">{current.phonetic}</p>}

              {/* 完整义项列表 */}
              {(current.meanings || []).length > 0 && (
                <div className="review-meanings">
                  {commonMeanings.map((m, i) => (
                    <div key={i} className="meaning-item-sm">
                      <span className="meta-chip">{m.partOfSpeech}</span>
                      <span className="meaning-zh-sm">{m.meaningZh}</span>
                    </div>
                  ))}
                  {obscureMeanings.length > 0 && (
                    <details className="obscure-section" style={{ marginTop: "var(--space-2)" }}>
                      <summary className="obscure-toggle">
                        ⚠️ 熟词僻义 — {obscureMeanings.length} 条
                      </summary>
                      <div style={{ marginTop: "var(--space-2)", display: "grid", gap: "var(--space-1)" }}>
                        {obscureMeanings.map((m, i) => (
                          <div key={i} className="meaning-item-sm meaning-obscure">
                            <span className="meta-chip">{m.partOfSpeech}</span>
                            <span className="meaning-zh-sm">{m.meaningZh}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>

            {(current.sourceType || current.sourceNote) && (
              <div className="review-meta">
                {current.sourceType && (
                  <span className="meta-chip">来源：{SOURCE_LABELS[current.sourceType] || current.sourceType}</span>
                )}
                {current.sourceNote && <span className="muted">{current.sourceNote}</span>}
              </div>
            )}

            <div className="divider" />

            <div className="answer-buttons">
              <button className="answer-btn known" disabled={submitting} onClick={() => submit("known")}>
                <span className="answer-emoji">👍</span>认识
              </button>
              <button className="answer-btn vague" disabled={submitting} onClick={() => submit("vague")}>
                <span className="answer-emoji">🤔</span>模糊
              </button>
              <button className="answer-btn forgot" disabled={submitting} onClick={() => submit("forgot")}>
                <span className="answer-emoji">😅</span>不会
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
