-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_active_virtual_contests" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contestId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "autosynced" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "active_virtual_contests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "active_virtual_contests_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_active_virtual_contests" ("autosynced", "contestId", "endedAt", "startedAt", "userId") SELECT "autosynced", "contestId", "endedAt", "startedAt", "userId" FROM "active_virtual_contests";
DROP TABLE "active_virtual_contests";
ALTER TABLE "new_active_virtual_contests" RENAME TO "active_virtual_contests";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
