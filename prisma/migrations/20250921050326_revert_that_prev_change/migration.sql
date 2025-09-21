/*
  Warnings:

  - Made the column `extra` on table `problems` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_problems" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "source" TEXT,
    "year" INTEGER,
    "extra" TEXT NOT NULL
);
INSERT INTO "new_problems" ("extra", "id", "name", "number", "source", "year") SELECT "extra", "id", "name", "number", "source", "year" FROM "problems";
DROP TABLE "problems";
ALTER TABLE "new_problems" RENAME TO "problems";
CREATE UNIQUE INDEX "problems_source_year_number_extra_key" ON "problems"("source", "year", "number", "extra");
CREATE UNIQUE INDEX "problems_name_source_year_extra_key" ON "problems"("name", "source", "year", "extra");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
