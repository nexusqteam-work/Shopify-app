import { createFileRoute } from "@tanstack/react-router";
import { Plus, Star, Zap, IndianRupee, Package, Sparkles, Clock } from "lucide-react";
import { competitors, formatRelativeMinutes } from "@/lib/mock-data";

export const Route = createFileRoute("/competitors")({
  head: () => ({
    meta: [
      { title: "Competitors — StoreCoach" },
      { name: "description", content: "Competitive intelligence on rival Shopify stores updated daily." },
    ],
  }),
  component: CompetitorsPage,
});

const threatStyles = {
  high: { bg: "color-mix(in oklab, var(--danger) 14%, white)", fg: "var(--danger)", label: "HIGH THREAT" },
  medium: { bg: "color-mix(in oklab, var(--warn) 14%, white)", fg: "var(--warn)", label: "MEDIUM THREAT" },
  low: { bg: "color-mix(in oklab, var(--emerald-brand) 14%, white)", fg: "var(--emerald-brand)", label: "LOW THREAT" },
} as const;

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="size-3"
          fill={i <= Math.round(rating) ? "var(--warn)" : "transparent"}
          style={{ color: "var(--warn)" }}
        />
      ))}
      <span className="mono text-[12px] font-bold ml-1">{rating}</span>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Zap;
  label: string;
  value: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-xl p-3.5 border" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--background) 50%, white)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="size-3.5" style={{ color: "var(--text-muted)" }} />
        <span className="label-eyebrow">{label}</span>
      </div>
      <div className="mono text-[15px] font-bold" style={{ color: color ?? "var(--foreground)" }}>
        {value}
      </div>
    </div>
  );
}

function CompetitorsPage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="flex items-start justify-between mb-6 animate-fade-up">
        <div>
          <div className="label-eyebrow">Intelligence</div>
          <h1 className="display text-[28px] font-bold tracking-tight">Competitor Intelligence</h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Monitoring {competitors.length} competitors · Updated every 24 hours
          </p>
        </div>
        <button className="gradient-emerald text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 glow-emerald hover:opacity-95 active:scale-[0.98] transition">
          <Plus className="size-4" /> Add Competitor
        </button>
      </div>

      <div className="space-y-4 mb-6">
        {competitors.map((c, i) => {
          const t = threatStyles[c.threat];
          const speedColor = c.speed < 3 ? "var(--emerald-brand)" : c.speed > 5 ? "var(--danger)" : "var(--warn)";
          return (
            <div
              key={c.name}
              className="surface-card p-6 animate-fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="display text-[18px] font-bold tracking-tight">{c.name}</h2>
                    <span
                      className="text-[10.5px] mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: t.bg, color: t.fg }}
                    >
                      {t.label}
                    </span>
                  </div>
                  <div className="mono text-[12px] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "var(--text-muted)" }}>
                    <span>{c.url}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      Checked {formatRelativeMinutes(c.lastCheckedMinutes)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox
                  icon={Zap}
                  label="Page Speed"
                  value={`${c.speed}s ${c.speed < 3 ? "✅" : c.speed > 5 ? "❌" : ""}`}
                  color={speedColor}
                />
                <StatBox
                  icon={IndianRupee}
                  label="Price Range"
                  value={`₹${c.priceLow.toLocaleString("en-IN")} – ₹${c.priceHigh.toLocaleString("en-IN")}`}
                />
                <StatBox
                  icon={Star}
                  label="Review Score"
                  value={<Stars rating={c.reviews} />}
                />
                <StatBox icon={Package} label="Apps Installed" value={`${c.apps} apps`} />
              </div>

              <div
                className="rounded-xl p-4 flex gap-3"
                style={{
                  background: "color-mix(in oklab, var(--electric) 6%, white)",
                  border: "1px solid color-mix(in oklab, var(--electric) 18%, transparent)",
                }}
              >
                <Sparkles className="size-4 mt-0.5 shrink-0" style={{ color: "var(--electric)" }} />
                <div>
                  <div
                    className="label-eyebrow mb-1"
                    style={{ color: "var(--electric)" }}
                  >
                    ◆ AI Insight
                  </div>
                  <p className="text-[13px] leading-relaxed">{c.insight}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global summary */}
      <div
        className="rounded-2xl p-7 text-white animate-fade-up"
        style={{
          background: "linear-gradient(135deg, #1E3A8A 0%, #3B82F6 70%, #06B6D4 100%)",
        }}
      >
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <Sparkles className="size-6 text-white" />
          </div>
          <div>
            <div className="mono text-[11px] uppercase tracking-widest font-bold text-white/70 mb-1">
              ◆ Competitive Summary
            </div>
            <h3 className="display text-[18px] font-bold mb-2">
              You're sandwiched between speed and price competition.
            </h3>
            <p className="text-[13.5px] leading-relaxed text-white/90 max-w-3xl">
              ZenHome's 2.1s load time is your top threat — they're winning organic traffic on shared keywords purely
              on technical performance. UrbanNest is squeezing you from below on price. Your defensible position is{" "}
              <strong>premium product quality + faster store</strong>. Fix the JS bloat this week and you neutralize
              your single biggest competitive disadvantage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
