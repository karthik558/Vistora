"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
export default function OperationsCharts({
  rows,
}: {
  rows: { date: string; created: number; completed: number }[];
}) {
  return (
    <section className="feedback-trend-row ops-trend-row">
      <Trend
        rows={rows}
        field="created"
        title="Service request volume"
        noun="requests"
      />
      <Trend
        rows={rows}
        field="completed"
        title="Completed service jobs"
        noun="completions"
      />
    </section>
  );
}
function Trend({
  rows,
  field,
  title,
  noun,
}: {
  rows: { date: string; created: number; completed: number }[];
  field: "created" | "completed";
  title: string;
  noun: string;
}) {
  const [range, setRange] = useState<7 | 14>(7),
    [selected, setSelected] = useState<number | null>(null),
    [width, setWidth] = useState(500);
  const plot = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!plot.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    );
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, []);
  const days = useMemo(() => rows.slice(-range), [rows, range]),
    max = Math.max(4, ...days.map((d) => d[field]));
  const points = days.map((d, i) => ({
    x: 32 + (i * (width - 56)) / Math.max(1, days.length - 1),
    y: 158 - (d[field] / max) * 132,
  }));
  const slopes = points
    .slice(1)
    .map((p, i) => (p.y - points[i].y) / (p.x - points[i].x));
  const tangents = points.map((_, i) =>
    i === 0 || i === points.length - 1 || slopes[i - 1] * slopes[i] <= 0
      ? 0
      : (2 * slopes[i - 1] * slopes[i]) / (slopes[i - 1] + slopes[i]),
  );
  const path = points.reduce((path, p, i) => {
    if (!i) return `M${p.x},${p.y}`;
    const prev = points[i - 1],
      third = (p.x - prev.x) / 3;
    return `${path} C${prev.x + third},${prev.y + third * tangents[i - 1]} ${p.x - third},${p.y - third * tangents[i]} ${p.x},${p.y}`;
  }, "");
  const dateLabel = (value: string) =>
    new Date(value + "T12:00:00Z").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const active = selected === null ? undefined : days[selected];
  return (
    <section className="panel feedback-trend-panel">
      <div className="panel-heading">
        <div>
          <h2 id={id}>{title}</h2>
          <p>
            {days.reduce((n, d) => n + d[field], 0)} {noun} over the last{" "}
            {range} days · UTC
          </p>
        </div>
        <div className="chart-range-control" aria-label={`${title} period`}>
          {([7, 14] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === range}
              onClick={() => {
                setRange(n);
                setSelected(null);
              }}
            >
              {n} days
            </button>
          ))}
        </div>
      </div>
      <div className="volume-chart">
        <div className="volume-plot" ref={plot}>
          <svg viewBox={`0 0 ${width} 194`} role="img" aria-labelledby={id}>
            {[0, 1, 2, 3, 4].map((n) => (
              <g key={n}>
                <line
                  x1="32"
                  x2={width - 24}
                  y1={158 - n * 33}
                  y2={158 - n * 33}
                  className="volume-grid"
                />
                <text
                  x="21"
                  y={162 - n * 33}
                  textAnchor="end"
                  className="volume-axis"
                >
                  {Math.round((max * n) / 4)}
                </text>
              </g>
            ))}
            <path d={path} className="volume-line" />
            {points.map((p, i) => (
              <g key={days[i].date}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={selected === i ? 4 : 2.5}
                  className="volume-point"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="14"
                  fill="transparent"
                  role="button"
                  tabIndex={0}
                  aria-label={`${dateLabel(days[i].date)}: ${days[i][field]} ${noun}`}
                  onMouseEnter={() => setSelected(i)}
                  onFocus={() => setSelected(i)}
                  onClick={() => setSelected(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(i);
                    }
                  }}
                />
                {(range === 7 || i % 2 === 0 || i === days.length - 1) && (
                  <text
                    x={p.x}
                    y="184"
                    textAnchor="middle"
                    className="volume-axis"
                  >
                    {dateLabel(days[i].date)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
        <div className="volume-chart-caption" aria-live="polite">
          <span className="volume-legend" />
          {active
            ? `${dateLabel(active.date)} · ${active[field]} ${noun}`
            : `Daily ${noun} · select a point to inspect`}
        </div>
      </div>
    </section>
  );
}
