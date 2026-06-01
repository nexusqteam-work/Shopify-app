import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Paperclip } from "lucide-react";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "AI Advisor — StoreCoach" },
      { name: "description", content: "Chat with an AI store coach that has full context on your Shopify data." },
    ],
  }),
  component: AdvisorPage,
});

type Msg = { role: "user" | "ai"; text: string; ts: string };

const SUGGESTIONS = [
  "Why is my conversion rate low?",
  "How do I speed up my store?",
  "Which issue should I fix first?",
  "How can I increase my AOV?",
];

const WELCOME =
  "Hi! I'm your AI Store Coach. I have full access to your store — 312 orders, 87 products, 11 apps, and your complete audit results.\n\nAsk me anything:\n• Why did my sales drop?\n• Which products to promote?\n• How do I fix the speed issue?\n• What should I focus on this week?";

function nowTs() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function aiReply(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("speed") || lower.includes("fast")) {
    return "Your biggest speed bottleneck is 2.4MB of app-injected JavaScript. Removing ReviewBuddy Pro, LiveChat Plus, and ExitPop Master alone will drop mobile load time from 7.8s to ~3.2s. That's worth roughly ₹38,000/month in recovered revenue. Want me to walk through the migration plan?";
  }
  if (lower.includes("conversion") || lower.includes("aov")) {
    return "Your conversion rate is 1.69% vs the industry benchmark of 2.5–3.1%. The top three levers, in order of ROI: (1) hide phone/company fields in checkout — 15 min for +₹19K/mo, (2) add scarcity badges on PDPs — 30 min for +₹24K/mo, (3) enable Shop Pay one-tap. Start with #1.";
  }
  if (lower.includes("first") || lower.includes("focus")) {
    return "This week, focus on #1 — the 11-app JS bloat. It's a 2-hour effort but unlocks ₹38,000/month and cascades into better SEO and mobile UX scores. After that, the checkout simplification is a 15-minute task for ₹19,000/month.";
  }
  return "Based on your store data, the highest-leverage move right now is reducing app JavaScript. Your current 7.8s mobile load time is suppressing every other metric. Want me to break down a 2-week plan?";
}

function AdvisorPage() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "ai", text: WELCOME, ts: "" }]);
  useEffect(() => {
    setMessages((m) => (m[0]?.ts ? m : [{ ...m[0], ts: nowTs() }, ...m.slice(1)]));
  }, []);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { role: "user", text: t, ts: nowTs() }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: "ai", text: aiReply(t), ts: nowTs() }]);
    }, 1200);
  };

  const showSuggestions = messages.length === 1;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="max-w-[820px] mx-auto space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""} animate-fade-up`}>
              {m.role === "ai" && (
                <div className="size-8 rounded-full gradient-emerald flex items-center justify-center shrink-0 glow-emerald">
                  <span className="text-white text-[14px] font-bold">◈</span>
                </div>
              )}
              <div className={`max-w-[78%] ${m.role === "user" ? "items-end" : ""} flex flex-col`}>
                {m.role === "ai" && (
                  <div className="display text-[12px] font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                    AI Store Coach
                  </div>
                )}
                <div
                  className={`text-[13.5px] leading-relaxed whitespace-pre-line px-4 py-3 rounded-2xl ${
                    m.role === "user" ? "text-white rounded-br-sm" : "rounded-tl-sm"
                  }`}
                  style={
                    m.role === "user"
                      ? { background: "var(--emerald-brand)" }
                      : { background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(13,19,32,0.04)" }
                  }
                >
                  {m.text}
                </div>
                <div className="text-[10.5px] mono mt-1 px-1" style={{ color: "var(--text-muted)" }}>
                  {m.ts}
                </div>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex gap-3 animate-fade-up">
              <div className="size-8 rounded-full gradient-emerald flex items-center justify-center shrink-0">
                <span className="text-white text-[14px] font-bold">◈</span>
              </div>
              <div
                className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {[0, 200, 400].map((d) => (
                  <span
                    key={d}
                    className="size-2 rounded-full animate-pulse-dot"
                    style={{ background: "var(--emerald-brand)", animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {showSuggestions && (
            <div className="flex flex-wrap gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3.5 py-2 rounded-full border bg-white text-[12.5px] font-medium hover:border-[var(--emerald-brand)] hover:text-[var(--emerald-brand)] transition"
                  style={{ borderColor: "var(--border)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 sm:px-6 lg:px-10 py-4 lg:py-5 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-[820px] mx-auto">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl border bg-white"
            style={{ borderColor: "var(--border)", boxShadow: "0 4px 16px -8px rgba(13,19,32,0.08)" }}
          >
            <button
              type="button"
              className="size-9 rounded-lg flex items-center justify-center hover:bg-[var(--muted)]"
              style={{ color: "var(--text-muted)" }}
              title="Store context attached"
            >
              <Paperclip className="size-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your store…"
              className="flex-1 bg-transparent outline-none text-[14px] py-2"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="size-10 rounded-full gradient-emerald flex items-center justify-center text-white glow-emerald hover:opacity-95 active:scale-[0.95] transition disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
          <div className="text-[10.5px] mono mt-2 text-center" style={{ color: "var(--text-muted)" }}>
            Press Enter to send · Replies are based on your live store data
          </div>
        </div>
      </div>
    </div>
  );
}
