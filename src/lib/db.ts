import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  // Turso / libsql (production)
  if (dbUrl.startsWith("libsql://")) {
    const adapter = new PrismaLibSQL(
      createClient({
        url: dbUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      })
    );
    return new PrismaClient({ adapter });
  }

  // Local SQLite (development)
  return new PrismaClient({
    log: ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
