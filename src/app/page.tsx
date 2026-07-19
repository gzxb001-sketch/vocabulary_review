import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserIdFromCookies } from "@/lib/auth";
import LogoutButton from "./ui/logout-button";
import { DEMO_WORDS } from "@/lib/demo-words";

export const dynamic = "force-dynamic";

async function getHomeData(userId: string) {
  try {
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalWordsCount,
      dueCount,
      todayAddedCount,
      todayReviewedCount,
      recentWords,
      recentReviews,
      sourceDistribution,
      weeklyKnownCount,
      weeklyTotalCount,
      stubbornWords,
    ] = await Promise.all([
      prisma.word.count({ where: { userId } }),
      prisma.reviewSchedule.count({
        where: { userId, nextReviewAt: { lte: now } },
      }),
      prisma.word.count({
        where: { userId, createdAt: { gte: startOfToday } },
      }),
      prisma.review.count({
        where: { userId, reviewedAt: { gte: startOfToday, lt: endOfToday } },
      }),
      prisma.word.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { sources: { orderBy: { createdAt: "desc" }, take: 1 }, schedule: { where: { userId } } },
        take: 10,
      }),
      prisma.review.findMany({
        where: { userId },
        include: { word: true },
        orderBy: { reviewedAt: "desc" },
        take: 10,
      }),
      prisma.wordSource.groupBy({
        where: { userId },
        by: ["sourceType"],
        _count: { sourceType: true },
        orderBy: { _count: { sourceType: "desc" } },
      }),
      // 本周认识次数
      prisma.review.count({
        where: { userId, reviewResult: "known", reviewedAt: { gte: sevenDaysAgo } },
      }),
      // 本周总复习次数
      prisma.review.count({
        where: { userId, reviewedAt: { gte: sevenDaysAgo } },
      }),
      // 顽固词：easeScore 最低 + reviewCount 最高的 top 5
      prisma.reviewSchedule.findMany({
        where: { userId, reviewCount: { gt: 2 } },
        include: { word: { select: { id: true, displayText: true, meaningZh: true } } },
        orderBy: [{ easeScore: "asc" }, { reviewCount: "desc" }],
        take: 5,
      }),
    ]);

    const weeklyKnownRate =
      weeklyTotalCount > 0 ? Math.round((weeklyKnownCount / weeklyTotalCount) * 100) : 0;

    // 连续打卡天数
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const allReviews = await prisma.review.findMany({
      where: { userId, reviewedAt: { gte: ninetyDaysAgo } },
      select: { reviewedAt: true },
      orderBy: { reviewedAt: "desc" },
    });
    const reviewDays = new Set<string>();
    for (const r of allReviews) {
      const d = new Date(r.reviewedAt);
      reviewDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    let streak = 0;
    const checkDate = new Date(now);
    const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (!reviewDays.has(todayKey)) checkDate.setDate(checkDate.getDate() - 1);
    for (let i = 0; i < 90; i++) {
      const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (reviewDays.has(key)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }

    return {
      totalWordsCount,
      dueCount,
      todayAddedCount,
      todayReviewedCount,
      recentWords,
      recentReviews,
      sourceDistribution,
      weeklyTotalCount,
      weeklyKnownRate,
      stubbornWords,
      streak,
    };
  } catch (error) {
    console.error("homepage data fetch failed:", error);
    return {
      totalWordsCount: 0,
      dueCount: 0,
      todayAddedCount: 0,
      todayReviewedCount: 0,
      recentWords: [],
      recentReviews: [],
      sourceDistribution: [],
      weeklyTotalCount: 0,
      weeklyKnownRate: 0,
      stubbornWords: [],
      streak: 0,
    };
  }
}

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题", reading: "阅读", lecture: "听课", manual: "手动",
  longSentence: "长难句", translation: "翻译", other: "其他",
};

