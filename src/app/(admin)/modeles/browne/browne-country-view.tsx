"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { computeKpis } from "@/lib/coredata/compute";
import { REBALANCE_LABELS, type BrowneResult } from "@/lib/coredata/browne";
import type { CountryBrowneConfig, BrowneDataQuality } from "@/lib/coredata/browne-service";
import { ExplorationChart, type ChartLine } from "../../exploration/exploration-chart";
import { deflate, mergeChart, fmtPct, fmtRatio, type BrowneDisplayMode } from "./helpers";
import {
  DrawdownCard,
  CompositionCard,
  ContributionCard,
  DataQualityCard,
} from "./browne-detail-cards";

const COLOR = {
  browne: "#E8833A",
  equity: "#5B9BF5",
  bond: "#57C198",
  cash: "#8794A6",
  gold: "#E9AF4B",
  inflation: "#E87386",
} as const;

const DISPLAY_LABEL: Record<BrowneDisplayMode, string> = {
  nominal: "Nominal",
  real: "Réel",
  nominal_vs_inflation: "Nominal vs Inflation",
};

function qualityIsNeutral(q: BrowneDataQuality): boolean {
  return q === "Complet" || q === "Complet avec proxy structurel";
}

function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(iso));
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function QualityBadge({ quality }: { quality: BrowneDataQuality }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        !qualityIsNeutral(quality) &&
          "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {quality}
    </Badge>
  );
}

// ─── Carte KPI ───────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  tooltip,
  delta,
}: {
  title: string;
  value: string;
  tooltip: string;
  delta?: string;
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground/60 hover:text-foreground">
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
      {delta && <div className="mt-0.5 text-xs text-muted-foreground">{delta}</div>}
    </Card>
  );
}

// ─── Graphique de performance ────────────────────────────────────────────────

const NOMINAL_CURVES = [
  { key: "browne", label: "Browne", color: COLOR.browne },
  { key: "equity", label: "Actions", color: COLOR.equity },
  { key: "bond", label: "Obligations", color: COLOR.bond },
  { key: "cash", label: "Cash", color: COLOR.cash },
  { key: "gold", label: "Or", color: COLOR.gold },
] as const;

