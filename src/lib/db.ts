import { PrismaClient } from "@prisma/client";

// 全局单例缓存
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value || value === "undefined") {
    throw new Error(
      `环境变量 ${key} 未设置。请在 Vercel 项目 Settings → Environment Variables 中添加 ${key}，然后 Redeploy。`
    );
  }
  return value;
}

function createPrismaClient(): PrismaClient {
  const dbUrl = getEnvOrThrow("DATABASE_URL");

  // Turso / libsql 远程数据库
  if (dbUrl.startsWith("libsql://")) {
    const authToken = getEnvOrThrow("TURSO_AUTH_TOKEN");

    // 使用 require 延迟加载（已通过 serverExternalPackages 标记为外部包）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaLibSQL } = require("@prisma/adapter-libsql");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require("@libsql/client/http");

    const libsqlClient = createClient({ url: dbUrl, authToken });
    const adapter = new PrismaLibSQL(libsqlClient);
    return new PrismaClient({ adapter });
  }

  // 本地 SQLite
  return new PrismaClient({ log: ["error", "warn"] });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// 惰性 Proxy：导入模块时不初始化，首次调用 prisma.xxx 时才触发
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    const client = getPrismaClient();
    return (client as any)[prop];
  },
});
