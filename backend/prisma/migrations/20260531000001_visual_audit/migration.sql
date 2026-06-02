-- ═══════════════════════════════════════════════════
--  Migration 002 — Visual Audit & Code Fix Tables
--  Run: npx prisma migrate dev --name visual_audit
-- ═══════════════════════════════════════════════════

-- Visual Audit Results table
CREATE TABLE "visual_audits" (
    "id"            TEXT NOT NULL,
    "merchantId"    TEXT NOT NULL,
    "auditId"       TEXT,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "plan"          TEXT NOT NULL,
    "score"         INTEGER,
    "pagesScanned"  INTEGER NOT NULL DEFAULT 0,
    "pageResults"   JSONB,
    "aiAnalysis"    TEXT,
    "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visual_audits_pkey" PRIMARY KEY ("id")
);

-- Code Fix Records table
CREATE TABLE "code_fixes" (
    "id"            TEXT NOT NULL,
    "merchantId"    TEXT NOT NULL,
    "issueId"       TEXT NOT NULL,
    "visualAuditId" TEXT,
    "cssCode"       TEXT NOT NULL,
    "liquidNote"    TEXT,
    "explanation"   TEXT,
    "riskLevel"     TEXT NOT NULL DEFAULT 'LOW',
    "status"        TEXT NOT NULL DEFAULT 'GENERATED',
    -- GENERATED | APPLIED | REVERTED | REJECTED
    "appliedAt"     TIMESTAMP(3),
    "revertedAt"    TIMESTAMP(3),
    "themeId"       TEXT,
    "tokensUsed"    INTEGER,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "code_fixes_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "visual_audits"
    ADD CONSTRAINT "visual_audits_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;

ALTER TABLE "visual_audits"
    ADD CONSTRAINT "visual_audits_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "audits"("id");

ALTER TABLE "code_fixes"
    ADD CONSTRAINT "code_fixes_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX "visual_audits_merchantId_idx" ON "visual_audits"("merchantId");
CREATE INDEX "code_fixes_merchantId_idx"    ON "code_fixes"("merchantId");
CREATE INDEX "code_fixes_issueId_idx"       ON "code_fixes"("issueId");
