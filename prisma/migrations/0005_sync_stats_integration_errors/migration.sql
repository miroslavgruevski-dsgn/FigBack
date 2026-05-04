-- AlterTable
ALTER TABLE "FigmaFile" ADD COLUMN "lastSyncFigmaCommentTotal" INTEGER,
ADD COLUMN "lastSyncImportedCount" INTEGER,
ADD COLUMN "lastSyncSkippedScopeCount" INTEGER;

-- AlterTable
ALTER TABLE "TeamConfig" ADD COLUMN "lastIntegrationError" TEXT,
ADD COLUMN "lastIntegrationErrorAt" TIMESTAMP(3);
