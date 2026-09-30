"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import SpeakButton from "../ui/speak-button";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import {
  saveReviewItems,
  getCachedReviewItems,
  enqueueSubmit,
  syncQueue,
  resumeIndex,
} from "@/lib/review-offline";
import { beijingDateStr } from "@/lib/user-day";
import { DEMO_WORDS, type DemoReviewItem } from "@/lib/demo-words";
import { REVIEW_CAPS } from "@/lib/review-config";
import {
  IconThumbsUp,
  IconHelp,
  IconX,
  IconCheckCircle,
  IconXCircle,
  IconSparkles,
  IconPause,
  IconExternalLink,
} from "../ui/icons";

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
  sourceContext?: string | null;
  meanings?: ReviewMeaning[];
  synonyms?: string[];
};

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题", reading: "阅读", lecture: "听课", manual: "手动", other: "其他",
};

type TodayResponse = {
  count: number;
  items: ReviewItem[];
  reviewedToday?: number;
  todayPlan?: number;
};

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

// 每次答题生成一个客户端幂等 ID，避免离线重试/响应丢失时重复计分
function newClientResultId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const SESSION_KEY = "zhumo-review-session";

// 会话进度存档：按「日期 + 词表 wordId + 已答位置」持久化，重开页面可接续
type SavedSession = {
  date: string; // 存档日期（存取两端一致即可）
  mode: "normal" | "stubborn";
  items: string[]; // 会话词表的 wordId（含重学追加的重复项）
  index: number; // 已答到的位置（items 前缀即已答词）
  sessionResults: { known: number; vague: number; forgot: number };
  relearnCount: Record<string, number>;
};

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [mode, setMode] = useState<"normal" | "stubborn">("normal");
  const [pausing, setPausing] = useState(false);
  // 会话休息改为渲染期派生：到达 sessionSize 边界且该位置尚未休息过时展示，
  // 「继续复习」记录已休息的位置，避免用 effect 驱动状态（级联渲染）
  const [breakDismissedAt, setBreakDismissedAt] = useState<number | null>(null);
  // 会话接续：从存档恢复的位置（null = 全新会话）
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  // 今日进度（来自 /api/review/today，北京时区口径，与首页一致）
  const [todayMeta, setTodayMeta] = useState<{ reviewedToday: number; todayPlan: number } | null>(null);
  // 本会话新作答的词（今日已完成 = reviewedToday + 这里去重后的新增）
  const [todayAnswered, setTodayAnswered] = useState<Set<string>>(() => new Set());
  const [wasEndedEarly, setWasEndedEarly] = useState(false);
  // 学习阶梯：忘了的词在本会话内重学，记录每个词已重学次数，避免无限循环
  const [relearnCount, setRelearnCount] = useState<Record<string, number>>({});
  // 原始今日计划数（不含重学追加），用于顶部展示
  const [planCount, setPlanCount] = useState(0);
  const [sessionResults, setSessionResults] = useState<{ known: number; vague: number; forgot: number }>({ known: 0, vague: 0, forgot: 0 });
  const [nonForgotCount, setNonForgotCount] = useState(0);
  const [isSpelling, setIsSpelling] = useState(false);
  const [spellingInput, setSpellingInput] = useState("");
  const [spellingChecked, setSpellingChecked] = useState(false);
  const [spellingCorrect, setSpellingCorrect] = useState(false);
  // 拼写验证：随机间隔触发（约每 3~6 个非忘词一次），避免固定节奏可被预期
  const [nextSpellingAt, setNextSpellingAt] = useState(() => 3 + Math.floor(Math.random() * 4));
  // 拼写只作练习反馈，单独统计，不写入 SRS 调度（拼写对错 ≠ 认不认识）
  const [spellingStats, setSpellingStats] = useState({ right: 0, wrong: 0 });
  const LAST_SESSION_KEY = "zhumo_last_session";
  const MAX_RELEARN = 2; // 忘了的词在本会话内最多重学 2 次

  // 从 localStorage 读取上次复习数据
  const [lastSession, setLastSession] = useState<{
    date: string;
    known: number;
    vague: number;
    forgot: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    // 挂载后再读 localStorage：SSR 首帧保持 null，避免 hydration mismatch
    try {
      const raw = localStorage.getItem(LAST_SESSION_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setLastSession(JSON.parse(raw));
    } catch {}
  }, []);

  // 埋点：会话开始/结束各上报一次（ref 防止 StrictMode 重挂载与状态变化导致重复上报）
  const trackedStartRef = useRef(false);
  const trackedCompleteRef = useRef(false);

  useEffect(() => {
    if (loading || isDemo || items.length === 0 || trackedStartRef.current) return;
    trackedStartRef.current = true;
    trackEvent(ANALYTICS_EVENTS.reviewSessionStart, { wordCount: items.length, mode });
  }, [loading, isDemo, items.length, mode]);

  useEffect(() => {
    if (items.length === 0 || index < items.length || trackedCompleteRef.current) return;
    trackedCompleteRef.current = true;
    if (isDemo) {
      trackEvent(ANALYTICS_EVENTS.demoSessionComplete);
      return;
    }
    trackEvent(ANALYTICS_EVENTS.reviewSessionComplete, {
      total: sessionResults.known + sessionResults.vague + sessionResults.forgot,
      known: sessionResults.known,
      vague: sessionResults.vague,
      forgot: sessionResults.forgot,
      endedEarly: wasEndedEarly,
      mode,
    });
  }, [index, items.length, isDemo, sessionResults, wasEndedEarly, mode]);

  // 复习完成时保存本轮数据
  useEffect(() => {
    if (index < items.length || items.length === 0 || isDemo) return;
    const total = sessionResults.known + sessionResults.vague + sessionResults.forgot;
    if (total === 0) return;
    try {
      localStorage.setItem(
        LAST_SESSION_KEY,
        JSON.stringify({
          date: beijingDateStr(),
          known: sessionResults.known,
          vague: sessionResults.vague,
          forgot: sessionResults.forgot,
          total,
        })
      );
    } catch {}
  }, [index, items.length, isDemo, sessionResults]);

  // 会话进度存档：每答一题写入，重开页面可接续；本轮完成时清档
  // （此时服务端列表已收缩，下次自然从新列表的第一个词开始）
  useEffect(() => {
    if (loading || isDemo || items.length === 0) return;
    if (index >= items.length) {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {}
      return;
    }
    const payload: SavedSession = {
      date: new Date().toISOString().slice(0, 10),
      mode,
      items: items.map((i) => i.wordId),
      index,
      sessionResults,
      relearnCount,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {}
  }, [loading, isDemo, items, index, mode, sessionResults, relearnCount]);

  // 计算本次与上次的对比
  function getSessionComparison() {
    if (!lastSession || lastSession.known === undefined) return null;
    const total = sessionResults.known + sessionResults.vague + sessionResults.forgot;
    const lastKnownRate = lastSession.total > 0 ? Math.round((lastSession.known / lastSession.total) * 100) : 0;
    const thisKnownRate = total > 0 ? Math.round((sessionResults.known / total) * 100) : 0;
    const delta = thisKnownRate - lastKnownRate;
    return { lastKnownRate, thisKnownRate, delta, lastDate: lastSession.date };
  }

  const trySync = useCallback(async () => {
    const { remaining } = await syncQueue();
    setPendingCount(remaining);
  }, []);

  // —— 会话进度接续 ——
  // 存档按 wordId 对齐而不是按 index 硬套：
  // - 队列尚未同步（列表未收缩）→ 直接恢复到上次的位置
  // - 队列已同步（列表已收缩）→ 跳过已答词，从第一个未答词继续
  function tryRestoreSession(list: ReviewItem[], sessionMode: "normal" | "stubborn") {
    let saved: SavedSession | null = null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) saved = JSON.parse(raw) as SavedSession;
    } catch {}
    if (!saved || saved.date !== beijingDateStr()) return;
    if (saved.mode !== sessionMode || !saved.items?.length) return;

    const restoredIndex = resumeIndex(
      list.map((w) => w.wordId),
      saved.items,
      saved.index,
    );
    if (restoredIndex <= 0) return; // 没有可恢复的进度（全新会话）

    setIndex(restoredIndex);
    setSessionResults(saved.sessionResults || { known: 0, vague: 0, forgot: 0 });
    setRelearnCount(saved.relearnCount || {});
    setResumeFrom(restoredIndex);
  }

  function restartSession() {
    setResumeFrom(null);
    setBreakDismissedAt(null);
    setIndex(0);
    setSessionResults({ known: 0, vague: 0, forgot: 0 });
    setRelearnCount({});
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 专项攻克模式：?mode=stubborn，只刷顽固词（不缓存、无 demo 回退）
      const attackMode = new URLSearchParams(window.location.search).get("mode") === "stubborn";
      if (attackMode) setMode("stubborn");

      try {
        const res = await fetch(attackMode ? "/api/review/stubborn" : "/api/review/today");
        if (!res.ok) throw new Error("fetch failed");
        const data: TodayResponse = await res.json();
        const list = (data.items || []) as ReviewItem[];
        if (!cancelled) {
          if (list.length > 0) {
            setItems(list);
            setPlanCount(list.length);
            setIsDemo(false);
            setTodayMeta(
              data.reviewedToday != null && data.todayPlan != null
                ? { reviewedToday: data.reviewedToday, todayPlan: data.todayPlan }
                : null,
            );
            tryRestoreSession(list, attackMode ? "stubborn" : "normal");
          } else {
            // 已登录但无待复习词：不降级到 demo，展示空状态
            setItems([]);
            setPlanCount(0);
            setIsDemo(false);
          }
          setIsOffline(false);
        }
        // 缓存到 IndexedDB 备用（专项队列为动态生成，不缓存）
        if (!attackMode) saveReviewItems(list);
      } catch {
        if (attackMode) {
          if (!cancelled) {
            setItems([]);
            setPlanCount(0);
            setIsOffline(true);
          }
        } else {
          // API 失败：先检查是否网络问题（离线缓存），否则就是游客（demo 模式）
          const cached = (await getCachedReviewItems()) as ReviewItem[];
          if (!cancelled && cached.length > 0) {
            setItems(cached);
            setPlanCount(cached.length);
            setIsOffline(true);
            setIsDemo(false);
            // 缓存词表同样支持接续：上次答过的词直接跳过
            tryRestoreSession(cached, attackMode ? "stubborn" : "normal");
          } else if (!cancelled) {
            // 游客模式：使用预置 demo 词库
            setItems(DEMO_WORDS.map(demoToReviewItem));
            setPlanCount(DEMO_WORDS.length);
            setIsDemo(true);
            setIsOffline(false);
          }
        }
      }
      if (!cancelled) setLoading(false);
    }

    // 先冲刷上次会话遗留的答题队列，再拉今日列表：
    // 否则队列里尚未同步的结果会让本次列表仍包含已复习过的词（表现为"重复复习"）
    (async () => {
      await trySync();
      if (!cancelled) await load();
    })();

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

      // 记录本轮结果
      setSessionResults((prev) => ({ ...prev, [result]: prev[result] + 1 }));

      // 跳过提交动画直接切词，已知/模糊
      const isForgot = result === "forgot";
      setRevealed(false);
      if (!isForgot) {
        const nextCount = nonForgotCount + 1;
        setNonForgotCount(nextCount);
        // 到达随机阈值时触发一次拼写验证
        if (!isDemo && nextCount >= nextSpellingAt) {
          setIsSpelling(true);
          setSpellingChecked(false);
          setSpellingInput("");
          return; // 不推进 index，等待拼写完成
        }
        setIndex((prev) => prev + 1);
      }

      // 游客模式：不调 API
      if (isDemo) {
        if (isForgot) setPausing(true);
        return;
      }

      // 写入模型：先持久化入队（关页/断网都不丢），再后台冲刷到服务端。
      // 旧模型"直接 fetch、失败才入队"在挂起的请求随页面关闭时会静默丢结果，
      // 导致服务端进度不推进、下次重开重复复习同样的词。
      // 提交幂等（clientResultId），队列重复同步无副作用。
      const clientResultId = newClientResultId();
      await enqueueSubmit({ wordId: current.wordId, result, clientResultId });
      setPendingCount((prev) => prev + 1);
      // 今日进度（去重）：同一词的会话内重学不重复计
      setTodayAnswered((prev) => {
        if (prev.has(current.wordId)) return prev;
        const next = new Set(prev);
        next.add(current.wordId);
        return next;
      });
      void trySync();

      // 忘了：学习阶梯——本会话内重学（最多 MAX_RELEARN 次），再展示「再看看」
      if (isForgot) {
        const count = relearnCount[current.wordId] || 0;
        if (count < MAX_RELEARN) {
          setItems((prev) => [...prev, current]);
          setRelearnCount((prev) => ({ ...prev, [current.wordId]: count + 1 }));
        }
        setPausing(true);
      }
    },
    [items, index, trySync, isDemo, nonForgotCount, relearnCount, nextSpellingAt]
  );

  // 拼写验证：用户输入单词后提交。只作练习反馈，不计入 SRS 调度。
  async function handleSpelling() {
    const current = items[index];
    if (!current) return;
    const userAnswer = spellingInput.trim();
    const correctAnswer = current.displayText.trim();
    const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();

    setSpellingChecked(true);
    setSpellingCorrect(isCorrect);

    setSpellingStats((prev) =>
      isCorrect ? { ...prev, right: prev.right + 1 } : { ...prev, wrong: prev.wrong + 1 },
    );

    // 1.5s 后自动进入下一词
    setTimeout(() => {
      setIsSpelling(false);
      setSpellingChecked(false);
      setSpellingInput("");
      setIndex((prev) => prev + 1);
    }, 1500);
  }

  // 跳过拼写（按「想不起来」处理，同样不计入 SRS）
  function skipSpelling() {
    setSpellingChecked(true);
    setSpellingCorrect(false);
    setSpellingStats((prev) => ({ ...prev, wrong: prev.wrong + 1 }));

    setTimeout(() => {
      setIsSpelling(false);
      setSpellingChecked(false);
      setSpellingInput("");
      setIndex((prev) => prev + 1);
    }, 800);
  }
  useEffect(() => {
    if (!pausing) return;
    const timer = setTimeout(() => {
      setPausing(false);
      setIndex((prev) => prev + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [pausing]);

  // 每完成一个会话（50 张）暂停一次，避免注意力疲劳
  const atSessionBoundary =
    !isDemo && index > 0 && index < items.length && index % REVIEW_CAPS.sessionSize === 0;
  const showSessionBreak = atSessionBoundary && breakDismissedAt !== index;

  // 沉浸模式：会话进行中隐藏全局底部导航，✕ 结束后自动恢复
  const sessionActive = !loading && items.length > 0 && index < items.length && !showSessionBreak;
  useEffect(() => {
    document.body.classList.toggle("review-immersive", sessionActive);
    return () => document.body.classList.remove("review-immersive");
  }, [sessionActive]);

  // 切词后回到顶部：上一张卡片的滚动位置不应残留到下一张
  useEffect(() => {
    if (sessionActive) window.scrollTo(0, 0);
  }, [index, sessionActive]);

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
    const isAttack = mode === "stubborn";
    return (
      <main className="container fade-in">
        <div className="card empty-state">
          <span className="empty-state-icon">
            {isAttack ? <IconSparkles /> : <IconCheckCircle />}
          </span>
          <h1 className="empty-state-title">
            {isAttack ? "暂时没有需要攻克的顽固词" : "今天没有待复习的词"}
          </h1>
          <p className="empty-state-text">
            {isAttack
              ? "坚持复习，顽固词池在缩小。继续按每日计划推进即可。"
              : "可以先去录入几个今天遇到的生词。"}
          </p>
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
            <span className="empty-state-icon"><IconSparkles /></span>
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
          <div className="card stack review-summary" style={{ textAlign: "center" }}>
            <span className="empty-state-icon">{wasEndedEarly ? <IconPause /> : <IconSparkles />}</span>
            <h1 className="empty-state-title">{wasEndedEarly ? "复习已暂停" : mode === "stubborn" ? "攻克完成" : "今天复习完成"}</h1>
            <p className="empty-state-text">
              {wasEndedEarly
                ? `已完成 ${Math.min(index, planCount)}/${planCount} 个`
                : mode === "stubborn"
                  ? `本次 ${planCount} 个顽固词已全部过完，正确率见下方统计`
                  : `今日计划 ${planCount} 个词已全部完成`}
              {items.length > planCount && (
                <>
                  <br />
                  其中 {items.length - planCount} 次为不熟悉词的当场重学
                </>
              )}
            </p>
            {wasEndedEarly && index < planCount && (
              <p className="muted" style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)" }}>
                剩余 {planCount - index} 个词排队明天复习，建议尽早完成以避免记忆断裂
              </p>
            )}
            {(sessionResults.known > 0 || sessionResults.vague > 0 || sessionResults.forgot > 0) && (
              <div className="review-summary-row">
                <div className="review-summary-chip known">
                  <IconThumbsUp /> 认识 {sessionResults.known}
                </div>
                <div className="review-summary-chip vague">
                  <IconHelp /> 模糊 {sessionResults.vague}
                </div>
                <div className="review-summary-chip forgot">
                  <IconX /> 不会 {sessionResults.forgot}
                </div>
              </div>
            )}
            {(spellingStats.right > 0 || spellingStats.wrong > 0) && (
              <div className="review-summary-row">
                <div className="review-summary-chip known">
                  <IconCheckCircle /> 拼写对 {spellingStats.right}
                </div>
                <div className="review-summary-chip forgot">
                  <IconXCircle /> 拼写错 {spellingStats.wrong}
                </div>
              </div>
            )}
            {(() => {
              const comp = getSessionComparison();
              if (!comp) return null;
              return (
                <p className="muted" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                  {comp.delta > 0
                    ? `认识率比上次（${comp.lastDate}）提升了 ${comp.delta}%，继续保持！`
                    : comp.delta < 0
                      ? `认识率比上次下降了 ${Math.abs(comp.delta)}%，下次集中攻克错词`
                      : `认识率与上次持平，稳步推进中`}
                </p>
              );
            })()}
            <div className="link-row">
              <Link href="/" className="link-button">返回首页</Link>
              {!wasEndedEarly && (
                <Link href="/manual" className="link-button secondary">继续录词</Link>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }

  // 会话休息：每完成 sessionSize 张暂停一次
  if (showSessionBreak) {
    return (
      <main className="container fade-in">
        <div className="card empty-state">
          <span className="empty-state-icon"><IconSparkles /></span>
          <h1 className="empty-state-title">这一轮完成了</h1>
          <p className="empty-state-text">
            已完成 {index} / {items.length} 个，休息一下再继续吧。
          </p>
          <div className="link-row">
            <button className="link-button" onClick={() => setBreakDismissedAt(index)}>
              继续复习
            </button>
            <button className="link-button secondary" onClick={endSession}>
              提前结束
            </button>
          </div>
        </div>
      </main>
    );
  }

  const current = items[index];
  const commonMeanings = (current.meanings || []).filter((m) => !m.isObscure);
  const obscureMeanings = (current.meanings || []).filter((m) => m.isObscure);
  const meaningEx = (current.meanings || []).find((m) => m.exampleSentence);
  const example = current.exampleSentence || meaningEx?.exampleSentence;
  // 义项层级：主释义 + 前 2 条平铺、熟词僻义带标直出（考研考点不折叠），
  // 仅第 3 条之后的冷门常见义与近义词/来源信息折叠
  const shownMeanings = commonMeanings.slice(0, 2);
  const extraCommon = commonMeanings.slice(2);
  const hiddenCount = extraCommon.length;
  const hasExtras =
    hiddenCount > 0 ||
    (current.synonyms?.length ?? 0) > 0 ||
    Boolean(current.sourceType || current.sourceNote);

  // 顶栏进度与首页同口径（今日已完成/今日计划）：列表收缩后的「本轮位置 1/2」
  // 会让用户误以为进度丢失，统一用今日口径才能与首页数字对上。
  // 演示/专项模式无今日口径，回落本轮位置。
  const dayProgress =
    todayMeta && mode !== "stubborn"
      ? {
          done: Math.min(todayMeta.reviewedToday + todayAnswered.size, todayMeta.todayPlan),
          total: todayMeta.todayPlan,
        }
      : null;
  const progressNow = dayProgress ? dayProgress.done : index;
  const progressTotal = dayProgress ? dayProgress.total : items.length;

  return (
    <main className="review-shell fade-in">
      {/* 顶栏：结束入口 + 进度条 + 计数 */}
      <header className="review-top">
        <button
          className="review-exit"
          aria-label="提前结束本轮"
          title="提前结束"
          onClick={() => {
            if (index === 0 || window.confirm(`确定提前结束本轮？已完成 ${index}/${items.length} 个。`)) {
              endSession();
            }
          }}
        >
          <IconX />
        </button>
        <div
          className="review-progress"
          role="progressbar"
          aria-label={dayProgress ? "今日复习进度" : "本轮复习进度"}
          aria-valuemin={0}
          aria-valuemax={progressTotal}
          aria-valuenow={progressNow}
        >
          <div
            className="review-progress-fill"
            style={{ width: `${Math.min(100, (progressNow / Math.max(1, progressTotal)) * 100)}%` }}
          />
        </div>
        <span className="review-counter">
          {dayProgress ? `${dayProgress.done} / ${dayProgress.total}` : `${index + 1} / ${items.length}`}
        </span>
      </header>

      {/* 状态条：按优先级只显示一条，替代原先堆叠的横幅 */}
      {isOffline ? (
        <p className="review-status is-warn">● 离线模式 · 答题已本地保存，联网后自动同步</p>
      ) : resumeFrom !== null ? (
        <p className="review-status">
          已接续上次进度，从第 {resumeFrom + 1} 个继续 ·
          <button className="review-status-action" onClick={restartSession}>从头开始</button>
        </p>
      ) : pendingCount > 0 ? (
        <p className="review-status">{pendingCount} 条答题结果将在联网后自动同步</p>
      ) : isDemo ? (
        <p className="review-status">体验模式 · 注册后解锁完整功能</p>
      ) : mode === "stubborn" ? (
        <p className="review-status">专项攻克模式 · 只刷反复记不住的词</p>
      ) : null}

      {/* 中部内容区：唯一可能滚动的区域；词卡是页面主体 */}
      <div className="review-body">
        <div className="review-stage">
          <div className={`review-stage-card${revealed && !isSpelling ? " is-revealed" : ""}`}>
            {!isSpelling && (
              <Link
                href={`/words/${current.wordId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="review-card-link"
                title="查看详情"
                aria-label="查看词详情"
              >
                <IconExternalLink />
              </Link>
            )}

            {isSpelling ? (
              <>
                <p className="review-stage-hint">看释义，拼出单词</p>
                <p className="review-hero-word is-clue">{current.meaningZh || "（该词暂无释义）"}</p>
                {current.phonetic && <p className="review-hero-phonetic">{current.phonetic}</p>}
              </>
            ) : (
              <>
                <h1 className="review-hero-word">{current.displayText}</h1>
                {revealed && current.phonetic && (
                  <p className="review-hero-phonetic">{current.phonetic}</p>
                )}
                <SpeakButton text={current.displayText} />
                {!revealed && <p className="review-stage-hint">回忆它的意思，再翻面核对</p>}
              </>
            )}
          </div>

          {revealed && !isSpelling && (
            <div className="review-answer">
              {/* 释义为注脚层：明显小于单词；熟词僻义带「僻」标直接亮出，考研考点不折叠 */}
              {shownMeanings.length > 0 || obscureMeanings.length > 0 ? (
                <div className="review-meanings-plain">
                  {shownMeanings.map((m, i) => (
                    <div key={i} className="review-meaning-row">
                      <span className="meta-chip">{m.partOfSpeech}</span>
                      <span className="review-meaning-text">{m.meaningZh}</span>
                    </div>
                  ))}
                  {obscureMeanings.map((m, i) => (
                    <div key={`o${i}`} className="review-meaning-row">
                      <span className="review-obscure-tag">僻</span>
                      <span className="meta-chip">{m.partOfSpeech}</span>
                      <span className="review-meaning-text">{m.meaningZh}</span>
                    </div>
                  ))}
                </div>
              ) : (
                current.meaningZh && (
                  <div className="review-meanings-plain">
                    <div className="review-meaning-row">
                      <span className="review-meaning-text">{current.meaningZh}</span>
                    </div>
                  </div>
                )
              )}

              {current.sourceContext && (
                <p className="review-context">&ldquo;{current.sourceContext}&rdquo;</p>
              )}

              {example && (
                <div className="review-example">
                  <p className="review-example-en">{example}</p>
                  {meaningEx?.exampleTranslation && (
                    <p className="review-example-zh">{meaningEx.exampleTranslation}</p>
                  )}
                </div>
              )}

              {hasExtras && (
                <details className="review-more">
                  <summary>{hiddenCount > 0 ? `+${hiddenCount} 条义项` : "更多信息"}</summary>
                  <div className="review-more-body">
                    {extraCommon.map((m, i) => (
                      <div key={`c${i}`} className="meaning-item-sm">
                        <span className="meta-chip">{m.partOfSpeech}</span>
                        <span className="meaning-zh-sm">{m.meaningZh}</span>
                      </div>
                    ))}
                    {(current.synonyms?.length ?? 0) > 0 && (
                      <div className="review-synonyms">
                        <span className="muted">近义词：</span>
                        {current.synonyms!.map((s) => (
                          <span key={s} className="synonym-chip">{s}</span>
                        ))}
                      </div>
                    )}
                    {(current.sourceType || current.sourceNote) && (
                      <div className="review-meta">
                        {current.sourceType && (
                          <span className="meta-chip">来源：{SOURCE_LABELS[current.sourceType] || current.sourceType}</span>
                        )}
                        {current.sourceNote && <span className="muted">{current.sourceNote}</span>}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部动作栏：吸底拇指热区，任何时刻可及 */}
      <footer className="review-dock">
        {isSpelling ? (
          spellingChecked ? (
            <div className={`review-spell-result ${spellingCorrect ? "is-ok" : "is-bad"}`}>
              {spellingCorrect ? (
                <><IconCheckCircle /> 拼写正确！</>
              ) : (
                <>正确答案：{current.displayText}</>
              )}
            </div>
          ) : (
            <div className="review-spell-row">
              <input
                className="input"
                type="text"
                autoFocus
                placeholder="输入英文单词…"
                value={spellingInput}
                onChange={(e) => setSpellingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && spellingInput.trim()) handleSpelling();
                }}
                aria-label="拼写单词"
              />
              <button className="review-dock-btn primary" onClick={handleSpelling} disabled={!spellingInput.trim()}>
                提交
              </button>
              <button className="review-dock-skip" onClick={skipSpelling}>
                想不起来
              </button>
            </div>
          )
        ) : pausing ? (
          <div className="review-dock-stack">
            <p className="review-dock-caption">已标记为「不会」，2 秒后自动继续</p>
            <button
              className="review-dock-btn secondary"
              onClick={() => { setPausing(false); setIndex((prev) => prev + 1); }}
            >
              再看一眼
            </button>
          </div>
        ) : !revealed ? (
          <button className="review-dock-btn primary" onClick={() => setRevealed(true)}>
            显示答案
          </button>
        ) : (
          <div className="review-dock-actions">
            <button className="answer-btn known" onClick={() => submit("known")}>
              <span className="answer-emoji"><IconThumbsUp /></span>认识
            </button>
            <button className="answer-btn vague" onClick={() => submit("vague")}>
              <span className="answer-emoji"><IconHelp /></span>模糊
            </button>
            <button className="answer-btn forgot" onClick={() => submit("forgot")}>
              <span className="answer-emoji"><IconX /></span>不会
            </button>
          </div>
        )}
      </footer>
    </main>
  );
}
