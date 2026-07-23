"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { computeKpis } from "@/lib/coredata/compute";
import type { EconomicDataPoint } from "@/lib/coredata/types";
import type {
  QuadrantModel,
  Strategy,
  BacktestResult,
  BacktestMetrics,
  TurnoverResult,
} from "@/lib/coredata/four-quadrants";
import type {
  QuadrantModelConfig,
  QuadrantDataQuality,
} from "@/lib/coredata/four-quadrants-service";
import {
  displayRegime,
  STRATEGY_LABELS,
  SLEEVE_META,
  CORE_SLEEVES,
  compositionDiverges,
  drawdownSeries,
  fmtPct0,
  fmtPctN,
  fmtRatio,
  fmtMonths,
  fmtMultiple,
  type PerfMode,
} from "./helpers";
import { SeriesChartCard, DrawdownKpiRow, type ChartSeries } from "../series-chart-card";
import { ExtremeMonthsCard } from "../extreme-months-card";
import { buildEquityModelSeries } from "../extreme-months";
import { availabilityMessage } from "./availability-message";
import { IS_MODEL_V2 } from "./model-version-active";

type OkModel = Extract<QuadrantModel, { status: "OK" }>;
type OkBacktest = Extract<BacktestResult, { status: "OK" }>;

const COLOR = {
  portfolio: "#E8833A",
  actions: SLEEVE_META.equities.hex,
  inflation: "#E87386",
  bonds: SLEEVE_META.bonds.hex,
  cash: SLEEVE_META.cash.hex,
  gold: SLEEVE_META.gold.hex,
};

function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

// ─── KPI ─────────────────────────────────────────────────────────────────────

type KpiFamily =
  | "performance"
  | "risque"
  | "rendement-risque"
  | "resilience"
  | "pouvoir-achat"
  | "inflation";
