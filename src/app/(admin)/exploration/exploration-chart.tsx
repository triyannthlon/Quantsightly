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
  /** Épaisseur de trait (px) — défaut selon `compact`. Sert à emphaser une courbe. */
  width?: number;
}

export type ChartPoint = { date: string; [key: string]: number | string | undefined };

interface Props {
  data: ChartPoint[];
  lines: ChartLine[];
  /** Nombre (px) ou chaîne CSS (ex. "70vh" pour la fenêtre agrandie). */
  height?: number | string;
  /** Mode carte : sans légende, axes allégés, lignes plus fines. */
  compact?: boolean;
  /** Axe Y en échelle logarithmique (valeurs strictement positives requises). */
  logScale?: boolean;
  /** Afficher la légende du bas (défaut : true, hors mode compact). */
  showLegend?: boolean;
  /** Domaine Y explicite (ex. `[-60, 0]` pour un drawdown). */
  yDomain?: [number, number];
  /** Marquer d'un point la dernière valeur de chaque courbe. */
  markLast?: boolean;
  /** Opacité de la grille (défaut 0.4 ; plus bas = plus discret). */
  gridOpacity?: number;
}

function formatAxisDate(iso: string): string {
  // `YYYY-MM-DD` → `MM/YYYY`
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
  return v.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Sous-ensemble d'abscisses réparties uniformément (évite la surcharge de l'axe X). */
function pickTicks(data: ChartPoint[], count: number): string[] {
  if (data.length <= count) return data.map((d) => d.date);
  const step = (data.length - 1) / (count - 1);
  const ticks: string[] = [];
  for (let i = 0; i < count; i++) ticks.push(data[Math.round(i * step)].date);
  return ticks;
}

export function ExplorationChart({
  data,
  lines,
  height = 380,
  compact = false,
  logScale = false,
  showLegend = true,
  yDomain,
  markLast = false,
  gridOpacity = 0.4,
}: Props) {
  const ticks = useMemo(() => pickTicks(data, compact ? 4 : 10), [data, compact]);

  // Hauteur CSS (ex. "78vh") → wrapper à hauteur définie + container en 100 %.
  // Hauteur numérique (px) → passée directement au ResponsiveContainer.
  const isCssHeight = typeof height === "string";

  return (
    <div style={isCssHeight ? { height } : undefined}>
      <ResponsiveContainer width="100%" height={isCssHeight ? "100%" : height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={gridOpacity}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={formatAxisDate}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: compact ? 10 : 11, fill: "var(--muted-foreground)" }}
            dy={4}
          />
          <YAxis
            tickFormatter={formatValue}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: compact ? 10 : 11, fill: "var(--muted-foreground)" }}
            width={compact ? 40 : 64}
            tickCount={compact ? 4 : 6}
            scale={logScale ? "log" : "linear"}
            domain={yDomain ?? ["auto", "auto"]}
            allowDataOverflow={yDomain !== undefined}
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
          {!compact && showLegend && (
            <Legend
              verticalAlign="bottom"
              height={32}
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
            />
          )}
          {lines.map((ln) => (
            <Line
              key={ln.key}
              type="monotone"
              dataKey={ln.key}
              name={ln.label}
              stroke={ln.color}
              strokeWidth={ln.width ?? (compact ? 1.5 : 2)}
              strokeDasharray={ln.dashed ? "5 4" : undefined}
              dot={
                markLast
                  ? (props: { cx?: number; cy?: number; index?: number }) => {
                      const isLast = props.index === data.length - 1;
                      if (!isLast || props.cx == null || props.cy == null) {
                        return <g key={`dot-${ln.key}-${props.index}`} />;
                      }
                      return (
                        <circle
                          key={`dot-${ln.key}-${props.index}`}
                          cx={props.cx}
                          cy={props.cy}
                          r={3}
                          fill={ln.color}
                          stroke="var(--background)"
                          strokeWidth={1.5}
                        />
                      );
                    }
                  : false
              }
              activeDot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
