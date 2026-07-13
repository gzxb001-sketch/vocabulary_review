import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client/http";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl || dbUrl === "undefined") {
    throw new Error("DATABASE_URL 环境变量未设置");
  }

  // Turso / libsql 远程数据库
  if (dbUrl.startsWith("libsql://")) {
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!authToken || authToken === "undefined") {
      throw new Error("TURSO_AUTH_TOKEN 环境变量未设置");
    }

    const libsqlClient = createClient({ url: dbUrl, authToken });
    const adapter = new PrismaLibSQL(libsqlClient as any);
    return new PrismaClient({ adapter });
  }

  // 本地 SQLite
  return new PrismaClient({ log: ["error", "warn"] });
}

let _prisma: PrismaClient;

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (_prisma) return _prisma;

  _prisma = createPrismaClient();
  globalForPrisma.prisma = _prisma;
  return _prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    return (getPrismaClient() as any)[prop];
  },
});
