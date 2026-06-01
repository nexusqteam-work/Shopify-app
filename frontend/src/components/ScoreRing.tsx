import { useEffect, useState } from "react";

type Props = {
  score: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  label?: string;
  className?: string;
};

export function ScoreRing({ score, size = 72, stroke = 6, showLabel = false, label, className = "" }: Props) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(score));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const color =
    score < 50 ? "var(--danger)" : score < 70 ? "var(--warn)" : "var(--emerald-brand)";
  const ringLabel = score < 50 ? "Poor" : score < 70 ? "Fair" : "Good";
  const numberSize = Math.max(size * 0.28, 14);

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--border)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (animated / 100) * circumference}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.2,.7,.2,1)" }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center display font-bold"
          style={{ fontSize: numberSize, color: "var(--foreground)" }}
        >
          {Math.round(score)}
        </div>
      </div>
      {showLabel && (
        <div className="mt-1.5 text-[11px] mono uppercase tracking-wider" style={{ color }}>
          {label ?? ringLabel}
        </div>
      )}
    </div>
  );
}
