import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserIdFromCookies } from "@/lib/auth";
import { calculateStreak, countMasteredWords } from "@/lib/stats";
import { getSprintInfo, type SprintInfo } from "@/lib/sprint";
import { WeeklyTrendChart } from "./weekly-trend-chart";
import { ReviewHeatmap } from "./ui/review-heatmap";
import LogoutButton from "./ui/logout-button";
import EmailReminder from "./ui/email-reminder";
import ExamSprintCard from "./ui/exam-sprint-card";
import ImportKaoyanButton from "./import-kaoyan-button";
import { DEMO_WORDS } from "@/lib/demo-words";

export const dynamic = "force-dynamic";

async function getHomeData(userId: string, sprint: SprintInfo) {
  try {
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalWordsCount,
      dueNewCount,
      dueReviewCount,
      todayAddedCount,
      todayReviewedCount,
      recentWords,
      recentReviews,
      sourceDistribution,
      weeklyKnownCount,
      weeklyTotalCount,
      stubbornWords,
      masteredCount,
    ] = await Promise.all([
      prisma.word.count({ where: { userId } }),
      // 到期词拆分统计：新词/旧词分别受冲刺配额约束，与 /api/review/today 一致
      prisma.reviewSchedule.count({
        where: { userId, nextReviewAt: { lte: now }, reviewCount: 0 },
      }),
      prisma.reviewSchedule.count({
        where: { userId, nextReviewAt: { lte: now }, reviewCount: { gt: 0 } },
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
      countMasteredWords(userId),
    ]);

    const weeklyKnownRate =
      weeklyTotalCount > 0 ? Math.round((weeklyKnownCount / weeklyTotalCount) * 100) : 0;

    // 连续打卡天数（共享实现，与 /api/stats/weekly 保持一致）
    const streak = await calculateStreak(userId, now);

    const dueCount = dueNewCount + dueReviewCount;
    const todayPlan =
      Math.min(dueNewCount, sprint.caps.newPerDay) +
      Math.min(dueReviewCount, sprint.caps.reviewPerDay);
    const remainingDue = Math.max(0, dueCount - todayPlan);

    return {
      totalWordsCount,
      dueCount,
      todayPlan,
      remainingDue,
      todayAddedCount,
      todayReviewedCount,
      recentWords,
      recentReviews,
      sourceDistribution,
      weeklyTotalCount,
      weeklyKnownRate,
      stubbornWords,
      streak,
      masteredCount,
    };
  } catch (error) {
    console.error("homepage data fetch failed:", error);
    return {
      totalWordsCount: 0,
      dueCount: 0,
      todayPlan: 0,
      remainingDue: 0,
      todayAddedCount: 0,
      todayReviewedCount: 0,
      recentWords: [],
      recentReviews: [],
      sourceDistribution: [],
      weeklyTotalCount: 0,
      weeklyKnownRate: 0,
      stubbornWords: [],
      streak: 0,
      masteredCount: 0,
    };
  }
}

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题", reading: "阅读", lecture: "听课", manual: "手动",
  longSentence: "长难句", translation: "翻译", other: "其他",
};

