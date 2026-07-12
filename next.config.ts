import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 标记需要作为外部包处理的依赖（原生模块、二进制绑定等）
  serverExternalPackages: [
    "@prisma/adapter-libsql",
    "@libsql/client",
    "tesseract.js",
  ],
};

export default nextConfig;
