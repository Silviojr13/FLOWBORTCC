-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN "tutorialProgress" TEXT;

-- CreateTable
CREATE TABLE "studies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "privacy" TEXT NOT NULL,
    "contact" TEXT,
    "inviteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "studies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "study_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "answers" TEXT,
    "susScore" REAL,
    CONSTRAINT "study_participants_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "studies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "study_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "study_task_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "study_task_progress_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "study_participants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "studies_inviteCode_key" ON "studies"("inviteCode");
CREATE UNIQUE INDEX "study_participants_studyId_userId_key" ON "study_participants"("studyId", "userId");
CREATE UNIQUE INDEX "study_task_progress_participantId_taskKey_key" ON "study_task_progress"("participantId", "taskKey");
