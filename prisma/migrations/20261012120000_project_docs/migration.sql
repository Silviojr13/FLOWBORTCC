-- Documentação do projeto: documentos de engenharia e diretrizes

CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '0.1',
    "sections" TEXT NOT NULL DEFAULT '{}',
    "revisions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "project_documents_projectId_type_key" ON "project_documents"("projectId", "type");

CREATE TABLE "project_doc_settings" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "academic" BOOLEAN NOT NULL DEFAULT false,
    "institution" TEXT,
    "course" TEXT,
    "authors" TEXT,
    "advisor" TEXT,
    "notes" TEXT,
    "referenceName" TEXT,
    "referenceText" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_doc_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
