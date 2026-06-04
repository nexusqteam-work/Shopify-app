import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import logoUrl from "../assets/Logo.png";

export function FloatingAdvisor() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/advisor")) return null;

  return (
    <div className="fixed z-50 bottom-5 right-5 lg:bottom-7 lg:right-7 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-[280px] rounded-2xl border bg-white p-4 animate-fade-up"
          style={{
            borderColor: "var(--border)",
            boxShadow: "0 24px 48px -16px rgba(13,19,32,0.25), 0 2px 8px rgba(13,19,32,0.06)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-white flex items-center justify-center border overflow-hidden shrink-0" style={{ borderColor: "var(--border)" }}>
                <img src={logoUrl} alt="AI Store Coach" className="size-7 object-contain" />
              </div>
              <div>
                <div className="display text-[14px] font-bold tracking-tight leading-tight">
                  AI Store Coach
                </div>
                <div
                  className="text-[10.5px] mono inline-flex items-center gap-1.5 mt-0.5"
                  style={{ color: "var(--emerald-brand)" }}
                >
                  <span
                    className="size-1.5 rounded-full animate-pulse-dot"
                    style={{ background: "var(--emerald-brand)" }}
                  />
                  Online · Powered by Claude
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="size-7 rounded-md flex items-center justify-center hover:bg-[var(--muted)]"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p
            className="text-[12.5px] leading-relaxed mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            Ask anything about your store — speed, conversions, SEO, app bloat.
            I have your full audit context.
          </p>
          <Link
            to="/advisor"
            onClick={() => setOpen(false)}
            className="mt-3 flex items-center justify-center gap-2 w-full gradient-emerald text-white text-[12.5px] font-semibold py-2.5 rounded-xl glow-emerald hover:opacity-95 active:scale-[0.98] transition"
          >
            Open Advisor
          </Link>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open AI Advisor"
        className="relative size-14 rounded-full bg-white border flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition"
        style={{ borderColor: "var(--border)", boxShadow: "0 8px 24px rgba(13,19,32,0.12)" }}
      >
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-15"
          style={{ background: "var(--border)" }}
        />
        {open ? <X className="size-5 relative text-[var(--text-secondary)]" /> : <img src={logoUrl} alt="StoreCoach Logo" className="size-7 object-contain relative" />}
      </button>
    </div>
  );
}
