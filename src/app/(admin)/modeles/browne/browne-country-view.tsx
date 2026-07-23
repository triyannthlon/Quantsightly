"use client";

import { Fragment, useMemo } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { computeKpis } from "@/lib/coredata/compute";
import type { EconomicDataPoint } from "@/lib/coredata/types";
import {
  REBALANCE_LABELS,
  computeRobustness,
  type BrowneResult,
  type Robustness,
} from "@/lib/coredata/browne";
import type { CountryBrowneConfig, BrowneDataQuality } from "@/lib/coredata/browne-service";
import { SeriesChartCard, type ChartSeries } from "../series-chart-card";
import {
  fmtPct,
  fmtRatio,
  fmtMonths,
  fmtMultiple,
  fmtPts,
  SLEEVE_PALETTE,
  ROBUSTNESS_TONE,
  type BrowneDisplayMode,
} from "./helpers";
import {
  DrawdownCard,
  CompositionCard,
  ContributionCard,
  DataQualityCard,
} from "./browne-detail-cards";

const COLOR = {
  browne: "#E8833A",
  inflation: "#E87386",
  equity: SLEEVE_PALETTE.equity,
  bond: SLEEVE_PALETTE.bond,
  cash: SLEEVE_PALETTE.cash,
  gold: SLEEVE_PALETTE.gold,
} as const;

const DISPLAY_LABEL: Record<BrowneDisplayMode, string> = {
  nominal: "Nominal",
  real: "Réel",
  nominal_vs_inflation: "Nominal vs Inflation",
};

// Familles de KPI — teinte TRÈS discrète (institutionnel/sobre) : bordure à
// basse opacité + dégradé léger. La valeur principale reste en blanc.
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
  // Pouvoir d'achat : ambre/or (rendement réel). Inflation : neutre discret.
  "pouvoir-achat": "border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-transparent",
  inflation: "border-foreground/15 bg-gradient-to-b from-foreground/[0.035] to-transparent",
};

type BadgeTone = "positive" | "info" | "negative";
const BADGE_TONE: Record<BadgeTone, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  info: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  negative: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────