const FAMILY_CARD: Record<KpiFamily, string> = {
  performance: "border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-transparent",
  risque: "border-orange-500/25 bg-gradient-to-b from-orange-500/[0.06] to-transparent",
  "rendement-risque": "border-violet-500/25 bg-gradient-to-b from-violet-500/[0.06] to-transparent",
  resilience: "border-cyan-500/25 bg-gradient-to-b from-cyan-500/[0.06] to-transparent",
  "pouvoir-achat": "border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-transparent",
  inflation: "border-foreground/15 bg-gradient-to-b from-foreground/[0.035] to-transparent",
};
type BadgeTone = "positive" | "info" | "negative";
const BADGE_TONE: Record<BadgeTone, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  info: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  negative: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function fmtEcart(diff: number, unit: "pts" | "ratio" | "mois"): string {
  if (unit === "ratio") return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
  if (unit === "mois") return `${diff > 0 ? "+" : ""}${Math.round(diff)} mois`;
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts`;
}

function CmpBar({
  label,
  width,
  value,
  strong,
}: {
  label: string;
  width: number;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-[4.6rem_1fr_3.4rem] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-slate-700/30">
        <span
          className={cn(
            "block h-full rounded-full",
            strong ? "bg-amber-400/70" : "bg-slate-400/55",
          )}
          style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
        />
      </span>
      <span className="text-right tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

interface KpiData {
  title: string;
  tooltip: string;
  value: string;
  actions?: string;
  ecart?: string;
  portfolioRaw?: number | null;
  actionsRaw?: number | null;
  family: KpiFamily;
  badge?: string;
  badgeTone?: BadgeTone;
}

function KpiCard({
  title,
  tooltip,
  value,
  actions,
  ecart,
  portfolioRaw,
  actionsRaw,
  family,
  badge,
  badgeTone = "positive",
  modelLabel,
}: KpiData & { modelLabel: string }) {
  const showBars = portfolioRaw != null && actionsRaw != null;
  const maxAbs = Math.max(Math.abs(portfolioRaw ?? 0), Math.abs(actionsRaw ?? 0)) || 1;
  return (
    <Card className={cn("gap-0 p-4", FAMILY_CARD[family])}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-help text-muted-foreground/60 hover:text-foreground"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
      {showBars && (
        <div className="mt-2.5 space-y-1.5">
          <CmpBar
            label={modelLabel}
            width={(Math.abs(portfolioRaw ?? 0) / maxAbs) * 100}
            value={value}
            strong
          />
          <CmpBar
            label="Actions"
            width={(Math.abs(actionsRaw ?? 0) / maxAbs) * 100}
            value={actions ?? "—"}
          />
          {ecart && (
            <div className="pt-0.5 text-xs">
              <span className="text-muted-foreground">Écart : </span>
              <span className="tabular-nums font-medium">{ecart}</span>
            </div>
          )}
        </div>
      )}
      {badge && (
        <div className="mt-2">
          <span
            className={cn(
              "inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              BADGE_TONE[badgeTone],
            )}
          >
            {badge}
          </span>
        </div>
      )}
    </Card>
  );
}

function buildKpis(pm: BacktestMetrics, am: BacktestMetrics, real: boolean): KpiData[] {
  const ctx = real ? " Calculé sur la série corrigée de l’inflation locale." : "";
  const row = (
    title: string,
    tip: string,
    bv: number | null,
    ev: number | null,
    fmt: (v: number | null) => string,
    unit: "pts" | "ratio" | "mois",
    family: KpiFamily,
    badge?: string,
    badgeTone?: BadgeTone,
  ): KpiData => ({
    title,
    tooltip: tip + ctx,
    value: fmt(bv),
    actions: ev !== null ? fmt(ev) : undefined,
    ecart: bv !== null && ev !== null ? fmtEcart(bv - ev, unit) : undefined,
    portfolioRaw: bv,
    actionsRaw: ev,
    family,
    badge,
    badgeTone,
  });

  const volRedux =
    pm.volatility !== null &&
    am.volatility !== null &&
    am.volatility > 0 &&
    pm.volatility <= 0.7 * am.volatility;
  const mddRedux =
    pm.maxDrawdown !== null && am.maxDrawdown !== null ? pm.maxDrawdown - am.maxDrawdown : null;
  const betterRR = pm.sharpe !== null && am.sharpe !== null && pm.sharpe > am.sharpe;
  const underwater = pm.currentDrawdown !== null && pm.currentDrawdown < -1;

  return [
    row(
      "Performance annualisée",
      "Rendement annualisé (CAGR).",
      pm.annualized,
      am.annualized,
      fmtPctN,
      "pts",
      "performance",
    ),
    row(
      "Volatilité annualisée",
      "Ampleur des variations mensuelles, annualisée.",
      pm.volatility,
      am.volatility,
      fmtPctN,
      "pts",
      "risque",
      volRedux ? "Risque réduit" : undefined,
    ),
    row(
      "Max drawdown",
      "Perte maximale entre un sommet et un point bas.",
      pm.maxDrawdown,
      am.maxDrawdown,
      fmtPctN,
      "pts",
      "risque",
      mddRedux !== null && mddRedux >= 20 ? "Protection élevée" : undefined,
    ),
    row(
      "Drawdown courant",
      "Recul actuel depuis le dernier sommet.",
      pm.currentDrawdown,
      am.currentDrawdown,
      fmtPctN,
      "pts",
      "risque",
      underwater ? "Sous le sommet" : undefined,
      "info",
    ),
    row(
      "Sharpe",
      "Excédent de rendement sur le cash, rapporté à la volatilité.",
      pm.sharpe,
      am.sharpe,
      fmtRatio,
      "ratio",
      "rendement-risque",
      betterRR ? "Meilleur rendement/risque" : undefined,
    ),
    row(
      "Meilleure année",
      "Meilleure performance sur une année civile.",
      pm.bestYear,
      am.bestYear,
      fmtPctN,
      "pts",
      "performance",
    ),
    row(
      "Pire année",
      "Pire performance sur une année civile.",
      pm.worstYear,
      am.worstYear,
      fmtPctN,
      "pts",
      "risque",
    ),
    row(
      "Durée max sous l’eau",
      "Plus longue durée passée sous le dernier sommet.",
      pm.maxUnderwaterMonths,
      am.maxUnderwaterMonths,
      fmtMonths,
      "mois",
      "resilience",
    ),
  ];
}

/** KPI du mode « Nominal vs Inflation » (cartes à valeur unique, sans comparaison). */
function buildInflationKpis(bt: OkBacktest): KpiData[] {
  const m = bt.metrics.nominal;
  const r = bt.metrics.real;
  const infl = bt.series.inflationIndex;
  const realS = bt.series.real;
  const inflAnnualized = infl && infl.length >= 2 ? computeKpis(infl).annualized : null;
  const surperf =
    m.annualized !== null && inflAnnualized !== null ? m.annualized - inflAnnualized : null;

  let mNom: number | null = null;
  let mInfl: number | null = null;
  let mReal: number | null = null;
  if (infl?.length && realS?.length) {
    const nomByDate = new Map(bt.series.nominal.map((p) => [p.date, p.value]));
    const n0 = nomByDate.get(infl[0].date);
    const n1 = nomByDate.get(infl[infl.length - 1].date);
    mNom = n0 && n1 && n0 > 0 ? n1 / n0 : null;
    mInfl = infl[infl.length - 1].value / infl[0].value;
    mReal = realS[realS.length - 1].value / realS[0].value;
  }

  const card = (
    title: string,
    tooltip: string,
    value: string,
    family: KpiFamily,
    badge?: string,
    badgeTone?: BadgeTone,
  ): KpiData => ({
    title,
    tooltip,
    value,
    family,
    badge,
    badgeTone,
  });

  return [
    card(
      "Perf. nominale annualisée",
      "Performance annualisée brute, sans correction de l’inflation.",
      fmtPctN(m.annualized),
      "performance",
    ),
    card(
      "Perf. réelle annualisée",
      "Performance corrigée de l’inflation : gain de pouvoir d’achat.",
      fmtPctN(r?.annualized ?? null),
      "pouvoir-achat",
    ),
    card(
      "Inflation annualisée",
      "Inflation locale annualisée sur la période (indice des prix).",
      fmtPctN(inflAnnualized),
      "inflation",
    ),
    card(
      "Écart annuel vs inflation",
      "Écart annualisé, en points, entre la performance nominale et l’inflation.",
      surperf === null ? "—" : `${surperf > 0 ? "+" : "−"}${Math.abs(surperf).toFixed(1)} pts`,
      "pouvoir-achat",
      surperf === null ? undefined : surperf > 0 ? "Bat l’inflation" : "Sous l’inflation",
      surperf !== null && surperf < 0 ? "negative" : "positive",
    ),
    card(
      "Multiple portefeuille",
      "Capital final rapporté au capital initial (nominal).",
      fmtMultiple(mNom),
      "performance",
    ),
    card(
      "Multiple inflation",
      "Hausse cumulée du coût de la vie sur la période.",
      fmtMultiple(mInfl),
      "inflation",
    ),
    card(
      "Multiple réel",
      "Gain de pouvoir d’achat cumulé (multiple réel).",
      fmtMultiple(mReal),
      "pouvoir-achat",
    ),
    card(
      "Max drawdown nominal",
      "Perte maximale nominale entre un sommet et un point bas.",
      fmtPctN(m.maxDrawdown),
      "risque",
    ),
  ];
}

// ─── Graphiques (performance + drawdown) ─────────────────────────────────────

type SeriesDef = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  defaultOn: boolean;
};

// Séries disponibles par mode + état par défaut (4Q + Actions actifs ; poches
// secondaires activables en nominal ; inflation en NvI). Clone de la Vue pays Browne.
const PERF_SERIES: Record<PerfMode, SeriesDef[]> = {
  nominal: [
    { key: "q4", label: "4 Quadrants", color: COLOR.portfolio, defaultOn: true },
    { key: "actions", label: "Actions", color: COLOR.actions, defaultOn: true },
    { key: "bonds", label: "Obligations", color: COLOR.bonds, defaultOn: false },
    { key: "cash", label: "Cash", color: COLOR.cash, defaultOn: false },
    { key: "gold", label: "Or", color: COLOR.gold, defaultOn: false },
  ],
  real: [
    { key: "q4", label: "4 Quadrants réel", color: COLOR.portfolio, defaultOn: true },
    { key: "actions", label: "Actions réelles", color: COLOR.actions, defaultOn: true },
  ],
  nominal_vs_inflation: [
    { key: "q4", label: "4 Quadrants nominal", color: COLOR.portfolio, defaultOn: true },
    {
      key: "inflation",
      label: "Inflation cumulée",
      color: COLOR.inflation,
      dashed: true,
      defaultOn: true,
    },
    { key: "actions", label: "Actions", color: COLOR.actions, defaultOn: false },
  ],
};

function perfSeriesData(
  mode: PerfMode,
  s: OkBacktest["series"],
  key: string,
): EconomicDataPoint[] | null {
  if (mode === "real") return key === "q4" ? s.real : key === "actions" ? s.equityReal : null;
  if (mode === "nominal_vs_inflation")
    return key === "q4"
      ? s.nominal
      : key === "inflation"
        ? s.inflationIndex
        : key === "actions"
          ? s.equityBenchmark
          : null;
  if (key === "q4") return s.nominal;
  if (key === "actions") return s.equityBenchmark;
  if (key === "bonds") return s.sleeves.bonds;
  if (key === "cash") return s.sleeves.cash;
  if (key === "gold") return s.sleeves.gold;
  return null;
}

function PerfChart({
  bt,
  displayMode,
  q4Label,
}: {
  bt: OkBacktest;
  displayMode: PerfMode;
  q4Label: string;
}) {
  const defs = PERF_SERIES[displayMode];
  const months = bt.metrics.nominal.months;
  // Libellé de la courbe 4Q = nom de stratégie active + suffixe de mode (cohérent avec les autres
  // cartes). Le tableau `PERF_SERIES` ne fournit que la structure/couleur ; le nom vient d'ici.
  const q4ModeLabel =
    displayMode === "real"
      ? `${q4Label} réel`
      : displayMode === "nominal_vs_inflation"
        ? `${q4Label} nominal`
        : q4Label;

  // Séries déclaratives (ordre de légende = ordre `defs`). La carte partagée gère la
  // visibilité, l'échelle Linéaire/Log, le zoom et l'ordre de tracé.
  const series: ChartSeries[] = useMemo(
    () =>
      defs
        .map((d) => ({ def: d, data: perfSeriesData(displayMode, bt.series, d.key) }))
        .filter(
          (x): x is { def: SeriesDef; data: EconomicDataPoint[] } => !!x.data && x.data.length > 0,
        )
        .map(({ def, data }) => ({
          id: def.key,
          label: def.key === "q4" ? q4ModeLabel : def.label,
          color: def.color,
          dashed: def.dashed,
          data,
          width: def.key === "q4" ? 2.6 : 1.4,
        })),
    [defs, displayMode, bt.series, q4ModeLabel],
  );
  const defaultHidden = defs.filter((d) => !d.defaultOn).map((d) => d.key);

  const extraRows =
    displayMode === "nominal_vs_inflation"
      ? (row: Record<string, number>) =>
          row.q4 && row.inflation && row.inflation > 0
            ? [
                {
                  label: "Pouvoir d’achat",
                  value: `x${(row.q4 / row.inflation).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                },
              ]
            : []
      : undefined;

  return (
    <SeriesChartCard
      // Remonte (reset visibilité/échelle) au changement de mode, comme l'ancien reset.
      key={displayMode}
      title="Performance cumulée"
      subtitle="Base 100 au début de la période sélectionnée."
      series={series}
      defaultHidden={defaultHidden}
      scaleToggle
      defaultScale={months > 120 ? "log" : "linear"}
      cumulativeTooltip
      extraTooltipRows={extraRows}
      height={360}
      emptyLabel="Donnée indisponible pour ce mode."
    />
  );
}

