"use client";

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FrostedDialogContent } from "@/components/custom/ui/frosted-dialog";
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
import { ExplorationChart, type ChartLine } from "../../exploration/exploration-chart";
import {
  displayRegime,
  STRATEGY_LABELS,
  SLEEVE_META,
  CORE_SLEEVES,
  mergeChart,
  drawdownSeries,
  fmtPct0,
  fmtPctN,
  fmtRatio,
  fmtMonths,
  fmtMultiple,
  type PerfMode,
} from "./helpers";
import { availabilityMessage } from "./availability-message";

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
}: KpiData) {
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
            label="4 Quadrants"
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

const defaultsOf = (mode: PerfMode): Record<string, boolean> =>
  Object.fromEntries(PERF_SERIES[mode].map((d) => [d.key, d.defaultOn]));

function PerfChart({ bt, displayMode }: { bt: OkBacktest; displayMode: PerfMode }) {
  const defs = PERF_SERIES[displayMode];
  const [shown, setShown] = useState<Record<string, boolean>>(() => defaultsOf(displayMode));
  useEffect(() => {
    setShown(defaultsOf(displayMode));
  }, [displayMode]);

  const months = bt.metrics.nominal.months;
  const [userScale, setUserScale] = useState<"linear" | "log" | null>(null);
  const scale = userScale ?? (months > 120 ? "log" : "linear");
  const [zoom, setZoom] = useState(false);

  const chart = useMemo(() => {
    const withData = defs
      .filter((d) => shown[d.key])
      .map((d) => ({ def: d, data: perfSeriesData(displayMode, bt.series, d.key) }))
      .filter(
        (x): x is { def: SeriesDef; data: EconomicDataPoint[] } => !!x.data && x.data.length > 0,
      );
    if (!withData.length) return null;
    const lines: ChartLine[] = withData
      .map(({ def }) => ({
        key: def.key,
        label: def.label,
        color: def.color,
        dashed: def.dashed,
        width: def.key === "q4" ? 2.6 : 1.4,
      }))
      .sort((a, b) => (a.key === "q4" ? 1 : b.key === "q4" ? -1 : 0));
    return { data: mergeChart(withData.map(({ def, data }) => ({ key: def.key, data }))), lines };
  }, [defs, shown, displayMode, bt.series]);

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

  const render = (height: number | string) =>
    chart ? (
      <ExplorationChart
        data={chart.data}
        lines={chart.lines}
        height={height}
        logScale={scale === "log"}
        showLegend={false}
        markLast
        gridOpacity={0.22}
        cumulativeTooltip
        extraTooltipRows={extraRows}
        axisLine
      />
    ) : null;

  return (
    <Card className="gap-0 bg-gradient-to-b from-foreground/[0.015] to-transparent p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Performance cumulée</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {defs.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setShown((s) => ({ ...s, [d.key]: !s[d.key] }))}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors",
                  shown[d.key]
                    ? "border-foreground/20 text-foreground"
                    : "border-transparent text-muted-foreground/50 hover:text-foreground",
                )}
              >
                <span
                  className="size-2 rounded-full transition-opacity"
                  style={{ backgroundColor: d.color, opacity: shown[d.key] ? 1 : 0.35 }}
                />
                {d.label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center rounded-md border border-border/50 bg-background/40 p-0.5 text-xs">
            {(["linear", "log"] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setUserScale(sc)}
                className={cn(
                  "cursor-pointer rounded px-2.5 py-1 font-medium transition-all",
                  scale === sc
                    ? "bg-slate-700/70 text-white shadow-sm ring-1 ring-slate-500/50"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {sc === "linear" ? "Linéaire" : "Log"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {chart ? (
        <>
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="cursor-zoom-img block w-full text-left"
            aria-label="Agrandir le graphique"
          >
            {render(360)}
          </button>
          <Dialog open={zoom} onOpenChange={setZoom}>
            <FrostedDialogContent
              className="max-h-[92vh] w-[92vw] max-w-[92vw] sm:max-w-[92vw]"
              showCloseButton
            >
              <DialogTitle className="text-center text-base font-medium">
                Performance cumulée
              </DialogTitle>
              {render("78vh")}
            </FrostedDialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
          Donnée indisponible pour ce mode.
        </div>
      )}
    </Card>
  );
}

function DrawdownCard({ bt, displayMode }: { bt: OkBacktest; displayMode: PerfMode }) {
  // Drawdown réel en mode Réel (si dispo) ; nominal sinon (y compris NvI).
  const useReal = displayMode === "real" && !!bt.series.real && !!bt.series.equityReal;
  const bSeries = useReal ? bt.series.real! : bt.series.nominal;
  const aSeries = useReal ? bt.series.equityReal! : bt.series.equityBenchmark;
  const bMetrics = useReal ? bt.metrics.real! : bt.metrics.nominal;
  const aMetrics = useReal ? bt.metrics.equityReal! : bt.metrics.equity;

  const [shown, setShown] = useState({ q4: true, actions: true });
  const [zoom, setZoom] = useState(false);

  const dd = useMemo(() => {
    const bDD = drawdownSeries(bSeries);
    const aDD = drawdownSeries(aSeries);
    let worst = 0;
    for (const p of [...bDD, ...aDD]) if (p.value < worst) worst = p.value;
    const floor = Math.min(-5, Math.floor(worst / 10) * 10);
    const active: { key: string; data: EconomicDataPoint[] }[] = [];
    const lines: ChartLine[] = [];
    if (shown.actions) {
      active.push({ key: "actions", data: aDD });
      lines.push({
        key: "actions",
        label: "Actions",
        color: COLOR.actions,
        width: 1.4,
        fillOpacity: 0.16,
      });
    }
    if (shown.q4) {
      active.push({ key: "q4", data: bDD });
      lines.push({
        key: "q4",
        label: "4 Quadrants",
        color: COLOR.portfolio,
        width: 2.6,
        fillOpacity: 0.22,
      });
    }
    return { data: mergeChart(active), lines, yDomain: [floor, 0] as [number, number] };
  }, [bSeries, aSeries, shown]);

  const reduction =
    bMetrics.maxDrawdown !== null && aMetrics.maxDrawdown !== null
      ? bMetrics.maxDrawdown - aMetrics.maxDrawdown
      : null;
  const toggles = [
    { key: "q4" as const, label: "4 Quadrants", color: COLOR.portfolio },
    { key: "actions" as const, label: "Actions", color: COLOR.actions },
  ];

  return (
    <Card className="gap-0 bg-gradient-to-b from-foreground/[0.015] to-transparent p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Drawdown</h3>
        <div className="flex flex-wrap gap-1.5">
          {toggles.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setShown((s) => ({ ...s, [t.key]: !s[t.key] }))}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors",
                shown[t.key]
                  ? "border-foreground/20 text-foreground"
                  : "border-transparent text-muted-foreground/50 hover:text-foreground",
              )}
            >
              <span
                className="size-2 rounded-full transition-opacity"
                style={{ backgroundColor: t.color, opacity: shown[t.key] ? 1 : 0.35 }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Max DD 4Q" value={fmtPctN(bMetrics.maxDrawdown)} />
        <Stat label="Max DD actions" value={fmtPctN(aMetrics.maxDrawdown)} />
        <Stat label="Réduction" value={reduction === null ? "—" : `+${reduction.toFixed(1)} pts`} />
        <Stat label="Durée max sous l’eau" value={fmtMonths(bMetrics.maxUnderwaterMonths)} />
      </div>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="cursor-zoom-img block w-full text-left"
        aria-label="Agrandir le graphique"
      >
        <ExplorationChart
          data={dd.data}
          lines={dd.lines}
          height={240}
          showLegend={false}
          markLast
          gridOpacity={0.22}
          yDomain={dd.yDomain}
          areaFill
          percentTooltip
          axisLine
        />
      </button>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <FrostedDialogContent
          className="max-h-[92vh] w-[92vw] max-w-[92vw] sm:max-w-[92vw]"
          showCloseButton
        >
          <DialogTitle className="text-center text-base font-medium">Drawdown</DialogTitle>
          <ExplorationChart
            data={dd.data}
            lines={dd.lines}
            height="78vh"
            showLegend={false}
            markLast
            gridOpacity={0.22}
            yDomain={dd.yDomain}
            areaFill
            percentTooltip
            axisLine
          />
        </FrostedDialogContent>
      </Dialog>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ─── Composition + Sources + Qualité ─────────────────────────────────────────

function CompositionCard({
  alloc,
  turnover,
}: {
  alloc: OkModel["latest"]["finalAllocation"];
  turnover: TurnoverResult | null;
}) {
  const sleeves = [...CORE_SLEEVES].sort((a, b) => alloc[b] - alloc[a]);
  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold">Composition du portefeuille</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Allocation cible au dernier mois clôturé (elle évolue avec le régime).
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
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, w * 100)}%`, background: meta.hex }}
                />
              </div>
            </div>
          );
        })}
      </div>

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
          <span className="font-medium">Profondeur</span>
          <span className="text-xs text-muted-foreground">{months} mois de signal</span>
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
  // Cause précise d'indisponibilité du backtest (message homogène), sinon repli.
  const unavailableMessage =
    backtest && backtest.status !== "OK" && backtest.availability.reason
      ? availabilityMessage(backtest.availability.reason, backtest.availability.firstInvalidMonth)
      : "Historique insuffisant pour calculer le backtest.";

  const isNvI = displayMode === "nominal_vs_inflation";
  const real = displayMode === "real" && bt?.metrics.real != null;
  const pm = bt ? (real ? bt.metrics.real! : bt.metrics.nominal) : null;
  const am = bt ? (real ? bt.metrics.equityReal! : bt.metrics.equity) : null;

  const kpis = !bt ? [] : isNvI ? buildInflationKpis(bt) : pm && am ? buildKpis(pm, am, real) : [];

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
              <Badge variant="secondary">
                {STRATEGY_LABELS[strategy]}
                {strategy === "dynamic" && " · DQAE"}
              </Badge>
              <DataQualityBadge quality={dataQuality} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
            <Info2 label="Devise" value={config.currency} />
            <Info2 label="Fréquence" value="Mensuelle" />
            <Info2
              label="Mode"
              value={isNvI ? "Nominal vs Inflation" : real ? "Réel" : "Nominal"}
            />
            {bt && (
              <Info2 label="Période" value={`${formatMonth(bt.start)} → ${formatMonth(bt.end)}`} />
            )}
            <Info2 label="Largeur de la zone neutre" value={`${transitionWidth} %`} />
          </div>
        </Card>

        {/* KPI principaux */}
        <section id="indicateurs" className="scroll-mt-[var(--model-header-offset,96px)]">
          {kpis.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {kpis.map((k) => (
                <KpiCard key={k.title} {...k} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {unavailableMessage}
            </Card>
          )}
        </section>

        {/* Performance + Drawdown */}
        {bt && (
          <>
            <section id="performance" className="scroll-mt-[var(--model-header-offset,96px)]">
              <PerfChart bt={bt} displayMode={displayMode} />
            </section>
            <section id="drawdown" className="scroll-mt-[var(--model-header-offset,96px)]">
              <DrawdownCard bt={bt} displayMode={displayMode} />
            </section>
          </>
        )}

        {/* Composition */}
        <section id="composition" className="scroll-mt-[var(--model-header-offset,96px)]">
          <CompositionCard alloc={latest.finalAllocation} turnover={bt ? bt.turnover : null} />
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