// Teinte du badge de disponibilité — alignée sur la légende de la Méthodologie.
const DATA_QUALITY_TONE: Record<BrowneDataQuality, string> = {
  Complet: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Complet avec proxy structurel":
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Historique court": "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Données en repli": "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  Partiel: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function QualityBadge({ quality }: { quality: BrowneDataQuality }) {
  return (
    <Badge variant="secondary" className={DATA_QUALITY_TONE[quality]}>
      {quality}
    </Badge>
  );
}

// ─── Pastille de robustesse ──────────────────────────────────────────────────

/**
 * Score de robustesse Browne (0–100) + badge, avec le détail des 5 composantes
 * au survol. Propriété RÉELLE du portefeuille : affichée quel que soit le mode.
 */
function RobustnessPill({ robustness }: { robustness: Robustness }) {
  if (!robustness.available) {
    const msg =
      robustness.reason === "missing_cpi"
        ? "Indisponible : sans inflation locale, la préservation du pouvoir d’achat ne peut pas être mesurée."
        : "Historique insuffisant pour évaluer la régularité sur des fenêtres de 5 ans.";
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
          >
            <span className="text-[11px] font-medium tracking-wide uppercase opacity-70">
              Robustesse Browne
            </span>
            <span className="opacity-40">·</span>
            <span>Indisponible</span>
            <Info className="size-3 opacity-50" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56">
          {msg}
        </TooltipContent>
      </Tooltip>
    );
  }

  const { score, badge, components, shortHistory } = robustness;
  const rows: [string, number][] = [
    ["Rendement réel", components.return],
    ["Drawdown", components.drawdown],
    ["Volatilité", components.volatility],
    ["Durée sous l’eau", components.underwater],
    ["Régularité", components.consistency],
  ];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
            ROBUSTNESS_TONE[badge],
          )}
        >
          <span className="text-[11px] font-medium tracking-wide uppercase opacity-70">
            Robustesse Browne
          </span>
          <span className="opacity-40">·</span>
          <span className="tabular-nums font-semibold">{score}/100</span>
          <span className="opacity-40">·</span>
          <span className="font-medium">{badge}</span>
          {shortHistory && <span className="opacity-70">· court</span>}
          <Info className="size-3 opacity-50" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="w-60 max-w-none">
        <div className="font-medium">Robustesse Browne — {score} / 100</div>
        <div className="text-muted-foreground">
          {badge}
          {shortHistory ? " · historique court" : ""}
        </div>
        <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 tabular-nums">
          {rows.map(([label, v]) => (
            <Fragment key={label}>
              <span className="text-muted-foreground">{label} :</span>
              <span className="text-right">{v}</span>
            </Fragment>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Carte KPI ───────────────────────────────────────────────────────────────

/** Écart Browne − Actions, formaté selon la métrique (points / ratio / mois). */
function fmtEcart(diff: number, unit: "pts" | "ratio" | "mois"): string {
  if (unit === "ratio") return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
  if (unit === "mois") return `${diff > 0 ? "+" : ""}${diff} mois`;
  const u = Math.abs(Number(diff.toFixed(1))) === 1 ? "pt" : "pts";
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} ${u}`;
}

interface KpiData {
  title: string;
  value: string;
  tooltip: string;
  /** Valeur Actions (sans préfixe) — modes comparant à l'indice actions. */
  actions?: string;
  /** Valeur de l'écart Browne − Actions (sans préfixe). */
  ecart?: string;
  /** Valeurs brutes Browne / Actions (barres de comparaison). */
  browneRaw?: number | null;
  actionsRaw?: number | null;
  /** Famille visuelle (teinte de la carte). */
  family?: KpiFamily;
  /** Badge d'interprétation (« Protection élevée »…). */
  badge?: string;
  badgeTone?: BadgeTone;
}

/** Barre de comparaison (longueur ∝ |valeur|, la plus grande remplit la piste). */
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
    <div className="grid grid-cols-[3.4rem_1fr_3.4rem] items-center gap-2 text-xs">
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

function KpiCard({
  title,
  value,
  tooltip,
  actions,
  ecart,
  browneRaw,
  actionsRaw,
  family,
  badge,
  badgeTone = "positive",
}: KpiData) {
  const showBars = browneRaw != null && actionsRaw != null;
  const maxAbs = Math.max(Math.abs(browneRaw ?? 0), Math.abs(actionsRaw ?? 0)) || 1;
  return (
    <Card className={cn("gap-0 p-4", family && FAMILY_CARD[family])}>
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
      {showBars ? (
        <div className="mt-2.5 space-y-1.5">
          <CmpBar
            label="Browne"
            width={(Math.abs(browneRaw ?? 0) / maxAbs) * 100}
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
      ) : (
        actions && (
          <div className="mt-1 text-xs tabular-nums text-muted-foreground">Actions : {actions}</div>
        )
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

// ─── Graphique de performance ────────────────────────────────────────────────

type SeriesDef = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  defaultOn: boolean;
};

// Séries disponibles par mode + état par défaut (Browne + Actions actifs ; poches
// secondaires activables). En « Nominal vs Inflation », Actions est proposé mais off.
const PERF_SERIES: Record<BrowneDisplayMode, SeriesDef[]> = {
  nominal: [
    { key: "browne", label: "Browne", color: COLOR.browne, defaultOn: true },
    { key: "equity", label: "Actions", color: COLOR.equity, defaultOn: true },
    { key: "bond", label: "Obligations", color: COLOR.bond, defaultOn: false },
    { key: "cash", label: "Cash", color: COLOR.cash, defaultOn: false },
    { key: "gold", label: "Or", color: COLOR.gold, defaultOn: false },
  ],
  real: [
    { key: "browne", label: "Browne réel", color: COLOR.browne, defaultOn: true },
    { key: "equity", label: "Actions réelles", color: COLOR.equity, defaultOn: true },
  ],
  nominal_vs_inflation: [
    { key: "browne", label: "Browne nominal", color: COLOR.browne, defaultOn: true },
    {
      key: "inflation",
      label: "Inflation cumulée",
      color: COLOR.inflation,
      dashed: true,
      defaultOn: true,
    },
    { key: "equity", label: "Actions", color: COLOR.equity, defaultOn: false },
  ],
};

type OkSeries = Extract<BrowneResult, { status: "OK" }>["series"];

function perfData(mode: BrowneDisplayMode, s: OkSeries, key: string): EconomicDataPoint[] | null {
  if (mode === "real") return key === "browne" ? s.real : key === "equity" ? s.equityReal : null;
  if (mode === "nominal_vs_inflation")
    return key === "browne"
      ? s.nominal
      : key === "inflation"
        ? s.inflationIndex
        : key === "equity"
          ? s.equityBenchmark
          : null;
  if (key === "browne") return s.nominal;
  if (key === "equity") return s.equityBenchmark;
  if (key === "bond") return s.sleeves.bond;
  if (key === "cash") return s.sleeves.cash;
  if (key === "gold") return s.sleeves.gold;
  return null;
}

function PerformanceChart({
  result,
  displayMode,
}: {
  result: Extract<BrowneResult, { status: "OK" }>;
  displayMode: BrowneDisplayMode;
}) {
  const defs = PERF_SERIES[displayMode];

  // Séries déclaratives (ordre de légende = ordre `defs`). La carte partagée gère la
  // visibilité, l'échelle Linéaire/Log, le zoom et l'ordre de tracé.
  const series: ChartSeries[] = useMemo(
    () =>
      defs
        .map((d) => ({ def: d, data: perfData(displayMode, result.series, d.key) }))
        .filter(
          (x): x is { def: SeriesDef; data: EconomicDataPoint[] } => !!x.data && x.data.length > 0,
        )
        .map(({ def, data }) => ({
          id: def.key,
          label: def.label,
          color: def.color,
          dashed: def.dashed,
          data,
          width: def.key === "browne" ? 2.6 : 1.4,
        })),
    [defs, displayMode, result.series],
  );
  const defaultHidden = defs.filter((d) => !d.defaultOn).map((d) => d.key);

  const extraRows =
    displayMode === "nominal_vs_inflation"
      ? (row: Record<string, number>) =>
          row.browne && row.inflation && row.inflation > 0
            ? [
                {
                  label: "Pouvoir d’achat",
                  value: `x${(row.browne / row.inflation).toLocaleString("fr-FR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}`,
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
      defaultScale={result.months > 120 ? "log" : "linear"}
      cumulativeTooltip
      extraTooltipRows={extraRows}
      height={360}
      emptyLabel="Donnée indisponible pour ce mode."
    />
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

  const { metrics, series } = result;
  const m = metrics.nominal;
  const r = metrics.real;
  const inflAnnualized = computeKpis(series.inflationIndex ?? []).annualized;
  const robustness = computeRobustness(result);

  // Multiples (mode Nominal vs Inflation) sur la fenêtre où le CPI existe.
  const multiples = (() => {
    const infl = series.inflationIndex;
    const real = series.real;
    if (!infl?.length || !real?.length) return { nom: null, infl: null, real: null };
    const nomByDate = new Map(series.nominal.map((p) => [p.date, p.value]));
    const n0 = nomByDate.get(infl[0].date);
    const n1 = nomByDate.get(infl[infl.length - 1].date);
    return {
      nom: n0 && n1 && n0 > 0 ? n1 / n0 : null,
      infl: infl[infl.length - 1].value / infl[0].value,
      real: real[real.length - 1].value / real[0].value,
    };
  })();
  const surperf =
    m.annualized !== null && inflAnnualized !== null ? m.annualized - inflAnnualized : null;

  // Libellés NEUTRES (le mode est déjà indiqué en tête de carte). Chaque carte
  // compare Browne à l'indice actions (Actions + Écart Browne − Actions) ; en
  // mode réel, la comparaison porte sur les séries corrigées de l'inflation.
  const perfKpis = (mm: typeof m, cmp: typeof m | null, real: boolean): KpiData[] => {
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
      browneRaw: bv,
      actionsRaw: ev,
      family,
      badge,
      badgeTone,
    });

    // Badges d'interprétation (Browne vs actions du même mode).
    const volRedux =
      mm.volatility !== null &&
      cmp != null &&
      cmp.volatility !== null &&
      cmp.volatility > 0 &&
      mm.volatility <= 0.7 * cmp.volatility;
    const mddRedux =
      mm.maxDrawdown !== null && cmp != null && cmp.maxDrawdown !== null
        ? mm.maxDrawdown - cmp.maxDrawdown
        : null;
    const betterRR =
      mm.sharpe !== null && cmp != null && cmp.sharpe !== null && mm.sharpe > cmp.sharpe;
    const underwater = mm.currentDrawdown !== null && mm.currentDrawdown < -1;

    // Ordre : rendement puis risque appariés, la paire Meilleure/Pire année
    // ensemble. La couleur de famille reste portée par chaque carte.
    return [
      row(
        "Performance annualisée",
        "Rendement annualisé (CAGR).",
        mm.annualized,
        cmp?.annualized ?? null,
        fmtPct,
        "pts",
        "performance",
      ),
      row(
        "Volatilité annualisée",
        "Ampleur des variations mensuelles, annualisée.",
        mm.volatility,
        cmp?.volatility ?? null,
        fmtPct,
        "pts",
        "risque",
        volRedux ? "Risque réduit" : undefined,
      ),
      row(
        "Max drawdown",
        "Perte maximale entre un sommet et un point bas.",
        mm.maxDrawdown,
        cmp?.maxDrawdown ?? null,
        fmtPct,
        "pts",
        "risque",
        mddRedux !== null && mddRedux >= 20 ? "Protection élevée" : undefined,
      ),
      row(
        "Drawdown courant",
        "Recul actuel depuis le dernier sommet.",
        mm.currentDrawdown,
        cmp?.currentDrawdown ?? null,
        fmtPct,
        "pts",
        "risque",
        underwater ? "Sous le sommet" : undefined,
        "info",
      ),
      row(
        "Sharpe",
        "Excédent de rendement sur le cash (taux sans risque), rapporté à la volatilité.",
        mm.sharpe,
        cmp?.sharpe ?? null,
        fmtRatio,
        "ratio",
        "rendement-risque",
        betterRR ? "Meilleur rendement/risque" : undefined,
      ),
      row(
        "Meilleure année",
        "Meilleure performance sur une année civile.",
        mm.bestYear,
        cmp?.bestYear ?? null,
        fmtPct,
        "pts",
        "performance",
      ),
      row(
        "Pire année",
        "Pire performance sur une année civile.",
        mm.worstYear,
        cmp?.worstYear ?? null,
        fmtPct,
        "pts",
        "risque",
      ),
      row(
        "Durée max sous l’eau",
        "Plus longue durée passée sous le dernier sommet.",
        mm.maxUnderwaterMonths,
        cmp?.maxUnderwaterMonths ?? null,
        fmtMonths,
        "mois",
        "resilience",
      ),
    ];
  };

  const KPIS: Record<BrowneDisplayMode, KpiData[]> = {
    nominal: perfKpis(m, metrics.equity, false),
    real: r ? perfKpis(r, metrics.equityReal, true) : [],
    nominal_vs_inflation: [
      {
        title: "Perf. nominale annualisée",
        value: fmtPct(m.annualized),
        tooltip: "Performance annualisée brute, sans correction de l’inflation.",
        family: "performance",
      },
      {
        title: "Perf. réelle annualisée",
        value: fmtPct(r?.annualized ?? null),
        tooltip: "Performance corrigée de l’inflation : gain de pouvoir d’achat.",
        family: "pouvoir-achat",
      },
      {
        title: "Inflation annualisée",
        value: fmtPct(inflAnnualized),
        tooltip: "Inflation locale annualisée sur la période (indice des prix à la consommation).",
        family: "inflation",
      },
      {
        title: "Écart annuel vs inflation",
        value: fmtPts(surperf),
        tooltip: "Écart annualisé, en points, entre la performance nominale et l’inflation.",
        family: "pouvoir-achat",
        badge: surperf === null ? undefined : surperf > 0 ? "Bat l’inflation" : "Sous l’inflation",
        badgeTone: surperf !== null && surperf < 0 ? "negative" : "positive",
      },
      {
        title: "Multiple portefeuille",
        value: fmtMultiple(multiples.nom),
        tooltip: "Capital final rapporté au capital initial (nominal).",
        family: "performance",
      },
      {
        title: "Multiple inflation",
        value: fmtMultiple(multiples.infl),
        tooltip: "Hausse cumulée du coût de la vie sur la période.",
        family: "inflation",
      },
      {
        title: "Multiple réel",
        value: fmtMultiple(multiples.real),
        tooltip: "Gain de pouvoir d’achat cumulé (multiple réel).",
        family: "pouvoir-achat",
      },
      {
        title: "Max drawdown nominal",
        value: fmtPct(m.maxDrawdown),
        tooltip: "Perte maximale nominale entre un sommet et un point bas.",
        family: "risque",
      },
    ],
  };
  const kpis = KPIS[displayMode];

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
                  <RobustnessPill robustness={robustness} />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Portefeuille Browne local en {config.currency}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Badge variant="secondary">Mensuel</Badge>
              <Badge variant="secondary">Devise locale</Badge>
              <Badge variant="secondary">Rééquilibrage {REBALANCE_LABELS[result.rebalance]}</Badge>
              <QualityBadge quality={dataQuality} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Info2 label="Devise" value={config.currency} />
            <Info2 label="Fréquence" value="Mensuelle" />
            <Info2 label="Mode" value={DISPLAY_LABEL[displayMode]} />
            <Info2
              label="Période"
              value={`${formatMonth(result.start)} → ${formatMonth(result.end)}`}
            />
          </div>
        </Card>

        {/* KPI (pilotés par le mode d'analyse) */}
        <section id="indicateurs" className="scroll-mt-[var(--model-header-offset,96px)]">
          {kpis.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {kpis.map((k) => (
                <KpiCard key={k.title} {...k} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Donnée d’inflation indisponible : le mode Réel n’est pas calculable pour ce pays.
            </Card>
          )}
        </section>

        {/* Performance */}
        <section id="performance" className="scroll-mt-[var(--model-header-offset,96px)]">
          <PerformanceChart result={result} displayMode={displayMode} />
        </section>

        {/* Drawdown */}
        <section id="drawdown" className="scroll-mt-[var(--model-header-offset,96px)]">
          <DrawdownCard result={result} displayMode={displayMode} />
        </section>

        {/* Composition */}
        <section id="composition" className="scroll-mt-[var(--model-header-offset,96px)]">
          <CompositionCard config={config} turnover={result.turnover} />
        </section>

        {/* Sources de performance + Qualité des données */}
        <section
          id="sources-qualite"
          className="grid scroll-mt-[var(--model-header-offset,96px)] grid-cols-1 gap-4 lg:grid-cols-2"
        >
          <ContributionCard result={result} />
          <DataQualityCard config={config} />
        </section>
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
