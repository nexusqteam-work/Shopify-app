import { createFileRoute } from "@tanstack/react-router";
import { Bell, Lock, CreditCard, Store as StoreIcon, Sparkles, Eye } from "lucide-react";
import { useMerchant } from "@/hooks/useMerchant";
import { useQuery, useMutation } from "@tanstack/react-query";
import { visualAuditApi, billingApi } from "@/lib/api";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings - StoreCoach" },
      { name: "description", content: "Manage your StoreCoach workspace, integrations and notifications." },
    ],
  }),
  component: SettingsPage,
});

function Section({
  icon: Icon,
  title,
  description,
  children,
  delay,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <div className="surface-card p-6 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-4 mb-5">
        <div
          className="size-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="display text-[16px] font-bold tracking-tight">{title}</h2>
          <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between py-2.5 border-t" style={{ borderColor: "var(--border)" }}>
      <span className="text-[13px]">{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative w-10 h-5.5 rounded-full transition-colors cursor-pointer" style={{ background: "var(--muted)" }}>
        <span className="absolute top-0.5 left-0.5 size-4.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4.5" />
      </span>
    </label>
  );
}

function SettingsPage() {
  const { merchant } = useMerchant();
  const { visualAudit, codeGen, autoFix } = usePlanFeatures();

  const { data: planInfoRes } = useQuery({
    queryKey: ["visual-audit-plan-info"],
    queryFn: () => visualAuditApi.getPlanInfo(),
  });

  const upgradeMutation = useMutation({
    mutationFn: (plan: string) => billingApi.activate(plan),
    onSuccess: (res: any) => {
      if (res?.confirmationUrl) {
        window.location.href = res.confirmationUrl;
      }
    }
  });

  return (
    <div className="mx-auto w-full max-w-[1100px] 2xl:max-w-[1280px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10">
      <div className="mb-6 animate-fade-up">
        <div className="label-eyebrow">Settings</div>
        <h1 className="display text-[28px] font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
          Manage your connected store, notifications, and account preferences.
        </p>
      </div>

      <div className="space-y-4">
        <Section
          icon={StoreIcon}
          title="Connected Store"
          description="Your Shopify store account details from the backend."
          delay={60}
        >
          <div
            className="flex items-center gap-4 p-4 rounded-xl border"
            style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--emerald-brand) 4%, white)" }}
          >
            <div className="size-11 rounded-xl gradient-emerald flex items-center justify-center text-white font-bold display">
              {merchant?.shopName?.[0] ?? "S"}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold">{merchant?.shopName ?? "No store connected"}</div>
              <div className="mono text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                {merchant?.shopDomain ?? "Authenticate to load your store"}
              </div>
              {merchant && (
                <div className="text-[11.5px] mt-1" style={{ color: "var(--text-secondary)" }}>
                  {merchant.email} · {merchant.plan} plan · {merchant.currency}
                </div>
              )}
            </div>
            <span
              className="text-[11px] mono font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
              style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}
            >
              <span className="size-1.5 rounded-full animate-pulse-dot" style={{ background: "var(--emerald-brand)" }} />
              Synced
            </span>
          </div>
        </Section>

        <Section icon={Bell} title="Notifications" description="Choose when StoreCoach should alert you." delay={120}>
          <Toggle label="New critical issue detected" defaultChecked />
          <Toggle label="Weekly performance report (Monday 9 AM)" defaultChecked />
          <Toggle label="Competitor activity changes" defaultChecked />
          <Toggle label="Revenue milestone reached" />
        </Section>

        <Section icon={Sparkles} title="AI Advisor" description="Fine-tune how the AI uses your store context." delay={180}>
          <Toggle label="Include order history in AI context" defaultChecked />
          <Toggle label="Share anonymized benchmarks across stores" defaultChecked />
          <Toggle label="Enable proactive suggestions on the dashboard" />
        </Section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Section icon={Lock} title="Security" description="2-factor authentication and access controls." delay={240}>
            <button className="w-full text-[13px] font-semibold py-2.5 rounded-xl border hover:bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
              Manage 2FA
            </button>
          </Section>
          <Section
            icon={CreditCard}
            title="Billing"
            description={`${merchant?.plan ?? "StoreCoach"} plan${merchant?.currency ? ` · billed in ${merchant.currency}` : ""}.`}
            delay={280}
          >
            <button className="w-full text-[13px] font-semibold py-2.5 rounded-xl gradient-emerald text-white glow-emerald hover:opacity-95">
              Manage Subscription
            </button>
          </Section>
        </div>

        <Section icon={Eye} title="Visual Analysis Features" description="Your current plan limits for visual audits and auto-fixes." delay={320}>
          <div className="overflow-x-auto border rounded-xl mb-4" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-[12.5px]">
              <thead style={{ background: "var(--muted)" }}>
                <tr>
                  <th className="px-4 py-2.5 font-semibold border-b" style={{ borderColor: "var(--border)" }}>Feature</th>
                  <th className="px-4 py-2.5 font-semibold border-b text-center" style={{ borderColor: "var(--border)" }}>Basic</th>
                  <th className="px-4 py-2.5 font-semibold border-b text-center" style={{ borderColor: "var(--border)" }}>Advanced</th>
                  <th className="px-4 py-2.5 font-semibold border-b text-center" style={{ borderColor: "var(--border)" }}>Pro</th>
                  <th className="px-4 py-2.5 font-semibold border-b text-center" style={{ borderColor: "var(--border)" }}>Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                <tr>
                  <td className="px-4 py-2.5">Visual scan</td>
                  <td className="px-4 py-2.5 text-center">❌</td>
                  <td className="px-4 py-2.5 text-center">✅</td>
                  <td className="px-4 py-2.5 text-center">✅</td>
                  <td className="px-4 py-2.5 text-center">✅</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">Pages per scan</td>
                  <td className="px-4 py-2.5 text-center">0</td>
                  <td className="px-4 py-2.5 text-center">2</td>
                  <td className="px-4 py-2.5 text-center">6</td>
                  <td className="px-4 py-2.5 text-center">All</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">Conversion checks</td>
                  <td className="px-4 py-2.5 text-center">0</td>
                  <td className="px-4 py-2.5 text-center">10</td>
                  <td className="px-4 py-2.5 text-center">30</td>
                  <td className="px-4 py-2.5 text-center">50</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">Code generation</td>
                  <td className="px-4 py-2.5 text-center">❌</td>
                  <td className="px-4 py-2.5 text-center">❌</td>
                  <td className="px-4 py-2.5 text-center">✅</td>
                  <td className="px-4 py-2.5 text-center">✅</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">Auto-apply fix</td>
                  <td className="px-4 py-2.5 text-center">❌</td>
                  <td className="px-4 py-2.5 text-center">❌</td>
                  <td className="px-4 py-2.5 text-center">❌</td>
                  <td className="px-4 py-2.5 text-center">✅</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!visualAudit ? (
            <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--muted) 40%, transparent)" }}>
              <span className="text-[13px] font-semibold">Upgrade to Advanced to unlock Visual Analysis</span>
              <button onClick={() => upgradeMutation.mutate('GROWTH')} disabled={upgradeMutation.isPending} className="gradient-emerald text-white text-[12px] font-bold px-4 py-2 rounded-lg transition hover:opacity-90 disabled:opacity-50">
                {upgradeMutation.isPending ? "Upgrading..." : "Upgrade"}
              </button>
            </div>
          ) : !codeGen ? (
            <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--muted) 40%, transparent)" }}>
              <span className="text-[13px] font-semibold">Upgrade to Pro to unlock AI code generation</span>
              <button onClick={() => upgradeMutation.mutate('PRO')} disabled={upgradeMutation.isPending} className="gradient-emerald text-white text-[12px] font-bold px-4 py-2 rounded-lg transition hover:opacity-90 disabled:opacity-50">
                {upgradeMutation.isPending ? "Upgrading..." : "Upgrade"}
              </button>
            </div>
          ) : !autoFix ? (
            <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--muted) 40%, transparent)" }}>
              <span className="text-[13px] font-semibold">Upgrade to Agent to unlock auto-apply</span>
              <button onClick={() => upgradeMutation.mutate('AGENCY')} disabled={upgradeMutation.isPending} className="gradient-emerald text-white text-[12px] font-bold px-4 py-2 rounded-lg transition hover:opacity-90 disabled:opacity-50">
                {upgradeMutation.isPending ? "Upgrading..." : "Upgrade"}
              </button>
            </div>
          ) : null}
        </Section>
      </div>
    </div>
  );
}
