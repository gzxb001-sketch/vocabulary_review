"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ReviewItem = {
  wordId: string;
  displayText: string;
  meaningZh?: string;
  phonetic?: string;
  exampleSentence?: string;
  sourceType?: string | null;
  sourceNote?: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题",
  reading: "阅读",
  lecture: "听课",
  manual: "手动",
  other: "其他",
};

type TodayResponse = {
  count: number;
  items: ReviewItem[];
};

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/review/today")
      .then((res) => res.json())
      .then((data: TodayResponse) => {
        setItems(data.items || []);
        setLoading(false);
      });
  }, []);

  async function submit(result: "known" | "vague" | "forgot") {
    const current = items[index];
    if (!current) return;

    setSubmitting(true);

    const res = await fetch("/api/review/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: current.wordId, result }),
    });

    setSubmitting(false);

    if (!res.ok) return;

    setRevealed(false);
    setIndex((prev) => prev + 1);
  }

  if (loading) {
    return (
      <main className="container">
        <div className="card">
          <p className="muted">加载中...</p>
        </div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="container fade-in">
        <div className="card stack empty-state">
          <div className="empty-state-icon">✅</div>
          <h1 className="title">今天没有待复习的词</h1>
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
        <div className="card stack empty-state">
          <div className="empty-state-icon">🎉</div>
          <h1 className="title">今天复习完成</h1>
          <p className="empty-state-text">这一轮已经结束，明天再继续。</p>
          <div className="link-row">
            <Link href="/" className="link-button">返回首页</Link>
            <Link href="/words?filter=due" className="link-button secondary">查看待复习词</Link>
          </div>
        </div>
      </main>
    );
  }

  const current = items[index];

  return (
    <main className="container fade-in">
      <div className="card stack">
        <p className="progress">
          {index + 1} / {items.length}
        </p>

        <h1 className="flashcard-word">{current.displayText}</h1>

        {!revealed ? (
          <button className="button" onClick={() => setRevealed(true)}>
            显示答案
          </button>
        ) : (
          <div className="stack">
            <div className="flashcard-reveal">
              <p className="flashcard-meaning">{current.meaningZh || "暂无释义"}</p>
              {current.phonetic ? <p className="phonetic">{current.phonetic}</p> : null}
              {current.exampleSentence ? <p className="muted">{current.exampleSentence}</p> : null}
            </div>

            {(current.sourceType || current.sourceNote) ? (
              <div className="review-meta">
                {current.sourceType ? <span className="meta-chip">来源：{SOURCE_LABELS[current.sourceType] || current.sourceType}</span> : null}
                {current.sourceNote ? <span className="muted">{current.sourceNote}</span> : null}
              </div>
            ) : null}

            <div className="divider" />

            <button className="button button-success" disabled={submitting} onClick={() => submit("known")}>
              认识
            </button>
            <button className="button button-warning" disabled={submitting} onClick={() => submit("vague")}>
              模糊
            </button>
            <button className="button button-danger" disabled={submitting} onClick={() => submit("forgot")}>
              不会
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
