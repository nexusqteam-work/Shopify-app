import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Check, Clock } from "lucide-react";
import { formatINRFull, type Issue } from "@/lib/mock-data";
import { useMerchant } from "@/hooks/useMerchant";
import { issuesApi, visualAuditApi } from "@/lib/api";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Code, RefreshCw, CheckCircle, Sparkles, Copy } from "lucide-react";

export const Route = createFileRoute("/action-plan")({
  head: () => ({
    meta: [
      { title: "Action Plan - StoreCoach" },
      { name: "description", content: "Prioritized fixes with revenue impact, effort, and step-by-step instructions." },
    ],
  }),
  component: ActionPlanPage,
});

const FILTERS = ["All", "Critical", "High", "Medium", "Fixed", "Visual"] as const;
type Filter = typeof FILTERS[number];

const SORTS = ["By Revenue Impact", "By Effort", "By Category"] as const;
type Sort = typeof SORTS[number];

const priorityColor: Record<Issue["priority"], string> = {
  critical: "var(--danger)",
  high: "var(--warn)",
  medium: "#EAB308",
};

const priorityLabel: Record<Issue["priority"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
};

function getEffortLabel(minutes: number) {
  if (!minutes) return "Unknown";
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function ActionPlanPage() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<Sort>("By Revenue Impact");
  const { codeGen } = usePlanFeatures();
  
  const { data: issuesRes, isPending, isError, refetch } = useQuery({
    queryKey: ["issues"],
    queryFn: () => issuesApi.getAll(),
    enabled: !!merchant,
  });

  const sourceIssues = issuesRes?.issues || [];

  const filtered = useMemo(() => {
    const list = sourceIssues.filter((issue: any) => {
      const isFixed = !!issue.isFixed;
      if (filter === "All") return true;
      if (filter === "Fixed") return isFixed;
      if (filter === "Visual") {
        return !isFixed && (issue.category?.toUpperCase() === "CONVERSION" || issue.category?.toUpperCase() === "MOBILE");
      }
      return !isFixed && issue.priority === filter.toLowerCase();
    });
    const sorted = [...list];
    if (sort === "By Revenue Impact") sorted.sort((a: any, b: any) => b.impact - a.impact);
    if (sort === "By Effort") sorted.sort((a: any, b: any) => a.effortMinutes - b.effortMinutes);
    if (sort === "By Category") sorted.sort((a: any, b: any) => a.category.localeCompare(b.category));
    
    // Add rank
    return sorted.map((issue: any, index: number) => ({ ...issue, rank: index + 1 }));
  }, [filter, sort, sourceIssues]);

  const fixedCount = sourceIssues.filter((issue: any) => issue.isFixed).length;
  const remaining = sourceIssues.length - fixedCount;
  const totalMonthlyLoss = sourceIssues.filter((issue: any) => !issue.isFixed).reduce((sum: number, issue: any) => sum + (issue.impact || 0), 0);
  const remainingFixHours = sourceIssues.filter((issue: any) => !issue.isFixed).reduce((sum: number, issue: any) => sum + (issue.effortMinutes || 0), 0) / 60;

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8">
        <SkeletonList count={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8">
        <ErrorState message="Failed to load action plan." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="mb-6 animate-fade-up">
        <div className="label-eyebrow">Action Plan</div>
        <h1 className="display text-[28px] font-bold tracking-tight">Revenue Recovery Plan</h1>
        <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
          Prioritized fixes ranked by monthly revenue impact for {merchant?.shopName ?? "your store"}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="surface-card p-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="label-eyebrow">Total Monthly Loss</div>
          <div className="display text-[32px] font-bold mt-1 mono transition-colors" style={{ color: totalMonthlyLoss === 0 ? "var(--emerald-brand)" : "var(--danger)" }}>
            {formatINRFull(totalMonthlyLoss)}
          </div>
          <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            {totalMonthlyLoss === 0 ? "All leaks plugged" : "recoverable revenue per month"}
          </div>
        </div>
        <div className="surface-card p-5 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="label-eyebrow">Issues Remaining</div>
          <div className="display text-[32px] font-bold mt-1 mono">
            {remaining}
            <span className="text-[18px]" style={{ color: "var(--text-muted)" }}> of {sourceIssues.length}</span>
          </div>
          <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>unresolved this cycle</div>
        </div>
        <div className="surface-card p-5 animate-fade-up" style={{ animationDelay: "140ms" }}>
          <div className="label-eyebrow">Estimated Fix Time</div>
          <div className="display text-[32px] font-bold mt-1 mono">{remainingFixHours.toFixed(1)}h</div>
          <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>remaining across open issues</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex gap-1 p-1 rounded-xl border overflow-x-auto no-scrollbar" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition whitespace-nowrap ${filter === item ? "text-white" : "hover:bg-[var(--muted)]"}`}
              style={filter === item ? { background: "var(--emerald-brand)" } : { color: "var(--text-secondary)" }}
            >
              {item}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
          className="w-full sm:w-auto px-3 py-2 rounded-lg border text-[12.5px] font-semibold bg-white"
          style={{ borderColor: "var(--border)" }}
        >
          {SORTS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((issue: any, index: number) => (
          <ActionPlanIssueCard key={issue.id} issue={issue} index={index} queryClient={queryClient} codeGen={codeGen} />
        ))}
        {filtered.length === 0 && (
          <div className="surface-card p-12 text-center" style={{ color: "var(--text-muted)" }}>
            No issues match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function ActionPlanIssueCard({ issue, index, queryClient, codeGen }: { issue: any, index: number, queryClient: any, codeGen: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState<string | null>(issue.cssFixCode || null);
  const [genError, setGenError] = useState(false);

  const isFixed = !!issue.isFixed;

  const fixMutation = useMutation({
    mutationFn: ({ issueId, isFixed }: { issueId: string; isFixed: boolean }) =>
      isFixed ? issuesApi.unfix(issueId) : issuesApi.fix(issueId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["issues"] }),
        queryClient.invalidateQueries({ queryKey: ["issue-summary"] }),
      ]);
    },
  });

  const genMutation = useMutation({
    mutationFn: () => visualAuditApi.generateFix(issue.id),
    onSuccess: (res: any) => {
      setCode(res.code);
      setGenError(false);
    },
    onError: () => setGenError(true)
  });

  return (
    <div
      className="surface-card overflow-hidden animate-fade-up transition-all"
      style={{
        borderLeft: `4px solid ${priorityColor[issue.priority as Issue["priority"]]}`,
        animationDelay: `${index * 50}ms`,
        opacity: isFixed ? 0.4 : 1,
      }}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className="size-9 rounded-xl flex items-center justify-center display font-bold text-white shrink-0 mono"
            style={{ background: priorityColor[issue.priority as Issue["priority"]] }}
          >
            #{issue.rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className={`text-[15px] font-bold ${isFixed ? "line-through" : ""}`}>{issue.title}</div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `color-mix(in oklab, ${priorityColor[issue.priority as Issue["priority"]]} 14%, white)`,
                      color: priorityColor[issue.priority as Issue["priority"]],
                    }}
                  >
                    {priorityLabel[issue.priority as Issue["priority"]]}
                  </span>
                  <span className="text-[11px] mono font-semibold px-2 py-0.5 rounded-full border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    {issue.category}
                  </span>
                  <span className="text-[11px] mono font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "var(--muted)", color: "var(--text-secondary)" }}>
                    <Clock className="size-3" />
                    {getEffortLabel(issue.effortMinutes)}
                  </span>
                  {isFixed && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}>
                      <Check className="size-3" strokeWidth={3} /> Fixed
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="label-eyebrow">Impact</div>
                <div className="display text-[20px] font-bold mono" style={{ color: "var(--danger)" }}>
                  {formatINRFull(issue.impact)}
                </div>
                <div className="text-[10.5px] mono" style={{ color: "var(--text-muted)" }}>per month</div>
              </div>
            </div>
            <p className="text-[13px] mt-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {issue.description}
            </p>
          </div>
        </div>

        {isOpen && (
          <div
            className="mt-4 ml-13 rounded-xl p-5 animate-fade-up"
            style={{
              background: "color-mix(in oklab, var(--emerald-brand) 7%, white)",
              border: "1px solid color-mix(in oklab, var(--emerald-brand) 20%, transparent)",
            }}
          >
            <div className="label-eyebrow mb-3" style={{ color: "var(--emerald-brand)" }}>
              Fix steps
            </div>
            <ol className="space-y-2.5">
              {issue.fixInstructions ? (
                <li className="text-[13px]">{issue.fixInstructions}</li>
              ) : (
                issue.fixSteps?.map((step: string, stepIndex: number) => (
                  <li key={stepIndex} className="flex gap-3 text-[13px]">
                    <span className="shrink-0 size-5 rounded-full mono text-[11px] font-bold flex items-center justify-center text-white" style={{ background: "var(--emerald-brand)" }}>
                      {stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))
              )}
            </ol>
            {issue.shopifyAdminUrl && (
              <a
                href={issue.shopifyAdminUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-[12.5px] font-semibold px-3 py-1.5 rounded-lg bg-white border hover:bg-[var(--muted)] transition"
                style={{ borderColor: "var(--border)" }}
              >
                Open in Shopify Admin <ExternalLink className="size-3.5" />
              </a>
            )}

            {codeGen && issue.cssFixTarget && (
              <div className="mt-5 border-t pt-4" style={{ borderColor: "color-mix(in oklab, var(--emerald-brand) 20%, transparent)" }}>
                <div className="flex items-center gap-3 mb-2">
                  {!code ? (
                    <button 
                      onClick={() => genMutation.mutate()}
                      disabled={genMutation.isPending}
                      className="text-[12.5px] font-semibold px-4 py-2 rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 transition flex items-center gap-2"
                    >
                      {genMutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Code className="size-4" />}
                      {genMutation.isPending ? "Generating..." : "Generate Fix Code"}
                    </button>
                  ) : (
                    <div className="text-[13px] font-medium text-green-700 flex items-center gap-1.5">
                      <CheckCircle className="size-4" /> Code Generated
                    </div>
                  )}
                </div>

                {genError && (
                  <div className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3 flex items-center justify-between border border-red-100">
                    <span>Could not generate fix. Try again or fix manually.</span>
                    <button onClick={() => genMutation.mutate()} className="font-semibold underline">Retry</button>
                  </div>
                )}

                {code && (
                  <div className="mt-3 bg-[#1e293b] rounded-xl overflow-hidden relative group">
                    <button 
                      onClick={() => navigator.clipboard.writeText(code)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition opacity-0 group-hover:opacity-100"
                    >
                      <Copy className="size-4" />
                    </button>
                    <pre className="p-4 text-[13px] text-gray-300 font-mono overflow-x-auto">
                      <code>{code}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="text-[12.5px] font-semibold inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: "var(--emerald-brand)" }}
          >
            {isOpen ? "Hide" : "Show"} Fix Instructions
            <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => fixMutation.mutate({ issueId: issue.id, isFixed })}
            disabled={fixMutation.isPending}
            className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50"
            style={{
              background: isFixed ? "var(--emerald-brand-soft)" : "var(--emerald-brand)",
              color: isFixed ? "var(--emerald-brand)" : "white",
            }}
          >
            <Check className="size-4" strokeWidth={3} />
            {isFixed ? "Reopen" : "Mark as Fixed"}
          </button>
        </div>
      </div>
    </div>
  );
}
