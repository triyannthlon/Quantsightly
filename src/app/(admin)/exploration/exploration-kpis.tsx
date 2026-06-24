"use client";

import { cn } from "@/lib/utils";
import type { SeriesKpis } from "@/lib/coredata/compute";

export interface KpiColumn {
  title?: string;
  color?: string;
  kpis: SeriesKpis;
}

function formatPct(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function toneClass(v: number | null): string {
  if (v === null) return "text-muted-foreground";
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-rose-600 dark:text-rose-400";
  return "text-foreground";
}

interface RowProps {
  label: string;
  values: (number | null)[];
  signed?: boolean;
  gridStyle: React.CSSProperties;
}

function MetricRow({ label, values, signed = true, gridStyle }: RowProps) {
  return (
    <div className="grid items-baseline gap-x-3" style={gridStyle}>
      <span className="text-sm text-muted-foreground">{label}</span>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "text-right font-mono text-sm tabular-nums",
            signed ? toneClass(v) : "text-foreground",
          )}
        >
          {formatPct(v)}
        </span>
      ))}
    </div>
  );
}

export function ExplorationKpis({
  columns,
  title,
  secondTitle = "Annualisé sur la période",
}: {
  columns: KpiColumn[];
  title?: string;
  secondTitle?: string;
}) {
  if (columns.length === 0) return null;

  const hasTitles = columns.some((c) => c.title);
  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `1fr ${columns.map(() => "minmax(0,5.5rem)").join(" ")}`,
  };
  const pick = (sel: (k: SeriesKpis) => number | null) => columns.map((c) => sel(c.kpis));

  const sectionLabel = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-4 rounded-lg border bg-muted/50 p-5">
      {title && <h3 className="text-base font-semibold">{title}</h3>}

      {hasTitles && (
        <div className="grid items-center gap-x-3 border-b pb-3" style={gridStyle}>
          <span />
          {columns.map((c, i) => (
            <span
              key={i}
              className="flex items-center justify-end gap-1.5 text-xs font-medium"
              title={c.title}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span>Série {String.fromCharCode(65 + i)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        <p className={sectionLabel}>Variation</p>
        <MetricRow label="Dernier mois" values={pick((k) => k.lastMonth)} gridStyle={gridStyle} />
        <MetricRow label="1 an" values={pick((k) => k.oneYear)} gridStyle={gridStyle} />
        <MetricRow label="3 ans" values={pick((k) => k.threeYear)} gridStyle={gridStyle} />
        <MetricRow label="5 ans" values={pick((k) => k.fiveYear)} gridStyle={gridStyle} />
      </div>

      <div className="space-y-2.5 border-t pt-4">
        <p className={sectionLabel}>{secondTitle}</p>
        <MetricRow label="Rendement" values={pick((k) => k.annualized)} gridStyle={gridStyle} />
        <MetricRow
          label="Volatilité"
          values={pick((k) => k.volatility)}
          signed={false}
          gridStyle={gridStyle}
        />
      </div>
    </div>
  );
}
