import { createClient } from "@libsql/client/http";

const url = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Error: set DATABASE_URL and TURSO_AUTH_TOKEN env vars");
  process.exit(1);
}

const client = createClient({ url, authToken });

const DDL = `
CREATE TABLE IF NOT EXISTS "Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lemma" TEXT NOT NULL,
    "displayText" TEXT NOT NULL,
    "meaningZh" TEXT,
    "phonetic" TEXT,
    "partOfSpeech" TEXT,
    "exampleSentence" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Meaning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "meaningZh" TEXT NOT NULL,
    "exampleSentence" TEXT,
    "exampleTranslation" TEXT,
    "isObscure" BOOLEAN NOT NULL DEFAULT false,
    "isHighFreq" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "WordSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceNote" TEXT,
    "sourceContext" TEXT,
    "imageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "ocrRawText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ReviewSchedule" (
    "wordId" TEXT NOT NULL PRIMARY KEY,
    "nextReviewAt" DATETIME NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easeScore" REAL NOT NULL DEFAULT 2.5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastResult" TEXT,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "reviewResult" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intervalBefore" INTEGER,
    "intervalAfter" INTEGER,
    FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE
);
`;

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "Word_lemma_idx" ON "Word"("lemma")`,
  `CREATE INDEX IF NOT EXISTS "Word_displayText_idx" ON "Word"("displayText")`,
  `CREATE INDEX IF NOT EXISTS "Meaning_wordId_idx" ON "Meaning"("wordId")`,
  `CREATE INDEX IF NOT EXISTS "WordSource_wordId_idx" ON "WordSource"("wordId")`,
  `CREATE INDEX IF NOT EXISTS "WordSource_sourceType_idx" ON "WordSource"("sourceType")`,
  `CREATE INDEX IF NOT EXISTS "WordSource_imageId_idx" ON "WordSource"("imageId")`,
  `CREATE INDEX IF NOT EXISTS "ReviewSchedule_nextReviewAt_idx" ON "ReviewSchedule"("nextReviewAt")`,
  `CREATE INDEX IF NOT EXISTS "Review_wordId_reviewedAt_idx" ON "Review"("wordId", "reviewedAt")`,
];

async function main() {
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
