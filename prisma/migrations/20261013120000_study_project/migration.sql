-- Avaliação de usabilidade ligada ao projeto avaliado (aba Avaliação do projeto)

ALTER TABLE "studies" ADD COLUMN "projectId" TEXT REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "studies_projectId_idx" ON "studies"("projectId");
