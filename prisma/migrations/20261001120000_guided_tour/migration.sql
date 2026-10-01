-- Tour guiado da primeira sessão: marca quem já concluiu e identifica o projeto de exemplo.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "tourCompletedAt" DATETIME;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "isTutorial" BOOLEAN NOT NULL DEFAULT false;
