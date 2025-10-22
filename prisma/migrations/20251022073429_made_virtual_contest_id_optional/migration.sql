-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_virtual_submissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "virtualContestId" INTEGER,
    "activeVirtualContestUserId" INTEGER,
    "contestProblemId" INTEGER NOT NULL,
    "time" DATETIME NOT NULL,
    "score" REAL NOT NULL,
    "subtaskScores" JSONB NOT NULL,
    CONSTRAINT "virtual_submissions_virtualContestId_fkey" FOREIGN KEY ("virtualContestId") REFERENCES "user_virtual_contests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "virtual_submissions_activeVirtualContestUserId_fkey" FOREIGN KEY ("activeVirtualContestUserId") REFERENCES "active_virtual_contests" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "virtual_submissions_contestProblemId_fkey" FOREIGN KEY ("contestProblemId") REFERENCES "contest_problems" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_virtual_submissions" ("activeVirtualContestUserId", "contestProblemId", "id", "score", "subtaskScores", "time", "virtualContestId") SELECT "activeVirtualContestUserId", "contestProblemId", "id", "score", "subtaskScores", "time", "virtualContestId" FROM "virtual_submissions";
DROP TABLE "virtual_submissions";
ALTER TABLE "new_virtual_submissions" RENAME TO "virtual_submissions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
