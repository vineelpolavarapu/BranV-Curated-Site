/**
 * Tiny inline-SVG bar chart. Avoids pulling in Recharts (~50 KB) for the
 * one dashboard view we have so far. Phase 11 can swap to Recharts when we
 * have more chart-y pages.
 */
export function MiniBarChart({
  data,
  height = 80,
  ariaLabel = 'Bar chart',
}: {
  data: Array<{ day: string; count: number }>;
  height?: number;
  ariaLabel?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const barW = 100 / data.length;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-label={ariaLabel}
        className="w-full"
        style={{ height }}
      >
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 4);
          const x = i * barW + 0.5;
          const y = height - h;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barW - 1}
                height={h}
                fill="#0a0a0a"
                rx={0.6}
              >
                <title>
                  {d.day}: {d.count}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-neutral-400">
        <span>{data[0]?.day.slice(5)}</span>
        <span>{data[data.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}