function DrawdownCard({
  bt,
  displayMode,
  q4Label,
}: {
  bt: OkBacktest;
  displayMode: PerfMode;
  q4Label: string;
}) {
  // Drawdown réel en mode Réel (si dispo) ; nominal sinon (y compris NvI).
  const useReal = displayMode === "real" && !!bt.series.real && !!bt.series.equityReal;
  const bSeries = useReal ? bt.series.real! : bt.series.nominal;
  const aSeries = useReal ? bt.series.equityReal! : bt.series.equityBenchmark;
  const bMetrics = useReal ? bt.metrics.real! : bt.metrics.nominal;
  const aMetrics = useReal ? bt.metrics.equityReal! : bt.metrics.equity;

  // Suffixe de mode « réel / réelles » en mode réel (cohérent avec « Performance cumulée » et
  // « Mois extrêmes ») ; libellés de base en nominal.
  const modelLabel = useReal ? `${q4Label} réel` : q4Label;
  const actionsLabel = useReal ? "Actions réelles" : "Actions";

  const { series, floor } = useMemo(() => {
    const bDD = drawdownSeries(bSeries);
    const aDD = drawdownSeries(aSeries);
    let worst = 0;
    for (const p of [...bDD, ...aDD]) if (p.value < worst) worst = p.value;
    // Ordre de légende : 4 Quadrants d'abord (la carte trace la courbe épaisse au-dessus).
    const s: ChartSeries[] = [
      {
        id: "q4",
        label: modelLabel,
        color: COLOR.portfolio,
        data: bDD,
        width: 2.6,
        fillOpacity: 0.22,
      },
      {
        id: "actions",
        label: actionsLabel,
        color: COLOR.actions,
        data: aDD,
        width: 1.4,
        fillOpacity: 0.16,
      },
    ];
    return { series: s, floor: Math.min(-5, Math.floor(worst / 10) * 10) };
  }, [bSeries, aSeries, modelLabel, actionsLabel]);

  const kpis = (
    <DrawdownKpiRow
      blocks={[
        {
          label: modelLabel,
          color: COLOR.portfolio,
          maxDrawdown: bMetrics.maxDrawdown,
          underwaterMonths: bMetrics.maxUnderwaterMonths,
        },
        {
          label: actionsLabel,
          color: COLOR.actions,
          maxDrawdown: aMetrics.maxDrawdown,
          underwaterMonths: aMetrics.maxUnderwaterMonths,
        },
      ]}
      delta={{
        refLabel: actionsLabel,
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

// ─── Composition + Sources + Qualité ─────────────────────────────────────────

function CompositionCard({
  held,
  target,
  turnover,
  v2,
}: {
  held: OkModel["latest"]["finalAllocation"];
  target: OkModel["latest"]["finalAllocation"];
  turnover: TurnoverResult | null;
  v2: boolean;
}) {
  // v2 : la carte principale montre les poids DÉTENUS (ceux qui font la performance réelle).
  // v1 : `held` === `target` → rendu strictement identique à l'historique.
  const alloc = v2 ? held : target;
  const diverges = v2 && compositionDiverges(held, target);
  const sleeves = [...CORE_SLEEVES].sort((a, b) => alloc[b] - alloc[a]);
  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold">Composition du portefeuille</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {v2
          ? "Allocation actuelle du modèle au dernier mois clôturé — celle à suivre aujourd’hui."
          : "Allocation cible au dernier mois clôturé (elle évolue avec le régime)."}
      </p>
      <div className="space-y-2.5">
        {sleeves.map((k) => {
          const w = alloc[k];
          const meta = SLEEVE_META[k];
          return (
            <div key={k}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: meta.hex }} />
                  <span className="font-medium">{meta.label}</span>
                </span>
                <span className="font-semibold tabular-nums">{fmtPct0(w)}</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, w * 100)}%`, background: meta.hex }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {diverges && (
        <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-3">
          {/* Bloc PUREMENT INFORMATIF — jamais une instruction de réallocation. */}
          <p className="text-xs font-medium">
            Aucune action requise — conservez l’allocation actuelle du modèle.
          </p>
          <div className="mt-2 overflow-x-auto">
            <div className="grid min-w-max grid-cols-[1fr_auto_auto] items-end gap-x-4 gap-y-1 text-xs">
              <span />
              <span className="text-right font-medium whitespace-nowrap text-muted-foreground">
                Allocation actuelle du modèle
              </span>
              <span className="text-right font-medium whitespace-nowrap text-muted-foreground">
                Allocation cible
              </span>
              {/* Même ORDRE d'actifs que la composition principale (tri par poids). */}
              {sleeves.map((k) => (
                <div key={k} className="contents">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: SLEEVE_META[k].hex }}
                    />
                    {SLEEVE_META[k].label}
                  </span>
                  <span className="text-right font-semibold tabular-nums">{fmtPct0(held[k])}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {fmtPct0(target[k])}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            L’allocation cible est indicative. Elle ne constitue pas une instruction de réallocation
            pour ce mois-ci.
          </p>
        </div>
      )}

      {turnover && (
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
      )}
    </Card>
  );
}

const CONTRIB_TOOLTIP =
  "Les contributions brutes additionnent les effets mensuels poids × rendement. Lorsqu’elles sont toutes positives, elles sont normalisées à 100 % pour faciliter la lecture. Cette mesure indique quelles poches ont le plus porté la performance, sans représenter directement la part du gain final capitalisé.";

function ContributionCard({ bt }: { bt: OkBacktest }) {
  const rows = CORE_SLEEVES.map((k) => ({
    key: k,
    label: SLEEVE_META[k].label,
    color: SLEEVE_META[k].hex,
    raw: bt.contributions[k],
  }));
  const allPositive = rows.every((r) => r.raw > 0);
  const total = allPositive ? rows.reduce((s, r) => s + r.raw, 0) : 0;
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.raw)));
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
          const share = allPositive && total > 0 ? (r.raw / total) * 100 : null;
          const width = allPositive ? (share ?? 0) : (Math.abs(r.raw) / maxAbs) * 100;
          return (
            <div
              key={r.key}
              className="grid grid-cols-[6rem_1fr_5rem] items-center gap-2.5 text-sm"
            >
              <span className="font-medium">{r.label}</span>
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
                {share !== null
                  ? `${share.toFixed(0)} %`
                  : `${r.raw >= 0 ? "+" : "−"}${Math.abs(r.raw).toFixed(1)} pts`}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Teinte du badge de disponibilité — alignée sur la légende de la Méthodologie
// (mêmes 4 niveaux que Browne : Complet / Historique court / Données en repli / Partiel).
const DATA_QUALITY_TONE: Record<QuadrantDataQuality, string> = {
  Complet: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Historique court": "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Données en repli": "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  Partiel: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

/** Badge de disponibilité coloré (Complet / Historique court / Données en repli / Partiel). */
function DataQualityBadge({ quality }: { quality: QuadrantDataQuality }) {
  return (
    <Badge variant="secondary" className={DATA_QUALITY_TONE[quality]}>
      {quality}
    </Badge>
  );
}

function DataQualityCard({
  config,
  dataQuality,
  months,
}: {
  config: QuadrantModelConfig;
  dataQuality: QuadrantDataQuality;
  months: number;
}) {
  const rows: { label: string; method: string }[] = [
    { label: "Signal activité", method: "Actions (prix) / pétrole" },
    {
      label: "Performance actions",
      method: config.equityTotalReturnFallback
        ? "Prix simple (repli, hors dividendes)"
        : "Indice total-return",
    },
    { label: "Obligations 10 ans", method: "Proxy total-return reconstruit du taux 10 ans" },
    { label: "Cash", method: "Indice capitalisé du taux court" },
    { label: "Or", method: "XAU converti en devise locale" },
    { label: "Inflation", method: config.cpiId ? "Indice des prix (CPI) local" : "Absente" },
  ];
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Qualité des données</h3>
        <DataQualityBadge quality={dataQuality} />
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="text-right text-xs text-muted-foreground">{r.method}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-2 text-sm">
          <span className="font-medium">Profondeur du signal</span>
          <span className="text-xs text-muted-foreground">{months} mois (historique complet)</span>
        </div>
      </div>
    </Card>
  );
}

// ─── Vue pays ────────────────────────────────────────────────────────────────

export function QuadrantsCountryView({
  config,
  dataQuality,
  model,
  backtest,
  strategy,
  transitionWidth,
  displayMode,
}: {
  config: QuadrantModelConfig;
  dataQuality: QuadrantDataQuality;
  model: OkModel;
  backtest: BacktestResult | null;
  strategy: Strategy;
  transitionWidth: number;
  displayMode: PerfMode;
}) {
  const latest = model.latest;
  const regime = displayRegime(latest);
  const bt = backtest && backtest.status === "OK" ? backtest : null;

  // « Mois extrêmes des actions » : Actions locales + stratégie 4Q active, dérivées du backtest
  // CLIENT déjà calculé (aucun recalcul). Mode / période / devise / stratégie = paramètres actifs.
  const extremeModelId = strategy === "dynamic" ? "quadrants-dynamic-v2" : "quadrants-binary-v2";
  // Nom de la stratégie 4Q active, utilisé PARTOUT (Perf cumulée, Drawdowns, Mois extrêmes) ;
  // le suffixe de mode « réel » est ajouté par chaque carte.
  const q4Label = strategy === "dynamic" ? "4Q Continue" : "4Q Régime";
  const extremeSeries = bt
    ? buildEquityModelSeries(bt.series, displayMode === "real", {
        id: extremeModelId,
        label: q4Label,
      })
    : null;

  // Cause précise d'indisponibilité du backtest (message homogène), sinon repli.
  const unavailableMessage =
    backtest && backtest.status !== "OK" && backtest.availability.reason
      ? availabilityMessage(backtest.availability.reason, backtest.availability.firstInvalidMonth)
      : "Historique insuffisant pour calculer le backtest.";

  const isNvI = displayMode === "nominal_vs_inflation";
  const wantsReal = displayMode === "real" || isNvI; // modes qui dépendent du CPI
  const hasReal = bt != null && bt.series.real != null; // CPI exploitable sur la fenêtre
  // CPI absent sous un mode qui en dépend : on NE bascule PAS en nominal en silence
  // (les KPI + graphes concernés sont remplacés par un message ; régime/allocation restent).
  const cpiMissing = bt != null && wantsReal && !hasReal;
  const real = displayMode === "real" && hasReal; // affichage réel effectif
  const pm = bt && !cpiMissing ? (real ? bt.metrics.real! : bt.metrics.nominal) : null;
  const am = bt && !cpiMissing ? (real ? bt.metrics.equityReal! : bt.metrics.equity) : null;

  const kpis =
    !bt || cpiMissing
      ? []
      : isNvI
        ? buildInflationKpis(bt)
        : pm && am
          ? buildKpis(pm, am, real)
          : [];

  // Période RÉELLEMENT couverte par les indicateurs affichés : en mode réel, la
  // série réelle peut démarrer après la fenêtre nominale si le CPI est plus court.
  const periodStart = real && bt?.series.real ? bt.series.real[0].date : bt?.start;
  const periodEnd =
    real && bt?.series.real ? bt.series.real[bt.series.real.length - 1].date : bt?.end;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Résumé */}
        <Card id="resume" className="scroll-mt-[var(--model-header-offset,96px)] gap-0 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-slate-800 shadow-sm sm:size-12">
                <CountryFlag
                  code={config.countryCode}
                  countryName={config.countryFr ?? config.countryCode}
                  size={28}
                />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {config.countryFr ?? config.countryCode}
                  </h2>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs font-medium",
                      regime.style.ring,
                      regime.style.ringBg,
                      regime.style.text,
                    )}
                  >
                    {regime.label}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Portefeuille 4 Quadrants local en {config.currency}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Badge variant="secondary">Mensuel</Badge>
              <Badge variant="secondary">Devise locale</Badge>
              <Badge variant="secondary">{STRATEGY_LABELS[strategy]}</Badge>
              <DataQualityBadge quality={dataQuality} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
            <Info2 label="Devise" value={config.currency} />
            <Info2 label="Fréquence" value="Mensuelle" />
            <Info2
              label="Mode"
              value={isNvI ? "Nominal vs Inflation" : displayMode === "real" ? "Réel" : "Nominal"}
            />
            {bt && periodStart && periodEnd && (
              <Info2
                label="Période"
                value={`${formatMonth(periodStart)} → ${formatMonth(periodEnd)}`}
              />
            )}
            <Info2 label="Largeur de la zone neutre" value={`${transitionWidth} %`} />
          </div>
        </Card>

        {/* KPI principaux */}
        <section id="indicateurs" className="scroll-mt-[var(--model-header-offset,96px)]">
          {kpis.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {kpis.map((k) => (
                <KpiCard key={k.title} {...k} modelLabel={q4Label} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {cpiMissing ? (
                <>
                  {availabilityMessage("cpi_unavailable")} Le régime courant et l’allocation cible
                  restent affichés.
                </>
              ) : (
                unavailableMessage
              )}
            </Card>
          )}
        </section>

        {/* Performance + Drawdown — masqués sans CPI en mode réel/NvI (pas de repli nominal) */}
        {bt && !cpiMissing && (
          <>
            <section id="performance" className="scroll-mt-[var(--model-header-offset,96px)]">
              <PerfChart bt={bt} displayMode={displayMode} q4Label={q4Label} />
            </section>
            <section id="drawdown" className="scroll-mt-[var(--model-header-offset,96px)]">
              <DrawdownCard bt={bt} displayMode={displayMode} q4Label={q4Label} />
            </section>
            <ExtremeMonthsCard
              series={extremeSeries ?? []}
              colors={{ equity: COLOR.actions, [extremeModelId]: COLOR.portfolio }}
            />
          </>
        )}

        {/* Composition */}
        <section id="composition" className="scroll-mt-[var(--model-header-offset,96px)]">
          <CompositionCard
            held={bt ? bt.heldAllocation : latest.finalAllocation}
            target={bt ? bt.targetAllocation : latest.finalAllocation}
            turnover={bt ? bt.turnover : null}
            v2={IS_MODEL_V2}
          />
        </section>

        {/* Sources + Qualité */}
        <section
          id="sources-qualite"
          className="grid scroll-mt-[var(--model-header-offset,96px)] grid-cols-1 gap-4 lg:grid-cols-2"
        >
          {bt && <ContributionCard bt={bt} />}
          <DataQualityCard
            config={config}
            dataQuality={dataQuality}
            months={model.monthlyResults.length}
          />
        </section>
      </div>
    </TooltipProvider>
  );
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-2">
      <span className="text-right whitespace-nowrap text-muted-foreground">{label} :</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
