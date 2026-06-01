import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Mail, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { ScoreRing } from "@/components/ScoreRing";
import { formatINR, formatINRFull } from "@/lib/mock-data";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildWeeklyRevenue,
  calculatePeriodChanges,
  emailReport,
  fetchDailyMetrics,
  fetchIssueSummary,
  fetchLatestAudit,
  fetchReport,
  fetchReports,
  generateReport,
} from "@/lib/store-data";

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

function ReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: reportsData } = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
    enabled: !!user,
  });
  const latestReportId = reportsData?.reports?.[0]?.id;
  const { data: latestReportData } = useQuery({
    queryKey: ["report", latestReportId],
    queryFn: () => fetchReport(latestReportId!),
    enabled: !!latestReportId,
  });
  const { data: metricsData } = useQuery({
    queryKey: ["metrics-daily", 35],
    queryFn: () => fetchDailyMetrics(35),
    enabled: !!user,
  });
  const { data: issueSummaryData } = useQuery({
    queryKey: ["issue-summary"],
    queryFn: fetchIssueSummary,
    enabled: !!user,
  });
  const { data: latestAuditData } = useQuery({
    queryKey: ["latest-audit"],
    queryFn: fetchLatestAudit,
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: generateReport,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: emailReport,
  });

  const metrics = metricsData?.metrics ?? [];
  const currentWeek = metrics.slice(-7);
  const previousWeek = metrics.slice(-14, -7);
  const latestReport = latestReportData?.report;
  const weeklyRevenue = buildWeeklyRevenue(metrics);
  const maxRev = Math.max(...weeklyRevenue.map((point) => point.value), 1);

  const currentRevenue = currentWeek.reduce((sum, item) => sum + item.revenue, 0);
  const previousRevenue = previousWeek.reduce((sum, item) => sum + item.revenue, 0);
  const currentOrders = currentWeek.reduce((sum, item) => sum + item.orders, 0);
  const previousOrders = previousWeek.reduce((sum, item) => sum + item.orders, 0);
  const currentCustomers = currentWeek.reduce((sum, item) => sum + item.newCustomers, 0);
  const previousCustomers = previousWeek.reduce((sum, item) => sum + item.newCustomers, 0);
  const currentLoadTime = latestAuditData?.audit?.speedScore ? Math.max(1, Number((10 - latestAuditData.audit.speedScore / 10).toFixed(1))) : 0;

  const weeklyStats = useMemo(() => ({
    revenue: { value: currentRevenue, change: calculatePeriodChanges(currentRevenue, previousRevenue) },
    orders: { value: currentOrders, change: calculatePeriodChanges(currentOrders, previousOrders) },
    newCustomers: { value: currentCustomers, change: calculatePeriodChanges(currentCustomers, previousCustomers) },
    loadTime: { value: currentLoadTime, change: 0 },
  }), [currentRevenue, previousRevenue, currentOrders, previousOrders, currentCustomers, previousCustomers, currentLoadTime]);

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
            {(reportsData?.reports ?? []).slice(0, 4).map((report) => (
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
            {(reportsData?.reports?.length ?? 0) === 0 && (
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