export default async function HomePage() {
  let userId: string | null = null;
  let user: { email: string; examDate: Date | null } | null = null;

  try {
    userId = await getUserIdFromCookies();
    user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, examDate: true },
        })
      : null;
  } catch (e: any) {
    return (
      <main className="container">
        <div className="card">
          <h1 className="title">竹墨词库</h1>
          <p className="error-text pre-wrap">
            用户查询失败: {String(e?.message || e)}
          </p>
          <a href="/login" className="button">重新登录</a>
        </div>
      </main>
    );
  }

  let data: Awaited<ReturnType<typeof getHomeData>>;
  const sprint = getSprintInfo(user?.examDate);
  try {
    data = userId
      ? await getHomeData(userId, sprint)
      : {
          totalWordsCount: 0,
          dueCount: 0,
          todayPlan: 0,
          remainingDue: 0,
          todayAddedCount: 0,
          todayReviewedCount: 0,
          recentWords: [],
          recentReviews: [],
          sourceDistribution: [],
          weeklyTotalCount: 0,
          weeklyKnownRate: 0,
          stubbornWords: [],
          streak: 0,
          masteredCount: 0,
        };
  } catch (e: any) {
    return (
      <main className="container">
        <div className="card">
          <h1 className="title">竹墨词库</h1>
          <p className="error-text pre-wrap">
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
        <div className="user-bar">
          <span>{user.email}</span>
          <LogoutButton />
        </div>
      ) : (
        <div className="user-bar">
          <Link href="/login" className="login-link">
            登录 / 注册
          </Link>
        </div>
      )}

      {/* Hero */}
      {isGuest ? (
        <section className="hero-card-home">
          <p className="hero-brand">竹墨词库</p>
          <p className="hero-due-count">{DEMO_WORDS.length}</p>
          <p className="hero-due-label">个考研预置词，免费体验</p>
          <p className="hero-due-hint">拍照速录生词 · 间隔记忆 · 考前冲刺计划</p>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M13.5 0.67s0.74 2.65 0.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l0.03-0.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5 0.67z" fill="#fde68a" />
              </svg>
              已连续打卡 <strong>{data.streak}</strong> 天
            </p>
          )}
          {data.todayPlan > 0 ? (
            <>
              <p className="hero-due-count">{data.todayPlan}</p>
              <p className="hero-due-label">个词 · 今日计划</p>
              <p className="hero-due-hint">
                今日已复习 {data.todayReviewedCount} / {data.todayPlan}
                {data.remainingDue > 0
                  ? ` · 还有 ${data.remainingDue} 个往期词顺延到之后`
                  : " · 完成后即可休息"}
              </p>
            </>
          ) : (
            <>
              <p className="hero-due-label">今天没有待复习</p>
              <p className="hero-due-hint mt-1">
                可以去录入新词，或者明天再来
              </p>
            </>
          )}
          <div className="hero-btns">
            <Link href="/review" className="hero-btn-primary">开始复习</Link>
            <Link href="/manual" className="hero-btn-secondary">手动录词</Link>
            <Link href="/capture" className="hero-btn-secondary">拍照录词</Link>
          </div>
        </section>
      )}

      {/* 考前冲刺计划（仅登录用户） */}
      {!isGuest && (
        <ExamSprintCard
          examDate={user.examDate ? user.examDate.toISOString().slice(0, 10) : null}
          sprint={sprint}
        />
      )}

      {/* 每日复习提醒 */}
      {!isGuest && <EmailReminder />}

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
          <div className="home-stat-card is-mastered">
            <span
              className="home-stat-num"
              title={data.totalWordsCount > 0 ? `掌握率 ${Math.round((data.masteredCount / data.totalWordsCount) * 100)}%` : undefined}
            >
              {data.masteredCount}
            </span>
            <span className="home-stat-label">已掌握</span>
          </div>
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

      {/* 新用户引导 */}
      {!isGuest && data.totalWordsCount === 0 && (
        <section className="onboarding card stack text-center">
          <h2 className="section-title">快速开始</h2>
          <div className="onboarding-steps">
            <div className="onboarding-step">
              <span className="onboarding-num">1</span>
              <p>手动录词<br />或拍照识别</p>
            </div>
            <div className="onboarding-arrow">→</div>
            <div className="onboarding-step">
              <span className="onboarding-num">2</span>
              <p>自动补全<br />词义与例句</p>
            </div>
            <div className="onboarding-arrow">→</div>
            <div className="onboarding-step">
              <span className="onboarding-num">3</span>
              <p>每日复习<br />科学间隔记忆</p>
            </div>
          </div>
          <p className="muted onboarding-hint">
            录入 5 个词后，统计卡片将自动激活。也可以一键导入考研核心词快速起步：
          </p>
          <div className="mt-3">
            <ImportKaoyanButton />
          </div>
        </section>
      )}

      {/* 竹节分隔 */}
      <div className="bamboo-divider">
        <span className="bamboo-divider-icon" />
      </div>

      {/* 本周复习效率（仅登录用户） */}
      {!isGuest && (
        <section className="card card-compact mb-4">
          <h2 className="home-section-title">本周复习</h2>
          <div className="stat-row">
            <div>
              <span className="stat-num">
                {data.weeklyTotalCount}
              </span>
              <span className="stat-unit">
                次复习
              </span>
            </div>
            <div>
              <span className={`stat-num ${data.weeklyKnownRate >= 60 ? "is-good" : "is-warn"}`}>
                {data.weeklyKnownRate}%
              </span>
              <span className="stat-unit">
                认识率
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 学习趋势图（仅登录用户） */}
      {!isGuest && <WeeklyTrendChart />}

      {/* 打卡热力图（仅登录用户） */}
      {!isGuest && <ReviewHeatmap />}

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
                <span className="home-word-tag">无限词库</span>
                <span className="home-word-tag">拍照录词</span>
                <span className="home-word-tag">间隔记忆</span>
                <span className="home-word-tag">考前冲刺</span>
                <span className="home-word-tag">学习统计</span>
              </div>
            </div>
          </section>

          {/* 游客注册引导 */}
          <div className="card text-center mt-4">
            <p className="cta-text">
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
        <section className="card card-compact mt-4">
          <div className="home-col-header">
            <h2 className="home-section-title">顽固词 · 集中攻克</h2>
            <div className="home-col-actions">
              <Link href="/review?mode=stubborn" className="home-col-more">专项攻克 →</Link>
              <Link href="/words/stubborn" className="home-col-more">全部 →</Link>
            </div>
          </div>
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
