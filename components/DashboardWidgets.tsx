"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Clock,
  QrCode,
  Send,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building,
  Building2,
  BedDouble,
  Utensils,
  Compass,
  Flower2,
  Wrench,
  Car,
} from "lucide-react";
import { FeedbackViewModel } from "../types/experience";

// 1. VERIFIED FEEDBACK VOLUME
export function FeedbackTrendChart({ feedback = [] }: { feedback: FeedbackViewModel[] }) {
  const [rangeDays, setRangeDays] = useState<7 | 14>(7);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(700);
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);
  const days = useMemo(() => {
    const today = new Date();
    const localDate = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    return Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - rangeDays + index + 1);
      const key = localDate(date);
      const records = feedback.filter(item => localDate(new Date(item.createdAt)) === key);
      return { key, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: records.length };
    });
  }, [feedback, rangeDays]);
  const max = Math.max(4, ...days.map(day => day.count));
  const points = days.map((day, index) => ({ x: 32 + index * (chartWidth - 56) / (days.length - 1), y: 158 - day.count / max * 132 }));
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / (point.x - points[index].x));
  // Round turns without inventing negative volumes or overshooting observed peaks.
  const tangents = points.map((_, index) => {
    if (index === 0 || index === points.length - 1) return 0;
    const before = slopes[index - 1];
    const after = slopes[index];
    return before * after <= 0 ? 0 : 2 * before * after / (before + after);
  });
  const path = points.reduce((result, point, index) => {
    if (index === 0) return `M${point.x},${point.y}`;
    const previous = points[index - 1];
    const controlWidth = (point.x - previous.x) / 3;
    return `${result} C${previous.x + controlWidth},${previous.y + controlWidth * tangents[index - 1]} ${point.x - controlWidth},${point.y - controlWidth * tangents[index]} ${point.x},${point.y}`;
  }, "");
  const active = selectedDay === null ? null : days[selectedDay];

  return (
    <section className="panel feedback-trend-panel">
      <div className="panel-heading">
        <div><h2>Feedback trend &amp; volume</h2><p>{days.reduce((sum, day) => sum + day.count, 0)} responses over the last {rangeDays} days</p></div>
        <div className="chart-range-control" aria-label="Chart period">
          {[7, 14].map(value => <button key={value} type="button" aria-pressed={rangeDays === value} onClick={() => { setRangeDays(value as 7 | 14); setSelectedDay(null); }}>{value} days</button>)}
        </div>
      </div>
      <div className="volume-chart">
        <div ref={plotRef} className="volume-plot">
        <svg viewBox={`0 0 ${chartWidth} 194`} role="img" aria-label={`Daily feedback volume. ${days.map(day => `${day.label}: ${day.count}`).join(", ")}`}>
          {[0, 1, 2, 3, 4].map(index => {
            const y = 158 - index * 33;
            return <g key={index}><line x1="32" x2={chartWidth - 24} y1={y} y2={y} className="volume-grid" /><text x="21" y={y + 4} textAnchor="end" className="volume-axis">{Math.round(max * index / 4)}</text></g>;
          })}
          <path d={path} className="volume-line" />
          {points.map((point, index) => <g key={days[index].key}>
            <circle cx={point.x} cy={point.y} r={selectedDay === index ? 4 : 2.5} className="volume-point" />
            <circle cx={point.x} cy={point.y} r="14" fill="transparent" tabIndex={0} role="button" aria-label={`${days[index].label}: ${days[index].count} responses`} onMouseEnter={() => setSelectedDay(index)} onFocus={() => setSelectedDay(index)} onClick={() => setSelectedDay(index)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDay(index); } }} />
            {(rangeDays === 7 || index % 2 === 0 || index === rangeDays - 1) && <text x={point.x} y="184" textAnchor="middle" className="volume-axis">{days[index].label}</text>}
          </g>)}
        </svg>
        </div>
        <div className="volume-chart-caption" aria-live="polite"><span className="volume-legend" />{active ? `${active.label} · ${active.count} responses` : "Daily guest responses · select a point to inspect"}</div>
      </div>
    </section>
  );
}

