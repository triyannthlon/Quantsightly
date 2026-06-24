"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  Legend,
  Line,
} from "recharts";

export interface ChartLine {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

export type ChartPoint = { date: string; [key: string]: number | string | undefined };

interface Props {
  data: ChartPoint[];
  lines: ChartLine[];
  height?: number;
}

function formatAxisDate(iso: string): string {
  // `YYYY-MM-DD` → `MM/YYYY`
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
  return v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Sous-ensemble d'abscisses réparties uniformément (évite la surcharge de l'axe X). */
function pickTicks(data: ChartPoint[], count: number): string[] {
  if (data.length <= count) return data.map((d) => d.date);
  const step = (data.length - 1) / (count - 1);
  const ticks: string[] = [];
  for (let i = 0; i < count; i++) ticks.push(data[Math.round(i * step)].date);
  return ticks;
}

export function ExplorationChart({ data, lines, height = 380 }: Props) {
  const ticks = useMemo(() => pickTicks(data, 10), [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={formatAxisDate}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          dy={4}
        />
        <YAxis
          tickFormatter={formatValue}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={64}
          tickCount={6}
          domain={["auto", "auto"]}
        />
        <ReTooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(l) => formatAxisDate(String(l))}
          formatter={(value, name, item) => {
            // En base 100, afficher le vrai prix ({dataKey}Raw) plutôt que la
            // valeur rebasée tracée.
            const dataKey = item?.dataKey as string | undefined;
            const payload = item?.payload as Record<string, unknown> | undefined;
            const raw = dataKey && payload ? payload[`${dataKey}Raw`] : undefined;
            const shown = typeof raw === "number" ? raw : Number(value);
            return [formatValue(shown), name];
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={32}
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
        />
        {lines.map((ln) => (
          <Line
            key={ln.key}
            type="monotone"
            dataKey={ln.key}
            name={ln.label}
            stroke={ln.color}
            strokeWidth={2}
            strokeDasharray={ln.dashed ? "5 4" : undefined}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
