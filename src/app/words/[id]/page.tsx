import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserIdFromCookies } from "@/lib/auth";
import WordActions from "./word-actions";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  exam: "真题",
  reading: "阅读",
  lecture: "听课",
  manual: "手动",
  other: "其他",
};

const RESULT_LABELS: Record<string, string> = {
  known: "认识",
  vague: "模糊",
  forgot: "忘记",
};

async function getWordDetail(id: string, userId: string) {
  try {
    return await prisma.word.findUnique({
      where: { id, userId },
      include: {
        sources: { orderBy: { createdAt: "desc" } },
        reviews: { orderBy: { reviewedAt: "desc" }, take: 10 },
        schedule: { where: { userId } },
        meanings: { orderBy: { sortOrder: "asc" } },
      },
    });
  } catch (error) {
    console.error("word detail fetch failed:", error);
    return null;
  }
}

export default async function WordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getUserIdFromCookies();
  const word = userId ? await getWordDetail(id, userId) : null;

  if (!word) notFound();

  const sched = word.schedule[0];
  const highFreqMeanings = word.meanings.filter((m) => m.isHighFreq);
  const normalMeanings = word.meanings.filter((m) => !m.isHighFreq && !m.isObscure);
  const lowObscureMeanings = word.meanings.filter((m) => m.isObscure && !m.isHighFreq);

  return (
    <main className="container fade-in">
      {/* Word Header */}
      <div className="card stack">
        <h1 className="word-display">{word.displayText}</h1>
        {word.meaningZh && <p className="word-meaning">{word.meaningZh}</p>}
        {word.phonetic && <p className="word-phonetic">{word.phonetic}</p>}
        {word.note && <p className="muted">备注：{word.note}</p>}
      </div>

      <div className="page-block" />

      {/* Meanings List */}
      {word.meanings.length > 0 && (
        <>
          <div className="card stack">
            <h2 className="section-title">义项详解</h2>

            {/* 🔥 重点掌握 — 考研高频义项 */}
            {highFreqMeanings.length > 0 && (
              <div className="highlight-section">
                <div className="section-tip">🔥 重点掌握</div>
                {highFreqMeanings.map((m) => (
                  <div key={m.id} className={`meaning-item meaning-highfreq${m.isObscure ? " meaning-obscure" : ""}`}>
                    <div className="meaning-header">
                      <span className="meta-chip">{m.partOfSpeech}</span>
                      <strong className="meaning-zh">{m.meaningZh}</strong>
                      <span className="highfreq-tag">高频</span>
                      {m.isObscure && <span className="obscure-tag">僻义</span>}
                    </div>
                    {m.exampleSentence ? (
                      <div className="meaning-body">
                        <p className="meaning-example">{m.exampleSentence}</p>
                        {m.exampleTranslation && (
                          <p className="meaning-trans">{m.exampleTranslation}</p>
                        )}
                      </div>
                    ) : (
                      <p className="meaning-no-example">暂无例句</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 一般义项 */}
            {normalMeanings.length > 0 && (
              <>
                {highFreqMeanings.length > 0 && (
                  <div className="section-sep">
                    <span className="section-sep-label">其他义项</span>
                  </div>
                )}
                {normalMeanings.map((m) => (
                  <div key={m.id} className="meaning-item">
                    <div className="meaning-header">
                      <span className="meta-chip">{m.partOfSpeech}</span>
                      <strong className="meaning-zh">{m.meaningZh}</strong>
                    </div>
                    {m.exampleSentence ? (
                      <div className="meaning-body">
                        <p className="meaning-example">{m.exampleSentence}</p>
                        {m.exampleTranslation && (
                          <p className="meaning-trans">{m.exampleTranslation}</p>
                        )}
                      </div>
                    ) : (
                      <p className="meaning-no-example">暂无例句</p>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* 熟词僻义（非高频） */}
            {lowObscureMeanings.length > 0 && (
              <details className="obscure-section">
                <summary className="obscure-toggle">
                  ⚠️ 熟词僻义 — {lowObscureMeanings.length} 条
                </summary>
                <div className="stack" style={{ marginTop: "var(--space-3)" }}>
                  {lowObscureMeanings.map((m) => (
                    <div key={m.id} className="meaning-item meaning-obscure">
                      <div className="meaning-header">
                        <span className="meta-chip">{m.partOfSpeech}</span>
                        <strong className="meaning-zh">{m.meaningZh}</strong>
                        <span className="obscure-tag">僻义</span>
                      </div>
                      {m.exampleSentence ? (
                        <div className="meaning-body">
                          <p className="meaning-example">{m.exampleSentence}</p>
                          {m.exampleTranslation && (
                            <p className="meaning-trans">{m.exampleTranslation}</p>
                          )}
                        </div>
                      ) : (
                        <p className="meaning-no-example">暂无例句</p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
          <div className="page-block" />
        </>
      )}

      <WordActions
        id={word.id}
        displayText={word.displayText}
        lemma={word.lemma}
        meaningZh={word.meaningZh}
        phonetic={word.phonetic}
        partOfSpeech={word.partOfSpeech}
        exampleSentence={word.exampleSentence}
        note={word.note}
      />

      <div className="page-block" />

      {/* Review Schedule */}
      <div className="card stack">
        <h2 className="section-title">当前复习状态</h2>
        <div className="stat-grid">

          {word.reviews.length > 0 && (
            <div className="stat-item" style={{ gridColumn: "1 / -1" }}>
              <div className="stat-label" style={{ marginBottom: "var(--space-2)" }}>复习趋势（最近 10 次）</div>
              <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "24px" }}>
                {word.reviews.map((r) => {
                  const colors: Record<string, string> = { known: "#16a34a", vague: "#ca8a04", forgot: "#dc2626" };
                  return (
                    <div
                      key={r.id}
                      title={`${RESULT_LABELS[r.reviewResult] || r.reviewResult} · ${new Date(r.reviewedAt).toLocaleDateString("zh-CN")}`}
                      style={{
                        flex: 1,
                        height: "100%",
                        borderRadius: "var(--radius-sm)",
                        background: colors[r.reviewResult] || "#9ca3af",
                        opacity: 0.75,
                        cursor: "default",
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                <span>远</span>
                <span>近</span>
              </div>
            </div>
          )}

          <div className="stat-item">
            <div className="stat-label">下次复习</div>
            <div className="stat-value">
              {sched?.nextReviewAt
                ? new Date(sched.nextReviewAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
                : "未安排"}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">当前间隔</div>
            <div className="stat-value">{sched?.intervalDays ?? 0} 天</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">复习次数</div>
            <div className="stat-value">{sched?.reviewCount ?? 0}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">上次结果</div>
            <div className="stat-value">
              {sched?.lastResult ? RESULT_LABELS[sched.lastResult] || sched.lastResult : "无"}
            </div>
          </div>
        </div>
      </div>

      <div className="page-block" />

      {/* Sources */}
      <div className="card stack">
        <h2 className="section-title">来源记录</h2>
        {word.sources.length === 0 ? (
          <p className="muted">暂无来源记录</p>
        ) : (
          <div className="stack">
            {word.sources.map((source) => (
              <div key={source.id} className="list-card">
                <strong>来源：{SOURCE_LABELS[source.sourceType] || source.sourceType}</strong>
                <span className="muted">{source.sourceNote || "无备注"}</span>
                {source.sourceContext && <span className="muted">{source.sourceContext}</span>}
                <span className="muted">记录时间：{new Date(source.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="page-block" />

      {/* Review History */}
      <div className="card stack">
        <h2 className="section-title">最近复习记录</h2>
        {word.reviews.length === 0 ? (
          <p className="muted">还没有复习记录</p>
        ) : (
          <div className="stack">
            {word.reviews.map((review) => (
              <div key={review.id} className="list-card">
                <strong>
                  结果：<span className={`result-chip ${review.reviewResult}`}>{RESULT_LABELS[review.reviewResult] || review.reviewResult}</span>
                </strong>
                <span className="muted">时间：{new Date(review.reviewedAt).toLocaleString()}</span>
                <span className="muted">间隔变化：{review.intervalBefore ?? 0} 天 → {review.intervalAfter ?? 0} 天</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
