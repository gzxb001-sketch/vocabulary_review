import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

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

export const prisma = new Proxy({} as PrismaClient, {
  get(_: any, p: string | symbol) { return (getPrismaClient() as any)[p]; },
});
