-- Liga a conversa do assistente ao projeto criado a partir dela (persistência do chat).

-- AlterTable
ALTER TABLE "chats" ADD COLUMN "projectId" TEXT REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "chats_userId_idx" ON "chats"("userId");
CREATE INDEX "chats_projectId_idx" ON "chats"("projectId");
