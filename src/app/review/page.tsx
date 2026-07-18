"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  saveReviewItems,
  getCachedReviewItems,
  enqueueSubmit,
  syncQueue,
} from "@/lib/review-offline";
import { DEMO_WORDS, type DemoReviewItem } from "@/lib/demo-words";

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

function demoToReviewItem(d: DemoReviewItem): ReviewItem {
  return {
    wordId: d.wordId,
    displayText: d.displayText,
    meaningZh: d.meaningZh,
    phonetic: d.phonetic,
    exampleSentence: d.exampleSentence,
    sourceType: d.sourceType,
    sourceNote: d.sourceNote,
    meanings: d.meanings,
  };
}

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseCountdown, setPauseCountdown] = useState(3);
  const [wasEndedEarly, setWasEndedEarly] = useState(false);

  const trySync = useCallback(async () => {
    const { remaining } = await syncQueue();
    setPendingCount(remaining);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/review/today");
        if (!res.ok) throw new Error("fetch failed");
        const data: TodayResponse = await res.json();
        const list = (data.items || []) as ReviewItem[];
        if (!cancelled) {
          if (list.length > 0) {
            setItems(list);
            setIsDemo(false);
          } else {
            // 已登录但无待复习词：不降级到 demo，展示空状态
            setItems([]);
            setIsDemo(false);
          }
          setIsOffline(false);
        }
        // 缓存到 IndexedDB 备用
        saveReviewItems(list);
      } catch {
        // API 失败：先检查是否网络问题（离线缓存），否则就是游客（demo 模式）
        const cached = (await getCachedReviewItems()) as ReviewItem[];
        if (!cancelled && cached.length > 0) {
          setItems(cached);
          setIsOffline(true);
          setIsDemo(false);
        } else if (!cancelled) {
          // 游客模式：使用预置 demo 词库
          setItems(DEMO_WORDS.map(demoToReviewItem));
          setIsDemo(true);
          setIsOffline(false);
        }
      }
      if (!cancelled) setLoading(false);
    }

    load();
    trySync();

    // 监听网络恢复，自动同步
    const onOnline = () => {
      setIsOffline(false);
      trySync();
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [trySync]);

  const submit = useCallback(
    async (result: "known" | "vague" | "forgot") => {
      const current = items[index];
      if (!current) return;

      // 游客模式：不调 API，进入暂停
      if (isDemo) {
        setPausing(true);
        setPauseCountdown(3);
        return;
      }

      setSubmitting(true);

      try {
        const res = await fetch("/api/review/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordId: current.wordId, result }),
        });
        if (!res.ok) throw new Error("submit failed");
        setIsOffline(false);
      } catch {
        // 离线：加入同步队列
        await enqueueSubmit({ wordId: current.wordId, result });
        setIsOffline(true);
        await trySync();
      }

      setSubmitting(false);
      setPausing(true);
      setPauseCountdown(3);
    },
    [items, index, trySync, isDemo]
  );

  // 暂停倒计时：3 秒后自动进入下一词
  useEffect(() => {
    if (!pausing) return;
    if (pauseCountdown <= 0) {
      setPausing(false);
      setRevealed(false);
      setIndex((prev) => prev + 1);
      return;
    }
    const timer = setTimeout(() => setPauseCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [pausing, pauseCountdown]);

  // 提前结束本轮
  function endSession() {
    setWasEndedEarly(true);
    setIndex(items.length);
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
        {isDemo ? (
          <div className="card empty-state">
            <span className="empty-state-icon">🎉</span>
            <h1 className="empty-state-title">体验完成</h1>
            <p className="empty-state-text">
              这只是演示模式。注册账号后，你可以录入自己的词库、<br />
              拍照提取生词、用间隔记忆法科学复习。
            </p>
            <div className="link-row">
              <Link href="/login" className="link-button">免费注册</Link>
              <Link href="/" className="link-button secondary">返回首页</Link>
            </div>
          </div>
        ) : (
          <div className="card empty-state">
            <span className="empty-state-icon">{wasEndedEarly ? "⏸" : "🎉"}</span>
            <h1 className="empty-state-title">{wasEndedEarly ? "复习已暂停" : "今天复习完成"}</h1>
            <p className="empty-state-text">
              {wasEndedEarly
                ? `已完成 ${items.length > 0 ? Math.min(index, items.length) : 0}/${items.length} 个，剩余的明天继续。`
                : "这一轮已经结束，明天再继续。"}
            </p>
            <div className="link-row">
              <Link href="/" className="link-button">返回首页</Link>
            </div>
          </div>
        )}
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

        {isDemo && (
          <div className="alert alert-info" style={{ textAlign: "center" }}>
            体验模式 · 注册后解锁完整功能
          </div>
        )}
        {isOffline && (
          <div className="alert alert-warning" style={{ textAlign: "center" }}>
            离线模式 · 数据可能不是最新
          </div>
        )}
        {pendingCount > 0 && (
          <div className="alert alert-info" style={{ textAlign: "center" }}>
            {pendingCount} 条答题结果将在联网后自动同步
          </div>
        )}

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

            {pausing ? (
              <div className="stack" style={{ textAlign: "center" }}>
                <p className="muted" style={{ fontSize: "var(--text-md)" }}>
                  已记录 · {pauseCountdown}s 后进入下一词
                </p>
                <button
                  className="button button-secondary"
                  onClick={() => { setPausing(false); setPauseCountdown(0); }}
                >
                  再看一眼
                </button>
              </div>
            ) : (
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
            )}

            {/* 提前结束按钮 */}
            <button
              className="button button-secondary"
              style={{ marginTop: "var(--space-3)", opacity: 0.7 }}
              onClick={endSession}
            >
              提前结束（已完成 {index + 1}/{items.length}）
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
