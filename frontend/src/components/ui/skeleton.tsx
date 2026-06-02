import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}

export { Skeleton };

export function SkeletonCard() {
  return (
    <div className="surface-card p-6 animate-pulse">
      <div className="h-6 w-32 bg-[var(--border)] rounded mb-4"></div>
      <div className="h-10 w-24 bg-[var(--border)] rounded mb-2"></div>
      <div className="h-4 w-48 bg-[var(--border)] rounded"></div>
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="surface-card p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 bg-[var(--border)] rounded-lg"></div>
        <div className="space-y-2">
          <div className="h-4 w-16 bg-[var(--border)] rounded"></div>
          <div className="h-3 w-24 bg-[var(--border)] rounded"></div>
        </div>
      </div>
      <div className="h-6 w-20 bg-[var(--border)] rounded mt-4"></div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)]">
          <div className="h-12 w-12 bg-[var(--border)] rounded-lg shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/3 bg-[var(--border)] rounded"></div>
            <div className="h-4 w-1/2 bg-[var(--border)] rounded"></div>
          </div>
          <div className="h-8 w-24 bg-[var(--border)] rounded-lg"></div>
        </div>
      ))}
    </div>
  );
}
