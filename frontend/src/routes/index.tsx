import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  X,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  CheckCircle2,
  Bell,
} from "lucide-react";
import { useState } from "react";
import { ScoreRing } from "@/components/ScoreRing";
import { Sparkline } from "@/components/Sparkline";
import {
  categories,
  formatINR,
  formatINRFull,
  issues,
  metrics as mockMetrics,
  overallScore,
  sparklines,
  unreadNotifications,
} from "@/lib/mock-data";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — StoreCoach" },
      { name: "description", content: "Your store's revenue health, audit scores and top issues at a glance." },
    ],
  }),
  component: Dashboard,
});

function ChangeChip({ change, note }: { change: number; note?: string }) {
  if (note) {
    return (
      <span
        className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: "color-mix(in oklab, var(--warn) 14%, white)", color: "var(--warn)" }}
      >
        {note}
      </span>
    );
  }
  const pos = change >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mono"
      style={{
        background: pos ? "color-mix(in oklab, var(--emerald-brand) 14%, white)" : "color-mix(in oklab, var(--danger) 12%, white)",
        color: pos ? "var(--emerald-brand)" : "var(--danger)",
      }}
    >
      {pos ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {pos ? "+" : ""}{change}%
    </span>
  );
}

function MetricCard({
  label,
  value,
  change,
  note,
  data,
  color,
  format,
  delay,
}: {
  label: string;
  value: number;
  change: number;
  note?: string;
  data: number[];
  color: string;
  format: (v: number) => string;
  delay: number;
}) {
  return (
    <div
      className="surface-card surface-card-hover p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="label-eyebrow">{label}</div>
        <ChangeChip change={change} note={note} />
      </div>
      <div className="display text-[28px] font-bold mt-2 tracking-tight">{format(value)}</div>
      <div className="mt-2 -mx-1">
        <Sparkline data={data} color={color} width={200} height={36} />
      </div>
    </div>
  );
}

