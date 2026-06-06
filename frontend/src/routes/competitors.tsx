import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Star, Zap, IndianRupee, Package, Sparkles, Clock, Trash2, RefreshCw } from "lucide-react";
import { competitorsApi } from "@/lib/api";
import { useMerchant } from "@/hooks/useMerchant";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

export const Route = createFileRoute("/competitors")({
  head: () => ({
    meta: [
      { title: "Competitors - Flovix" },
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
        <Star key={i} className="size-3" fill={i <= Math.round(rating) ? "var(--warn)" : "transparent"} style={{ color: "var(--warn)" }} />
      ))}
      <span className="mono text-[12px] font-bold ml-1">{rating.toFixed(1)}</span>
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

function formatRelativeMinutes(min: number): string {
  if (min == null) return "never";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CompetitorsPage() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [storeName, setStoreName] = useState("");
  const [niche, setNiche] = useState("");
  const [error, setError] = useState("");

  const { data: compRes, isPending, isError, refetch } = useQuery({
    queryKey: ["competitors"],
    queryFn: () => competitorsApi.getAll(),
    enabled: !!merchant,
  });

  const addMutation = useMutation({
    mutationFn: (data: { storeUrl: string; storeName?: string; niche?: string }) => competitorsApi.add(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      setShowAddModal(false);
      setError("");
      setStoreUrl("");
      setStoreName("");
      setNiche("");
    },
    onError: (err: any) => {
      setError(err?.error || err?.message || "Failed to add competitor");
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => competitorsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => competitorsApi.refresh(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    }
  });

  const competitors = compRes?.competitors || [];

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    let url = storeUrl.trim().toLowerCase();
    if (!url) {
      setError("Store URL is required");
      return;
    }

    // Clean up domain (remove https://, http://, trailing slashes)
    url = url.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");

    if (!url.endsWith(".myshopify.com")) {
      setError("Store URL must be a valid .myshopify.com domain");
      return;
    }

    addMutation.mutate({
      storeUrl: url,
      storeName: storeName.trim() || undefined,
      niche: niche.trim() || undefined,
    });
  };

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8">
        <SkeletonList count={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8">
        <ErrorState message="Failed to load competitors." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="flex items-start justify-between mb-6 animate-fade-up">
        <div>
          <div className="label-eyebrow">Intelligence</div>
          <h1 className="display text-[28px] font-bold tracking-tight">Competitor Intelligence</h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Monitoring {compRes?.used ?? competitors.length} of {compRes?.limit ?? 1} competitors · Updated every 24 hours
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setShowAddModal(true);
          }}
          className="gradient-emerald text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 glow-emerald hover:opacity-95 active:scale-[0.98] transition"
        >
          <Plus className="size-4" /> Add Competitor
        </button>
      </div>

      <div className="space-y-4 mb-6">
        {competitors.map((competitor: any, i: number) => {
          const threat = threatStyles[competitor.threatLevel?.toLowerCase() as keyof typeof threatStyles] || threatStyles.medium;
          // Get the latest snapshot data if available
          const latestSnapshot = competitor.snapshots?.[0] || {};
          const speed = latestSnapshot.speedScore ?? competitor.speed ?? null;
          const priceLow = latestSnapshot.priceRangeMin ?? competitor.priceLow ?? 0;
          const priceHigh = latestSnapshot.priceRangeMax ?? competitor.priceHigh ?? 0;
          const reviews = latestSnapshot.reviewScore ?? competitor.reviews ?? 0;
          const apps = latestSnapshot.appCount ?? competitor.apps ?? 0;
          const aiInsight = latestSnapshot.aiInsight ?? competitor.insight ?? "";

          const speedColor = speed !== null && speed < 3 ? "var(--emerald-brand)" : speed !== null && speed > 5 ? "var(--danger)" : "var(--warn)";

          return (
            <div key={competitor.id} className="surface-card p-6 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="display text-[18px] font-bold tracking-tight">{competitor.storeName}</h2>
                    <span className="text-[10.5px] mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: threat.bg, color: threat.fg }}>
                      {threat.label}
                    </span>
                  </div>
                  <div className="mono text-[12px] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "var(--text-muted)" }}>
                    <span>{competitor.storeUrl}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      Checked {formatRelativeMinutes(competitor.lastCheckedMinutes || Math.floor((Date.now() - new Date(competitor.lastCheckedAt || competitor.createdAt).getTime()) / 60000))}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refreshMutation.mutate(competitor.id)}
                    disabled={refreshMutation.isPending || removeMutation.isPending}
                    title="Refresh competitor data"
                    className="size-8 rounded-lg flex items-center justify-center border hover:bg-[var(--muted)] text-[var(--text-secondary)] disabled:opacity-50 transition"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <RefreshCw className={`size-3.5 ${refreshMutation.variables === competitor.id && refreshMutation.isPending ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${competitor.storeName}?`)) {
                        removeMutation.mutate(competitor.id);
                      }
                    }}
                    disabled={removeMutation.isPending || refreshMutation.isPending}
                    title="Delete competitor"
                    className="size-8 rounded-lg flex items-center justify-center border hover:bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] text-[var(--danger)] hover:border-[color-mix(in_oklab,var(--danger)_25%,transparent)] disabled:opacity-50 transition"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBox icon={Zap} label="Page Speed" value={speed !== null ? `${speed}s` : "Pending"} color={speedColor} />
                <StatBox icon={IndianRupee} label="Price Range" value={priceLow || priceHigh ? `₹${priceLow.toLocaleString("en-IN")} - ₹${priceHigh.toLocaleString("en-IN")}` : "Pending"} />
                <StatBox icon={Star} label="Review Score" value={reviews ? <Stars rating={reviews} /> : "Pending"} />
                <StatBox icon={Package} label="Apps Installed" value={apps !== null ? `${apps} apps` : "Pending"} />
              </div>

              {aiInsight && (
                <div
                  className="rounded-xl p-4 flex gap-3"
                  style={{
                    background: "color-mix(in oklab, var(--electric) 6%, white)",
                    border: "1px solid color-mix(in oklab, var(--electric) 18%, transparent)",
                  }}
                >
                  <Sparkles className="size-4 mt-0.5 shrink-0" style={{ color: "var(--electric)" }} />
                  <div>
                    <div className="label-eyebrow mb-1" style={{ color: "var(--electric)" }}>AI Insight</div>
                    <p className="text-[13px] leading-relaxed">{aiInsight}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {competitors.length === 0 && (
          <div className="surface-card p-8 text-[13px] text-center" style={{ color: "var(--text-secondary)" }}>
            <p className="font-semibold mb-1">No competitors tracked yet</p>
            <p className="text-[12px] opacity-80">Click the "Add Competitor" button above to track your first competitor store.</p>
          </div>
        )}
      </div>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="surface-card w-full max-w-md p-6 relative animate-zoom-in"
            style={{
              borderColor: "var(--border)",
              boxShadow: "0 24px 48px -16px rgba(13,19,32,0.25)",
            }}
          >
            <h2 className="display text-[20px] font-bold mb-1">Add Competitor</h2>
            <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>
              Enter the domain of a competitor Shopify store to monitor their performance.
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5">
                  Store Domain *
                </label>
                <input
                  type="text"
                  required
                  placeholder="competitor-store.myshopify.com"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--emerald-brand)]"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5">
                  Store Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="My Competitor"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--emerald-brand)]"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5">
                  Niche / Segment (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Fashion / Electronics"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--emerald-brand)]"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              {error && (
                <div className="text-[12.5px] text-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] p-3 rounded-lg border border-[color-mix(in_oklab,var(--danger)_15%,transparent)]">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-[12.5px] font-semibold rounded-xl border hover:bg-[var(--muted)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="gradient-emerald text-white px-4 py-2 text-[12.5px] font-semibold rounded-xl glow-emerald hover:opacity-95 disabled:opacity-50"
                >
                  {addMutation.isPending ? "Adding..." : "Add Competitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
