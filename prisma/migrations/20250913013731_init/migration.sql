-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "problems" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "source" TEXT,
    "year" INTEGER,
    "extra" TEXT
);

-- CreateTable
CREATE TABLE "problem_links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "problemId" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "problem_links_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_problem_data" (
    "userId" INTEGER NOT NULL,
    "problemId" INTEGER NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "score" REAL NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "problemId"),
    CONSTRAINT "user_problem_data_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_problem_data_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "checklistPublic" BOOLEAN NOT NULL DEFAULT false,
    "ascSort" BOOLEAN NOT NULL DEFAULT false,
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "olympiadOrder" JSONB,
    "platformPref" JSONB,
    "hiddenOlympiads" JSONB,
    "platformUsernames" JSONB,
    CONSTRAINT "settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contests" (
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
CREATE TABLE "contest_problems" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contestId" INTEGER NOT NULL,
    "problemId" INTEGER NOT NULL,
    "problemIndex" INTEGER NOT NULL,
    CONSTRAINT "contest_problems_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contest_problems_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contest_scores" (
    "contestId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "medalNames" JSONB,
    "medalCutoffs" JSONB,
    "problemScores" JSONB NOT NULL,
    CONSTRAINT "contest_scores_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_virtual_contests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "contestId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "score" REAL NOT NULL,
    "perProblemScores" JSONB,
    CONSTRAINT "user_virtual_contests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_virtual_contests_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "virtual_submissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "virtualContestId" INTEGER NOT NULL,
    "contestProblemId" INTEGER NOT NULL,
    "time" DATETIME NOT NULL,
    "score" REAL NOT NULL,
    "subtaskScores" JSONB NOT NULL,
    CONSTRAINT "virtual_submissions_virtualContestId_fkey" FOREIGN KEY ("virtualContestId") REFERENCES "user_virtual_contests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "virtual_submissions_contestProblemId_fkey" FOREIGN KEY ("contestProblemId") REFERENCES "contest_problems" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "active_virtual_contests" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contestId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "autosynced" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "active_virtual_contests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scraper_auth_tokens" (
    "platform" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_providerUserId_key" ON "auth_identities"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "problems_source_year_number_extra_key" ON "problems"("source", "year", "number", "extra");

-- CreateIndex
CREATE UNIQUE INDEX "problem_links_problemId_platform_url_key" ON "problem_links"("problemId", "platform", "url");

-- CreateIndex
CREATE UNIQUE INDEX "contests_name_stage_key" ON "contests"("name", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "contest_problems_contestId_problemId_key" ON "contest_problems"("contestId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "contest_problems_contestId_problemIndex_key" ON "contest_problems"("contestId", "problemIndex");

-- CreateIndex
CREATE UNIQUE INDEX "user_virtual_contests_userId_contestId_key" ON "user_virtual_contests"("userId", "contestId");
