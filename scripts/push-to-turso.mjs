import { createClient } from "@libsql/client/http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// 手动加载 .env（本脚本是独立执行的，不走 Next.js 的 dotenv）
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const url = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Error: set DATABASE_URL and TURSO_AUTH_TOKEN env vars");
  process.exit(1);
}

const client = createClient({ url, authToken });

const DDL = `
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailReminderHour" INTEGER NOT NULL DEFAULT 20,
    "emailReminderMinute" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'legacy',
    "lemma" TEXT NOT NULL,
    "displayText" TEXT NOT NULL,
    "meaningZh" TEXT,
    "phonetic" TEXT,
    "partOfSpeech" TEXT,
    "exampleSentence" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Meaning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'legacy',
    "partOfSpeech" TEXT NOT NULL,
    "meaningZh" TEXT NOT NULL,
    "exampleSentence" TEXT,
    "exampleTranslation" TEXT,
    "isObscure" BOOLEAN NOT NULL DEFAULT false,
    "isHighFreq" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "WordSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'legacy',
    "sourceType" TEXT NOT NULL,
    "sourceNote" TEXT,
    "sourceContext" TEXT,
    "imageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "ocrRawText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ReviewSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'legacy',
    "nextReviewAt" DATETIME NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easeScore" REAL NOT NULL DEFAULT 2.5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastResult" TEXT,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'legacy',
    "reviewResult" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intervalBefore" INTEGER,
    "intervalAfter" INTEGER,
    "clientResultId" TEXT,
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL UNIQUE,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "remindHour" INTEGER NOT NULL DEFAULT 20,
    "remindMinute" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
`;

const ALT = [
  `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,

  `ALTER TABLE "User" ADD COLUMN "emailReminderEnabled" BOOLEAN DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN "emailReminderHour" INTEGER DEFAULT 20`,
  `ALTER TABLE "User" ADD COLUMN "emailReminderMinute" INTEGER DEFAULT 0`,

  // Add columns without REFERENCES first (SQLite limitation)
  `ALTER TABLE "Word" ADD COLUMN "userId" TEXT DEFAULT 'legacy'`,
  `ALTER TABLE "Meaning" ADD COLUMN "userId" TEXT DEFAULT 'legacy'`,
  `ALTER TABLE "WordSource" ADD COLUMN "userId" TEXT DEFAULT 'legacy'`,

  `ALTER TABLE "ReviewSchedule" ADD COLUMN "id" TEXT`,
  `ALTER TABLE "ReviewSchedule" ADD COLUMN "userId" TEXT DEFAULT 'legacy'`,

  `ALTER TABLE "Review" ADD COLUMN "userId" TEXT DEFAULT 'legacy'`,

  `ALTER TABLE "Review" ADD COLUMN "clientResultId" TEXT`,
];

const INDEXES = [
  // Word
  `CREATE INDEX IF NOT EXISTS "Word_lemma_idx" ON "Word"("lemma")`,
  `CREATE INDEX IF NOT EXISTS "Word_displayText_idx" ON "Word"("displayText")`,
  `CREATE INDEX IF NOT EXISTS "Word_userId_idx" ON "Word"("userId")`,

  // Meaning
  `CREATE INDEX IF NOT EXISTS "Meaning_wordId_idx" ON "Meaning"("wordId")`,
  `CREATE INDEX IF NOT EXISTS "Meaning_userId_idx" ON "Meaning"("userId")`,

  // WordSource
  `CREATE INDEX IF NOT EXISTS "WordSource_wordId_idx" ON "WordSource"("wordId")`,
  `CREATE INDEX IF NOT EXISTS "WordSource_sourceType_idx" ON "WordSource"("sourceType")`,
  `CREATE INDEX IF NOT EXISTS "WordSource_imageId_idx" ON "WordSource"("imageId")`,
  `CREATE INDEX IF NOT EXISTS "WordSource_userId_idx" ON "WordSource"("userId")`,

  // ReviewSchedule
  `CREATE INDEX IF NOT EXISTS "ReviewSchedule_nextReviewAt_idx" ON "ReviewSchedule"("nextReviewAt")`,
  `CREATE INDEX IF NOT EXISTS "ReviewSchedule_userId_idx" ON "ReviewSchedule"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ReviewSchedule_wordId_idx" ON "ReviewSchedule"("wordId")`,

  // Review
  `CREATE INDEX IF NOT EXISTS "Review_wordId_reviewedAt_idx" ON "Review"("wordId", "reviewedAt")`,
  `CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Review_clientResultId_key" ON "Review"("clientResultId")`,

  // PushSubscription
  `CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId")`,
  `CREATE INDEX IF NOT EXISTS "PushSubscription_enabled_idx" ON "PushSubscription"("enabled")`,
];

async function main() {
  // Create tables
  const statements = DDL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    const name = stmt.split("\n")[0].trim();
    try {
      await client.execute(stmt + ";");
      console.log("OK:", name);
    } catch (err) {
      console.error("FAIL:", name, err.message);
    }
  }

  // Alter existing tables
  for (const a of ALT) {
    const name = a.substring(0, 60);
    try {
      await client.execute(a);
      console.log("OK:", name);
    } catch (err) {
      console.error("SKIP:", name, "(" + err.message + ")");
    }
  }

  // Create indexes
  for (const idx of INDEXES) {
    const name = idx.split(" ON")[0].trim();
    try {
      await client.execute(idx);
      console.log("OK:", name);
    } catch (err) {
      console.error("FAIL:", name, err.message);
    }
  }

  console.log("\nDone!");
}

main();
