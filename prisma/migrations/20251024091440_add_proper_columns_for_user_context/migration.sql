-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "location" TEXT,
    "duration" INTEGER,
    "source" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "date" DATETIME,
    "website" TEXT,
    "link" TEXT,
    "note" TEXT,
    "userContext" TEXT,
    "contextData" JSONB
);
INSERT INTO "new_Contest" ("date", "duration", "id", "link", "location", "name", "note", "source", "stage", "userContext", "website", "year") SELECT "date", "duration", "id", "link", "location", "name", "note", "source", "stage", "userContext", "website", "year" FROM "Contest";
DROP TABLE "Contest";
ALTER TABLE "new_Contest" RENAME TO "Contest";
CREATE UNIQUE INDEX "Contest_name_stage_key" ON "Contest"("name", "stage");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
