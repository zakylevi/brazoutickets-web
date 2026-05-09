import { useState, useMemo, useEffect } from "react";

export interface DonutCategory {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutCategory[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  isCurrency?: boolean;
}

const DonutChart = ({ data, size = 200, thickness = 32, centerLabel = "Total", isCurrency = true }: DonutChartProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [animProgress, setAnimProgress] = useState(0);
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Animate on mount
  useEffect(() => {
    setAnimProgress(0);
    const start = performance.now();
    const duration = 1000;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setAnimProgress(easeOut(progress));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [data]);

  const segments = useMemo(() => {
    let accumulated = 0;
    return data.map((item) => {
      const pct = total > 0 ? item.value / total : 0;
      const dashArray = pct * circumference;
      const dashOffset = -accumulated * circumference;
      accumulated += pct;
      return { ...item, pct, dashArray, dashOffset };
    });
  }, [data, total, circumference]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth={thickness}
          />
          {segments.map((seg, i) => {
            const animatedDash = seg.dashArray * animProgress;
            return (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${animatedDash} ${circumference - animatedDash}`}
                strokeDashoffset={seg.dashOffset * animProgress}
                className="transition-opacity duration-200"
                style={{ opacity: hovered !== null && hovered !== i ? 0.25 : 1 }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered !== null ? (
            <>
              <span className="font-bold text-muted-foreground" style={{ fontSize: Math.max(8, size * 0.07) }}>{segments[hovered].label}</span>
              <span className="font-black text-foreground" style={{ fontSize: Math.max(12, size * 0.13) }}>{isCurrency ? `$${segments[hovered].value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : segments[hovered].value.toLocaleString()}</span>
              <span className="text-muted-foreground font-medium" style={{ fontSize: Math.max(7, size * 0.06) }}>
                {total > 0 ? Math.round(segments[hovered].pct * 100) : 0}%
              </span>
            </>
          ) : (
            <>
              <span className="font-bold text-muted-foreground" style={{ fontSize: Math.max(8, size * 0.07) }}>{centerLabel}</span>
              <span className="font-black text-foreground" style={{ fontSize: Math.max(12, size * 0.13) }}>{isCurrency ? `$${Math.round(total * animProgress).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : Math.round(total * animProgress).toLocaleString()}</span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 cursor-default"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
