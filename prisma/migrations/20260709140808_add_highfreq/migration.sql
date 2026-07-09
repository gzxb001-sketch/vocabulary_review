-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meaning" (
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
    CONSTRAINT "Meaning_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Meaning" ("createdAt", "exampleSentence", "exampleTranslation", "id", "isObscure", "meaningZh", "partOfSpeech", "sortOrder", "wordId") SELECT "createdAt", "exampleSentence", "exampleTranslation", "id", "isObscure", "meaningZh", "partOfSpeech", "sortOrder", "wordId" FROM "Meaning";
DROP TABLE "Meaning";
ALTER TABLE "new_Meaning" RENAME TO "Meaning";
CREATE INDEX "Meaning_wordId_idx" ON "Meaning"("wordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
