"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  SLEEVE_KEYS,
  type BrowneResult,
  type BrowneTurnover,
  type SleeveKey,
} from "@/lib/coredata/browne";
import type {
  CountryBrowneConfig,
  SleeveConfig,
  SleeveQuality,
} from "@/lib/coredata/browne-service";
import { SeriesChartCard, DrawdownKpiRow, type ChartSeries } from "../series-chart-card";
import { drawdownSeries, fmtPct, SLEEVE_PALETTE, type BrowneDisplayMode } from "./helpers";

type OkResult = Extract<BrowneResult, { status: "OK" }>;

const SLEEVE_COLOR: Record<SleeveKey, string> = SLEEVE_PALETTE;
const SLEEVE_LABEL: Record<SleeveKey, string> = {
  equity: "Actions",
  bond: "Obligations",
  cash: "Cash",
  gold: "Or",
};

// ─── Graphique de drawdown ───────────────────────────────────────────────────

const DD_COLOR = { browne: "#E8833A", equity: SLEEVE_PALETTE.equity };

export function DrawdownCard({
  result,
  displayMode,
}: {
  result: OkResult;
  displayMode: BrowneDisplayMode;
}) {
  // Drawdown réel en mode Réel (si dispo) ; nominal sinon (y compris « Nominal vs
  // Inflation », l'inflation n'ayant pas de drawdown comparable).
  const useReal = displayMode === "real" && !!result.series.real && !!result.series.equityReal;
  const bSeries = useReal ? result.series.real! : result.series.nominal;
  const aSeries = useReal ? result.series.equityReal! : result.series.equityBenchmark;
  const bMetrics = useReal ? result.metrics.real! : result.metrics.nominal;
  const aMetrics = useReal ? result.metrics.equityReal! : result.metrics.equity;

  const { series, floor } = useMemo(() => {
    const bDD = drawdownSeries(bSeries);
    const aDD = drawdownSeries(aSeries);
    let worst = 0;
    for (const p of [...bDD, ...aDD]) if (p.value < worst) worst = p.value;
    // Ordre de légende : Browne d'abord (la carte trace la courbe épaisse au-dessus).
    const s: ChartSeries[] = [
      {
        id: "browne",
        label: "Browne",
        color: DD_COLOR.browne,
        data: bDD,
        width: 2.6,
        fillOpacity: 0.22,
      },
      {
        id: "equity",
        label: "Actions",
        color: DD_COLOR.equity,
        data: aDD,
        width: 1.4,
        fillOpacity: 0.16,
      },
    ];
    return { series: s, floor: Math.min(-5, Math.floor(worst / 10) * 10) };
  }, [bSeries, aSeries]);

  const kpis = (
    <DrawdownKpiRow
      blocks={[
        {
          label: "Browne",
          color: DD_COLOR.browne,
          maxDrawdown: bMetrics.maxDrawdown,
          underwaterMonths: bMetrics.maxUnderwaterMonths,
        },
        {
          label: "Actions",
          color: DD_COLOR.equity,
          maxDrawdown: aMetrics.maxDrawdown,
          underwaterMonths: aMetrics.maxUnderwaterMonths,
        },
      ]}
      delta={{
        refLabel: "Actions",
        maxDrawdown:
          bMetrics.maxDrawdown !== null && aMetrics.maxDrawdown !== null
            ? bMetrics.maxDrawdown - aMetrics.maxDrawdown
            : null,
        underwaterMonths:
          bMetrics.maxUnderwaterMonths !== null && aMetrics.maxUnderwaterMonths !== null
            ? bMetrics.maxUnderwaterMonths - aMetrics.maxUnderwaterMonths
            : null,
      }}
    />
  );

  return (
    <SeriesChartCard
      title="Drawdowns successifs"
      subtitle="Pertes depuis le dernier sommet, sur la même chronologie."
      series={series}
      kpis={kpis}
      areaFill
      percentTooltip
      yDomain={[floor, 0]}
      height={280}
    />
  );
}

// ─── Composition ─────────────────────────────────────────────────────────────

