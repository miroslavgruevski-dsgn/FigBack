Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "figmaAccessToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigmaFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "version" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "FigmaFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorImg" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "clientMeta" JSONB NOT NULL,
    "nodeId" TEXT,
    "frameId" TEXT,
    "pageId" TEXT,
    "frameName" TEXT,
    "pageName" TEXT,
    "pinX" DOUBLE PRECISION,
    "pinY" DOUBLE PRECISION,
    "regionW" DOUBLE PRECISION,
    "regionH" DOUBLE PRECISION,
    "mapConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "reactions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRound" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "executiveSummary" TEXT,
    "commentCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewCard" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "commentThread" JSONB NOT NULL DEFAULT '[]',
    "frameName" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "targetNodeName" TEXT,
    "targetNodeType" TEXT,
    "fullFrameUrl" TEXT,
    "contextCropUrl" TEXT,
    "tightCropUrl" TEXT,
    "annotatedUrl" TEXT,
    "figmaDeepLink" TEXT,

    CONSTRAINT "ReviewCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMAssessment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "elementTarget" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "actionability" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "needsClarify" BOOLEAN NOT NULL DEFAULT false,
    "ambiguityReason" TEXT,
    "priorityHint" TEXT NOT NULL,
    "rawOutput" TEXT,

    CONSTRAINT "LLMAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueCluster" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "frameName" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "effortEstimate" TEXT,
    "assignee" TEXT,
    "notes" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IssueCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextJobId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "setupComplete" BOOLEAN NOT NULL DEFAULT false,
    "slackWebhookUrl" TEXT,
    "autoPostSlack" BOOLEAN NOT NULL DEFAULT false,
    "confluenceBaseUrl" TEXT,
    "confluenceEmail" TEXT,
    "confluenceToken" TEXT,
    "confluenceSpaceKey" TEXT,
    "confluenceParentId" TEXT,
    "cronEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewComments" BOOLEAN NOT NULL DEFAULT true,
    "notifySyncComplete" BOOLEAN NOT NULL DEFAULT true,
    "llmProvider" TEXT NOT NULL DEFAULT 'google',
    "llmModel" TEXT,
    "llmApiKey" TEXT,
    "archiveDays" INTEGER NOT NULL DEFAULT 90,
    "skipLlm" BOOLEAN NOT NULL DEFAULT false,
    "figmaAccessToken" TEXT,
    "lastCronRunAt" TIMESTAMP(3),

    CONSTRAINT "TeamConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CardClusters" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CardClusters_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Project_archived_idx" ON "Project"("archived");

-- CreateIndex
CREATE UNIQUE INDEX "FigmaFile_fileKey_key" ON "FigmaFile"("fileKey");

-- CreateIndex
CREATE INDEX "FigmaFile_projectId_idx" ON "FigmaFile"("projectId");

-- CreateIndex
CREATE INDEX "Comment_fileId_idx" ON "Comment"("fileId");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Comment_processed_createdAt_idx" ON "Comment"("processed", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReviewRound_projectId_syncedAt_idx" ON "ReviewRound"("projectId", "syncedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCard_commentId_key" ON "ReviewCard"("commentId");

-- CreateIndex
CREATE INDEX "ReviewCard_roundId_idx" ON "ReviewCard"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "LLMAssessment_cardId_key" ON "LLMAssessment"("cardId");

-- CreateIndex
CREATE INDEX "IssueCluster_roundId_idx" ON "IssueCluster"("roundId");

-- CreateIndex
CREATE INDEX "IssueCluster_status_idx" ON "IssueCluster"("status");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_projectId_idx" ON "Job"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "_CardClusters_B_index" ON "_CardClusters"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FigmaFile" ADD CONSTRAINT "FigmaFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FigmaFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRound" ADD CONSTRAINT "ReviewRound_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCard" ADD CONSTRAINT "ReviewCard_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCard" ADD CONSTRAINT "ReviewCard_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ReviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLMAssessment" ADD CONSTRAINT "LLMAssessment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "ReviewCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueCluster" ADD CONSTRAINT "IssueCluster_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ReviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CardClusters" ADD CONSTRAINT "_CardClusters_A_fkey" FOREIGN KEY ("A") REFERENCES "IssueCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CardClusters" ADD CONSTRAINT "_CardClusters_B_fkey" FOREIGN KEY ("B") REFERENCES "ReviewCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

