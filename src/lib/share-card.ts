// 今日成果卡：Canvas 手绘的可分享成绩图（零第三方依赖）。
// 规格：4:5 竖版（1000×1250，2x 渲染保证清晰度）。
// 设计语言：成绩单 × 奖牌 —— 巨大主角数字 +「全部完成」称号 + 认识率奖牌环
// + 同心圆/彩点庆祝装饰；绿色配额制，庄重而值得晒。

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

  // —— 背景墨绿渐变 ——
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#17330a");
  bg.addColorStop(0.42, "#2f5210");
  bg.addColorStop(1, "#4d7c0f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 双柔光
  const glow1 = ctx.createRadialGradient(W - 60, 140, 30, W - 60, 140, 460);
  glow1.addColorStop(0, "rgba(255,255,255,0.12)");
  glow1.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(40, H - 40, 20, 40, H - 40, 420);
  glow2.addColorStop(0, "rgba(240,245,232,0.09)");
  glow2.addColorStop(1, "rgba(240,245,232,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // 奖牌同心圆（右上，衬托称号区）
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  for (const r of [130, 185, 240]) {
    ctx.beginPath();
    ctx.arc(W - 100, 330, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 彩点庆祝（固定位置，克制透明度）
  const dots: Array<[number, number, number, string, number]> = [
    [150, 200, 3.5, "#fde68a", 0.5],
    [268, 148, 2.5, "#bbf7d0", 0.45],
    [505, 190, 3, "#f0f5e8", 0.4],
    [760, 150, 4, "#fde68a", 0.55],
    [872, 452, 3, "#bbf7d0", 0.4],
    [96, 470, 2.5, "#f0f5e8", 0.4],
    [88, 742, 3.5, "#fde68a", 0.45],
    [836, 706, 2.5, "#f0f5e8", 0.4],
    [900, 952, 3.5, "#fde68a", 0.5],
    [170, 986, 2.5, "#bbf7d0", 0.45],
    [742, 1042, 3, "#fde68a", 0.4],
    [452, 132, 2.5, "#f0f5e8", 0.35],
  ];
  for (const [x, y, r, c, o] of dots) {
    ctx.fillStyle = c;
    ctx.globalAlpha = o;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // —— 品牌行 ——
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f0f5e8";
  ctx.font = "600 32px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText("🎋 竹墨词库", 76, 116);
  ctx.font = "24px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.textAlign = "right";
  ctx.fillText(data.dateLabel, W - 76, 114);

  // —— 称号 + 标签 ——
  ctx.textAlign = "left";
  ctx.font = "26px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText("今 日 复 习", 80, 296);

  const allDone = data.plan > 0 && data.done >= data.plan;
  ctx.font = "700 58px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(allDone ? "全部完成" : "已完成", 76, 388);
  if (allDone) {
    ctx.font = "34px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillText("★", 76 + ctx.measureText("全部完成").width + 18, 386);
  }

  // —— 主角：巨大数字 ——
  ctx.font = "800 200px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "#f0f5e8";
  const doneStr = String(data.done);
  ctx.fillText(doneStr, 70, 600);
  const doneW = ctx.measureText(doneStr).width;
  ctx.font = "500 58px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`/ ${data.plan}`, 70 + doneW + 18, 594);

  // —— 笔触进度条 ——
  const barY = 668;
  const barW = W - 152;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(76, barY, barW, 10);
  const pct = Math.min(1, data.plan > 0 ? data.done / data.plan : 1);
  ctx.fillStyle = "#f0f5e8";
  ctx.fillRect(76, barY, barW * pct, 10);
  if (pct > 0) {
    ctx.beginPath();
    ctx.arc(76 + barW * pct, barY + 5, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  // —— 认识率奖牌环（左） + 三档明细（右） ——
  const total = data.known + data.vague + data.forgot;
  const rate = total > 0 ? data.known / total : 0;
  const ringX = 250;
  const ringY = 940;
  const ringR = 104;
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
  ctx.stroke();
  if (rate > 0) {
    ctx.strokeStyle = "#f0f5e8";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + rate * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  ctx.textAlign = "center";
  ctx.font = "800 54px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${Math.round(rate * 100)}%`, ringX, ringY + 12);
  ctx.font = "22px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText("认识率", ringX, ringY + 46);

  const rows: Array<{ label: string; value: number; dot: string }> = [
    { label: "认识", value: data.known, dot: "#bbf7d0" },
    { label: "模糊", value: data.vague, dot: "#fde68a" },
    { label: "不会", value: data.forgot, dot: "#fca5a5" },
  ];
  let rowY = 866;
  for (const row of rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = row.dot;
    ctx.beginPath();
    ctx.arc(W / 2 + 60, rowY - 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "26px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.fillText(row.label, W / 2 + 82, rowY);
    ctx.font = "700 38px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(row.value), W / 2 + 190, rowY);
    rowY += 74;
  }

  // —— 底部品牌语 ——
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(76, 1096);
  ctx.lineTo(W - 76, 1096);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "500 28px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(240,245,232,0.85)";
  ctx.fillText("竹墨词库 · 考研生词，科学背牢", W / 2, 1158);
  ctx.font = "20px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("每天进步一点点", W / 2, 1198);

  return canvas.toDataURL("image/png");
}
