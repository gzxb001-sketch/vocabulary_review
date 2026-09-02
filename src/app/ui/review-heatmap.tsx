"use client";

import { useEffect, useState } from "react";

type HeatmapData = { start: string; days: Record<string, number> };

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function levelFor(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

const LEVEL_COLORS = ["#eef2e6", "#c8e0a4", "#94c56b", "#5f9d3f", "#3f6d1e"];

export function ReviewHeatmap() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/heatmap")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: HeatmapData | null) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (!data) return null;

  const activeDays = Object.values(data.days).filter((n) => n > 0).length;
  const totalReviews = Object.values(data.days).reduce((a, b) => a + b, 0);
  if (activeDays === 0) return null;

  // 构建 13 周网格（周一至周日，右对齐到今天）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 90);
  const dow = (start.getDay() + 6) % 7; // 0=周一
  start.setDate(start.getDate() - dow);

  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= today.getTime()) {
    week.push(new Date(cursor));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return (
    <section
      className="card stack"
      style={{ marginBottom: "var(--space-4)", padding: "var(--space-4)" }}
    >
      <div className="home-col-header">
        <h2 className="home-section-title">打卡记录</h2>
        <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
          近 {weeks.length} 周 · 复习 {activeDays} 天 · 共 {totalReviews} 次
        </span>
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        {/* 星期标签 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            height: "100%",
          }}
        >
          {["一", "", "三", "", "五", "", ""].map((label, i) => (
            <span
              key={i}
              className="muted"
              style={{
                width: 12,
                height: 12,
                fontSize: 8,
                lineHeight: "12px",
                textAlign: "center",
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* 周网格 */}
        <div style={{ overflowX: "auto", flex: 1 }}>
          <div style={{ display: "flex", gap: 3, minWidth: "max-content" }}>
            {weeks.map((w, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {w.map((d, di) => {
                  const future = d === null;
                  const count = d ? data.days[dayKey(d)] || 0 : 0;
                  const color = future ? "transparent" : LEVEL_COLORS[levelFor(count)];
                  const title = future
                    ? ""
                    : count === 0
                      ? `${d!.getMonth() + 1}/${d!.getDate()} · 未复习`
                      : `${d!.getMonth() + 1}/${d!.getDate()} · 复习 ${count} 次`;
                  return (
                    <div
                      key={di}
                      title={title}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "var(--space-1)",
        }}
      >
        <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
          少
        </span>
        {LEVEL_COLORS.map((c, i) => (
          <span
            key={i}
            style={{ width: 12, height: 12, borderRadius: 3, background: c, display: "inline-block" }}
          />
        ))}
        <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
          多
        </span>
      </div>
    </section>
  );
}