export default async function HomePage() {
  let userId: string | null = null;
  let user: { email: string } | null = null;

  try {
    userId = await getUserIdFromCookies();
    user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        })
      : null;
  } catch (e: any) {
    return (
      <main className="container">
        <div className="card">
          <h1 className="title">竹墨词库</h1>
          <p className="muted" style={{ color: "#dc2626", whiteSpace: "pre-wrap" }}>
            用户查询失败: {String(e?.message || e)}
          </p>
          <a href="/login" className="button">重新登录</a>
        </div>
      </main>
    );
  }

  let data: Awaited<ReturnType<typeof getHomeData>>;
  try {
    data = userId
      ? await getHomeData(userId)
      : {
          totalWordsCount: 0,
          dueCount: 0,
          todayAddedCount: 0,
          todayReviewedCount: 0,
          recentWords: [],
          recentReviews: [],
          sourceDistribution: [],
          weeklyTotalCount: 0,
          weeklyKnownRate: 0,
          stubbornWords: [],
          streak: 0,
        };
  } catch (e: any) {
    return (
      <main className="container">
        <div className="card">
          <h1 className="title">竹墨词库</h1>
          <p className="muted" style={{ color: "#dc2626", whiteSpace: "pre-wrap" }}>
            数据加载失败: {String(e?.message || e)}
          </p>
          <a href="/login" className="button">重新登录</a>
        </div>
      </main>
    );
  }

  const isGuest = !user;

  return (
    <main className="container">
      {/* User bar */}
      {user ? (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          <span>{user.email}</span>
          <LogoutButton />
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-2)" }}>
          <Link href="/login" style={{ fontSize: "var(--text-sm)", color: "var(--color-primary)", fontWeight: "var(--font-semibold)" }}>
            登录 / 注册
          </Link>
        </div>
      )}

      {/* Hero */}
      {isGuest ? (
        <section className="hero-card-home">
          <p className="hero-brand">竹墨词库</p>
          <p className="hero-due-count">{DEMO_WORDS.length}</p>
          <p className="hero-due-label">个预置词，免费体验</p>
          <div className="hero-btns">
            <Link href="/review" className="hero-btn-primary">开始体验</Link>
            <Link href="/login" className="hero-btn-secondary">注册账号</Link>
          </div>
        </section>
      ) : (
        <section className="hero-card-home">
          <p className="hero-brand">竹墨词库</p>
          {data.streak > 1 && (
            <p className="hero-streak">
              🔥 已连续打卡 <strong>{data.streak}</strong> 天
            </p>
          )}
          {data.dueCount > 0 ? (
            <>
              <p className="hero-due-count">{data.dueCount}</p>
              <p className="hero-due-label">个词待复习</p>
            </>
          ) : (
            <p className="hero-due-label">今天没有待复习</p>
          )}
          <div className="hero-btns">
            <Link href="/review" className="hero-btn-primary">开始复习</Link>
            <Link href="/manual" className="hero-btn-secondary">手动录词</Link>
            <Link href="/capture" className="hero-btn-secondary">拍照录词</Link>
          </div>
        </section>
      )}

      {/* Stats */}
      {isGuest ? (
        <section className="home-stats-row">
          <div className="home-stat-card">
            <span className="home-stat-num">{DEMO_WORDS.length}</span>
            <span className="home-stat-label">预置词条</span>
          </div>
          <div className="home-stat-card is-due">
            <span className="home-stat-num">{DEMO_WORDS.length}</span>
            <span className="home-stat-label">可体验</span>
          </div>
          <div className="home-stat-card">
            <span className="home-stat-num">∞</span>
            <span className="home-stat-label">间隔复习</span>
          </div>
          <div className="home-stat-card">
            <span className="home-stat-num">OCR</span>
            <span className="home-stat-label">拍照录词</span>
          </div>
        </section>
      ) : (
        <section className="home-stats-row">
          <div className="home-stat-card">
            <span className="home-stat-num">{data.totalWordsCount}</span>
            <span className="home-stat-label">词条总数</span>
          </div>
          <div className="home-stat-card is-due">
            <span className="home-stat-num">{data.dueCount}</span>
            <span className="home-stat-label">待复习</span>
          </div>
          <div className="home-stat-card">
            <span className="home-stat-num">{data.todayAddedCount}</span>
            <span className="home-stat-label">今日新增</span>
          </div>
          <div className="home-stat-card">
            <span className="home-stat-num">{data.todayReviewedCount}</span>
            <span className="home-stat-label">今日复习</span>
          </div>
        </section>
      )}

      {/* 竹节分隔 */}
      <div className="bamboo-divider">
        <span className="bamboo-divider-icon" />
      </div>

      {/* 本周复习效率（仅登录用户） */}
      {!isGuest && (
        <section className="card" style={{ marginBottom: "var(--space-4)", padding: "var(--space-4)" }}>
          <h2 className="home-section-title">本周复习</h2>
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--color-primary)" }}>
                {data.weeklyTotalCount}
              </span>
              <span style={{ marginLeft: "var(--space-1)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
                次复习
              </span>
            </div>
            <div>
              <span style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: data.weeklyKnownRate >= 60 ? "var(--color-success, #16a34a)" : "var(--color-warning, #ca8a04)" }}>
                {data.weeklyKnownRate}%
              </span>
              <span style={{ marginLeft: "var(--space-1)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
                认识率
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 最近 */}
      {isGuest ? (
        <>
          <section className="home-two-col">
            <div className="card home-col-card">
              <div className="home-col-header">
                <h2 className="home-section-title">预置体验词</h2>
              </div>
              <div className="home-tag-cloud">
                {DEMO_WORDS.map((word) => (
                  <Link key={word.wordId} href="/review" className="home-word-tag">
                    {word.displayText}
                  </Link>
                ))}
              </div>
            </div>

            <div className="card home-col-card">
              <div className="home-col-header">
                <h2 className="home-section-title">注册后解锁</h2>
              </div>
              <div className="home-tag-cloud">
                <span className="home-word-tag">📚 无限词库</span>
                <span className="home-word-tag">📸 拍照录词</span>
                <span className="home-word-tag">📊 学习统计</span>
                <span className="home-word-tag">🔄 间隔记忆</span>
              </div>
            </div>
          </section>

          {/* 游客注册引导 */}
          <div className="card" style={{ marginTop: "var(--space-4)", textAlign: "center", padding: "var(--space-6)" }}>
            <p style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-secondary)", fontSize: "var(--text-md)", lineHeight: "var(--leading-relaxed)" }}>
              注册账号即可拥有自己的专属词库，<br />拍照录词、间隔复习、数据永久保存。
            </p>
            <Link href="/login" className="link-button">免费注册</Link>
          </div>
        </>
      ) : (
        <section className="home-two-col">
          <div className="card home-col-card">
            <div className="home-col-header">
              <h2 className="home-section-title">最近新增</h2>
              <Link href="/words/recent" className="home-col-more">全部 →</Link>
            </div>
            {data.recentWords.length === 0 ? (
              <p className="empty-hint">还没有词条</p>
            ) : (
              <div className="home-tag-cloud">
                {data.recentWords.map((word) => (
                  <Link key={word.id} href={`/words/${word.id}`} className="home-word-tag">
                    {word.displayText}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card home-col-card">
            <div className="home-col-header">
              <h2 className="home-section-title">最近复习</h2>
              <Link href="/review" className="home-col-more">全部 →</Link>
            </div>
            {data.recentReviews.length === 0 ? (
              <p className="empty-hint">还没有复习记录</p>
            ) : (
              <div className="home-tag-cloud">
                {data.recentReviews.map((review) => (
                  <Link
                    key={review.id}
                    href={`/words/${review.word.id}`}
                    className={`home-word-tag tag-${review.reviewResult}`}
                  >
                    {review.word.displayText}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 顽固词 — 仅登录用户 */}
      {!isGuest && data.stubbornWords.length > 0 && (
        <section className="card" style={{ marginTop: "var(--space-4)", padding: "var(--space-4)" }}>
          <h2 className="home-section-title">顽固词 · 集中攻克</h2>
          <div className="home-tag-cloud">
            {data.stubbornWords.map((s) => (
              <Link key={s.wordId} href={`/words/${s.word.id}`} className="home-word-tag stubborn">
                {s.word.displayText}
                <span className="stubborn-badge" title={`复习${s.reviewCount}次 · 难度${s.easeScore.toFixed(1)}`}>
                  {s.reviewCount}次
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 来源分布 — 仅登录用户 */}
      {!isGuest && data.sourceDistribution.length > 0 && (
        <details className="source-detail">
          <summary className="source-detail-summary">来源分布</summary>
          <div className="source-tag-row">
            {data.sourceDistribution.map((item) => (
              <span key={item.sourceType} className="source-tag">
                {SOURCE_LABELS[item.sourceType] || item.sourceType}
                <em>{item._count.sourceType}</em>
              </span>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
