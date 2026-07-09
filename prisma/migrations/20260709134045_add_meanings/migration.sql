-- CreateTable
CREATE TABLE "Word" (
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

-- CreateTable
CREATE TABLE "Meaning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "meaningZh" TEXT NOT NULL,
    "exampleSentence" TEXT,
    "isObscure" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meaning_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WordSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceNote" TEXT,
    "sourceContext" TEXT,
    "imageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WordSource_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WordSource_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "ocrRawText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReviewSchedule" (
    "wordId" TEXT NOT NULL PRIMARY KEY,
    "nextReviewAt" DATETIME NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easeScore" REAL NOT NULL DEFAULT 2.5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastResult" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewSchedule_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wordId" TEXT NOT NULL,
    "reviewResult" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intervalBefore" INTEGER,
    "intervalAfter" INTEGER,
    CONSTRAINT "Review_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Word_lemma_idx" ON "Word"("lemma");

-- CreateIndex
CREATE INDEX "Word_displayText_idx" ON "Word"("displayText");

-- CreateIndex
CREATE INDEX "Meaning_wordId_idx" ON "Meaning"("wordId");

-- CreateIndex
CREATE INDEX "WordSource_wordId_idx" ON "WordSource"("wordId");

-- CreateIndex
CREATE INDEX "WordSource_sourceType_idx" ON "WordSource"("sourceType");

-- CreateIndex
CREATE INDEX "WordSource_imageId_idx" ON "WordSource"("imageId");

-- CreateIndex
CREATE INDEX "ReviewSchedule_nextReviewAt_idx" ON "ReviewSchedule"("nextReviewAt");

-- CreateIndex
CREATE INDEX "Review_wordId_reviewedAt_idx" ON "Review"("wordId", "reviewedAt");
