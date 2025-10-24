-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContestScores" (
    "contestId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "medalNames" JSONB,
    "medalCutoffs" JSONB,
    "problemScores" JSONB,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ContestScores_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ContestScores" ("contestId", "isPrivate", "medalCutoffs", "medalNames", "problemScores") SELECT "contestId", "isPrivate", "medalCutoffs", "medalNames", "problemScores" FROM "ContestScores";
DROP TABLE "ContestScores";
ALTER TABLE "new_ContestScores" RENAME TO "ContestScores";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
