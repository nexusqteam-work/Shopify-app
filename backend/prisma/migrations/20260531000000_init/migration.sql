-- ═══════════════════════════════════════════════════
--  Initial Migration — Flovix Database
--  Auto-generated from Prisma schema
-- ═══════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'GROWTH', 'PRO', 'AGENCY');
CREATE TYPE "AuditStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "IssuePriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "IssueCategory" AS ENUM ('SPEED', 'SEO', 'CONVERSION', 'PRODUCT', 'CHECKOUT', 'MOBILE', 'APPS');
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable: merchants
CREATE TABLE "merchants" (
    "id"             TEXT NOT NULL,
    "shopDomain"     TEXT NOT NULL,
    "shopName"       TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "accessToken"    TEXT NOT NULL,
    "plan"           "Plan" NOT NULL DEFAULT 'FREE',
    "planExpiresAt"  TIMESTAMP(3),
    "billingId"      TEXT,
    "timezone"       TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "currency"       TEXT NOT NULL DEFAULT 'INR',
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "installedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "merchants_shopDomain_key" ON "merchants"("shopDomain");

-- CreateTable: audits
CREATE TABLE "audits" (
    "id"               TEXT NOT NULL,
    "merchantId"       TEXT NOT NULL,
    "status"           "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "overallScore"     INTEGER,
    "totalRevenueLoss" DOUBLE PRECISION,
    "speedScore"       INTEGER,
    "seoScore"         INTEGER,
    "conversionScore"  INTEGER,
    "productScore"     INTEGER,
    "checkoutScore"    INTEGER,
    "mobileScore"      INTEGER,
    "rawSpeedData"     JSONB,
    "rawSeoData"       JSONB,
    "rawAppData"       JSONB,
    "rawProductData"   JSONB,
    "rawCheckoutData"  JSONB,
    "aiSummary"        TEXT,
    "aiInsights"       JSONB,
    "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"      TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable: issues
CREATE TABLE "issues" (
    "id"              TEXT NOT NULL,
    "merchantId"      TEXT NOT NULL,
    "auditId"         TEXT,
    "priority"        "IssuePriority" NOT NULL,
    "category"        "IssueCategory" NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "impact"          DOUBLE PRECISION NOT NULL,
    "effortMinutes"   INTEGER NOT NULL,
    "fixInstructions" TEXT NOT NULL,
    "shopifyAdminUrl" TEXT,
    "isFixed"         BOOLEAN NOT NULL DEFAULT false,
    "fixedAt"         TIMESTAMP(3),
    "fixedNote"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable: competitors
CREATE TABLE "competitors" (
    "id"            TEXT NOT NULL,
    "merchantId"    TEXT NOT NULL,
    "storeName"     TEXT NOT NULL,
    "storeUrl"      TEXT NOT NULL,
    "niche"         TEXT,
    "threatLevel"   TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "competitors_merchantId_storeUrl_key" ON "competitors"("merchantId", "storeUrl");

-- CreateTable: competitor_snapshots
CREATE TABLE "competitor_snapshots" (
    "id"            TEXT NOT NULL,
    "competitorId"  TEXT NOT NULL,
    "speedScore"    DOUBLE PRECISION,
    "priceRangeMin" DOUBLE PRECISION,
    "priceRangeMax" DOUBLE PRECISION,
    "reviewScore"   DOUBLE PRECISION,
    "appCount"      INTEGER,
    "productCount"  INTEGER,
    "aiInsight"     TEXT,
    "capturedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competitor_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chat_messages
CREATE TABLE "chat_messages" (
    "id"         TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "sessionId"  TEXT NOT NULL,
    "role"       TEXT NOT NULL,
    "content"    TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chat_messages_merchantId_sessionId_idx" ON "chat_messages"("merchantId", "sessionId");

-- CreateTable: store_metrics
CREATE TABLE "store_metrics" (
    "id"             TEXT NOT NULL,
    "merchantId"     TEXT NOT NULL,
    "date"           DATE NOT NULL,
    "revenue"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orders"         INTEGER NOT NULL DEFAULT 0,
    "visitors"       INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgOrderValue"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newCustomers"   INTEGER NOT NULL DEFAULT 0,
    "refundRate"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "store_metrics_merchantId_date_key" ON "store_metrics"("merchantId", "date");

-- CreateTable: reports
CREATE TABLE "reports" (
    "id"          TEXT NOT NULL,
    "merchantId"  TEXT NOT NULL,
    "type"        "ReportType" NOT NULL,
    "period"      TEXT NOT NULL,
    "data"        JSONB NOT NULL,
    "aiSummary"   TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reports_merchantId_type_period_key" ON "reports"("merchantId", "type", "period");

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id"         TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "data"       JSONB,
    "isRead"     BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys
ALTER TABLE "audits"               ADD CONSTRAINT "audits_merchantId_fkey"              FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;
ALTER TABLE "issues"               ADD CONSTRAINT "issues_merchantId_fkey"              FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;
ALTER TABLE "issues"               ADD CONSTRAINT "issues_auditId_fkey"                 FOREIGN KEY ("auditId")    REFERENCES "audits"("id");
ALTER TABLE "competitors"          ADD CONSTRAINT "competitors_merchantId_fkey"         FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;
ALTER TABLE "competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE;
ALTER TABLE "chat_messages"        ADD CONSTRAINT "chat_messages_merchantId_fkey"       FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;
ALTER TABLE "store_metrics"        ADD CONSTRAINT "store_metrics_merchantId_fkey"       FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;
ALTER TABLE "reports"              ADD CONSTRAINT "reports_merchantId_fkey"             FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;
ALTER TABLE "notifications"        ADD CONSTRAINT "notifications_merchantId_fkey"       FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;
