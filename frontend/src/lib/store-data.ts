import { ApiError, api } from "./api-client";
import type { Category, Competitor, Issue, Store } from "./mock-data";

export type Merchant = {
  id: string;
  shopDomain: string;
  shopName: string;
  email: string;
  plan: string;
  timezone?: string;
  currency: string;
  installedAt?: string;
  lastSeenAt?: string;
};

export type BackendMetric = {
  date: string;
  revenue: number;
  orders: number;
  visitors: number;
  conversionRate: number;
  avgOrderValue: number;
  newCustomers: number;
  refundRate: number;
};

export type BackendIssue = {
  id: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  title: string;
  description: string;
  impact: number;
  effortMinutes: number;
  fixInstructions: string;
  shopifyAdminUrl: string | null;
  isFixed: boolean;
  fixedAt: string | null;
};

export type BackendAudit = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  overallScore: number | null;
  totalRevenueLoss: number | null;
  speedScore: number | null;
  seoScore: number | null;
  conversionScore: number | null;
  productScore: number | null;
  checkoutScore: number | null;
  mobileScore: number | null;
  aiSummary: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type BackendCompetitor = {
  id: string;
  storeName: string;
  storeUrl: string;
  niche: string | null;
  threatLevel: string | null;
  lastCheckedAt: string | null;
  snapshots: Array<{
    speedScore: number | null;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    reviewScore: number | null;
    appCount: number | null;
    aiInsight: string | null;
    capturedAt: string;
  }>;
};

export type BackendReport = {
  id: string;
  type: string;
  period: string;
  aiSummary: string | null;
  emailSentAt: string | null;
  createdAt: string;
  data?: {
    thisWeek?: {
      revenue?: number;
      orders?: number;
      visitors?: number;
      newCustomers?: number;
      avgCVR?: number;
      avgAOV?: number;
    };
    lastWeek?: {
      revenue?: number;
      orders?: number;
      visitors?: number;
      newCustomers?: number;
      avgCVR?: number;
      avgAOV?: number;
    };
    changes?: {
      revenue?: string | number;
      orders?: string | number;
      visitors?: string | number;
      cvr?: string | number;
    };
    issues?: {
      open?: number;
      fixed?: number;
    };
    auditScore?: number;
    revenueLoss?: number;
  };
};

export async function fetchMetricsSummary() {
  return api.get<{ success: boolean; summary: any; metrics: BackendMetric[] }>("/metrics/summary");
}

export async function fetchDailyMetrics(days = 30) {
  return api.get<{ success: boolean; metrics: BackendMetric[] }>(`/metrics/daily?days=${days}`);
}

export async function fetchIssues() {
  return api.get<{
    success: boolean;
    issues: BackendIssue[];
    totalLoss: number;
    totalEffortMinutes: number;
    count: number;
  }>("/issues");
}

export async function fetchIssueSummary() {
  return api.get<{
    success: boolean;
    total: number;
    open: number;
    fixed: number;
    critical: number;
    totalLoss: number;
    totalRecovered: number;
  }>("/issues/summary/stats");
}

export async function fetchLatestAudit() {
  try {
    return await api.get<{ success: boolean; audit: BackendAudit }>("/audits/latest");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { success: true, audit: null };
    }
    throw error;
  }
}

export async function fetchAuditStatus(auditId: string) {
  return api.get<{
    success: boolean;
    id: string;
    status: BackendAudit["status"];
    overallScore: number | null;
    completedAt: string | null;
  }>(`/audits/${auditId}/status`);
}

export async function runAudit() {
  return api.post<{ success: boolean; message: string; auditId: string }>("/audits/run", {});
}

export async function fetchCompetitors() {
  return api.get<{
    success: boolean;
    competitors: BackendCompetitor[];
    limit: number;
    used: number;
  }>("/competitors");
}

export async function fetchReports() {
  return api.get<{ success: boolean; reports: BackendReport[] }>("/reports");
}

export async function fetchReport(reportId: string) {
  return api.get<{ success: boolean; report: BackendReport }>(`/reports/${reportId}`);
}

export async function generateReport() {
  return api.post<{ success: boolean; report: BackendReport }>("/reports/generate", { type: "WEEKLY" });
}

export async function emailReport(reportId: string) {
  return api.post<{ success: boolean; message: string }>(`/reports/${reportId}/email`, {});
}

export async function markIssueFixed(issueId: string) {
  return api.patch<{ success: boolean; issue: BackendIssue }>(`/issues/${issueId}/fix`, {});
}

