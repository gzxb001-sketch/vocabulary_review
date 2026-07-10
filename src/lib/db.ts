import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createTursoPrisma(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaLibSQL } = require("@prisma/adapter-libsql");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@libsql/client/http");
  const adapter = new PrismaLibSQL(
    createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  );
  return new PrismaClient({ adapter });
}

function createLocalPrisma(): PrismaClient {
  return new PrismaClient({ log: ["error", "warn"] });
}

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (dbUrl.startsWith("libsql://")) {
    return createTursoPrisma();
  }
  return createLocalPrisma();
}

// Lazy init: deferred until first access, ensuring env vars are loaded
let _prisma: PrismaClient | null = null;

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (!_prisma) {
      _prisma = createPrismaClient();
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = _prisma;
      }
    }
    return (_prisma as any)[prop];
  },
});
