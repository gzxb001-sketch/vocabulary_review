import { PrismaClient } from "@prisma/client";

// 使用 globalThis 缓存实例，防止 Vercel serverless 热启动时重复创建连接
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error("DATABASE_URL 环境变量未设置");
  }

  // Turso / libsql 远程数据库（生产环境）
  if (dbUrl.startsWith("libsql://")) {
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!authToken) {
      throw new Error("TURSO_AUTH_TOKEN 环境变量未设置");
    }

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

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// 导出惰性代理，导入模块时不会立即初始化连接
// 只有实际调用 prisma.xxx.xxx() 时才会触发初始化
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    const client = getPrismaClient();
    return (client as any)[prop];
  },
});
