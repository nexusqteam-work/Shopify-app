import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Mail, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { ScoreRing } from "@/components/ScoreRing";
import { formatINR, formatINRFull } from "@/lib/mock-data";
import { reportsApi, metricsApi, issuesApi, auditApi } from "@/lib/api";
import { useMerchant } from "@/hooks/useMerchant";
import { SkeletonCard } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports - StoreCoach" },
      { name: "description", content: "Weekly performance reports and AI-generated summaries of your store." },
    ],
  }),
  component: ReportsPage,
});

function StatCard({
  label,
  value,
  change,
  bad,
  suffix,
  delay,
}: {
  label: string;
  value: string;
  change: number;
  bad?: boolean;
  suffix?: string;
  delay: number;
}) {
  const pos = change >= 0;
  const color = bad ? "var(--danger)" : pos ? "var(--emerald-brand)" : "var(--danger)";
  return (
    <div className="surface-card p-5 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="label-eyebrow">{label}</div>
      <div className="display text-[28px] font-bold mt-1 tracking-tight">
        {value}
        {suffix && <span className="text-[14px] mono ml-1" style={{ color: "var(--text-muted)" }}>{suffix}</span>}
      </div>
      <div className="flex items-center gap-1 mt-1 text-[12px] mono font-bold" style={{ color }}>
        {bad ? "Needs work" : pos ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
        {!bad && `${pos ? "+" : ""}${change}% vs previous period`}
      </div>
    </div>
  );
}

function calculatePeriodChanges(current: number, previous: number) {
  if (!previous) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function buildWeeklyRevenue(metrics: any[]) {
  const weekly: Record<string, number> = {};
  metrics.forEach((m) => {
    const d = new Date(m.date || Date.now());
    // Get week number of the year approximately, or just month-week
    const weekStr = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString('en-US', { month: 'short' })}`;
    weekly[weekStr] = (weekly[weekStr] || 0) + (m.revenue || 0);
  });
  return Object.entries(weekly).map(([week, value]) => ({ week, value }));
}

function ReportsPage() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();
  
  const { data: reportsRes, isPending: loadingReports, isError: errorReports, refetch: refetchReports } = useQuery({
    queryKey: ["reports"],
    queryFn: () => reportsApi.getAll(),
    enabled: !!merchant,
  });
  const latestReportId = reportsRes?.reports?.[0]?.id;
  const { data: latestReportRes } = useQuery({
    queryKey: ["report", latestReportId],
    queryFn: () => reportsApi.getById(latestReportId!),
    enabled: !!latestReportId,
  });
  
  const { data: metricsRes, isPending: loadingMetrics, isError: errorMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ["metrics-daily", 35],
    queryFn: () => metricsApi.getDaily(35),
    enabled: !!merchant,
  });
  
  const { data: issueSummaryRes, isPending: loadingIssues, isError: errorIssues, refetch: refetchIssues } = useQuery({
    queryKey: ["issue-summary"],
    queryFn: () => issuesApi.summary(),
    enabled: !!merchant,
  });
  
  const { data: latestAuditRes, isPending: loadingAudit, isError: errorAudit, refetch: refetchAudit } = useQuery({
    queryKey: ["latest-audit"],
    queryFn: () => auditApi.getLatest(),
    enabled: !!merchant,
  });

  const generateMutation = useMutation({
    mutationFn: () => reportsApi.generate(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: (id: string) => reportsApi.email(id),
  });

  const isPending = loadingReports || loadingMetrics || loadingIssues || loadingAudit;
  const isError = errorReports || errorMetrics || errorIssues || errorAudit;

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8">
        <ErrorState message="Failed to load reports data." onRetry={() => {
          refetchReports();
          refetchMetrics();
          refetchIssues();
          refetchAudit();
        }} />
      </div>
    );
  }

  const metrics = metricsRes?.metrics ?? [];
  const currentWeek = metrics.slice(-7);
  const previousWeek = metrics.slice(-14, -7);
  const latestReport = latestReportRes?.report;
  const weeklyRevenue = buildWeeklyRevenue(metrics);
  const maxRev = Math.max(...weeklyRevenue.map((point) => point.value), 1);

  const currentRevenue = currentWeek.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0);
  const previousRevenue = previousWeek.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0);
  const currentOrders = currentWeek.reduce((sum: number, item: any) => sum + (item.orders || 0), 0);
  const previousOrders = previousWeek.reduce((sum: number, item: any) => sum + (item.orders || 0), 0);
  const currentCustomers = currentWeek.reduce((sum: number, item: any) => sum + (item.newCustomers || 0), 0);
  const previousCustomers = previousWeek.reduce((sum: number, item: any) => sum + (item.newCustomers || 0), 0);
  const currentLoadTime = latestAuditRes?.audit?.speedScore ? Math.max(1, Number((10 - latestAuditRes.audit.speedScore / 10).toFixed(1))) : 0;
  const issueSummaryData = issueSummaryRes?.summary || { total: 0, fixed: 0, open: 0, critical: 0, totalLoss: 0 };

  const weeklyStats = {
    revenue: { value: currentRevenue, change: calculatePeriodChanges(currentRevenue, previousRevenue) },
    orders: { value: currentOrders, change: calculatePeriodChanges(currentOrders, previousOrders) },
    newCustomers: { value: currentCustomers, change: calculatePeriodChanges(currentCustomers, previousCustomers) },
    loadTime: { value: currentLoadTime, change: 0 },
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="flex items-start justify-between mb-6 animate-fade-up">
        <div>
          <div className="label-eyebrow">Reports</div>
          <h1 className="display text-[28px] font-bold tracking-tight">Weekly Reports</h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Live metrics and generated report summaries from your backend
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2.5 rounded-xl border bg-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
            <Download className="size-4" /> Download PDF
          </button>
          <button
            onClick={() => latestReportId && emailMutation.mutate(latestReportId)}
            disabled={!latestReportId || emailMutation.isPending}
            className="gradient-emerald text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 glow-emerald hover:opacity-95 disabled:opacity-50"
          >
            <Mail className="size-4" /> Email Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenue" value={formatINR(weeklyStats.revenue.value)} change={weeklyStats.revenue.change} delay={60} />
        <StatCard label="Orders" value={String(weeklyStats.orders.value)} change={weeklyStats.orders.change} delay={100} />
        <StatCard label="New Customers" value={String(weeklyStats.newCustomers.value)} change={weeklyStats.newCustomers.change} delay={140} />
        <StatCard label="Avg Load Time" value={`${weeklyStats.loadTime.value}s`} change={weeklyStats.loadTime.change} bad delay={180} />
      </div>

      <div className="surface-card p-6 mb-6 animate-fade-up" style={{ animationDelay: "220ms" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="label-eyebrow">Trend</div>
            <h2 className="display text-[17px] font-bold tracking-tight">Revenue Trend</h2>
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gradient-emerald text-white px-4 py-2 rounded-xl text-[12.5px] font-semibold disabled:opacity-50"
          >
            {generateMutation.isPending ? "Generating..." : "Generate latest report"}
          </button>
        </div>
        <div className="h-56 flex items-end gap-6 px-2 relative">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-dashed" style={{ borderColor: "var(--border)", bottom: `${(i / 3) * 100}%` }} />
          ))}
          {weeklyRevenue.map((point, i) => {
            const height = (point.value / maxRev) * 100;
            return (
              <div key={`${point.week}-${i}`} className="flex-1 flex flex-col items-center gap-2 z-10">
                <div className="mono text-[12px] font-bold">{formatINR(point.value)}</div>
                <div className="w-full max-w-[80px] flex flex-col justify-end" style={{ height: 180 }}>
                  <div
                    className="w-full rounded-t-xl animate-fade-up"
                    style={{
                      height: `${height}%`,
                      background: "linear-gradient(180deg, oklch(0.78 0.16 165) 0%, oklch(0.68 0.18 170) 100%)",
                      animationDelay: `${300 + i * 80}ms`,
                    }}
                  />
                </div>
                <div className="text-[11.5px] mono" style={{ color: "var(--text-secondary)" }}>{point.week}</div>
              </div>
            );
          })}
        </div>
        {weeklyRevenue.length === 0 && (
          <div className="mt-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            No metric history yet. Sync metrics from Shopify first.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: "280ms" }}>
          <div className="label-eyebrow">Progress</div>
          <h3 className="display text-[17px] font-bold tracking-tight mb-4">Issues Fixed</h3>
          <div className="flex items-center gap-5 mb-5">
            <ScoreRing
              score={issueSummaryData?.total ? (issueSummaryData.fixed / issueSummaryData.total) * 100 : 0}
              size={96}
              stroke={8}
            />
            <div>
              <div className="display text-[24px] font-bold">
                {issueSummaryData?.fixed ?? 0}
                <span className="text-[16px]" style={{ color: "var(--text-muted)" }}> of {issueSummaryData?.total ?? 0}</span>
              </div>
              <div className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>fixed so far</div>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-[12.5px]">
              <span>Open issues</span>
              <span className="mono font-bold">{issueSummaryData?.open ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span>Critical issues</span>
              <span className="mono font-bold">{issueSummaryData?.critical ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span>Recoverable loss</span>
              <span className="mono font-bold" style={{ color: "var(--danger)" }}>{formatINRFull(issueSummaryData?.totalLoss ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: "320ms" }}>
          <div className="label-eyebrow">Recent Reports</div>
          <h3 className="display text-[17px] font-bold tracking-tight mb-4">Generated Summaries</h3>
          <div className="space-y-3">
            {(reportsRes?.reports ?? []).slice(0, 4).map((report: any) => (
              <div key={report.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold">{report.period}</div>
                    <div className="text-[11px] mono" style={{ color: "var(--text-muted)" }}>{report.type}</div>
                  </div>
                  <div className="text-[11px] mono" style={{ color: "var(--text-secondary)" }}>
                    {new Date(report.createdAt).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                  {report.aiSummary ?? "No summary text stored for this report yet."}
                </p>
              </div>
            ))}
            {(reportsRes?.reports?.length ?? 0) === 0 && (
              <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                No reports generated yet. Use the button above to create your first backend report.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: "360ms", borderLeft: "4px solid var(--emerald-brand)" }}>
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-xl gradient-emerald flex items-center justify-center shrink-0 glow-emerald">
            <Sparkles className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="label-eyebrow" style={{ color: "var(--emerald-brand)" }}>AI Weekly Summary</div>
            <h3 className="display text-[17px] font-bold tracking-tight mt-1">
              {latestReport?.period ?? "Waiting for a generated report"}
            </h3>
            <p className="text-[13.5px] leading-relaxed mt-2" style={{ color: "var(--text-secondary)" }}>
              {latestReport?.aiSummary ?? "Generate a weekly report to pull a backend-authored AI summary into the frontend."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
