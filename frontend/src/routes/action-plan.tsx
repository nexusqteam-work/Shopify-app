import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Check, Clock } from "lucide-react";
import {
  formatINRFull,
  issues as ALL_ISSUES,
  Issue,
  store,
} from "@/lib/mock-data";

export const Route = createFileRoute("/action-plan")({
  head: () => ({
    meta: [
      { title: "Action Plan — StoreCoach" },
      { name: "description", content: "Prioritized fixes with revenue impact, effort, and step-by-step instructions." },
    ],
  }),
  component: ActionPlanPage,
});

const FILTERS = ["All", "Critical", "High", "Medium", "Fixed"] as const;
type Filter = typeof FILTERS[number];

const SORTS = ["By Revenue Impact", "By Effort", "By Category"] as const;
type Sort = typeof SORTS[number];

const priorityColor: Record<Issue["priority"], string> = {
  critical: "var(--danger)",
  high: "var(--warn)",
  medium: "#EAB308",
};
const priorityLabel: Record<Issue["priority"], string> = {
  critical: "🔴 Critical",
  high: "🟠 High",
  medium: "🟡 Medium",
};

function ActionPlanPage() {
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<Sort>("By Revenue Impact");
  const [fixed, setFixed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const list = ALL_ISSUES.filter((i) => {
      const isFixed = !!fixed[i.id];
      if (filter === "All") return true;
      if (filter === "Fixed") return isFixed;
      return !isFixed && i.priority === (filter.toLowerCase() as Issue["priority"]);
    });
    const sorted = [...list];
    if (sort === "By Revenue Impact") sorted.sort((a, b) => b.revenueImpact - a.revenueImpact);
    if (sort === "By Effort") sorted.sort((a, b) => a.effortMinutes - b.effortMinutes);
    if (sort === "By Category") sorted.sort((a, b) => a.category.localeCompare(b.category));
    return sorted;
  }, [filter, sort, fixed]);

  const remaining = ALL_ISSUES.length - Object.values(fixed).filter(Boolean).length;
  const totalMonthlyLoss = useMemo(
    () => ALL_ISSUES.filter((i) => !fixed[i.id]).reduce((s, i) => s + i.revenueImpact, 0),
    [fixed],
  );
  const remainingFixHours = useMemo(
    () => ALL_ISSUES.filter((i) => !fixed[i.id]).reduce((s, i) => s + i.effortMinutes, 0) / 60,
    [fixed],
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="mb-6 animate-fade-up">
        <div className="label-eyebrow">Action Plan</div>
        <h1 className="display text-[28px] font-bold tracking-tight">Revenue Recovery Plan</h1>
        <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
          Prioritized fixes ranked by monthly revenue impact for {store.name}.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="surface-card p-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="label-eyebrow">Total Monthly Loss</div>
          <div
            className="display text-[32px] font-bold mt-1 mono transition-colors"
            style={{ color: totalMonthlyLoss === 0 ? "var(--emerald-brand)" : "var(--danger)" }}
          >
            {formatINRFull(totalMonthlyLoss)}
          </div>
          <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            {totalMonthlyLoss === 0 ? "All leaks plugged 🎉" : "recoverable revenue per month"}
          </div>
        </div>
        <div className="surface-card p-5 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="label-eyebrow">Issues Remaining</div>
          <div className="display text-[32px] font-bold mt-1 mono">
            {remaining}<span className="text-[18px]" style={{ color: "var(--text-muted)" }}> of {ALL_ISSUES.length}</span>
          </div>
          <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            unresolved this cycle
          </div>
        </div>
        <div className="surface-card p-5 animate-fade-up" style={{ animationDelay: "140ms" }}>
          <div className="label-eyebrow">Estimated Fix Time</div>
          <div className="display text-[32px] font-bold mt-1 mono">
            {remainingFixHours.toFixed(1)}h
          </div>
          <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            remaining across open issues
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div
          className="flex gap-1 p-1 rounded-xl border overflow-x-auto no-scrollbar"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition whitespace-nowrap ${
                filter === f ? "text-white" : "hover:bg-[var(--muted)]"
              }`}
              style={filter === f ? { background: "var(--emerald-brand)" } : { color: "var(--text-secondary)" }}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="w-full sm:w-auto px-3 py-2 rounded-lg border text-[12.5px] font-semibold bg-white"
          style={{ borderColor: "var(--border)" }}
        >
          {SORTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Issues list */}
      <div className="space-y-3">
        {filtered.map((iss, i) => {
          const isFixed = !!fixed[iss.id];
          const isOpen = !!expanded[iss.id];
          return (
            <div
              key={iss.id}
              className="surface-card overflow-hidden animate-fade-up transition-all"
              style={{
                borderLeft: `4px solid ${priorityColor[iss.priority]}`,
                animationDelay: `${i * 50}ms`,
                opacity: isFixed ? 0.4 : 1,
              }}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="size-9 rounded-xl flex items-center justify-center display font-bold text-white shrink-0 mono"
                    style={{ background: priorityColor[iss.priority] }}
                  >
                    #{iss.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className={`text-[15px] font-bold ${isFixed ? "line-through" : ""}`}>
                          {iss.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: `color-mix(in oklab, ${priorityColor[iss.priority]} 14%, white)`,
                              color: priorityColor[iss.priority],
                            }}
                          >
                            {priorityLabel[iss.priority]}
                          </span>
                          <span
                            className="text-[11px] mono font-semibold px-2 py-0.5 rounded-full border"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          >
                            {iss.category}
                          </span>
                          <span
                            className="text-[11px] mono font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                            style={{ background: "var(--muted)", color: "var(--text-secondary)" }}
                          >
                            <Clock className="size-3" />
                            {iss.effortLabel}
                          </span>
                          {isFixed && (
                            <span
                              className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                              style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}
                            >
                              <Check className="size-3" strokeWidth={3} /> Fixed
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="label-eyebrow">Impact</div>
                        <div className="display text-[20px] font-bold mono" style={{ color: "var(--danger)" }}>
                          {formatINRFull(iss.revenueImpact)}
                        </div>
                        <div className="text-[10.5px] mono" style={{ color: "var(--text-muted)" }}>per month</div>
                      </div>
                    </div>
                    <p className="text-[13px] mt-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {iss.description}
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
                      ◆ Step-by-Step Fix
                    </div>
                    <ol className="space-y-2.5">
                      {iss.fixSteps.map((s, idx) => (
                        <li key={idx} className="flex gap-3 text-[13px]">
                          <span
                            className="shrink-0 size-5 rounded-full mono text-[11px] font-bold flex items-center justify-center text-white"
                            style={{ background: "var(--emerald-brand)" }}
                          >
                            {idx + 1}
                          </span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                    <a
                      href={`https://${store.url}${iss.shopifyAdminPath}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-[12.5px] font-semibold px-3 py-1.5 rounded-lg bg-white border hover:bg-[var(--muted)] transition"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Open in Shopify Admin <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [iss.id]: !e[iss.id] }))}
                    className="text-[12.5px] font-semibold inline-flex items-center gap-1 hover:opacity-80"
                    style={{ color: "var(--emerald-brand)" }}
                  >
                    {isOpen ? "Hide" : "Show"} Fix Instructions
                    <ChevronDown
                      className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => setFixed((f) => ({ ...f, [iss.id]: !f[iss.id] }))}
                    className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-[0.98]"
                    style={{
                      background: isFixed ? "var(--emerald-brand-soft)" : "var(--emerald-brand)",
                      color: isFixed ? "var(--emerald-brand)" : "white",
                    }}
                  >
                    <Check className="size-4" strokeWidth={3} />
                    {isFixed ? "Fixed" : "Mark as Fixed"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="surface-card p-12 text-center" style={{ color: "var(--text-muted)" }}>
            No issues match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
