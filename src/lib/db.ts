import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createTursoPrisma(): PrismaClient {
  // Use HTTP-only client to avoid native module issues on Vercel
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaLibSQL } = require("@prisma/adapter-libsql");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@libsql/client/http");

  const libsqlClient = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsqlClient);
  return new PrismaClient({ adapter });
}

export const prisma = (() => {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  if (dbUrl.startsWith("libsql://")) {
    try {
      if (globalForPrisma.prisma) return globalForPrisma.prisma;
      const client = createTursoPrisma();
      globalForPrisma.prisma = client;
      return client;
    } catch (err: any) {
      console.error("[db] Turso init failed:", err?.message || err);
      throw err;
    }
  }

  // Local SQLite
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = new PrismaClient({ log: ["error", "warn"] });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
})();
