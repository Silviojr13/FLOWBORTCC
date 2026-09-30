-- Onboarding na conta. Contas já existentes são marcadas como concluídas
-- para que a coluna nova não as trate como primeiro acesso.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "profile" TEXT;
ALTER TABLE "users" ADD COLUMN "discoverySource" TEXT;
ALTER TABLE "users" ADD COLUMN "onboardingCompletedAt" DATETIME;

-- Backfill único, no momento da migração.
UPDATE "users" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL;
