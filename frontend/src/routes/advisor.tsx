import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { Send, Paperclip } from "lucide-react";
import logoUrl from "../assets/Logo.png";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "@/lib/api";
import { useMerchant } from "@/hooks/useMerchant";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

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

const getWelcomeMessage = (shopName?: string) =>
  `Hi! I'm your AI Store Coach for ${shopName || 'your store'}. I have full access to your live Shopify data and your complete audit results.\n\nAsk me anything:\n• Why did my sales drop?\n• Which products to promote?\n• How do I fix the speed issue?\n• What should I focus on this week?`;

function nowTs() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function AdvisorPage() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();
  const sessionId = "default";

  const { data: historyRes, isPending, isError } = useQuery({
    queryKey: ["chat-history", sessionId],
    queryFn: () => chatApi.getHistory(sessionId),
    enabled: !!merchant,
  });

  const sendMutation = useMutation({
    mutationFn: (msg: string) => chatApi.send(msg, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-history", sessionId] });
    },
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => {
    const rawMessages = historyRes?.messages || [];
    if (rawMessages.length === 0) {
      return [{ role: "ai", text: getWelcomeMessage(merchant?.shopName), ts: nowTs(), _id: "welcome" }];
    }
    return rawMessages.map((m: any) => ({
      role: m.role,
      text: m.content || m.text, // depending on backend naming
      ts: new Date(m.createdAt || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      _id: m.id || Math.random().toString(),
    }));
  }, [historyRes, merchant?.shopName]);

  // Optimistic typing or pending state
  const typing = sendMutation.isPending;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setInput("");
    sendMutation.mutate(t);
  };

  if (isPending) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen p-8 max-w-[820px] mx-auto w-full">
        <SkeletonList count={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen p-8 max-w-[820px] mx-auto w-full">
        <ErrorState message="Failed to load chat history." onRetry={() => queryClient.invalidateQueries({ queryKey: ["chat-history", sessionId] })} />
      </div>
    );
  }

  const showSuggestions = messages.length === 1;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="max-w-[820px] mx-auto space-y-5">
          {messages.map((m: any, i: number) => (
            <div key={m._id || i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""} animate-fade-up`}>
              {m.role === "ai" && (
                <div className="size-8 rounded-full bg-white flex items-center justify-center shrink-0 border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <img src={logoUrl} alt="AI Store Coach" className="size-6 object-contain" />
                </div>
              )}
              <div className={`max-w-[78%] ${m.role === "user" ? "items-end" : ""} flex flex-col`}>
                {m.role === "ai" && (
                  <div className="display text-[12px] font-bold mb-1" style={{ color: "var(--text-secondary)" }}>
                    AI Store Coach
                  </div>
                )}
                <div
                  className={`text-[13.5px] leading-relaxed whitespace-pre-line px-4 py-3 rounded-2xl ${m.role === "user" ? "text-white rounded-br-sm" : "rounded-tl-sm"
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
              <div className="size-8 rounded-full bg-white flex items-center justify-center shrink-0 border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <img src={logoUrl} alt="AI Store Coach" className="size-6 object-contain" />
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
              disabled={!input.trim() || sendMutation.isPending}
              className="size-10 rounded-full gradient-emerald flex items-center justify-center text-white glow-emerald hover:opacity-95 active:scale-[0.95] transition disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