function PerformanceChart({
  result,
  displayMode,
}: {
  result: Extract<BrowneResult, { status: "OK" }>;
  displayMode: BrowneDisplayMode;
}) {
  const [shown, setShown] = useState<Record<string, boolean>>({
    browne: true,
    equity: true,
    bond: false,
    cash: false,
    gold: false,
  });

  const chart = useMemo(() => {
    const { series } = result;
    if (displayMode === "real") {
      const eqReal = deflate(series.equityBenchmark, series.inflationIndex);
      if (!series.real || eqReal.length < 2) return null;
      return {
        data: mergeChart([
          { key: "browne", data: series.real },
          { key: "equity", data: eqReal },
        ]),
        lines: [
          { key: "browne", label: "Browne réel", color: COLOR.browne },
          { key: "equity", label: "Actions réelles", color: COLOR.equity },
        ] as ChartLine[],
      };
    }
    if (displayMode === "nominal_vs_inflation") {
      if (!series.inflationIndex) return null;
      return {
        data: mergeChart([
          { key: "browne", data: series.nominal },
          { key: "inflation", data: series.inflationIndex },
        ]),
        lines: [
          { key: "browne", label: "Browne nominal", color: COLOR.browne },
          { key: "inflation", label: "Inflation cumulée", color: COLOR.inflation, dashed: true },
        ] as ChartLine[],
      };
    }
    const byKey: Record<string, typeof series.nominal> = {
      browne: series.nominal,
      equity: series.equityBenchmark,
      bond: series.sleeves.bond,
      cash: series.sleeves.cash,
      gold: series.sleeves.gold,
    };
    const active = NOMINAL_CURVES.filter((c) => shown[c.key]);
    return {
      data: mergeChart(active.map((c) => ({ key: c.key, data: byKey[c.key] }))),
      lines: active.map((c) => ({ key: c.key, label: c.label, color: c.color })) as ChartLine[],
    };
  }, [result, displayMode, shown]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Performance (base 100)</h3>
        {displayMode === "nominal" && (
          <div className="flex flex-wrap gap-1.5">
            {NOMINAL_CURVES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setShown((s) => ({ ...s, [c.key]: !s[c.key] }))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors",
                  shown[c.key]
                    ? "border-foreground/20 text-foreground"
                    : "border-transparent text-muted-foreground/60 hover:text-foreground",
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {chart && chart.lines.length ? (
        <ExplorationChart data={chart.data} lines={chart.lines} height={360} />
      ) : (
        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
          Donnée d’inflation indisponible pour ce mode.
        </div>
      )}
    </Card>
  );
}

// ─── Vue pays ────────────────────────────────────────────────────────────────

export function BrowneCountryView({
  config,
  dataQuality,
  result,
  displayMode,
}: {
  config: CountryBrowneConfig;
  dataQuality: BrowneDataQuality;
  result: BrowneResult;
  displayMode: BrowneDisplayMode;
}) {
  if (result.status !== "OK") {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Historique insuffisant pour construire le portefeuille de ce pays ({result.status}).
      </Card>
    );
  }

  const { metrics } = result;
  const inflAnnualized = computeKpis(result.series.inflationIndex ?? []).annualized;
  const delta = (a: number | null, b: number | null, unit = "pts") =>
    a === null || b === null ? undefined : `vs actions ${a - b > 0 ? "+" : ""}${(a - b).toFixed(1)} ${unit}`;

  const kpis = [
    {
      title: "Perf. nominale",
      value: fmtPct(metrics.nominal.annualized),
      tooltip:
        "Performance annualisée brute, dans la devise du pays, sans correction de l’inflation.",
      delta: delta(metrics.nominal.annualized, metrics.equity.annualized),
    },
    {
      title: "Inflation",
      value: fmtPct(inflAnnualized),
      tooltip: "Inflation locale annualisée sur la période (indice des prix à la consommation).",
    },
    {
      title: "Perf. réelle",
      value: fmtPct(metrics.real?.annualized ?? null),
      tooltip:
        "Performance corrigée de l’inflation. Elle mesure le gain de pouvoir d’achat.",
    },
    {
      title: "Volatilité",
      value: fmtPct(metrics.nominal.volatility),
      tooltip: "Volatilité annualisée : ampleur des variations mensuelles.",
      delta: delta(metrics.nominal.volatility, metrics.equity.volatility),
    },
    {
      title: "Max drawdown",
      value: fmtPct(metrics.nominal.maxDrawdown),
      tooltip: "Perte maximale observée entre un sommet et un point bas.",
      delta: delta(metrics.nominal.maxDrawdown, metrics.equity.maxDrawdown),
    },
    {
      title: "Max DD réel",
      value: fmtPct(metrics.real?.maxDrawdown ?? null),
      tooltip: "Perte maximale en pouvoir d’achat (drawdown de la courbe réelle).",
    },
    {
      title: "Sharpe",
      value: fmtRatio(metrics.nominal.sharpe),
      tooltip: "Rendement annualisé rapporté à la volatilité (taux sans risque = 0).",
      delta: delta(metrics.nominal.sharpe, metrics.equity.sharpe, ""),
    },
    {
      title: "Sortino",
      value: fmtRatio(metrics.nominal.sortino),
      tooltip: "Comme le Sharpe, mais ne pénalise que la volatilité baissière.",
    },
    {
      title: "Calmar",
      value: fmtRatio(metrics.nominal.calmar),
      tooltip: "Performance annualisée divisée par le drawdown maximal.",
    },
    {
      title: "Pire année",
      value: fmtPct(metrics.nominal.worstYear),
      tooltip: "Pire performance sur une année civile.",
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Résumé */}
        <Card className="gap-0 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Portefeuille Browne — {config.countryFr ?? config.countryCode}
              </h2>
              <p className="text-sm text-muted-foreground">
                Portefeuille permanent local en {config.currency}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">Mensuel</Badge>
              <Badge variant="secondary">Devise locale</Badge>
              <Badge variant="secondary">Rééquilibrage {REBALANCE_LABELS[result.rebalance]}</Badge>
              <QualityBadge quality={dataQuality} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Info2 label="Devise" value={config.currency} />
            <Info2 label="Fréquence" value="Mensuelle" />
            <Info2 label="Affichage" value={DISPLAY_LABEL[displayMode]} />
            <Info2 label="Période" value={`${formatMonth(result.start)} → ${formatMonth(result.end)}`} />
          </div>
        </Card>

        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <KpiCard key={k.title} {...k} />
          ))}
        </div>

        {/* Performance */}
        <PerformanceChart result={result} displayMode={displayMode} />

        {/* Drawdown */}
        <DrawdownCard result={result} />

        {/* Composition */}
        <CompositionCard config={config} />

        {/* Sources de performance + Qualité des données */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ContributionCard result={result} />
          <DataQualityCard config={config} />
        </div>
      </div>
    </TooltipProvider>
  );
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-2">
      <span className="text-right text-muted-foreground">{label} :</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