// 2. COLLECTION SOURCE BREAKDOWN COMPONENT
export function CollectionSourceBreakdown({ totalFeedbackCount }: { totalFeedbackCount: number }) {
  const sources = [
    {
      id: "qr_room",
      name: "In-Room Keycard QR",
      detail: "Bedside nightstand & door keycard sleeve",
      icon: QrCode,
    },
    {
      id: "qr_dining",
      name: "Restaurant & Bar Table QR",
      detail: "All-day dining & rooftop lounge acrylics",
      icon: Utensils,
    },
    {
      id: "guest_invite",
      name: "Tracked Guest Invitation Link",
      detail: "Concierge VIP dispatch via email & SMS",
      icon: Send,
    },
    {
      id: "front_desk",
      name: "Front Desk Tablet & Check-in",
      detail: "Reception departure concierge desk",
      icon: Building,
    },
    {
      id: "post_stay",
      name: "Post-Stay Automated Follow-up",
      detail: "Scheduled checkout survey email",
      icon: ExternalLink,
    },
  ];

  return (
    <div className="panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="panel-heading">
        <div>
          <h2>Collection touchpoints</h2>
          <p>Supported paths for collecting guest sentiment</p>
        </div>
        <Link className="panel-action" href="/dashboard/qr-codes">
          QR Studio ↗
        </Link>
      </div>

      <div style={{ padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
        {sources.map((src) => {
          const Icon = src.icon;
          return (
            <div key={src.id} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "10px 12px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span style={{ width: "34px", height: "34px", display: "grid", placeItems: "center", color: "var(--sage-deep)", background: "var(--sage-soft)", borderRadius: "9px", flexShrink: 0 }}>
                <Icon size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{src.name}</strong>
                <span style={{ display: "block", fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>{src.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: "12px 24px",
          background: "var(--canvas-alt)",
          borderTop: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
        }}
      >
        <span style={{ color: "var(--muted)" }}>{totalFeedbackCount} verified responses in the current view</span>
        <Link
          href="/dashboard/invitations"
          style={{ color: "var(--sage-deep)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <span>Tracked Invitations</span>
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}

// 3. DEPARTMENT PERFORMANCE MATRIX COMPONENT
export function DepartmentPerformanceMatrix({ feedback = [] }: { feedback: FeedbackViewModel[] }) {
  const departments = [
    { name: "Front Desk", targetSla: "10 min" },
    { name: "Housekeeping", targetSla: "15 min" },
    { name: "Food & Beverage", targetSla: "12 min" },
    { name: "Concierge", targetSla: "8 min" },
    { name: "Spa & Wellness", targetSla: "15 min" },
    { name: "Facilities & Room", targetSla: "20 min" },
    { name: "Valet & Transfers", targetSla: "5 min" },
  ];

  return (
    <div className="panel" style={{ overflow: "hidden", marginBottom: "22px" }}>
      <div className="panel-heading">
        <div>
          <h2>Department performance &amp; SLA compliance</h2>
          <p>Operational CSAT benchmarks across hotel functional divisions</p>
        </div>
        <Link className="panel-action" href="/dashboard/analytics">
          Full Analytics ↗
        </Link>
      </div>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Department Touchpoint</th>
              <th>Volume</th>
              <th>Average CSAT</th>
              <th>Target SLA</th>
              <th>SLA Recovery Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => {
              const deptFeedback = feedback.filter((f) => f.department === dept.name);
              const count = deptFeedback.length;
              const totalRating = deptFeedback.reduce((acc, cur) => acc + cur.rating, 0);
              const avg = count > 0 ? (totalRating / count).toFixed(2) : null;
              const complaints = deptFeedback.filter((f) => f.rating <= 2).length;
              const complianceRate = count > 0 ? Math.round(((count - complaints) / count) * 100) : null;

              const isExcellence = avg !== null && Number(avg) >= 4.5;
              const isWarning = avg !== null && Number(avg) < 3.5;

              return (
                <tr key={dept.name}>
                  <td>
                    <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{dept.name}</strong>
                  </td>
                  <td>
                    <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "12px" }}>
                      {count}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <strong style={{ fontSize: "13px", color: isExcellence ? "var(--sage-deep)" : "var(--ink)" }}>
                        {avg ?? "—"}
                      </strong>
                      <small style={{ color: "var(--muted)" }}>/ 5.0</small>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-dm-mono)" }}>
                      {dept.targetSla}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "80px", height: "5px", background: "var(--canvas-alt)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${complianceRate ?? 0}%`,
                            height: "100%",
                            background: complianceRate !== null && complianceRate >= 95 ? "var(--sage)" : "var(--amber)",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "11px", fontFamily: "var(--font-dm-mono)", fontWeight: 600 }}>
                        {complianceRate === null ? "—" : `${complianceRate}%`}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontFamily: "var(--font-dm-mono)",
                        textTransform: "uppercase",
                        background: avg === null ? "var(--canvas-alt)" : isExcellence ? "var(--sage-soft)" : isWarning ? "var(--red-soft)" : "var(--warm-soft)",
                        color: avg === null ? "var(--muted)" : isExcellence ? "var(--sage-deep)" : isWarning ? "var(--red)" : "var(--warm-deep)",
                      }}
                    >
                      {avg === null ? "Awaiting data" : isExcellence ? "Optimal" : isWarning ? "Attention" : "Standard"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 4. SLA RECOVERY EXECUTIVE BANNER
export function SlaRecoveryBanner({ openComplaintsCount }: { openComplaintsCount: number }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "22px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "5px",
            display: "grid",
            placeItems: "center",
            background: "var(--canvas-alt)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            flexShrink: 0,
          }}
        >
          {openComplaintsCount > 0 ? <AlertTriangle size={16} strokeWidth={1.75} /> : <CheckCircle2 size={16} strokeWidth={1.75} />}
        </div>
        <div>
          <strong style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>
            {openComplaintsCount > 0
              ? `${openComplaintsCount} Service Recovery Cases Requiring Attention`
              : "Complaints & SLA: All Guest Recovery Targets Within Standard"}
          </strong>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            {openComplaintsCount > 0
              ? "Prioritize the open queue and record each recovery outcome."
              : "There are no open recovery cases in the current view."}
          </span>
        </div>
      </div>

      <Link
        href="/dashboard/complaints"
        className="button button-outline"
        style={{
          background: "var(--panel)",
          borderColor: openComplaintsCount > 0 ? "var(--red)" : "var(--line)",
          color: openComplaintsCount > 0 ? "var(--red)" : "var(--ink)",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          fontSize: "11px",
        }}
      >
        <span>Open Complaints &amp; SLA Management</span>
        <ExternalLink size={12} />
      </Link>
    </div>
  );
}
