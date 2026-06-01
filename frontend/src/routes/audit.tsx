import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radar, Check, ArrowRight, Store, Sparkles } from "lucide-react";
import { ScoreRing } from "@/components/ScoreRing";
import { categories, formatINRFull, issues, overallScore, store } from "@/lib/mock-data";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Store Audit — StoreCoach" },
      { name: "description", content: "Run a deep AI scan across speed, SEO, apps, checkout, and mobile UX." },
    ],
  }),
  component: AuditPage,
});

const SCAN_STEPS = [
  "Connecting to Shopify Admin API…",
  "Fetching store metadata & 87 products…",
  "Scanning installed apps (11 detected)…",
  "Measuring page speed across 6 templates…",
  "Analyzing JavaScript payloads — 2.4MB total…",
  "Auditing SEO meta & schema markup…",
  "Tracing mobile checkout flow…",
  "Running AI revenue impact analysis…",
  "Compiling report & recommendations…",
];

type State = "pre" | "scanning" | "done";

function AuditPage() {
  const [state, setState] = useState<State>("pre");
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (state !== "scanning") return;
    const total = 5500;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / total) * 100);
      setProgress(p);
      setStepIndex(Math.min(SCAN_STEPS.length - 1, Math.floor((p / 100) * SCAN_STEPS.length)));
      if (p >= 100) {
        clearInterval(id);
        setTimeout(() => setState("done"), 400);
      }
    }, 80);
    return () => clearInterval(id);
  }, [state]);

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="mb-8 animate-fade-up">
        <div className="label-eyebrow">Audit</div>
        <h1 className="display text-[28px] font-bold tracking-tight">Store Audit</h1>
        <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
          A full diagnostic scan of your Shopify store across performance, SEO and UX.
        </p>
      </div>

      {state === "pre" && (
        <div className="mx-auto max-w-[560px] surface-card p-8 text-center animate-fade-up">
          <div className="size-14 rounded-2xl gradient-emerald flex items-center justify-center mx-auto glow-emerald">
            <Store className="size-7 text-white" />
          </div>
          <div className="display text-[22px] font-bold mt-4">{store.name}</div>
          <div className="mono text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
            {store.url}
          </div>
          <div className="mt-4 text-[12.5px] mono" style={{ color: "var(--text-secondary)" }}>
            {store.productCount} Products · {store.appCount} Apps · Last scanned 2 hours ago
          </div>

          <button
            onClick={() => { setState("scanning"); setProgress(0); setStepIndex(0); }}
            className="mt-6 inline-flex items-center gap-2 gradient-emerald text-white font-semibold px-6 py-3 rounded-full glow-emerald hover:opacity-95 active:scale-[0.98] transition"
          >
            <Radar className="size-4" />
            Start Deep Scan
          </button>
          <div className="text-[11.5px] mono mt-3" style={{ color: "var(--text-muted)" }}>
            ~60 seconds · Scans all pages, apps, checkout, SEO &amp; speed
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {["Page Speed", "SEO", "App Conflicts", "Checkout Flow"].map((c) => (
              <span
                key={c}
                className="text-[11px] mono font-semibold px-2.5 py-1 rounded-full border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {state === "scanning" && (
        <div className="mx-auto max-w-[720px] surface-card p-10 animate-fade-up">
          <div className="relative flex items-center justify-center h-40">
            <div
              className="absolute size-24 rounded-full animate-radar"
              style={{ background: "color-mix(in oklab, var(--emerald-brand) 30%, transparent)" }}
            />
            <div
              className="absolute size-24 rounded-full animate-radar"
              style={{
                background: "color-mix(in oklab, var(--emerald-brand) 30%, transparent)",
                animationDelay: "1.2s",
              }}
            />
            <div className="relative size-20 rounded-full gradient-emerald flex items-center justify-center glow-emerald">
              <Radar className="size-9 text-white" />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-semibold">{SCAN_STEPS[stepIndex]}</div>
              <div className="mono text-[12px] font-bold" style={{ color: "var(--emerald-brand)" }}>
                {progress.toFixed(0)}%
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
              <div
                className="h-full rounded-full transition-[width] duration-100 gradient-emerald"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div
            className="mt-6 rounded-xl p-4 mono text-[11.5px] h-44 overflow-hidden border"
            style={{ background: "#0D1320", color: "#9AE6C0", borderColor: "var(--border)" }}
          >
            {SCAN_STEPS.slice(0, stepIndex + 1).map((s, i) => (
              <div key={i} className="flex gap-2">
                <span style={{ color: "#6B7280" }}>$</span>
                <span>{s}</span>
                {i < stepIndex && <span style={{ color: "#34D399" }}>✓</span>}
              </div>
            ))}
            <div className="flex gap-2">
              <span style={{ color: "#6B7280" }}>{">"}</span>
              <span className="animate-pulse">▊</span>
            </div>
          </div>

          <div className="mt-5 text-center">
            <button
              onClick={() => setState("pre")}
              className="text-[12px] underline"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel scan
            </button>
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="space-y-6">
          <div className="surface-card p-8 text-center animate-fade-up">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
              style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}
            >
              <Check className="size-4" strokeWidth={3} />
              <span className="text-[12px] mono font-bold uppercase tracking-wider">Scan Complete</span>
            </div>
            <h2 className="display text-[22px] font-bold">Your store score is in</h2>
            <div className="flex justify-center mt-4">
              <ScoreRing score={overallScore} size={160} stroke={12} showLabel />
            </div>
            <div
              className="mt-6 mx-auto max-w-[640px] text-left rounded-2xl p-5 border"
              style={{
                borderColor: "color-mix(in oklab, var(--emerald-brand) 20%, var(--border))",
                background: "color-mix(in oklab, var(--emerald-brand) 4%, white)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4" style={{ color: "var(--emerald-brand)" }} />
                <span className="label-eyebrow" style={{ color: "var(--emerald-brand)" }}>
                  AI Summary
                </span>
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Your store scored <strong style={{ color: "var(--foreground)" }}>{overallScore}/100</strong> —
                in the <strong style={{ color: "var(--warn)" }}>"Needs Improvement"</strong> tier.
                The biggest drag is <strong>Page Speed (38)</strong> and <strong>Conversion UX (44)</strong>,
                which together are bleeding roughly{" "}
                <span className="mono" style={{ color: "var(--danger)" }}>
                  {formatINRFull(issues.reduce((s, i) => s + i.revenueImpact, 0))}
                </span>{" "}
                per month. The good news: <strong>Checkout Flow (71)</strong> is already healthy, and most
                top issues are quick fixes — under an hour each. Start with the action plan below to recover
                the largest losses first.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {categories.map((c, i) => (
              <div
                key={c.key}
                className="surface-card p-5 animate-fade-up"
                style={{ animationDelay: `${100 + i * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl">{c.emoji}</div>
                  <ScoreRing score={c.score} size={64} stroke={6} />
                </div>
                <div className="text-[14px] font-semibold">{c.name}</div>
                <div
                  className="text-[11px] mono uppercase tracking-wider mt-1 font-bold"
                  style={{
                    color: c.score < 50 ? "var(--danger)" : c.score < 70 ? "var(--warn)" : "var(--emerald-brand)",
                  }}
                >
                  {c.score < 50 ? "Poor" : c.score < 70 ? "Fair" : "Good"}
                </div>
              </div>
            ))}
          </div>

          <div
            className="surface-card p-6 flex items-center justify-between"
            style={{
              background: "linear-gradient(90deg, color-mix(in oklab, var(--emerald-brand) 8%, white), white)",
              borderLeft: "4px solid var(--emerald-brand)",
            }}
          >
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl gradient-emerald flex items-center justify-center">
                <Sparkles className="size-5 text-white" />
              </div>
              <div>
                <div className="text-[15px] font-semibold">
                  Found {issues.length} issues · Estimated{" "}
                  <span className="mono" style={{ color: "var(--danger)" }}>
                    {formatINRFull(issues.reduce((s, i) => s + i.revenueImpact, 0))}/month
                  </span>{" "}
                  in preventable losses
                </div>
                <div className="text-[12.5px] mt-1" style={{ color: "var(--text-secondary)" }}>
                  Your full action plan is ready with step-by-step fixes.
                </div>
              </div>
            </div>
            <Link
              to="/action-plan"
              className="gradient-emerald text-white font-semibold px-5 py-2.5 rounded-xl glow-emerald flex items-center gap-2 hover:opacity-95 active:scale-[0.98] transition"
            >
              View Full Action Plan <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
