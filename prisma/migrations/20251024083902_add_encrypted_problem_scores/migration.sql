/*
  Warnings:

  - You are about to alter the column `problemScores` on the `ContestScores` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContestScores" (
    "contestId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "medalNames" JSONB,
    "medalCutoffs" JSONB,
    "problemScores" JSONB NOT NULL,
    "encryptedProblemScores" TEXT,
    CONSTRAINT "ContestScores_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ContestScores" ("contestId", "medalCutoffs", "medalNames", "problemScores") SELECT "contestId", "medalCutoffs", "medalNames", "problemScores" FROM "ContestScores";
DROP TABLE "ContestScores";
ALTER TABLE "new_ContestScores" RENAME TO "ContestScores";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
