/*
  Warnings:

  - You are about to drop the `active_virtual_contests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_identities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contest_problems` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contest_scores` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `oauth_states` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `problem_links` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `problems` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scraper_auth_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_problem_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_virtual_contests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `virtual_submissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "active_virtual_contests";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "auth_identities";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "contest_problems";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "contest_scores";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "contests";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "oauth_states";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "problem_links";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "problems";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "scraper_auth_tokens";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "sessions";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "settings";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "user_problem_data";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "user_virtual_contests";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "users";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "virtual_submissions";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "source" TEXT,
    "year" INTEGER,
    "extra" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ProblemLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problemId" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "ProblemLink_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProblemData" (
    "userId" INTEGER NOT NULL,
    "problemId" INTEGER NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "score" REAL NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "problemId"),
    CONSTRAINT "UserProblemData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserProblemData_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "checklistPublic" BOOLEAN NOT NULL DEFAULT false,
    "ascSort" BOOLEAN NOT NULL DEFAULT false,
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "olympiadOrder" JSONB,
    "platformPref" JSONB,
    "hiddenOlympiads" JSONB,
    "platformUsernames" JSONB,
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contest" (
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
    "note" TEXT
);

-- CreateTable
CREATE TABLE "ContestProblem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contestId" INTEGER NOT NULL,
    "problemId" INTEGER NOT NULL,
    "problemIndex" INTEGER NOT NULL,
    CONSTRAINT "ContestProblem_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContestProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContestScores" (
    "contestId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "medalNames" JSONB,
    "medalCutoffs" JSONB,
    "problemScores" JSONB NOT NULL,
    CONSTRAINT "ContestScores_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserVirtualContest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "contestId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "score" REAL NOT NULL,
    "perProblemScores" JSONB,
    CONSTRAINT "UserVirtualContest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserVirtualContest_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VirtualSubmission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "virtualContestId" INTEGER,
    "activeVirtualContestUserId" INTEGER,
    "contestProblemId" INTEGER NOT NULL,
    "time" DATETIME NOT NULL,
    "score" REAL NOT NULL,
    "subtaskScores" JSONB NOT NULL,
    CONSTRAINT "VirtualSubmission_virtualContestId_fkey" FOREIGN KEY ("virtualContestId") REFERENCES "UserVirtualContest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VirtualSubmission_activeVirtualContestUserId_fkey" FOREIGN KEY ("activeVirtualContestUserId") REFERENCES "ActiveVirtualContest" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VirtualSubmission_contestProblemId_fkey" FOREIGN KEY ("contestProblemId") REFERENCES "ContestProblem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActiveVirtualContest" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contestId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "autosynced" BOOLEAN NOT NULL DEFAULT false,
    "score" REAL,
    "perProblemScores" JSONB,
    CONSTRAINT "ActiveVirtualContest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActiveVirtualContest_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScraperAuthToken" (
    "platform" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER,
    "redirectUri" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerUserId_key" ON "AuthIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_source_year_number_extra_key" ON "Problem"("source", "year", "number", "extra");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_name_source_year_extra_key" ON "Problem"("name", "source", "year", "extra");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemLink_problemId_platform_url_key" ON "ProblemLink"("problemId", "platform", "url");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_name_stage_key" ON "Contest"("name", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "ContestProblem_contestId_problemId_key" ON "ContestProblem"("contestId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestProblem_contestId_problemIndex_key" ON "ContestProblem"("contestId", "problemIndex");

-- CreateIndex
CREATE UNIQUE INDEX "UserVirtualContest_userId_contestId_key" ON "UserVirtualContest"("userId", "contestId");