export function CompositionCard({
  config,
  turnover,
}: {
  config: CountryBrowneConfig;
  turnover: BrowneTurnover;
}) {
  const sleeves: SleeveConfig[] = [config.equity, config.bond, config.cash, config.gold];
  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold">Composition</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Quatre poches équipondérées, rééquilibrées à 25 %.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Poche</TableHead>
              <TableHead className="text-right">Poids</TableHead>
              <TableHead>Série</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Devise</TableHead>
              <TableHead>Méthode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sleeves.map((s) => (
              <TableRow key={s.label}>
                <TableCell className="font-medium">{s.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {Math.round(s.weight * 100)} %
                </TableCell>
                <TableCell>{s.tickerName}</TableCell>
                <TableCell className="text-muted-foreground">{s.typeFr ?? "—"}</TableCell>
                <TableCell>{s.currency}</TableCell>
                <TableCell className="text-muted-foreground">{s.method}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Gestion de l'allocation — rotation annualisée (même définition que 4 Quadrants :
          turnover unidirectionnel ½·Σ|cible − détenu|, cumulé sur les rééquilibrages,
          divisé par la durée exacte). Suit la fréquence de rééquilibrage sélectionnée. */}
      <div className="mt-4 border-t border-border/50 pt-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Gestion de l’allocation
        </p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm font-medium">Rotation annualisée</span>
          <span className="text-sm font-semibold tabular-nums">
            {Math.round(turnover.annualized * 100)} % / an
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Part moyenne du portefeuille réallouée chaque année.
        </p>
      </div>
    </Card>
  );
}

// ─── Sources de performance (contributions) ──────────────────────────────────

const CONTRIB_TOOLTIP =
  "Les contributions brutes additionnent les effets mensuels poids × rendement. " +
  "Lorsqu’elles sont toutes positives, elles sont normalisées à 100 % pour faciliter " +
  "la lecture. Cette mesure indique quelles poches ont le plus porté la performance, " +
  "sans représenter directement la part du gain final capitalisé.";

export function ContributionCard({ result }: { result: OkResult }) {
  const rows = SLEEVE_KEYS.map((k) => ({
    key: k,
    label: SLEEVE_LABEL[k],
    color: SLEEVE_COLOR[k],
    raw: result.metrics.sleeves[k].contribution,
  }));

  const values = rows.map((r) => r.raw);
  const allPositive = values.every((v) => v !== null && v > 0);
  const total = allPositive ? values.reduce<number>((s, v) => s + (v ?? 0), 0) : 0;
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v ?? 0)));

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">Sources de performance</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-help text-muted-foreground/60 hover:text-foreground"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-80">
            {CONTRIB_TOOLTIP}
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Répartition relative des contributions cumulées des quatre poches.
      </p>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const share = allPositive && r.raw !== null && total > 0 ? (r.raw / total) * 100 : null;
          const width = allPositive ? (share ?? 0) : (Math.abs(r.raw ?? 0) / maxAbs) * 100;
          return (
            <div
              key={r.key}
              className="grid grid-cols-[6rem_1fr_5rem] items-center gap-2.5 text-sm"
            >
              <span className="text-muted-foreground">{r.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, width))}%`,
                    backgroundColor: r.color,
                  }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">
                {share !== null ? `${share.toFixed(0)} %` : fmtPct(r.raw, true)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Qualité des données ─────────────────────────────────────────────────────

const SLEEVE_QUALITY_TOOLTIP =
  "Série reconstruite par méthode standard lorsque l’indice directement investissable " +
  "n’est pas disponible. Ce proxy fait partie de la méthodologie normale du modèle.";

function SleeveQualityBadge({ quality }: { quality: SleeveQuality }) {
  const attention = quality === "Repli";
  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        attention && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {quality}
    </Badge>
  );
  if (quality !== "Proxy structurel") return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        {SLEEVE_QUALITY_TOOLTIP}
      </TooltipContent>
    </Tooltip>
  );
}

export function DataQualityCard({ config }: { config: CountryBrowneConfig }) {
  const rows: { label: string; method: string; quality: SleeveQuality }[] = [
    { label: "Actions", method: config.equity.method, quality: config.equity.quality },
    { label: "Obligations 10 ans", method: config.bond.method, quality: config.bond.quality },
    { label: "Cash", method: config.cash.method, quality: config.cash.quality },
    { label: "Or", method: config.gold.method, quality: config.gold.quality },
  ];
  if (config.inflation) {
    rows.push({
      label: "Inflation",
      method: config.inflation.method,
      quality: config.inflation.quality,
    });
  }

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Qualité des données</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <div className="font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.method}</div>
            </div>
            <SleeveQualityBadge quality={r.quality} />
          </div>
        ))}
      </div>
    </Card>
  );
}
