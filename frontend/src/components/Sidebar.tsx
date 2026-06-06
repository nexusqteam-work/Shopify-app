import { Link, useRouterState } from "@tanstack/react-router";
import logoUrl from "../assets/Logo.png";
import {
  Home,
  Radar,
  Zap,
  Sparkles,
  BarChart3,
  FileText,
  Settings,
  Cpu,
  Play,
  Menu,
  X,
  Bell,
  CreditCard,
  Eye,
  Lock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScoreRing } from "./ScoreRing";
import { useMerchant } from "@/hooks/useMerchant";
import { issuesApi, auditApi, visualAuditApi } from "@/lib/api";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Home, exact: true },
  { to: "/audit", label: "Store Audit", icon: Radar },
  { to: "/visual-audit", label: "Visual Analysis", icon: Eye },
  { to: "/action-plan", label: "Action Plan", icon: Zap },
  { to: "/advisor", label: "AI Advisor", icon: Sparkles },
  { to: "/competitors", label: "Competitors", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/pricing", label: "Pricing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { merchant } = useMerchant();
  const { visualAudit } = usePlanFeatures();

  const { data: issueSummaryRes } = useQuery({
    queryKey: ["issue-summary"],
    queryFn: () => issuesApi.summary(),
    enabled: !!merchant,
  });
  const { data: latestAuditRes } = useQuery({
    queryKey: ["latest-audit"],
    queryFn: () => auditApi.getLatest(),
    enabled: !!merchant,
  });
  const { data: visualIssuesRes } = useQuery({
    queryKey: ["visual-audit-issues"],
    queryFn: () => visualAuditApi.getIssues(),
    enabled: !!merchant && visualAudit,
  });

  const unreadNotifications = 0;
  const openIssues = issueSummaryRes?.summary?.open ?? 0;
  const visualIssuesCount = visualIssuesRes?.count ?? visualIssuesRes?.issues?.length ?? 0;

  const audit = latestAuditRes?.audit;
  let lastScannedMinutes = null;
  if (audit?.completedAt) {
    lastScannedMinutes = Math.floor((Date.now() - new Date(audit.completedAt).getTime()) / 60000);
  }

  const store = {
    name: merchant?.shopName,
    url: merchant?.shopDomain,
    lastScannedMinutes,
  };

  const overallScore = audit?.overallScore ?? 0;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        className="lg:hidden fixed top-0 inset-x-0 h-14 z-40 flex items-center justify-between px-4 border-b bg-[var(--surface)]"
        style={{ borderColor: "var(--border)" }}
      >
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-white flex items-center justify-center border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <img src={logoUrl} alt="Flovix Logo" className="size-6 object-contain" />
          </div>
          <span className="display font-bold text-[16px] tracking-tight">Flovix</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Notifications (${unreadNotifications} unread)`}
            className="relative size-10 rounded-lg flex items-center justify-center border hover:bg-[var(--muted)] transition"
            style={{ borderColor: "var(--border)" }}
          >
            <Bell className="size-5" />
            {unreadNotifications > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] mono font-bold text-white flex items-center justify-center"
                style={{ background: "var(--danger)" }}
              >
                {unreadNotifications}
              </span>
            )}
          </button>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="size-10 rounded-lg flex items-center justify-center border hover:bg-[var(--muted)] transition"
            style={{ borderColor: "var(--border)" }}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-[260px] sm:w-60 flex flex-col bg-[var(--surface)] border-r z-50 transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
        style={{ borderColor: "var(--border)" }}
      >
        <div className="px-5 pt-6 pb-4 relative">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="lg:hidden absolute top-4 right-4 size-8 rounded-md flex items-center justify-center hover:bg-[var(--muted)]"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-white flex items-center justify-center border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <img src={logoUrl} alt="Flovix Logo" className="size-7 object-contain" />
            </div>
            <div>
              <div className="display font-bold text-[18px] leading-none tracking-tight">Flovix</div>
            </div>
          </div>

          <div
            className="mt-5 p-3 rounded-xl border"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in oklab, var(--emerald-brand) 4%, white)",
            }}
          >
            <div className="flex items-center gap-3">
              <ScoreRing score={overallScore} size={48} stroke={4} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold truncate">{store.name || "No store connected"}</div>
                <div className="text-[10.5px] mono truncate" style={{ color: "var(--text-muted)" }}>
                  {store.url || "Waiting for authentication"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          <div className="label-eyebrow px-2 mb-2">Workspace</div>
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;

              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-200 ${active
                      ? "text-foreground"
                      : "text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--muted)] hover:translate-x-0.5"
                      }`}
                    style={
                      active
                        ? { background: "color-mix(in oklab, var(--emerald-brand) 10%, white)" }
                        : undefined
                    }
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                        style={{ background: "var(--emerald-brand)" }}
                      />
                    )}
                    <Icon className="size-4" strokeWidth={active ? 2.5 : 2} />
                    <span className="flex-1">{item.label}</span>
                    {item.to === "/action-plan" && openIssues > 0 && (
                      <span
                        className="text-[10px] mono font-bold px-1.5 py-0.5 rounded-full text-white"
                        style={{ background: "var(--danger)" }}
                      >
                        {openIssues}
                      </span>
                    )}
                    {item.to === "/visual-audit" && (
                      !visualAudit ? (
                        <Lock className="size-3.5 text-gray-400" />
                      ) : visualIssuesCount > 0 ? (
                        <span
                          className="text-[10px] mono font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: "var(--warn)" }}
                        >
                          {visualIssuesCount}
                        </span>
                      ) : null
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
          <Link
            to="/audit"
            className="flex items-center justify-center gap-2 w-full gradient-emerald text-white text-[13.5px] font-semibold py-2.5 rounded-xl glow-emerald hover:opacity-95 active:scale-[0.98] transition-all"
          >
            <Play className="size-4" fill="currentColor" />
            Run New Scan
          </Link>
          <div className="text-[10.5px] mono text-center mt-3" style={{ color: "var(--text-muted)" }}>
            {audit?.completedAt ? `Last scan · ${store.lastScannedMinutes}m ago` : "No completed scan yet"}
          </div>
        </div>
      </aside >
    </>
  );
}
