import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient, type Client } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined; libsql: Client | undefined };

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl === 'undefined') throw new Error('DATABASE_URL not set');
  if (dbUrl.startsWith('libsql://')) {
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!token || token === 'undefined') throw new Error('TURSO_AUTH_TOKEN not set');
    return new PrismaClient({ adapter: new PrismaLibSQL({ url: dbUrl, authToken: token }) });
  }
  return new PrismaClient({ log: ['error', 'warn'] });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, p: string | symbol, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, p, receiver);
    // 函数需要绑定到 client 实例，避免 this 丢失
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * 原生 libsql 写客户端：Prisma 的 libsql 适配器对每条语句都发独立 HTTP 往返
 * （createMany/$transaction 均不批量），批量写入（batch）一次请求打包 N 条语句，
 * 用于保存类接口的高吞吐路径。读取仍走 Prisma 保持类型安全。
 */
export function getLibsqlClient(): Client {
  if (!globalForPrisma.libsql) {
    const dbUrl = process.env.DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!dbUrl || !token) throw new Error('DATABASE_URL / TURSO_AUTH_TOKEN not set');
    globalForPrisma.libsql = createClient({ url: dbUrl, authToken: token });
  }
  return globalForPrisma.libsql;
}
