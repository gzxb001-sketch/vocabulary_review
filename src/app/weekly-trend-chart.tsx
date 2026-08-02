"use client";

import { useEffect, useState } from "react";

type TrendItem = { label: string; knownRate: number; total: number };

export function WeeklyTrendChart() {
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/weekly")
      .then((r) => r.json())
      .then((d) => {
        setTrend(d.weeklyTrend || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || trend.length === 0) return null;

  const hasData = trend.some((t) => t.total > 0);
  if (!hasData) return null;

  const padding = 10;
  const width = 320;
  const height = 120;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const rates = trend.map((t) => Math.max(0, t.knownRate));
  const maxRate = Math.max(100, ...rates);
  const minRate = Math.min(0, ...rates);
  const range = maxRate - minRate || 1;

  const points = trend.map((t, i) => {
    const x = padding + (i / Math.max(1, trend.length - 1)) * chartW;
    const y = padding + chartH - ((Math.max(0, t.knownRate) - minRate) / range) * chartH;
    return { x, y, ...t };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <section className="card stack" style={{ marginBottom: "var(--space-4)", padding: "var(--space-4)" }}>
      <h2 className="home-section-title">学习趋势</h2>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", maxHeight: "140px" }}>
        {/* 网格线 */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padding + chartH - ((v - minRate) / range) * chartH;
          return (
            <g key={v}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 3" />
              <text x={2} y={y + 4} fontSize="8" fill="#9ca3af">{v}%</text>
            </g>
          );
        })}
        {/* 折线 */}
        <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* 数据点 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.total > 0 ? 3 : 0} fill="var(--color-primary)" />
        ))}
        {/* 标签 */}
        {points.map((p, i) =>
          i % 2 === 0 || i === points.length - 1 ? (
            <text key={`l-${i}`} x={p.x} y={height - 2} fontSize="8" fill="#9ca3af" textAnchor="middle">
              {p.label}
            </text>
          ) : null
        )}
      </svg>
    </section>
  );
}
