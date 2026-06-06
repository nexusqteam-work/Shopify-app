import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, Zap, Crown, Bot } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Flovix" },
      {
        name: "description",
        content:
          "Flovix pricing plans — Basic, Advanced, Pro, and Agent. AI-powered Shopify audits, auto-fixes, and a merchant chatbot priced from $12/month.",
      },
    ],
  }),
  component: PricingPage,
});

type Tier = {
  id: "basic" | "advanced" | "pro" | "agent";
  name: string;
  price: number;
  tagline: string;
  icon: typeof Sparkles;
  highlight?: boolean;
  paragraphs: string[];
  enforcement: string;
};

const TIERS: Tier[] = [
  {
    id: "basic",
    name: "Basic",
    price: 12,
    tagline: "Get a clear picture of your store, every month.",
    icon: Sparkles,
    paragraphs: [
      "The Basic plan is built for small merchants and side-project stores that want professional-grade visibility without committing to automation. You receive up to four full store audits per month, each covering a maximum of one hundred products, with diagnostics across performance, SEO, conversion, theme, and app bloat. Findings are presented as a prioritized action plan with severity, estimated revenue impact, and a recommended manual fix — but every change still lands in your hands.",
      "The included merchant chatbot is available for one hundred messages per month and is tuned for read-only conversations: it can explain audit findings, walk you through best practices, and summarize your store's metrics, but it cannot trigger any write operation on your Shopify store. There are no auto-fixes on this tier, no scheduled scans beyond the monthly cadence, and no bulk operations. Reports are exportable as PDF for sharing with a freelancer or developer.",
    ],
    enforcement:
      "Once the four-audit or one-hundred-message ceiling is reached, the audit and chat endpoints return a soft-block with an upgrade prompt rather than queuing requests. Any attempt to call an auto-fix or bulk-edit route is rejected at the middleware layer with a 403, even if the UI is bypassed.",
  },
  {
    id: "advanced",
    name: "Advanced",
    price: 24.99,
    tagline: "Move from insight to safe, one-click fixes.",
    icon: Zap,
    highlight: true,
    paragraphs: [
      "The Advanced plan is the natural step up for growing stores that have accepted the diagnoses and now want to act on them quickly. It includes up to twelve audits per month and increases the per-audit product coverage to five hundred SKUs, with weekly scheduled scans that surface regressions automatically. The action plan is enriched with one-click safe auto-fixes: alt-text generation, meta-title and meta-description rewrites, image compression, broken-link redirects, and structured-data patches. Every auto-fix is logged, reversible, and capped at a daily quota so that nothing changes silently overnight.",
      "The chatbot ceiling rises to one thousand messages per month and the assistant gains read-and-suggest permissions: it can draft product descriptions, propose collection structures, and generate SEO copy, but the merchant still has to click an explicit approve button before anything is published. High-risk actions — price changes, inventory edits, theme code edits, app installs, and any bulk operation touching more than twenty-five resources — are intentionally disabled on this tier, regardless of how the request is phrased.",
    ],
    enforcement:
      "Auto-fix calls are routed through a policy engine that checks the action type against the plan's allow-list before executing the Shopify Admin API call. Bulk operations and price mutations short-circuit with a clear upgrade message pointing to Pro.",
  },
  {
    id: "pro",
    name: "Pro",
    price: 59.99,
    tagline: "Run your store on autopilot, with humans in the loop where it matters.",
    icon: Crown,
    highlight: false,
    paragraphs: [
      "The Pro plan is designed for serious DTC operators and small agencies that treat their store as a revenue engine. It unlocks unlimited audits with daily scheduled scans, lifts per-audit coverage to two thousand products, and opens the full auto-fix catalogue — including bulk SEO rewrites, structured-data rollouts, redirect maps, theme micro-optimizations, and app-bloat cleanup. Pricing, inventory, and promotion changes become available as guarded actions: they execute only after a two-step confirmation and respect per-day caps, so a single mistake cannot cascade across the catalog.",
      "The chatbot allowance rises to ten thousand messages per month and gains agentic capabilities within a sandbox: it can stage edits, run dry-runs of bulk operations, and prepare merchandising experiments that the merchant reviews in a diff view before approval. Reports become white-label-ready, multi-store views are supported up to three connected Shopify stores, and Slack and email digests of new findings ship by default. What remains off-limits on Pro is fully unattended execution of high-value mutations — every price change, theme deploy, and large bulk write still requires an explicit human approval click.",
    ],
    enforcement:
      "Daily caps on price and inventory mutations are enforced server-side per store, not per user, to prevent multi-seat abuse. The Shopify token used for write operations is scoped to the minimum required permissions and rotates on every plan downgrade.",
  },
  {
    id: "agent",
    name: "Agent",
    price: 179.99,
    tagline: "A fully autonomous AI store operator, governed by your rules.",
    icon: Bot,
    paragraphs: [
      "The Agent plan is Flovix's flagship offering, intended for high-volume stores, brands with in-house growth teams, and agencies managing portfolios of merchants. It includes everything in Pro and removes the human-in-the-loop requirement for the categories the merchant explicitly opts into: continuous SEO maintenance, dynamic merchandising, automated A/B tests on product pages, scheduled price experiments within configured bands, abandoned-cart sequence optimization, and proactive incident response when an audit detects a regression. The agent operates inside a policy file the merchant configures once — defining price floors and ceilings, allowed discount ranges, blocked SKUs, brand voice, and approval thresholds — and every autonomous action is recorded with a full audit trail and a one-click revert.",
      "Usage limits move from numerical ceilings to fair-use guardrails: unlimited audits and unlimited chatbot messages, unlimited connected stores, priority AI capacity with a dedicated model pool, and SLA-backed response times. The agent can perform bulk operations of any size, but any single action whose estimated revenue impact exceeds the configured threshold escalates to the merchant via Slack or email and waits for approval. Restricted categories — refunds, customer data exports, payment configuration, and storefront takedowns — remain permanently behind explicit human confirmation regardless of policy settings, because some actions should never be autonomous.",
    ],
    enforcement:
      "The Agent plan adds a per-store policy engine that evaluates every autonomous action against configured guardrails before execution. All AI inference is metered per token and per action, with circuit breakers that shadow-box anomalous usage patterns.",
  },
];

function PricingPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1200px] mx-auto">
      {/* Header */}
      <header className="text-center max-w-2xl mx-auto mb-12">
        <span
          className="inline-block text-[11px] mono font-bold px-3 py-1 rounded-full mb-4"
          style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}
        >
          Pricing
        </span>
        <h1 className="display text-3xl lg:text-5xl font-bold tracking-tight">
          Grow at your own pace.
        </h1>
        <p
          className="mt-4 text-[15px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Four plans, each defined less by usage caps and more by how much of your store
          you're ready to hand over to AI. Start with diagnostics, graduate to safe
          one-click fixes, then unlock guarded automation and finally a fully autonomous
          agent governed by your own policy.
        </p>
      </header>

      {/* Tier cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {TIERS.map((t) => {
          const Icon = t.icon;
          return (
            <article
              key={t.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 transition ${t.highlight ? "shadow-xl" : ""
                }`}
              style={{
                borderColor: t.highlight ? "var(--emerald-brand)" : "var(--border)",
                boxShadow: t.highlight
                  ? "0 20px 48px -20px color-mix(in oklab, var(--emerald-brand) 40%, transparent)"
                  : "0 1px 2px rgba(13,19,32,0.04)",
              }}
            >
              {t.highlight && (
                <span
                  className="absolute -top-3 left-6 text-[10px] mono font-bold px-2.5 py-1 rounded-full text-white gradient-emerald"
                >
                  Most popular
                </span>
              )}
              <div className="flex items-center gap-3">
                <div
                  className={`size-10 rounded-xl flex items-center justify-center ${t.highlight ? "gradient-emerald glow-emerald" : ""
                    }`}
                  style={
                    t.highlight
                      ? undefined
                      : { background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }
                  }
                >
                  <Icon className={`size-5 ${t.highlight ? "text-white" : ""}`} />
                </div>
                <div>
                  <div className="display text-[16px] font-bold tracking-tight">{t.name}</div>
                  <div className="text-[11px] mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Plan
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-baseline gap-1">
                  <span className="display text-3xl font-bold tracking-tight">
                    ${t.price.toLocaleString("en-US")}
                  </span>
                  <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                    /month
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {t.tagline}
                </p>
              </div>

              <a
                href={`#${t.id}`}
                className={`mt-5 inline-flex items-center justify-center gap-2 w-full text-[13px] font-semibold py-2.5 rounded-xl transition ${t.highlight
                  ? "gradient-emerald text-white glow-emerald hover:opacity-95"
                  : "border hover:bg-[var(--muted)]"
                  }`}
                style={t.highlight ? undefined : { borderColor: "var(--border)" }}
              >
                Read full plan
              </a>

              <ul className="mt-5 space-y-2">
                {[
                  t.id === "basic" && "4 audits / month · 100 products each",
                  t.id === "basic" && "100 chatbot messages",
                  t.id === "basic" && "Diagnostics only — no auto-fix",
                  t.id === "advanced" && "12 audits / month · 500 products",
                  t.id === "advanced" && "1,000 chatbot messages",
                  t.id === "advanced" && "Safe one-click auto-fixes",
                  t.id === "pro" && "Unlimited audits · 2,000 products",
                  t.id === "pro" && "10,000 chatbot messages",
                  t.id === "pro" && "Full auto-fix catalogue, guarded",
                  t.id === "agent" && "Unlimited everything · fair use",
                  t.id === "agent" && "Fully autonomous AI agent",
                  t.id === "agent" && "Policy engine + SLA support",
                ]
                  .filter(Boolean)
                  .map((line) => (
                    <li key={line as string} className="flex items-start gap-2 text-[12.5px]">
                      <Check
                        className="size-4 shrink-0 mt-0.5"
                        style={{ color: "var(--emerald-brand)" }}
                      />
                      <span>{line}</span>
                    </li>
                  ))}
              </ul>
            </article>
          );
        })}
      </section>

      {/* Long-form descriptions */}
      <section className="mt-16 space-y-12">
        {TIERS.map((t) => (
          <article
            key={t.id}
            id={t.id}
            className="rounded-2xl border bg-white p-6 lg:p-8 scroll-mt-8"
            style={{ borderColor: "var(--border)" }}
          >
            <header className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <div
                  className="text-[11px] mono font-bold uppercase tracking-widest"
                  style={{ color: "var(--emerald-brand)" }}
                >
                  {t.name} plan
                </div>
                <h2 className="display text-2xl lg:text-3xl font-bold tracking-tight mt-1">
                  {t.tagline}
                </h2>
              </div>
              <div className="display text-2xl font-bold">
                ${t.price.toLocaleString("en-US")}
                <span className="text-[13px] font-normal" style={{ color: "var(--text-muted)" }}>
                  {" "}
                  /month
                </span>
              </div>
            </header>
            <div className="space-y-4 text-[14px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              {t.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p
                className="rounded-xl border-l-4 px-4 py-3 text-[13.5px]"
                style={{
                  borderColor: "var(--emerald-brand)",
                  background: "var(--emerald-brand-soft)",
                  color: "var(--text-foreground, #0d1320)",
                }}
              >
                <strong className="display font-bold">Enforcement.</strong> {t.enforcement}
              </p>
            </div>
          </article>
        ))}
      </section>

      {/* Backend enforcement section */}
      <section
        className="mt-16 rounded-2xl p-6 lg:p-10 text-white"
        style={{
          background:
            "linear-gradient(135deg, #0d1320 0%, #15233a 60%, color-mix(in oklab, var(--emerald-brand) 40%, #15233a) 100%)",
        }}
      >
        <div
          className="text-[11px] mono font-bold uppercase tracking-widest mb-2"
          style={{ color: "color-mix(in oklab, var(--emerald-brand) 70%, white)" }}
        >
          System design
        </div>
        <h2 className="display text-2xl lg:text-3xl font-bold tracking-tight">
          How the backend enforces every plan
        </h2>
        <div className="space-y-4 mt-5 text-[14px] leading-[1.75] max-w-4xl" style={{ color: "rgba(255,255,255,0.82)" }}>
          <p>
            Every authenticated request first passes through a plan-resolution middleware that
            attaches the merchant's current tier, billing status, and the start of the current
            usage window to the request context. This resolution is cached at the edge for short
            intervals to keep latency low, but it always reads from a single source of truth — the
            subscription record — so that downgrades and cancellations take effect on the very next
            request without manual cache invalidation.
          </p>
          <p>
            Usage tracking is implemented as a per-merchant, per-resource counter keyed by a
            rolling thirty-day window for monthly limits and by a calendar-day window for daily
            caps. Audits, chatbot messages, and auto-fix executions each increment their own
            counter atomically as part of the same transaction that records the underlying action,
            which prevents the classic double-spend race where two parallel requests both think
            they are under the limit. When a counter crosses a soft threshold, the API returns a
            structured warning that the client surfaces in the UI; when it crosses the hard limit,
            the request is rejected with a 402-style payload that includes the cap, the current
            count, and a deep link to the upgrade page.
          </p>
          <p>
            Auto-fix and write operations are routed through a separate policy engine that takes
            the action type, the plan, the merchant's configured guardrails, and the target Shopify
            resource as input, and returns either an allow, an allow-with-confirmation, or a deny.
            High-risk categories — price changes, inventory mutations, bulk writes beyond plan-specific
            sizes, theme code deploys, and app installs — are explicitly enumerated in the policy
            so that a missing rule defaults to deny rather than allow. The same engine is invoked
            from both the chatbot tool-calling layer and the direct API, so a merchant cannot bypass
            a restriction by phrasing it as a chat instruction.
          </p>
          <p>
            AI cost control sits on top of usage limits as a second, independent layer. Every LLM
            call is metered by input and output tokens, attributed to the merchant and the feature
            that issued it, and aggregated into a per-tier monthly budget. When a merchant approaches
            their budget the system automatically downshifts to smaller models for low-stakes calls
            such as suggestion previews, while keeping the strongest model reserved for diagnoses
            and policy decisions. Per-request circuit breakers cap maximum tokens, maximum tool-call
            depth, and maximum wall-clock time, which protects against runaway agent loops and
            prompt-injection attempts that try to drain the merchant's budget. All of this telemetry
            flows into an internal dashboard so that pricing assumptions can be re-evaluated against
            real cost-of-goods on a continuous basis.
          </p>
        </div>
      </section>

      {/* Footer CTA */}
      <div className="mt-12 text-center">
        <Link
          to="/advisor"
          className="inline-flex items-center justify-center gap-2 gradient-emerald text-white text-[14px] font-semibold px-6 py-3 rounded-xl glow-emerald hover:opacity-95 active:scale-[0.98] transition"
        >
          <Sparkles className="size-4" />
          Try the AI Advisor first
        </Link>
        <div className="mt-3 text-[12px] mono" style={{ color: "var(--text-muted)" }}>
          14-day money-back guarantee on every paid plan.
        </div>
      </div>
    </div>
  );
}
