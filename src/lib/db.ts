import { PrismaClient } from "@prisma/client";

// 使用 globalThis 缓存实例，防止 Vercel serverless 热启动时重复创建连接
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL 环境变量未设置。请在 Vercel 项目设置中添加 DATABASE_URL 和 TURSO_AUTH_TOKEN 环境变量。"
    );
  }

  // Turso / libsql 远程数据库（生产环境）
  if (dbUrl.startsWith("libsql://")) {
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!authToken) {
      throw new Error(
        "使用 Turso 数据库需要设置 TURSO_AUTH_TOKEN 环境变量。"
      );
    }

    // 使用动态 import 避免 Turbopack 打包问题
    const { PrismaLibSQL } = require("@prisma/adapter-libsql");
    const { createClient } = require("@libsql/client/http");

    const adapter = new PrismaLibSQL(
      createClient({
        url: dbUrl,
        authToken,
      })
    );
    return new PrismaClient({ adapter });
  }

  // 本地 SQLite（开发环境）
  return new PrismaClient({ log: ["error", "warn"] });
}

// 单例模式：优先复用 globalThis 缓存，避免 Vercel 每次请求都创建新连接
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
