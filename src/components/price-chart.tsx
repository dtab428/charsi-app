"use client";

import { useId, useState } from "react";

export type ChartPoint = { label: string; value: number };

function fmt(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: value >= 200 ? 0 : 2 }).format(value);
  } catch {
    return String(value);
  }
}

export function PriceChart({ title, note, points, currency, empty }: { title: string; note?: string; points: ChartPoint[]; currency: string; empty: string }) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const height = 190;
  const pad = { left: 8, right: 8, top: 16, bottom: 22 };

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || Math.max(high * 0.1, 1);
  const min = low - span * 0.15;
  const max = high + span * 0.15;
  const x = (index: number) => (points.length === 1 ? width / 2 : pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right));
  const y = (value: number) => pad.top + (1 - (value - min) / (max - min)) * (height - pad.top - pad.bottom);
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = points.length > 1 ? `${line} L${x(points.length - 1).toFixed(1)},${height - pad.bottom} L${x(0).toFixed(1)},${height - pad.bottom} Z` : "";
  const active = hover == null ? points[points.length - 1] : points[hover];

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1c1814]/80 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[10px] font-medium tracking-[0.16em] text-[#d4a574] uppercase">{title}</h3>
        {active ? (
          <p className="text-right">
            <span className="font-serif text-2xl text-[#f3ecdf]">{fmt(active.value, currency)}</span>
            <span className="ml-2 text-xs text-[#b3a694]">{active.label}</span>
          </p>
        ) : null}
      </div>
      {points.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-white/15 px-3 py-6 text-center text-sm text-[#b3a694]">{empty}</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-3 h-auto w-full touch-none"
          role="img"
          aria-label={`${title}: ${points.length} data point${points.length === 1 ? "" : "s"}, from ${fmt(low, currency)} to ${fmt(high, currency)}`}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - box.left) / box.width;
            const index = Math.round(ratio * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, index)));
          }}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#d4a574" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d4a574" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line key={fraction} x1={pad.left} x2={width - pad.right} y1={pad.top + fraction * (height - pad.top - pad.bottom)} y2={pad.top + fraction * (height - pad.top - pad.bottom)} stroke="white" strokeOpacity="0.06" />
          ))}
          {area ? <path d={area} fill={`url(#${gradient})`} /> : null}
          {points.length > 1 ? <path d={line} fill="none" stroke="#d4a574" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {points.map((point, index) => (
            <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r={hover === index || points.length <= 4 ? 4.5 : 0} fill="#14110e" stroke="#d4a574" strokeWidth="2" />
          ))}
          {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={height - pad.bottom} stroke="#d4a574" strokeOpacity="0.4" /> : null}
          <text x={pad.left} y={height - 5} fontSize="11" fill="#b3a694">
            {points[0].label}
          </text>
          {points.length > 1 ? (
            <text x={width - pad.right} y={height - 5} fontSize="11" fill="#b3a694" textAnchor="end">
              {points[points.length - 1].label}
            </text>
          ) : null}
        </svg>
      )}
      {note ? <p className="mt-2 text-xs leading-relaxed text-[#b3a694]">{note}</p> : null}
    </section>
  );
}
