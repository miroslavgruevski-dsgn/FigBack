ALTER TABLE "IssueCluster"
ADD COLUMN "canonicalKey" TEXT;

UPDATE "IssueCluster"
SET "canonicalKey" = lower(
  coalesce("frameId", 'unknown') || '::' ||
  coalesce("pageId", 'unknown') || '::' ||
  coalesce("title", 'untitled')
)
WHERE "canonicalKey" IS NULL;

CREATE INDEX "IssueCluster_canonicalKey_idx" ON "IssueCluster"("canonicalKey");
