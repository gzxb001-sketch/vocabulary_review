import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "tesseract.js"],
  // 开发工具悬浮球固定在左下角，移动视口下恰好压住底部导航的「首页」键吞掉点击；
  // 仅影响开发模式，生产构建无此层
  devIndicators: false,
};

export default nextConfig;
