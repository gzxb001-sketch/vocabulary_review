// 今日成果卡：Canvas 手绘的可分享成绩图（零第三方依赖）。
// 规格：4:5 竖版（1000×1250，2x 渲染保证清晰度），竹墨品牌深绿底，
// 与首页 hero 同一配色语言，适合保存到相册或分享到社群。

export type TodayCardData = {
  dateLabel: string; // "9月30日 · 周三"
  done: number;
  plan: number;
  known: number;
  vague: number;
  forgot: number;
};

export function drawTodayCard(data: TodayCardData): string {
  const W = 1000;
  const H = 1250;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(2, 2);

  // 背景：品牌深绿渐变
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1f3a06");
  bg.addColorStop(0.45, "#3f6212");
  bg.addColorStop(1, "#4d7c0f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 柔光装饰
  const glow1 = ctx.createRadialGradient(W - 80, 120, 20, W - 80, 120, 420);
  glow1.addColorStop(0, "rgba(255,255,255,0.10)");
  glow1.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(60, H - 60, 20, 60, H - 60, 380);
  glow2.addColorStop(0, "rgba(240,245,232,0.08)");
  glow2.addColorStop(1, "rgba(240,245,232,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // 品牌行：左品牌 · 右日期
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f0f5e8";
  ctx.font = "600 34px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText("🎋 竹墨词库", 72, 120);
  ctx.font = "26px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.textAlign = "right";
  ctx.fillText(data.dateLabel, W - 72, 118);

  // 标签
  ctx.textAlign = "left";
  ctx.font = "26px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.fillText("今 日 复 习", 72, 330);

  // 大数字：已完成 / 计划
  ctx.font = "800 170px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "#f0f5e8";
  const doneStr = String(data.done);
  ctx.fillText(doneStr, 66, 500);
  const doneW = ctx.measureText(doneStr).width;
  ctx.font = "500 56px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(`/ ${data.plan}`, 66 + doneW + 14, 496);

  // 进度条 + 末端光点
  const barY = 560;
  const barW = W - 144;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(72, barY, barW, 10);
  const pct = Math.min(1, data.plan > 0 ? data.done / data.plan : 1);
  ctx.fillStyle = "#f0f5e8";
  ctx.fillRect(72, barY, barW * pct, 10);
  if (pct > 0) {
    ctx.beginPath();
    ctx.arc(72 + barW * pct, barY + 5, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // 三档统计：认识 / 模糊 / 不会
  const stats = [
    { label: "认识", value: data.known, dot: "#bbf7d0" },
    { label: "模糊", value: data.vague, dot: "#fde68a" },
    { label: "不会", value: data.forgot, dot: "#fca5a5" },
  ];
  const colW = (W - 144) / 3;
  stats.forEach((s) => {
    const cx = 72 + colW * stats.indexOf(s) + colW / 2;
    ctx.textAlign = "center";
    ctx.font = "700 64px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(s.value), cx, 760);
    ctx.font = "24px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.fillText(s.label, cx, 806);
    const labelW = ctx.measureText(s.label).width;
    ctx.fillStyle = s.dot;
    ctx.beginPath();
    ctx.arc(cx - labelW / 2 - 14, 798, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 本轮认识率
  const total = data.known + data.vague + data.forgot;
  const rate = total > 0 ? Math.round((data.known / total) * 100) : 0;
  ctx.textAlign = "center";
  ctx.font = "28px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(`本轮认识率 ${rate}%`, W / 2, 900);

  // 分隔线 + 品牌语
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, 1040);
  ctx.lineTo(W - 72, 1040);
  ctx.stroke();
  ctx.font = "500 30px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "#f0f5e8";
  ctx.fillText("竹墨词库 · 考研生词，科学背牢", W / 2, 1120);
  ctx.font = "22px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("每天进步一点点", W / 2, 1165);

  return canvas.toDataURL("image/png");
}
