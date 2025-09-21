/*
  Warnings:

  - You are about to alter the column `userId` on the `oauth_states` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_oauth_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER,
    "redirectUri" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_oauth_states" ("createdAt", "id", "redirectUri", "userId") SELECT "createdAt", "id", "redirectUri", "userId" FROM "oauth_states";
DROP TABLE "oauth_states";
ALTER TABLE "new_oauth_states" RENAME TO "oauth_states";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
