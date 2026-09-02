"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { getSprintInfo, type SprintInfo } from "@/lib/sprint";

/**
 * 考前冲刺卡片：设置考试日期后按剩余天数展示阶段与当日配额。
 * 保存后用同构的 getSprintInfo 本地即时重算，router.refresh() 只负责同步其余统计。
 */
export default function ExamSprintCard({
  examDate,
  sprint,
}: {
  /** "YYYY-MM-DD" 或 null */
  examDate: string | null;
  sprint: SprintInfo;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(examDate ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 本地覆盖：undefined = 未修改（跟随服务端数据），string = 已设置，null = 已清除
  const [localDate, setLocalDate] = useState<string | null | undefined>(undefined);

  // 服务端数据刷新后清除本地覆盖
  useEffect(() => {
    setLocalDate(undefined);
  }, [examDate]);

  const displayDate = localDate === undefined ? examDate : localDate;
  const displaySprint = displayDate
    ? getSprintInfo(new Date(`${displayDate}T00:00:00Z`))
    : sprint;
  const hasDate = Boolean(displayDate);

  async function save(next: string | null) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/exam-date", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examDate: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "保存失败，请稍后重试");
        return;
      }
      if (next && !hasDate) {
        trackEvent(ANALYTICS_EVENTS.sprintDateSet);
      }
      setLocalDate(next);
      setEditing(false);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setValue(displayDate ?? "");
    setError("");
    setEditing(true);
  }

  if (!hasDate && !editing) {
    return (
      <button className="sprint-entry" onClick={startEditing}>
        🎋 正在备考考研？设置考试日期，开启冲刺计划 →
      </button>
    );
  }

  return (
    <section className="card card-compact sprint-card">
      <div className="home-col-header">
        <h2 className="home-section-title">
          {hasDate && displaySprint.daysLeft !== null
            ? displaySprint.daysLeft === 0
              ? "今天考试 · 顶住，稳住"
              : `距考试还有 ${displaySprint.daysLeft} 天 · ${displaySprint.label}`
            : "冲刺计划"}
        </h2>
        {hasDate && !editing && (
          <button className="home-col-more" onClick={startEditing}>
            修改
          </button>
        )}
      </div>

      {hasDate && !editing && (
        <>
          <p className="muted">
            考试日期：{formatDateCN(displayDate!)}
          </p>
          <p className="muted">{displaySprint.hint}</p>
          <p className="muted sprint-caps-line">
            今日配额：新词 {displaySprint.caps.newPerDay} · 复习 {displaySprint.caps.reviewPerDay}
          </p>
        </>
      )}

      {editing && (
        <div className="stack">
          <input
            type="date"
            className="input"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            aria-label="考试日期"
          />
          {error ? <p className="muted" style={{ color: "#dc2626" }}>{error}</p> : null}
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button className="button" onClick={() => save(value || null)} disabled={loading || !value}>
              {loading ? "保存中..." : "保存"}
            </button>
            {hasDate ? (
              <button className="button button-secondary" onClick={() => save(null)} disabled={loading}>
                清除日期
              </button>
            ) : (
              <button className="button button-secondary" onClick={() => setEditing(false)} disabled={loading}>
                取消
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function formatDateCN(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m} 月 ${d} 日`;
}
