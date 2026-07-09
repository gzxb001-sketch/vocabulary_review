import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createLocalPrisma(): PrismaClient {
  return new PrismaClient({
    log: ["error", "warn"],
  });
}

function createTursoPrisma(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaLibSQL } = require("@prisma/adapter-libsql");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@libsql/client");
  const adapter = new PrismaLibSQL(
    createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  );
  return new PrismaClient({ adapter });
}

export const prisma = (() => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  if (dbUrl.startsWith("libsql://")) {
    const client = createTursoPrisma();
    globalForPrisma.prisma = client;
    return client;
  }

  const client = createLocalPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
})();