function Dashboard() {
  const [bannerOpen, setBannerOpen] = useState(true);
  const totalLoss = issues.reduce((s, i) => s + i.revenueImpact, 0);
  const { user } = useAuth();
  
  const { data: metricsData } = useQuery({
    queryKey: ['metrics-summary'],
    queryFn: () => api.get<{ success: boolean; summary: any; metrics: any[] }>('/metrics/summary'),
    enabled: !!user,
  });

  const displayMetrics = metricsData?.summary ? {
    revenue: { value: metricsData.summary.totalRevenue, change: parseFloat(metricsData.summary.revenueChange) || 0 },
    orders: { value: metricsData.summary.totalOrders, change: 0 },
    visitors: { value: metricsData.summary.totalVisitors, change: 0 },
    conversion: { value: Number((metricsData.summary.avgConversionRate * 100).toFixed(1)), change: 0 },
  } : mockMetrics;

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 animate-fade-up">
        <div>
          <h1 className="display text-[22px] sm:text-[28px] font-bold tracking-tight">Good morning, Rahul 👋</h1>
          <p className="mt-1.5 text-[13px] sm:text-[14px]" style={{ color: "var(--danger)" }}>
            Your store has <strong>{issues.length} critical issues</strong> costing{" "}
            <strong>{formatINRFull(totalLoss)}/month</strong>
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full surface-card">
            <span className="relative flex size-2">
              <span className="absolute inset-0 rounded-full animate-pulse-dot" style={{ background: "var(--emerald-brand)" }} />
              <span className="relative rounded-full size-2" style={{ background: "var(--emerald-brand)" }} />
            </span>
            <span className="text-[11px] mono font-bold uppercase tracking-wider">LIVE</span>
          </div>
          <button
            type="button"
            aria-label={`Notifications (${unreadNotifications} unread)`}
            className="hidden lg:flex relative size-10 rounded-full surface-card items-center justify-center hover:bg-[var(--muted)] transition"
          >
            <Bell className="size-[18px]" />
            {unreadNotifications > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] mono font-bold text-white flex items-center justify-center border-2 border-white"
                style={{ background: "var(--danger)" }}
              >
                {unreadNotifications}
              </span>
            )}
          </button>
          <div className="hidden sm:block text-[12.5px] mono" style={{ color: "var(--text-muted)" }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </div>

      {/* Alert banner */}
      {bannerOpen && (
        <div
          className="relative mb-6 p-4 pr-10 sm:pr-12 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-fade-up"
          style={{
            background: "linear-gradient(90deg, color-mix(in oklab, var(--danger) 10%, white), white)",
            borderLeft: "4px solid var(--danger)",
            border: "1px solid color-mix(in oklab, var(--danger) 18%, var(--border))",
            borderLeftWidth: 4,
            animationDelay: "60ms",
          }}
        >
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <div
              className="size-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "color-mix(in oklab, var(--danger) 14%, white)" }}
            >
              <AlertTriangle className="size-5" style={{ color: "var(--danger)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] sm:text-[13.5px] font-semibold">
                Revenue Leak Detected — You are losing{" "}
                <span className="mono whitespace-nowrap" style={{ color: "var(--danger)" }}>{formatINRFull(totalLoss)}</span> every month from{" "}
                {issues.length} fixable issues
              </div>
            </div>
          </div>
          <Link
            to="/action-plan"
            className="self-start sm:self-auto text-white font-semibold text-[13px] px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-95 active:scale-[0.98] transition whitespace-nowrap shrink-0"
            style={{ background: "var(--danger)" }}
          >
            Fix Issues Now <ArrowRight className="size-4" />
          </Link>
          <button
            onClick={() => setBannerOpen(false)}
            className="absolute top-3 right-3 size-7 rounded-md flex items-center justify-center hover:bg-[var(--muted)]"
          >
            <X className="size-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Monthly Revenue"
          value={displayMetrics.revenue.value}
          change={displayMetrics.revenue.change}
          data={sparklines.revenue}
          color="var(--emerald-brand)"
          format={formatINR}
          delay={80}
        />
        <MetricCard
          label="Total Orders"
          value={displayMetrics.orders.value}
          change={displayMetrics.orders.change}
          data={sparklines.orders}
          color="var(--electric)"
          format={(v) => v.toLocaleString("en-IN")}
          delay={120}
        />
        <MetricCard
          label="Store Visitors"
          value={displayMetrics.visitors.value}
          change={displayMetrics.visitors.change}
          data={sparklines.visitors}
          color="var(--danger)"
          format={(v) => v.toLocaleString("en-IN")}
          delay={160}
        />
        <MetricCard
          label="Conversion Rate"
          value={displayMetrics.conversion.value}
          change={0}
          note="Below Average"
          data={sparklines.conversion}
          color="var(--warn)"
          format={(v) => `${v}%`}
          delay={200}
        />
      </div>

      {/* Health grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:gap-6 mb-6">
        {/* Overall score */}
        <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: "240ms" }}>
          <div className="label-eyebrow mb-1">Overall Health</div>
          <div className="text-[15px] font-semibold mb-4">Store Score</div>
          <div className="flex flex-col items-center">
            <ScoreRing score={overallScore} size={140} stroke={10} />
            <div
              className="mt-3 text-[13px] font-semibold mono uppercase tracking-wider"
              style={{ color: "var(--warn)" }}
            >
              Needs Improvement
            </div>
            <div className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
              4 of 6 categories underperforming
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2">
            {categories.map((c) => (
              <div key={c.key} className="flex items-center gap-2 text-[12px]">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{
                    background:
                      c.score < 50 ? "var(--danger)" : c.score < 70 ? "var(--warn)" : "var(--emerald-brand)",
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="lg:col-span-2 surface-card p-6 animate-fade-up" style={{ animationDelay: "280ms" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="label-eyebrow">Categories</div>
              <div className="text-[15px] font-semibold">Performance Breakdown</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categories.map((c, i) => (
              <div
                key={c.key}
                className="rounded-xl p-4 border surface-card-hover animate-fade-up"
                style={{ borderColor: "var(--border)", animationDelay: `${320 + i * 40}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-xl">{c.emoji}</div>
                </div>
                <div className="text-[12.5px] font-semibold mb-2">{c.name}</div>
                <div className="flex items-center gap-3">
                  <ScoreRing score={c.score} size={56} stroke={5} />
                  <div
                    className="text-[11px] mono uppercase tracking-wider font-bold"
                    style={{
                      color:
                        c.score < 50 ? "var(--danger)" : c.score < 70 ? "var(--warn)" : "var(--emerald-brand)",
                    }}
                  >
                    {c.score < 50 ? "Poor" : c.score < 70 ? "Fair" : "Good"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top issues */}
        <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: "400ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-eyebrow" style={{ color: "var(--danger)" }}>Urgent</div>
              <div className="text-[15px] font-semibold">Action Required</div>
            </div>
            <span
              className="text-[11px] mono font-bold px-2 py-1 rounded-full"
              style={{ background: "color-mix(in oklab, var(--danger) 12%, white)", color: "var(--danger)" }}
            >
              {issues.length} OPEN
            </span>
          </div>
          <div className="space-y-2.5">
            {issues.slice(0, 3).map((iss) => (
              <div
                key={iss.id}
                className="flex items-center gap-3 p-3 rounded-xl border hover:border-[var(--emerald-brand)] transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ background: iss.priority === "critical" ? "var(--danger)" : "var(--warn)" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{iss.title}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11.5px] mono font-bold" style={{ color: "var(--danger)" }}>
                      {formatINRFull(iss.revenueImpact)}/mo
                    </span>
                    <span
                      className="text-[10.5px] mono px-1.5 py-0.5 rounded"
                      style={{ background: "var(--muted)", color: "var(--text-secondary)" }}
                    >
                      <Clock className="inline size-3 mr-0.5" />
                      {iss.effortLabel}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/action-plan"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold"
            style={{ color: "var(--emerald-brand)" }}
          >
            View All {issues.length} Issues <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Quick wins */}
        <QuickWins />
      </div>
    </div>
  );
}

function QuickWins() {
  const wins = [
    { id: "w1", title: "Enable Shop Pay one-tap checkout", time: "5 min", recovery: 8000 },
    { id: "w2", title: "Hide phone & company fields at checkout", time: "10 min", recovery: 11000 },
    { id: "w3", title: "Add scarcity badge to top 10 products", time: "45 min", recovery: 14000 },
  ];
  const [done, setDone] = useState<Record<string, boolean>>({});

  return (
    <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: "440ms" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label-eyebrow" style={{ color: "var(--emerald-brand)" }}>Quick Wins</div>
          <div className="text-[15px] font-semibold">Under 1 Hour</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {wins.map((w) => {
          const checked = !!done[w.id];
          return (
            <label
              key={w.id}
              className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:border-[var(--emerald-brand)] transition"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                type="button"
                onClick={() => setDone((d) => ({ ...d, [w.id]: !d[w.id] }))}
                className="size-5 rounded-md border-2 flex items-center justify-center transition"
                style={{
                  borderColor: checked ? "var(--emerald-brand)" : "var(--border)",
                  background: checked ? "var(--emerald-brand)" : "transparent",
                }}
              >
                {checked && <CheckCircle2 className="size-4 text-white" strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13px] font-semibold transition ${checked ? "line-through opacity-50" : ""}`}
                >
                  {w.title}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10.5px] mono" style={{ color: "var(--text-muted)" }}>
                    <Clock className="inline size-3 mr-0.5" />
                    {w.time}
                  </span>
                  <span
                    className="text-[10.5px] mono font-bold"
                    style={{ color: "var(--emerald-brand)" }}
                  >
                    + {formatINRFull(w.recovery)}/mo
                  </span>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
