-- AlterTable
ALTER TABLE "hardware_components" ADD COLUMN "domain" TEXT NOT NULL DEFAULT 'Hardware';

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "availability" TEXT NOT NULL DEFAULT 'disponivel',
    "costModel" TEXT NOT NULL DEFAULT 'unico',
    "unitCost" REAL NOT NULL DEFAULT 0,
    "quantity" REAL NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "requirementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "resources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "resources_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "resources_projectId_idx" ON "resources"("projectId");
