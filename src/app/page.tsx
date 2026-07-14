import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserIdFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getHomeData(userId: string) {
  try {
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [
      totalWordsCount,
      dueCount,
      todayAddedCount,
      todayReviewedCount,
      recentWords,
      recentReviews,
      sourceDistribution,
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
        take: 15,
      }),
      prisma.review.findMany({
        where: { userId },
        include: { word: true },
        orderBy: { reviewedAt: "desc" },
        take: 15,
      }),
      prisma.wordSource.groupBy({
        where: { userId },
        by: ["sourceType"],
        _count: { sourceType: true },
        orderBy: { _count: { sourceType: "desc" } },
      }),
    ]);

    return {
      totalWordsCount,
      dueCount,
      todayAddedCount,
      todayReviewedCount,
      recentWords,
      recentReviews,
      sourceDistribution,
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
    };
  }
}

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题",
  reading: "阅读",
  lecture: "听课",
  manual: "手动",
  other: "其他",
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

  return (
    <main className="container">
      {/* User bar */}
      {user && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          <span>{user.email}</span>
          <a href="/api/auth/login" className="link-button" onClick={async (e) => { e.preventDefault(); await fetch("/api/auth/login", { method: "DELETE" }); window.location.href = "/login"; }}>退出</a>
        </div>
      )}

      {/* Hero */}
      <section className="hero-card-home">
        <p className="hero-brand">竹墨词库</p>
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

      {/* Stats */}
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

      {/* 竹节分隔 */}
      <div className="bamboo-divider">
        <span className="bamboo-divider-icon" />
      </div>

      {/* 最近 */}
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

      {/* 来源分布 */}
      {data.sourceDistribution.length > 0 && (
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
