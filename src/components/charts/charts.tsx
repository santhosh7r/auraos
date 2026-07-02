"use client";

import * as React from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;
const GRID = "hsl(var(--border))";

export const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))",
];

function ChartTooltip({
  active, payload, label, formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/70 glass-strong px-3 py-2 text-xs shadow-premium">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums">
            {formatter ? formatter(p.value) : formatNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Revenue / area trend ---------- */
export function AreaTrend({
  data, keys, currency = true, height = 280,
}: {
  data: SeriesPoint[];
  keys: { key: string; color?: string; label?: string }[];
  currency?: boolean;
  height?: number;
}) {
  const fmt = currency ? (v: number) => formatCurrency(v, { compact: true }) : (v: number) => formatNumber(v, true);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={k.key} id={`grad-${k.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={k.color ?? CHART_COLORS[i]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={k.color ?? CHART_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={8} />
        <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={fmt} width={48} />
        <Tooltip content={<ChartTooltip formatter={fmt} />} />
        {keys.map((k, i) => (
          <Area
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.label ?? k.key}
            stroke={k.color ?? CHART_COLORS[i]}
            strokeWidth={2.5}
            fill={`url(#grad-${k.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------- Spotlight area (Apple Stocks style — no axes, no grid) ---------- */
export function SpotlightArea({
  data, color = "hsl(var(--brand))", height = 260, currency = true,
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  currency?: boolean;
}) {
  const fmt = currency
    ? (v: number) => formatCurrency(v, { compact: true })
    : (v: number) => formatNumber(v, true);
  const id = React.useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id={`spot-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Tooltip
          content={<ChartTooltip formatter={fmt} />}
          cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name="Revenue"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#spot-${id})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------- Bar series ---------- */
export function BarSeries({
  data, keys, currency = false, height = 280, stacked = false,
}: {
  data: SeriesPoint[];
  keys: { key: string; color?: string; label?: string }[];
  currency?: boolean;
  height?: number;
  stacked?: boolean;
}) {
  const fmt = currency ? (v: number) => formatCurrency(v, { compact: true }) : (v: number) => formatNumber(v, true);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={8} />
        <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={fmt} width={48} />
        <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} content={<ChartTooltip formatter={fmt} />} />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.label ?? k.key}
            stackId={stacked ? "a" : undefined}
            fill={k.color ?? CHART_COLORS[i]}
            radius={stacked ? 0 : [6, 6, 0, 0]}
            maxBarSize={44}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- Donut ---------- */
export function DonutChart({
  data, currency = false, height = 240, colors = CHART_COLORS,
}: {
  data: SeriesPoint[];
  currency?: boolean;
  height?: number;
  colors?: string[];
}) {
  const fmt = currency ? (v: number) => formatCurrency(v, { compact: true }) : (v: number) => formatNumber(v, true);
  const total = data.reduce((s, d) => s + (d.value as number), 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatter={fmt} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{fmt(total)}</span>
        <span className="text-[11px] text-muted-foreground">Total</span>
      </div>
    </div>
  );
}

/* ---------- Funnel (horizontal bars) ---------- */
export function FunnelChart({ data }: { data: SeriesPoint[] }) {
  const max = Math.max(...data.map((d) => d.value as number));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = ((d.value as number) / max) * 100;
        const conv = i > 0 ? ((d.value as number) / (data[i - 1].value as number)) * 100 : 100;
        return (
          <div key={d.label} className="group">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{d.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(d.value as number)}
                {i > 0 && <span className="ml-1.5 text-[10px]">({conv.toFixed(0)}%)</span>}
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-lg bg-muted/50">
              <div
                className="flex h-full items-center rounded-lg bg-brand transition-all duration-700"
                style={{ width: `${pct}%`, opacity: 1 - i * 0.12 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Radial progress (single value) ---------- */
export function RadialProgress({
  value, label, size = 160, color = "hsl(var(--primary))",
}: {
  value: number;
  label?: string;
  size?: number;
  color?: string;
}) {
  const data = [{ name: "v", value, fill: color }];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "hsl(var(--muted))" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{value}%</span>
        {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

/* ---------- Growth bars (positive/negative) ---------- */
export function GrowthBars({ data, height = 200 }: { data: SeriesPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={8} />
        <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(v) => `${v}%`} width={40} />
        <ReferenceLine y={0} stroke={GRID} />
        <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
        <Bar dataKey="growth" radius={[6, 6, 6, 6]} maxBarSize={36}>
          {data.map((d, i) => (
            <Cell key={i} fill={(d.growth as number) >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- Mini sparkline for KPI cards ---------- */
export function Sparkline({
  data, color = "hsl(var(--primary))", height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
