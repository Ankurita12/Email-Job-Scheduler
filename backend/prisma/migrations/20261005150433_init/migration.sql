-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled', 'partial');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "status" "LogStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "previewUrl" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailJob_idempotencyKey_key" ON "EmailJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailJob_status_scheduledAt_idx" ON "EmailJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "EmailLog_jobId_idx" ON "EmailLog"("jobId");

-- CreateIndex
CREATE INDEX "EmailLog_toEmail_idx" ON "EmailLog"("toEmail");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_jobId_toEmail_key" ON "EmailLog"("jobId", "toEmail");

-- AddForeignKey
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "EmailJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
