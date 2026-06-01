import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Mail, Sparkles, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { ScoreRing } from "@/components/ScoreRing";
import {
  formatINR,
  formatINRFull,
  issues,
  topProducts,
  weeklyRevenue,
  weeklyStats,
} from "@/lib/mock-data";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — StoreCoach" },
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
        {bad ? "▼ Needs work" : pos ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
        {!bad && (
          <>
            {pos ? "+" : ""}
            {change}% vs last week
          </>
        )}
      </div>
    </div>
  );
}

function ReportsPage() {
  const maxRev = Math.max(...weeklyRevenue.map((w) => w.value));
  const fixedCount = 0;
  const fixedPct = (fixedCount / issues.length) * 100;
  const maxProductRev = Math.max(...topProducts.map((p) => p.revenue));

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="flex items-start justify-between mb-6 animate-fade-up">
        <div>
          <div className="label-eyebrow">Reports</div>
          <h1 className="display text-[28px] font-bold tracking-tight">Weekly Reports</h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Week of {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2.5 rounded-xl border bg-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
            <Download className="size-4" /> Download PDF
          </button>
          <button className="gradient-emerald text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 glow-emerald hover:opacity-95">
            <Mail className="size-4" /> Email Report
          </button>
        </div>
      </div>

      {/* Performance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenue" value={formatINR(weeklyStats.revenue.value)} change={weeklyStats.revenue.change} delay={60} />
        <StatCard label="Orders" value={String(weeklyStats.orders.value)} change={weeklyStats.orders.change} delay={100} />
        <StatCard label="New Customers" value={String(weeklyStats.newCustomers.value)} change={weeklyStats.newCustomers.change} delay={140} />
        <StatCard label="Avg Load Time" value={`${weeklyStats.loadTime.value}s`} change={weeklyStats.loadTime.change} bad delay={180} />
      </div>

      {/* Revenue chart */}
      <div className="surface-card p-6 mb-6 animate-fade-up" style={{ animationDelay: "220ms" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="label-eyebrow">Trend</div>
            <h2 className="display text-[17px] font-bold tracking-tight">Monthly Revenue Trend</h2>
          </div>
          <div className="text-[12px] mono" style={{ color: "var(--text-muted)" }}>
            Last 4 weeks
          </div>
        </div>
        <div className="h-56 flex items-end gap-6 px-2 relative">
          {/* gridlines */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-dashed"
              style={{ borderColor: "var(--border)", bottom: `${(i / 3) * 100}%` }}
            />
          ))}
          {weeklyRevenue.map((w, i) => {
            const h = (w.value / maxRev) * 100;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-2 z-10">
                <div className="mono text-[12px] font-bold">{formatINR(w.value)}</div>
                <div className="w-full max-w-[80px] flex flex-col justify-end" style={{ height: 180 }}>
                  <div
                    className="w-full rounded-t-xl animate-fade-up"
                    style={{
                      height: `${h}%`,
                      background: "linear-gradient(180deg, oklch(0.78 0.16 165) 0%, oklch(0.68 0.18 170) 100%)",
                      animationDelay: `${300 + i * 80}ms`,
                      boxShadow: "0 4px 12px -4px color-mix(in oklab, var(--emerald-brand) 50%, transparent)",
                    }}
                  />
                </div>
                <div className="text-[11.5px] mono" style={{ color: "var(--text-secondary)" }}>
                  {w.week}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Resolution tracker */}
        <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: "280ms" }}>
          <div className="label-eyebrow">Progress</div>
          <h3 className="display text-[17px] font-bold tracking-tight mb-4">Issues Fixed This Month</h3>
          <div className="flex items-center gap-5 mb-5">
            <ScoreRing score={fixedPct} size={96} stroke={8} />
            <div>
              <div className="display text-[24px] font-bold">
                {fixedCount} <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>of {issues.length}</span>
              </div>
              <div className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                fixed so far
              </div>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {issues.map((i) => (
              <div key={i.id} className="flex items-center gap-3 text-[12.5px]">
                <span className="size-2 rounded-full shrink-0" style={{ background: "var(--text-muted)" }} />
                <span className="flex-1 truncate">{i.title}</span>
                <span className="mono text-[11px] font-bold" style={{ color: "var(--danger)" }}>
                  {formatINRFull(i.revenueImpact)}
                </span>
              </div>
            ))}
          </div>
          <Link
            to="/action-plan"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
            style={{ color: "var(--emerald-brand)" }}
          >
            Start fixing <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Top products */}
        <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: "320ms" }}>
          <div className="label-eyebrow">Bestsellers</div>
          <h3 className="display text-[17px] font-bold tracking-tight mb-4">Top Products This Week</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <div
                  className="size-7 rounded-lg flex items-center justify-center display text-[12px] font-bold shrink-0"
                  style={{
                    background: i === 0 ? "var(--emerald-brand-soft)" : "var(--muted)",
                    color: i === 0 ? "var(--emerald-brand)" : "var(--text-secondary)",
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{p.name}</div>
                  <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                    <div
                      className="h-full gradient-emerald rounded-full"
                      style={{ width: `${(p.revenue / maxProductRev) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="mono text-[12.5px] font-bold">{formatINR(p.revenue)}</div>
                  <div className="mono text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                    {p.orders} orders
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <div
        className="surface-card p-6 animate-fade-up"
        style={{ animationDelay: "360ms", borderLeft: "4px solid var(--emerald-brand)" }}
      >
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-xl gradient-emerald flex items-center justify-center shrink-0 glow-emerald">
            <Sparkles className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="label-eyebrow" style={{ color: "var(--emerald-brand)" }}>
              ◆ AI Weekly Summary
            </div>
            <h3 className="display text-[17px] font-bold tracking-tight mt-1">
              A strong week, but you're leaving real money on the table.
            </h3>
            <p className="text-[13.5px] leading-relaxed mt-2" style={{ color: "var(--text-secondary)" }}>
              Revenue climbed 17.6% to ₹1.27L — your best week this month, driven by Linen Throw and Ceramic Vase Set.
              However, mobile load time held at 7.8s and zero audit issues were resolved. Fixing just the JavaScript
              bloat this week would unlock an estimated ₹38,000/month in additional recurring revenue. Friday was your
              top sales day; consider doubling down on weekend campaigns.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span
                className="text-[11px] mono font-bold px-2.5 py-1 rounded-full"
                style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}
              >
                🏆 Best day: Friday
              </span>
              <span
                className="text-[11px] mono font-bold px-2.5 py-1 rounded-full"
                style={{ background: "color-mix(in oklab, var(--electric) 12%, white)", color: "var(--electric)" }}
              >
                ⭐ Best product: Linen Throw
              </span>
              <span
                className="text-[11px] mono font-bold px-2.5 py-1 rounded-full"
                style={{ background: "color-mix(in oklab, var(--warn) 14%, white)", color: "var(--warn)" }}
              >
                🚀 Biggest opportunity: App JS cleanup
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
