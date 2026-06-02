import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar, Check, ArrowRight, Store, Sparkles } from "lucide-react";
import { ScoreRing } from "@/components/ScoreRing";
import { formatINRFull } from "@/lib/mock-data";
import { auditApi, issuesApi, visualAuditApi } from "@/lib/api";
import { useMerchant } from "@/hooks/useMerchant";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Eye, Lock } from "lucide-react";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Store Audit - StoreCoach" },
      { name: "description", content: "Run a deep AI scan across speed, SEO, apps, checkout, and mobile UX." },
    ],
  }),
  component: AuditPage,
});

const SCAN_STEPS = [
  "Connecting to Shopify Admin API...",
  "Fetching store metadata...",
  "Scanning installed apps...",
  "Measuring page speed...",
  "Auditing SEO metadata...",
  "Tracing mobile checkout flow...",
  "Running AI revenue impact analysis...",
  "Compiling recommendations...",
];

type State = "pre" | "scanning" | "done";

function AuditPage() {
  const { merchant } = useMerchant();
  const { visualAudit } = usePlanFeatures();
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>("pre");
  const [auditId, setAuditId] = useState<string | null>(null);

  const { data: latestAuditRes, isPending: loadingAudit, isError: errorAudit, refetch: refetchAudit } = useQuery({
    queryKey: ["latest-audit"],
    queryFn: () => auditApi.getLatest(),
    enabled: !!merchant,
  });
  
  const { data: latestVisualAuditRes } = useQuery({
    queryKey: ["visual-audit-latest"],
    queryFn: () => visualAuditApi.getLatest(),
    enabled: !!merchant && visualAudit,
    retry: false,
  });
  const { data: issueSummaryRes, isPending: loadingSummary, isError: errorSummary, refetch: refetchSummary } = useQuery({
    queryKey: ["issue-summary"],
    queryFn: () => issuesApi.summary(),
    enabled: !!merchant,
  });
  const { data: auditStatusRes } = useQuery({
    queryKey: ["audit-status", auditId],
    queryFn: () => auditApi.getStatus(auditId!),
    enabled: !!auditId && state === "scanning",
    refetchInterval: 2500,
  });

  const runAuditMutation = useMutation({
    mutationFn: () => auditApi.run(),
    onSuccess: (data: any) => {
      setAuditId(data.auditId);
      setState("scanning");
    },
  });

  useEffect(() => {
    if (latestAuditRes?.audit && state === "pre" && !auditId) {
      setState("done");
    }
  }, [latestAuditRes?.audit, state, auditId]);

  useEffect(() => {
    if (auditStatusRes?.status === "COMPLETED") {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["latest-audit"] }),
        queryClient.invalidateQueries({ queryKey: ["issues"] }),
        queryClient.invalidateQueries({ queryKey: ["issue-summary"] }),
      ]);
      setState("done");
      setAuditId(null);
    }
  }, [auditStatusRes?.status, queryClient]);

  const audit = latestAuditRes?.audit;
  const auditStatusData = auditStatusRes?.audit; // if returned

  let lastScannedMinutes = null;
  if (audit?.completedAt) {
    lastScannedMinutes = Math.floor((Date.now() - new Date(audit.completedAt).getTime()) / 60000);
  }

  const store = {
    name: merchant?.shopName,
    url: merchant?.shopDomain,
    lastScannedMinutes,
  };

  const categories = audit ? [
    { key: "speed", name: "Store Speed", score: audit.speedScore || 0, emoji: "⚡" },
    { key: "seo", name: "SEO & Discovery", score: audit.seoScore || 0, emoji: "🔍" },
    { key: "conversion", name: "Conversion Rate", score: audit.conversionScore || 0, emoji: "📈" },
    { key: "product", name: "Product Pages", score: audit.productScore || 0, emoji: "🛍️" },
    { key: "checkout", name: "Checkout Flow", score: audit.checkoutScore || 0, emoji: "🛒" },
    { key: "mobile", name: "Mobile Experience", score: audit.mobileScore || 0, emoji: "📱" },
  ] : [];

  const visualAuditData = latestVisualAuditRes?.audit;
  if (visualAuditData?.status === 'COMPLETED') {
    categories.push({
      key: "visual", name: "Visual UX", score: visualAuditData.score || 0, emoji: "🎨"
    });
  }

  const overallScore = audit?.overallScore ?? auditStatusData?.overallScore ?? 0;
  const totalLoss = audit?.totalRevenueLoss ?? issueSummaryRes?.summary?.totalLoss ?? 0;
  const progress = auditStatusRes?.status === "COMPLETED" ? 100 : state === "scanning" ? 65 : 0;
  const stepIndex = useMemo(() => {
    if (state !== "scanning") return 0;
    const ratio = Math.min(SCAN_STEPS.length - 1, Math.floor((progress / 100) * SCAN_STEPS.length));
    return ratio;
  }, [progress, state]);

  if (loadingAudit || loadingSummary) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8">
        <SkeletonCard />
      </div>
    );
  }

  if (errorAudit || errorSummary) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8">
        <ErrorState message="Failed to load audit data." onRetry={() => {
          refetchAudit();
          refetchSummary();
        }} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="mb-8 animate-fade-up">
        <div className="label-eyebrow">Audit</div>
        <h1 className="display text-[28px] font-bold tracking-tight">Store Audit</h1>
        <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
          A live diagnostic scan of your Shopify store across performance, SEO, and UX.
        </p>
      </div>

      {state === "pre" && (
        <div className="mx-auto max-w-[560px] surface-card p-8 text-center animate-fade-up">
          <div className="size-14 rounded-2xl gradient-emerald flex items-center justify-center mx-auto glow-emerald">
            <Store className="size-7 text-white" />
          </div>
          <div className="display text-[22px] font-bold mt-4">{store.name || "No store connected"}</div>
          <div className="mono text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
            {store.url || "Authenticate to load your Shopify store"}
          </div>
          <div className="mt-4 text-[12.5px] mono" style={{ color: "var(--text-secondary)" }}>
            Last scanned {store.lastScannedMinutes ? `${store.lastScannedMinutes} minutes ago` : "never"}
          </div>

          <button
            onClick={() => runAuditMutation.mutate()}
            disabled={runAuditMutation.isPending}
            className="mt-6 inline-flex items-center gap-2 gradient-emerald text-white font-semibold px-6 py-3 rounded-full glow-emerald hover:opacity-95 active:scale-[0.98] transition disabled:opacity-50"
          >
            <Radar className="size-4" />
            {runAuditMutation.isPending ? "Starting..." : "Start Deep Scan"}
          </button>
          <div className="text-[11.5px] mono mt-3" style={{ color: "var(--text-muted)" }}>
            Scan runs on the backend and updates the frontend when complete
          </div>
        </div>
      )}

      {state === "scanning" && (
        <div className="mx-auto max-w-[720px] surface-card p-10 animate-fade-up">
          <div className="relative flex items-center justify-center h-40">
            <div className="absolute size-24 rounded-full animate-radar" style={{ background: "color-mix(in oklab, var(--emerald-brand) 30%, transparent)" }} />
            <div
              className="absolute size-24 rounded-full animate-radar"
              style={{ background: "color-mix(in oklab, var(--emerald-brand) 30%, transparent)", animationDelay: "1.2s" }}
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
              <div className="h-full rounded-full transition-[width] duration-300 gradient-emerald" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mt-6 rounded-xl p-4 mono text-[11.5px] h-44 overflow-hidden border" style={{ background: "#0D1320", color: "#9AE6C0", borderColor: "var(--border)" }}>
            {SCAN_STEPS.slice(0, stepIndex + 1).map((step, index) => (
              <div key={index} className="flex gap-2">
                <span style={{ color: "#6B7280" }}>$</span>
                <span>{step}</span>
                {index < stepIndex && <span style={{ color: "#34D399" }}>done</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="space-y-6">
          <div className="surface-card p-8 text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}>
              <Check className="size-4" strokeWidth={3} />
              <span className="text-[12px] mono font-bold uppercase tracking-wider">Scan Complete</span>
            </div>
            <h2 className="display text-[22px] font-bold">Your store score is in</h2>
            <div className="flex justify-center mt-4">
              <ScoreRing score={overallScore} size={160} stroke={12} showLabel />
            </div>
            <div className="mt-6 mx-auto max-w-[640px] text-left rounded-2xl p-5 border" style={{ borderColor: "color-mix(in oklab, var(--emerald-brand) 20%, var(--border))", background: "color-mix(in oklab, var(--emerald-brand) 4%, white)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4" style={{ color: "var(--emerald-brand)" }} />
                <span className="label-eyebrow" style={{ color: "var(--emerald-brand)" }}>AI Summary</span>
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {audit?.aiSummary ?? "Your latest audit summary will appear here after the backend completes analysis."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {categories.map((category, index) => (
              <div key={category.key} className="surface-card p-5 animate-fade-up" style={{ animationDelay: `${100 + index * 50}ms` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl">{category.emoji}</div>
                  <ScoreRing score={category.score} size={64} stroke={6} />
                </div>
                <div className="text-[14px] font-semibold">{category.name}</div>
                <div className="text-[11px] mono uppercase tracking-wider mt-1 font-bold" style={{ color: category.score < 50 ? "var(--danger)" : category.score < 70 ? "var(--warn)" : "var(--emerald-brand)" }}>
                  {category.score < 50 ? "Poor" : category.score < 70 ? "Fair" : "Good"}
                </div>
              </div>
            ))}
          </div>

          {(!visualAuditData || visualAuditData.status !== 'COMPLETED') && (
            <div className="surface-card p-6 mt-6 animate-fade-up">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="size-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0" style={{ background: "color-mix(in oklab, var(--border) 20%, transparent)" }}>
                  {!visualAudit ? <Lock className="size-5 text-foreground" /> : <Eye className="size-5 text-foreground" />}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="text-[15px] font-semibold">Visual Analysis</div>
                  <div className="text-[12.5px] mt-1" style={{ color: "var(--text-secondary)" }}>
                    {!visualAudit ? "Upgrade to Advanced to unlock AI visual analysis." : "Run a visual scan to get AI fixes for your store's layout."}
                  </div>
                </div>
                <Link to="/visual-audit" className="gradient-emerald text-white font-semibold px-5 py-2.5 rounded-xl glow-emerald flex items-center gap-2 hover:opacity-95 transition whitespace-nowrap">
                  {!visualAudit ? "Upgrade Plan" : "Run Visual Scan"} <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          )}

          <div className="surface-card p-6 flex items-center justify-between" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--emerald-brand) 8%, white), white)", borderLeft: "4px solid var(--emerald-brand)" }}>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl gradient-emerald flex items-center justify-center">
                <Sparkles className="size-5 text-white" />
              </div>
              <div>
                <div className="text-[15px] font-semibold">
                  Found {issueSummaryRes?.summary?.open ?? 0} open issues · Estimated{" "}
                  <span className="mono" style={{ color: "var(--danger)" }}>
                    {formatINRFull(totalLoss)}/month
                  </span>{" "}
                  in preventable losses
                </div>
                <div className="text-[12.5px] mt-1" style={{ color: "var(--text-secondary)" }}>
                  Your live action plan is ready with fixes from the backend audit.
                </div>
              </div>
            </div>
            <Link to="/action-plan" className="gradient-emerald text-white font-semibold px-5 py-2.5 rounded-xl glow-emerald flex items-center gap-2 hover:opacity-95 active:scale-[0.98] transition">
              View Full Action Plan <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
