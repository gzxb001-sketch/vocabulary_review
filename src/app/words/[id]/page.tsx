import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import WordActions from "./word-actions";

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

async function getWordDetail(id: string) {
  return prisma.word.findUnique({
    where: { id },
    include: {
      sources: { orderBy: { createdAt: "desc" } },
      reviews: { orderBy: { reviewedAt: "desc" }, take: 10 },
      schedule: true,
    },
  });
}

export default async function WordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const word = await getWordDetail(id);

  if (!word) { notFound(); }

  return (
    <main className="container fade-in">
      <div className="card stack">
        <h1 className="word">{word.displayText}</h1>
        <p className="meaning">{word.meaningZh || "暂无释义"}</p>
        {word.phonetic ? <p className="phonetic">{word.phonetic}</p> : null}
        {word.partOfSpeech ? <p className="muted">词性：{word.partOfSpeech}</p> : null}
        {word.exampleSentence ? <p className="muted">例句：{word.exampleSentence}</p> : null}
        {word.note ? <p className="muted">备注：{word.note}</p> : null}
      </div>

      <div style={{ height: 16 }} />

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

      <div style={{ height: 16 }} />

      <div className="card stack">
        <h2 className="section-title">当前复习状态</h2>
        <p className="muted">
          下次复习：{word.schedule?.nextReviewAt ? new Date(word.schedule.nextReviewAt).toLocaleString() : "未安排"}
        </p>
        <p className="muted">当前间隔：{word.schedule?.intervalDays ?? 0} 天</p>
        <p className="muted">复习次数：{word.schedule?.reviewCount ?? 0}</p>
        <p className="muted">上次结果：{word.schedule?.lastResult ? RESULT_LABELS[word.schedule.lastResult] || word.schedule.lastResult : "无"}</p>
      </div>

      <div style={{ height: 16 }} />

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
                {source.sourceContext ? <span className="muted">{source.sourceContext}</span> : null}
                <span className="muted">记录时间：{new Date(source.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />

      <div className="card stack">
        <h2 className="section-title">最近复习记录</h2>
        {word.reviews.length === 0 ? (
          <p className="muted">还没有复习记录</p>
        ) : (
          <div className="stack">
            {word.reviews.map((review) => (
              <div key={review.id} className="list-card">
                <strong>
                  结果：
                  <span className={`result-chip ${review.reviewResult}`}>{RESULT_LABELS[review.reviewResult] || review.reviewResult}</span>
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