export async function markIssueOpen(issueId: string) {
  return api.patch<{ success: boolean }>(`/issues/${issueId}/unfix`, {});
}

export function buildStore(merchant: Merchant | null, audit: BackendAudit | null): Store {
  return {
    name: merchant?.shopName ?? "",
    url: merchant?.shopDomain ?? "",
    productCount: 0,
    appCount: 0,
    lastScannedMinutes: minutesAgo(audit?.completedAt ?? null),
  };
}

export function buildCategories(audit: BackendAudit | null): Category[] {
  if (!audit) return [];

  return [
    { key: "speed", emoji: "⚡", name: "Page Speed", score: audit.speedScore ?? 0 },
    { key: "seo", emoji: "🔎", name: "SEO", score: audit.seoScore ?? 0 },
    { key: "conversion", emoji: "📈", name: "Conversion", score: audit.conversionScore ?? 0 },
    { key: "product", emoji: "🛍️", name: "Product Pages", score: audit.productScore ?? 0 },
    { key: "checkout", emoji: "🧾", name: "Checkout", score: audit.checkoutScore ?? 0 },
    { key: "mobile", emoji: "📱", name: "Mobile UX", score: audit.mobileScore ?? 0 },
  ];
}

export function mapIssues(issues: BackendIssue[]): Issue[] {
  return issues.map((issue, index) => ({
    id: issue.id,
    rank: index + 1,
    priority: normalizePriority(issue.priority),
    title: issue.title,
    category: toTitleCase(issue.category),
    revenueImpact: issue.impact,
    effortLabel: formatEffort(issue.effortMinutes),
    effortMinutes: issue.effortMinutes,
    description: issue.description,
    fixSteps: issue.fixInstructions
      .split(/\r?\n/)
      .map((line) => line.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean),
    shopifyAdminPath: issue.shopifyAdminUrl ?? "",
  }));
}

export function mapCompetitors(competitors: BackendCompetitor[]): Competitor[] {
  return competitors.map((competitor) => {
    const latest = competitor.snapshots[0];

    return {
      name: competitor.storeName,
      url: competitor.storeUrl,
      speed: latest?.speedScore ?? 0,
      priceLow: latest?.priceRangeMin ?? 0,
      priceHigh: latest?.priceRangeMax ?? 0,
      reviews: latest?.reviewScore ?? 0,
      apps: latest?.appCount ?? 0,
      threat: normalizeThreat(competitor.threatLevel),
      lastCheckedMinutes: minutesAgo(competitor.lastCheckedAt),
      insight: latest?.aiInsight ?? "No AI insight available yet. Refresh this competitor to generate one.",
    };
  });
}

export function buildSparklines(metrics: BackendMetric[]) {
  const recent = metrics.slice(-7);
  return {
    revenue: recent.map((metric) => metric.revenue),
    orders: recent.map((metric) => metric.orders),
    visitors: recent.map((metric) => metric.visitors),
    conversion: recent.map((metric) => Number((metric.conversionRate * 100).toFixed(1))),
  };
}

export function buildWeeklyRevenue(metrics: BackendMetric[]) {
  const buckets = new Map<string, number>();

  metrics.forEach((metric) => {
    const date = new Date(metric.date);
    const key = `${date.getFullYear()}-${date.getMonth()}-${weekOfMonth(date)}`;
    buckets.set(key, (buckets.get(key) ?? 0) + metric.revenue);
  });

  return Array.from(buckets.entries())
    .slice(-4)
    .map(([key, value]) => {
      const [, month, week] = key.split("-");
      return {
        week: `W${Number(week) + 1}`,
        value,
        month: Number(month),
      };
    });
}

export function calculatePeriodChanges(current: number, previous: number) {
  if (!previous) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function formatEffort(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function normalizePriority(priority: BackendIssue["priority"]): Issue["priority"] {
  if (priority === "CRITICAL") return "critical";
  if (priority === "HIGH") return "high";
  return "medium";
}

function normalizeThreat(threatLevel: string | null): Competitor["threat"] {
  if (threatLevel === "HIGH") return "high";
  if (threatLevel === "MEDIUM") return "medium";
  return "low";
}

function minutesAgo(timestamp: string | null) {
  if (!timestamp) return 0;
  const diffMs = Date.now() - new Date(timestamp).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function weekOfMonth(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = start.getDay();
  return Math.floor((date.getDate() + offset - 1) / 7);
}
