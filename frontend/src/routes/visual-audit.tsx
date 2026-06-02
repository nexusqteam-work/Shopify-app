import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { visualAuditApi, billingApi } from "@/lib/api";
import { useMerchant } from "@/hooks/useMerchant";
import { ScoreRing } from "@/components/ScoreRing";
import { Eye, Lock, Layout, AlertCircle, RefreshCw, AlertTriangle, Code, CheckCircle, Copy, Clock } from "lucide-react";
import { SkeletonList } from "@/components/ui/Skeleton";

export const Route = createFileRoute("/visual-audit")({
  head: () => ({ meta: [{ title: "Visual Analysis - StoreCoach" }] }),
  component: VisualAuditPage,
});

function formatINRFull(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

const POLL_INTERVAL_DEFAULT = 3000;
const POLL_INTERVAL_ERROR = 10000;

function VisualAuditPage() {
  const { merchant } = useMerchant();
  const { visualAudit, codeGen, autoFix } = usePlanFeatures();
  const queryClient = useQueryClient();

  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState(POLL_INTERVAL_DEFAULT);
  const [pollError, setPollError] = useState(false);

  // 1. Fetch latest audit
  const { data: latestRes, error: latestError, isPending: latestPending, refetch: refetchLatest } = useQuery({
    queryKey: ["visual-audit-latest"],
    queryFn: () => visualAuditApi.getLatest(),
    enabled: visualAudit && !activeScanId,
    retry: false,
  });

  const latestStatus = latestRes?.audit?.status;
  
  useEffect(() => {
    if (latestStatus === 'RUNNING' && latestRes?.audit?.id) {
      setActiveScanId(latestRes.audit.id);
    }
  }, [latestStatus, latestRes]);

  // 2. Poll status if running
  const { data: statusRes, isError: statusIsError } = useQuery({
    queryKey: ["visual-audit-status", activeScanId],
    queryFn: () => visualAuditApi.getStatus(activeScanId!),
    enabled: !!activeScanId,
    refetchInterval: (query) => (query.state.data?.status === 'COMPLETED' ? false : pollInterval),
  });

  useEffect(() => {
    if (statusIsError) {
      setPollError(true);
      setPollInterval(POLL_INTERVAL_ERROR);
    } else {
      setPollError(false);
      setPollInterval(POLL_INTERVAL_DEFAULT);
    }
    
    if (statusRes?.status === 'COMPLETED') {
      setActiveScanId(null);
      queryClient.invalidateQueries({ queryKey: ["visual-audit-latest"] });
      queryClient.invalidateQueries({ queryKey: ["visual-audit-issues"] });
      queryClient.invalidateQueries({ queryKey: ["visual-audit-fixes"] });
    }
  }, [statusRes, statusIsError, queryClient]);

  // 3. Fetch Issues if COMPLETED
  const { data: issuesRes } = useQuery({
    queryKey: ["visual-audit-issues"],
    queryFn: () => visualAuditApi.getIssues(),
    enabled: visualAudit && latestStatus === 'COMPLETED',
  });

  // 4. Fetch Fixes History if PRO+
  const { data: fixesRes } = useQuery({
    queryKey: ["visual-audit-fixes"],
    queryFn: () => visualAuditApi.getCodeFixes(),
    enabled: codeGen && latestStatus === 'COMPLETED',
  });

  // Mutations
  const upgradeMutation = useMutation({
    mutationFn: () => billingApi.activate('GROWTH'),
    onSuccess: (res: any) => {
      if (res?.confirmationUrl) {
        window.location.href = res.confirmationUrl;
      }
    }
  });

  const runMutation = useMutation({
    mutationFn: () => visualAuditApi.run(),
    onSuccess: (res: any) => {
      if (res?.visualAuditId) {
        setActiveScanId(res.visualAuditId);
      }
    },
    onError: (err: any) => {
      if (err?.status === 409 && err?.visualAuditId) {
        // Auto-switch to scanning
        setActiveScanId(err.visualAuditId);
      }
    }
  });

  const revertAllMutation = useMutation({
    mutationFn: () => visualAuditApi.revertAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visual-audit-fixes"] });
    }
  });

  // Render States

  // STATE 1 - PLAN LOCKED (or 403 error on latest)
  const is403 = (latestError as any)?.status === 403;
  if (!visualAudit || is403) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 flex items-center justify-center min-h-[60vh]">
        <div className="surface-card p-8 text-center max-w-md w-full animate-fade-up">
          <div className="size-16 rounded-2xl mx-auto flex items-center justify-center mb-6" style={{ background: "color-mix(in oklab, var(--border) 20%, transparent)" }}>
            <Lock className="size-8 text-foreground" />
          </div>
          <h2 className="display text-[22px] font-bold mb-2">Visual Analysis locked</h2>
          <p className="text-[14px] mb-6" style={{ color: "var(--text-secondary)" }}>
            Visual Analysis requires Advanced plan or higher.
          </p>
          <div className="text-left text-[13px] p-4 rounded-xl mb-6 space-y-2 border" style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
            <div className="flex justify-between"><span>Advanced</span><span className="font-bold">₹1,999/mo</span></div>
            <div className="flex justify-between"><span>Pro</span><span className="font-bold">₹2,999/mo</span></div>
            <div className="flex justify-between"><span>Agent</span><span className="font-bold">₹29,999/mo</span></div>
          </div>
          <button 
            onClick={() => upgradeMutation.mutate()} 
            disabled={upgradeMutation.isPending}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-xl glow-emerald transition disabled:opacity-50"
          >
            {upgradeMutation.isPending ? "Redirecting..." : "Upgrade Now"}
          </button>
        </div>
      </div>
    );
  }

  // STATE 3 - SCANNING
  if (activeScanId || (latestPending && !latestError)) {
    const progress = statusRes?.progress || 0;
    const message = statusRes?.message || "Visiting your store pages...";
    const currentUrl = statusRes?.currentUrl || "";

    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 flex items-center justify-center min-h-[60vh]">
        <div className="surface-card p-8 max-w-md w-full animate-fade-up">
          {pollError && (
            <div className="mb-4 text-[12.5px] font-medium text-center px-3 py-2 rounded-lg" style={{ background: "color-mix(in oklab, var(--warn) 15%, transparent)", color: "var(--warn)" }}>
              Connection lost — retrying...
            </div>
          )}
          <div className="flex justify-center mb-8">
            <div className="relative size-20">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "var(--emerald-brand)" }} />
              <div className="absolute inset-2 rounded-full flex items-center justify-center gradient-emerald glow-emerald z-10">
                <Layout className="size-8 text-white" />
              </div>
            </div>
          </div>
          <h2 className="display text-center text-[20px] font-bold mb-1">{message}</h2>
          {currentUrl && <p className="text-center text-[12.5px] mono truncate mb-6" style={{ color: "var(--text-muted)" }}>{currentUrl}</p>}
          
          <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: "var(--border)" }}>
            <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, background: "var(--emerald-brand)" }} />
          </div>
          
          <div className="flex justify-between items-center text-[12px] mono font-bold mb-6" style={{ color: "var(--emerald-brand)" }}>
            <span>{Math.round(progress)}% Complete</span>
            {progress === 100 && <span>Finalizing...</span>}
          </div>

          <div className="space-y-2 mb-8">
            {statusRes?.steps?.map((step: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[13px]" style={{ color: step.done ? "var(--emerald-brand)" : "var(--text-secondary)" }}>
                {step.done ? <CheckCircle className="size-4" /> : <div className="size-1.5 rounded-full ml-1 mr-1.5" style={{ background: "currentColor" }} />}
                {step.name}
              </div>
            ))}
          </div>

          <button 
            onClick={() => setActiveScanId(null)}
            className="w-full text-[13px] font-semibold py-2.5 rounded-xl border hover:bg-[var(--muted)] transition"
            style={{ borderColor: "var(--border)" }}
          >
            Run in background
          </button>
        </div>
      </div>
    );
  }

  const is404 = (latestError as any)?.status === 404 || (!latestRes?.audit && !latestPending);

  // STATE 2 - NO SCAN YET
  if (is404) {
    const planName = merchant?.plan === 'AGENCY' ? 'Agent' : merchant?.plan === 'PRO' ? 'Pro' : 'Advanced';
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10">
        <div className="surface-card p-8 text-center max-w-lg mx-auto animate-fade-up">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-6 text-[12px] font-bold uppercase tracking-wider" style={{ background: "var(--emerald-brand-soft)", color: "var(--emerald-brand)" }}>
            <Sparkles className="size-3.5" />
            {planName} Plan Active
          </div>
          <h1 className="display text-[26px] font-bold mb-3 tracking-tight">Visual Store Analysis</h1>
          <p className="text-[14px] mb-8 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {merchant?.plan === 'GROWTH' && "2 pages scanned · 10 conversion checks"}
            {merchant?.plan === 'PRO' && "6 pages scanned · 30 checks · AI code fixes"}
            {merchant?.plan === 'AGENCY' && "All pages · 50 checks · Auto-fix enabled"}
          </p>
          <button 
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="gradient-emerald text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mx-auto glow-emerald transition hover:opacity-95 disabled:opacity-50"
          >
            <Eye className="size-4.5" />
            {runMutation.isPending ? "Starting..." : "Start Visual Scan"}
          </button>
        </div>
      </div>
    );
  }

  // STATE 4 - RESULTS
  const audit = latestRes?.audit;
  const issues = issuesRes?.issues || [];
  const fixes = fixesRes?.fixes || [];

  return (
    <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1720px] px-4 sm:px-6 lg:px-10 xl:px-14 py-6 lg:py-8 xl:py-10 space-y-8">
      
      {/* SECTION A - Visual Score Card */}
      <div className="surface-card p-6 lg:p-8 animate-fade-up">
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="shrink-0 flex flex-col items-center">
            <ScoreRing score={audit?.score || 0} size={120} stroke={10} />
            <div className="mt-4 font-bold text-[14px]">Visual Health Score</div>
            <div className="text-[12.5px] mt-1" style={{ color: "var(--text-muted)" }}>
              {audit?.pagesScanned || 0} pages scanned · {issues.length} issues found
            </div>
            <button 
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="mt-6 text-[12.5px] font-semibold px-4 py-2 border rounded-lg hover:bg-[var(--muted)] flex items-center gap-2 transition"
            >
              <RefreshCw className={`size-3.5 ${runMutation.isPending ? "animate-spin" : ""}`} />
              Re-scan
            </button>
          </div>
          <div className="flex-1">
            <h2 className="display text-[20px] font-bold mb-3 tracking-tight">AI Analysis</h2>
            <div className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
              {audit?.aiAnalysis || "Analysis complete. Review issues below."}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B - Issues List */}
      <div>
        <h3 className="display text-[18px] font-bold mb-4 tracking-tight">Visual Issues Detected</h3>
        <div className="space-y-4">
          {issues.map((issue: any, i: number) => (
            <IssueCard key={issue.id} issue={issue} codeGen={codeGen} autoFix={autoFix} delay={i * 50} queryClient={queryClient} />
          ))}
          {issues.length === 0 && (
            <div className="surface-card p-8 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
              No visual issues found. Your store looks great!
            </div>
          )}
        </div>
      </div>

      {/* SECTION C - Code Fixes History */}
      {codeGen && fixes.length > 0 && (
        <div>
          <h3 className="display text-[18px] font-bold mb-4 tracking-tight">Code Fixes History</h3>
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--muted) 40%, transparent)" }}>
                    <th className="px-4 py-3 font-semibold">Fix Title</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date Applied</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {fixes.map((fix: any) => (
                    <tr key={fix.id}>
                      <td className="px-4 py-3 font-medium">{fix.title}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] mono font-bold uppercase ${
                          fix.status === 'APPLIED' ? 'bg-green-100 text-green-700' :
                          fix.status === 'GENERATED' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {fix.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] mono" style={{ color: "var(--text-secondary)" }}>
                        {fix.appliedAt ? new Date(fix.appliedAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {fix.status === 'APPLIED' && (
                          <RevertButton fixId={fix.id} queryClient={queryClient} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--muted) 40%, transparent)" }}>
              <button 
                onClick={() => {
                  if(confirm("This will remove all StoreCoach CSS changes from your theme. Are you sure?")) {
                    revertAllMutation.mutate();
                  }
                }}
                disabled={revertAllMutation.isPending}
                className="text-[12.5px] font-semibold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition"
              >
                {revertAllMutation.isPending ? "Reverting..." : "Revert All Fixes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponents for Issue Card logic

function Sparkles({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
}

function IssueCard({ issue, codeGen, autoFix, delay, queryClient }: any) {
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState<string | null>(issue.cssFixCode || null);
  const [codeFixId, setCodeFixId] = useState<string | null>(issue.codeFixId || null);
  const [fixStatus, setFixStatus] = useState<string | null>(issue.fixStatus || null);
  const [genError, setGenError] = useState(false);
  const [applyError, setApplyError] = useState(false);

  const priorityStyles = {
    critical: { bg: "var(--danger)", fg: "white", icon: AlertTriangle },
    high: { bg: "var(--warn)", fg: "white", icon: AlertCircle },
    medium: { bg: "var(--emerald-brand)", fg: "white", icon: CheckCircle },
  };
  const pStyle = priorityStyles[issue.priority as keyof typeof priorityStyles] || priorityStyles.medium;
  const PIcon = pStyle.icon;

  const genMutation = useMutation({
    mutationFn: () => visualAuditApi.generateFix(issue.id),
    onSuccess: (res: any) => {
      setCode(res.code);
      setCodeFixId(res.codeFixId);
      setFixStatus('GENERATED');
      setGenError(false);
      queryClient.invalidateQueries({ queryKey: ["visual-audit-fixes"] });
    },
    onError: () => setGenError(true)
  });

  const applyMutation = useMutation({
    mutationFn: () => visualAuditApi.applyFix(codeFixId!),
    onSuccess: () => {
      setFixStatus('APPLIED');
      setApplyError(false);
      queryClient.invalidateQueries({ queryKey: ["visual-audit-fixes"] });
    },
    onError: () => setApplyError(true)
  });

  const revertMutation = useMutation({
    mutationFn: () => visualAuditApi.revertFix(codeFixId!),
    onSuccess: () => {
      setFixStatus('REVERTED');
      queryClient.invalidateQueries({ queryKey: ["visual-audit-fixes"] });
    }
  });

  return (
    <div className="surface-card overflow-hidden animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] mono font-bold uppercase tracking-wider" style={{ background: pStyle.bg, color: pStyle.fg }}>
              <PIcon className="size-3" /> {issue.priority}
            </span>
            <span className="text-[11px] mono font-semibold px-2 py-0.5 rounded-full border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              {issue.location || 'Storewide'}
            </span>
            <span className="text-[11px] mono font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "var(--muted)", color: "var(--text-secondary)" }}>
              <Clock className="size-3" />
              {issue.effortLabel || "30 min"}
            </span>
          </div>
          <h4 className="display text-[15px] font-bold tracking-tight text-foreground truncate">{issue.title}</h4>
          <p className="text-[13px] mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{issue.description}</p>
        </div>
        
        <div className="shrink-0 flex items-center gap-4">
          <div className="text-right">
            <div className="label-eyebrow">Impact</div>
            <div className="display text-[18px] font-bold mono" style={{ color: "var(--danger)" }}>
              {formatINRFull(issue.impact || 0)}
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-2 border rounded-xl hover:bg-[var(--muted)] transition" style={{ borderColor: "var(--border)" }}>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-5 border-t" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--muted) 40%, transparent)" }}>
          <div className="label-eyebrow mb-3">Fix Instructions</div>
          {issue.fixInstructions ? (
            <p className="text-[13px] leading-relaxed mb-4">{issue.fixInstructions}</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {issue.fixSteps?.map((step: string, i: number) => (
                <li key={i} className="flex gap-2 text-[13px]">
                  <span className="shrink-0 size-5 rounded-full mono text-[10px] font-bold flex items-center justify-center bg-white border" style={{ borderColor: "var(--border)" }}>{i+1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ul>
          )}

          {codeGen && (
            <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3 mb-3">
                {!code ? (
                  <button 
                    onClick={() => genMutation.mutate()}
                    disabled={genMutation.isPending}
                    className="text-[12.5px] font-semibold px-4 py-2 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition flex items-center gap-2"
                  >
                    {genMutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Code className="size-4" />}
                    {genMutation.isPending ? "Generating..." : "Generate Fix Code"}
                  </button>
                ) : (
                  <div className="text-[13px] font-medium text-green-700 flex items-center gap-1.5">
                    <CheckCircle className="size-4" /> Code Generated
                  </div>
                )}
                
                {autoFix && code && fixStatus !== 'APPLIED' && (
                  <button 
                    onClick={() => applyMutation.mutate()}
                    disabled={applyMutation.isPending}
                    className="text-[12.5px] font-semibold px-4 py-2 rounded-lg gradient-emerald text-white glow-emerald hover:opacity-95 transition flex items-center gap-2"
                  >
                    {applyMutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {applyMutation.isPending ? "Applying to theme..." : "Auto-Apply to Store"}
                  </button>
                )}
                
                {fixStatus === 'APPLIED' && (
                  <>
                    <div className="text-[13px] font-medium text-emerald-600 flex items-center gap-1.5 px-3">
                      ✅ Applied to your store
                    </div>
                    <button 
                      onClick={() => revertMutation.mutate()}
                      disabled={revertMutation.isPending}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition"
                    >
                      {revertMutation.isPending ? "Reverting..." : "Revert"}
                    </button>
                  </>
                )}
              </div>

              {genError && (
                <div className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3 flex items-center justify-between">
                  <span>Could not generate fix. Try again or fix manually using the instructions.</span>
                  <button onClick={() => genMutation.mutate()} className="font-semibold underline">Retry</button>
                </div>
              )}

              {applyError && (
                <div className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">
                  Could not apply fix automatically. Copy the code below and add it to your theme CSS.
                </div>
              )}

              {code && (
                <div className="mt-4 bg-[#1e293b] rounded-xl overflow-hidden relative group">
                  <button 
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition opacity-0 group-hover:opacity-100"
                    title="Copy Code"
                  >
                    <Copy className="size-4" />
                  </button>
                  <pre className="p-4 text-[13px] text-gray-300 font-mono overflow-x-auto">
                    <code>{code}</code>
                  </pre>
                  <div className="px-4 py-2.5 bg-black/40 flex items-center gap-3 border-t border-white/10 text-white/70 text-[11px] mono">
                    {issue.riskLevel && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        issue.riskLevel === 'LOW' ? 'bg-green-500/20 text-green-400' : 
                        issue.riskLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' : 
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {issue.riskLevel} RISK
                      </span>
                    )}
                    <span className="flex-1">{issue.codeExplanation || "Copy this to your base.css or theme.css"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RevertButton({ fixId, queryClient }: any) {
  const mutation = useMutation({
    mutationFn: () => visualAuditApi.revertFix(fixId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visual-audit-fixes"] });
    }
  });

  return (
    <button 
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="text-[12px] font-medium px-3 py-1.5 rounded-lg border hover:bg-[var(--muted)] transition"
    >
      {mutation.isPending ? "..." : "Revert"}
    </button>
  );
}
