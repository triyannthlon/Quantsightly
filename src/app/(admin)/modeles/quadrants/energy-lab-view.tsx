// Laboratoire Énergie — vue de l'onglet INTERNE gated (staging uniquement). Importé par
// quadrants-view.tsx (la frontière cliente) : pas de directive `"use client"` redondante.
//
// Compare, pour UNE stratégie (Continue / Régime), le socle « 4 Quadrants » (4q-standard-v2) à sa
// variante « 4 Quadrants + surcouche Énergie » (surcouche `energy-trend-v1`). La surcouche est une
// exposition TEMPORAIRE et CONDITIONNELLE, dérivée du socle — jamais un 5ᵉ pilier permanent.
//
// ⚠️ FENÊTRE COMMUNE : le socle couvre parfois un historique plus long que la variante Énergie.
// Toutes les métriques comparatives, l'« Apport Énergie » et le verdict sont recalculés sur la
// fenêtre STRICTEMENT commune (cf. `lab-window-metrics.ts`) — sinon on mélangerait l'effet de
// l'Énergie et l'effet d'années de marché supplémentaires. RESTITUTION PURE (aucun recalcul
// moteur). Ouvrir cet onglet ne change RIEN aux pages publiques. Aucun paramètre propriétaire.

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipBody,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FinalAllocation } from "@/lib/coredata/four-quadrants";
import type {
  EnergyLabComparison,
  EnergyLabVariant,
  EnergySignalState,
  SignalMonthState,
} from "@/lib/coredata/four-quadrants/energy-trend-v1/lab";
import {
  clipSeries,
  riskFreeFromMetrics,
  windowMetrics,
  windowTurnoverAnnualized,
  windowTurnoverTrailing12,
} from "@/lib/coredata/four-quadrants/energy-trend-v1/lab-window-metrics";
import { LAB_CRISIS_SLOTS } from "@/lib/coredata/four-quadrants/energy-trend-v1/lab-crises";
import type { ComparisonStrategyId } from "@/lib/coredata/model-comparison/types";
import type { HistoricalCrisisResult } from "@/lib/coredata/model-comparison/historical-stress/types";
import type { EconomicDataPoint } from "@/lib/coredata/types";
import { SLEEVE_META, drawdownSeries } from "./helpers";
import { SeriesChartCard, DrawdownKpiRow, type ChartSeries } from "../series-chart-card";
import { HistoricalCrisesSection } from "./historical-crises-section";

// ─── Constantes d'affichage ─────────────────────────────────────────────────────

/** Libellés PUBLICS des deux courbes (la stratégie active est rappelée dans la barre de résumé). */
const STANDARD_LABEL = "4 Quadrants";
const ENERGY_LABEL = "4 Quadrants + surcouche Énergie";

/** Couleurs des DEUX courbes comparées (contraste maximal, distinctes des poches). */
const VARIANT_COLOR = {
  standard: "#6C93C7", // socle (bleu)
  energy: "#E8833A", // socle + surcouche Énergie (orange accent produit)
} as const;

/** Poches affichées dans le labo : les 4 cœur + la 5ᵉ poche `energy` (onglet gated seulement). */
const LAB_ALLOC_KEYS = ["equities", "bonds", "gold", "cash", "energy"] as const;
type LabAllocKey = (typeof LAB_ALLOC_KEYS)[number];

/** Hypothèse de coûts pour l'estimation (identique au défaut de « 4Q vs Browne »). */
const LAB_COST_BPS = 25;

const SIGNAL_STATE_LABEL: Record<SignalMonthState, string> = {
  active: "Actif",
  inactive: "Inactif",
  unavailable: "Indisponible",
};
const signalCellClass: Record<SignalMonthState, string> = {
  active: "",
  inactive: "bg-muted-foreground/15",
  unavailable: "bg-muted-foreground/35",
};

type Verdict = "Favorable" | "Neutre" | "Défavorable";
const VERDICT_TONE: Record<Verdict, string> = {
  Favorable: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Neutre: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400",
  Défavorable: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

// ─── Formatters ─────────────────────────────────────────────────────────────────

const nf = (v: number, d = 1) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number | null, d = 1) => (v === null ? "—" : `${nf(v, d)} %`);
const ratio = (v: number | null, d = 2) => (v === null ? "—" : nf(v, d));
const signed = (v: number, unit: string, d = 1) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(Math.abs(v), d)}${unit ? ` ${unit}` : ""}`;

function formatMonthKey(ym: string): string {
  // Jour 15 (milieu de mois) : robuste à tout fuseau (jamais de bascule de mois à l'affichage).
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(
    new Date(`${ym.slice(0, 7)}-15`),
  );
}

/** Ton favorable / défavorable / neutre d'un écart selon le sens de la métrique. */
function deltaTone(d: number, higherBetter: boolean, negligible: boolean): string {
  if (negligible) return "text-muted-foreground";
  const good = higherBetter ? d > 0 : d < 0;
  return good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

/** Ratio de Calmar DÉRIVÉ (CAGR ÷ |max drawdown|, même série). `null` si non calculable. */
function calmarOf(annualized: number | null, maxDrawdown: number | null): number | null {
  if (annualized === null || maxDrawdown === null || maxDrawdown >= 0) return null;
  return annualized / Math.abs(maxDrawdown);
}

/** Courbe re-basée à 100 au mois d'ancrage (pour l'affichage sur la fenêtre commune). */
function rebaseAt(series: readonly EconomicDataPoint[], anchorMonth: string): EconomicDataPoint[] {
  const anchor = series.find((p) => p.date.slice(0, 7) === anchorMonth)?.value;
  if (!anchor || anchor <= 0) return series.map((p) => ({ ...p }));
  return series.map((p) => ({ date: p.date, value: (p.value / anchor) * 100 }));
}

// ─── Types internes ───────────────────────────────────────────────────────────

/** Métriques d'une variante SUR LA FENÊTRE COMMUNE (mode sélectionné). */
interface VariantMetrics {
  annualized: number | null;
  volatility: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  maxUnderwaterMonths: number | null;
  bestYear: number | null;
  worstYear: number | null;
  calmar: number | null;
  /** Rotation annualisée (fraction) sur la fenêtre commune. */
  turnover: number | null;
  /** Rotation sur 12 mois glissants (fraction). */
  turnoverTrailing12: number | null;
}

interface LabMetrics {
  standard: VariantMetrics;
  energy: VariantMetrics;
}

interface SignalStats {
  total: number;
  active: number;
  unavailable: number;
  activationRate: number;
  activations: number;
  deactivations: number;
  avgActiveRun: number;
  lastActivation: string | null;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[var(--model-header-offset,96px)] space-y-3">
      {title && (
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function VariantChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-foreground">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Libellé + infobulle SOMBRE partagée (icône « i ») — même environnement que le reste du module. */
function InfoLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Définition : ${label}`}
            className="cursor-help text-muted-foreground/60 hover:text-foreground"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72">
          <TooltipBody title={label}>{tip}</TooltipBody>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function CpiMissingCard() {
  return (
    <Card className="p-6 text-center text-sm text-muted-foreground">
      Indice des prix (CPI) local indisponible sur la période : la vue réelle ne peut pas être
      calculée. Basculez en mode nominal — l’état du signal et l’allocation restent affichés.
    </Card>
  );
}

const COMMON_WINDOW_TIP =
  "Calculé sur la fenêtre commune aux deux stratégies afin d’isoler l’apport de la surcouche Énergie.";

// ─── 1. Vue d'ensemble ───────────────────────────────────────────────────────

function VerdictCard({
  comparison,
  metrics,
}: {
  comparison: EnergyLabComparison;
  metrics: LabMetrics;
}) {
  const { standard: sm, energy: em } = metrics;
  const dRet =
    em.annualized !== null && sm.annualized !== null ? em.annualized - sm.annualized : null;
  const dDD =
    em.maxDrawdown !== null && sm.maxDrawdown !== null ? em.maxDrawdown - sm.maxDrawdown : null;
  const dTurn =
    em.turnover !== null && sm.turnover !== null ? (em.turnover - sm.turnover) * 100 : null;

  const dim = (d: number | null, higherBetter: boolean, thr: number): Verdict | null => {
    if (d === null) return null;
    const good = higherBetter ? d >= thr : d <= -thr;
    const bad = higherBetter ? d <= -thr : d >= thr;
    return good ? "Favorable" : bad ? "Défavorable" : "Neutre";
  };
  const rendement = dim(dRet, true, 0.25);
  const protection = dim(dDD, true, 0.5);
  const cout = dim(dTurn, false, 2);

  // Titre GLOBAL — toujours conditionnel (dépend du pays, de la stratégie, de la période, du mode).
  const headline =
    rendement === "Favorable" && protection === "Favorable"
      ? "Favorable sur la période analysée"
      : rendement === "Défavorable" && protection === "Défavorable"
        ? "Défavorable sur la période analysée"
        : "Contrasté sur la période analysée";
  const headlineTone: Verdict = headline.startsWith("Favorable")
    ? "Favorable"
    : headline.startsWith("Défavorable")
      ? "Défavorable"
      : "Neutre";

  const retPhrase =
    rendement === "Favorable"
      ? "améliore le rendement"
      : rendement === "Défavorable"
        ? "dégrade le rendement"
        : "laisse le rendement globalement inchangé";
  const protPhrase =
    protection === "Favorable"
      ? "renforce la protection contre les pertes"
      : protection === "Défavorable"
        ? "réduit la protection contre les pertes"
        : "laisse la protection contre les pertes globalement inchangée";
  const coutPhrase =
    cout === "Défavorable"
      ? "au prix d’une rotation sensiblement plus élevée"
      : cout === "Favorable"
        ? "avec une rotation plus faible"
        : "pour une rotation comparable";

  const sentence = `Sur ${comparison.countryFr ?? comparison.countryCode}, elle ${retPhrase} et ${protPhrase}, ${coutPhrase}.`;

  // Principal avantage : la dimension favorable la plus marquée (rendement / protection).
  let avantage = "Aucun apport net de rendement ou de protection sur la période.";
  const favs: { txt: string; mag: number }[] = [];
  if (dRet !== null && dRet > 0)
    favs.push({ txt: `rendement annualisé ${signed(dRet, "pt")}`, mag: dRet });
  if (dDD !== null && dDD > 0)
    favs.push({ txt: `baisse maximale réduite de ${nf(Math.abs(dDD), 1)} pts`, mag: dDD });
  if (favs.length) {
    favs.sort((a, b) => b.mag - a.mag);
    avantage = favs[0].txt.charAt(0).toUpperCase() + favs[0].txt.slice(1) + ".";
  }
  const coutTxt =
    dTurn !== null && dTurn > 0.05
      ? `Rotation ${signed(dTurn, "pt")}/an.`
      : "Rotation comparable au socle.";

  const dims: { label: string; verdict: Verdict | null }[] = [
    { label: "Rendement", verdict: rendement },
    { label: "Protection", verdict: protection },
    { label: "Coût de gestion", verdict: cout },
  ];

  return (
    <Card className="gap-3 border-primary/25 bg-gradient-to-b from-primary/[0.05] to-transparent p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-semibold tracking-wide text-primary uppercase">
          Apport de la surcouche Énergie
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-sm font-semibold",
            VERDICT_TONE[headlineTone],
          )}
        >
          {headline}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{sentence}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {dims.map((d) => (
          <div
            key={d.label}
            className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5"
          >
            <span className="text-sm font-medium">{d.label}</span>
            {d.verdict ? (
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-xs font-medium",
                  VERDICT_TONE[d.verdict],
                )}
              >
                {d.verdict}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <span className="text-xs text-muted-foreground">Principal avantage : </span>
          <span className="font-medium">{avantage}</span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Principal coût : </span>
          <span className="font-medium">{coutTxt}</span>
        </div>
      </div>
    </Card>
  );
}

interface DeltaCard {
  title: string;
  tip: string;
  standard: string;
  energy: string;
  delta: number | null;
  fmtDelta: (d: number) => string;
  higherBetter: boolean;
}

function DeltaKpiCards({ metrics }: { metrics: LabMetrics }) {
  const { standard: sm, energy: em } = metrics;
  const cards: DeltaCard[] = [
    {
      title: "Performance annualisée",
      tip: `Rendement annualisé (CAGR). L’écart mesure l’apport de la surcouche Énergie. ${COMMON_WINDOW_TIP}`,
      standard: pct(sm.annualized),
      energy: pct(em.annualized),
      delta:
        sm.annualized !== null && em.annualized !== null ? em.annualized - sm.annualized : null,
      fmtDelta: (d) => signed(d, "pt"),
      higherBetter: true,
    },
    {
      title: "Sharpe",
      tip: `Excédent de rendement sur le cash local rapporté à la volatilité. ${COMMON_WINDOW_TIP}`,
      standard: ratio(sm.sharpe),
      energy: ratio(em.sharpe),
      delta: sm.sharpe !== null && em.sharpe !== null ? em.sharpe - sm.sharpe : null,
      fmtDelta: (d) => signed(d, "", 2),
      higherBetter: true,
    },
    {
      title: "Baisse maximale",
      tip: `Pire perte du plus haut au plus bas (max drawdown). Un écart positif indique une meilleure limitation des pertes. ${COMMON_WINDOW_TIP}`,
      standard: pct(sm.maxDrawdown),
      energy: pct(em.maxDrawdown),
      delta:
        sm.maxDrawdown !== null && em.maxDrawdown !== null ? em.maxDrawdown - sm.maxDrawdown : null,
      fmtDelta: (d) => signed(d, "pt"),
      higherBetter: true,
    },
    {
      title: "Rotation du portefeuille",
      tip: `Part du portefeuille échangée en moyenne par an. L’activation conditionnelle de la surcouche augmente la rotation. ${COMMON_WINDOW_TIP}`,
      standard: pct(sm.turnover === null ? null : sm.turnover * 100),
      energy: pct(em.turnover === null ? null : em.turnover * 100),
      delta:
        sm.turnover !== null && em.turnover !== null ? (em.turnover - sm.turnover) * 100 : null,
      fmtDelta: (d) => signed(d, "pt"),
      higherBetter: false,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const negligible = c.delta === null || Math.abs(c.delta) < 0.05;
        return (
          <Card key={c.title} className="gap-1.5 p-4">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              <InfoLabel label={c.title} tip={c.tip} />
            </p>
            <dl className="mt-1 space-y-1 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{STANDARD_LABEL}</dt>
                <dd className="font-semibold tabular-nums">{c.standard}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="truncate text-muted-foreground">+ surcouche Énergie</dt>
                <dd className="font-semibold tabular-nums">{c.energy}</dd>
              </div>
            </dl>
            <div className="mt-1.5 border-t pt-1.5 text-sm">
              <span className="text-xs text-muted-foreground">Apport Énergie : </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  c.delta === null
                    ? "text-muted-foreground"
                    : deltaTone(c.delta, c.higherBetter, negligible),
                )}
              >
                {c.delta === null ? "—" : negligible ? "≈ neutre" : c.fmtDelta(c.delta)}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SignalStatusBadge({ status }: { status: SignalMonthState }) {
  const tone =
    status === "active"
      ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
      : status === "inactive"
        ? "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400"
        : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return (
    <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", tone)}>
      {SIGNAL_STATE_LABEL[status]}
    </span>
  );
}

/** Résumé compact du signal + allocation actuelle (Vue d'ensemble). */
function OverviewSignalAllocation({ comparison }: { comparison: EnergyLabComparison }) {
  const { signal } = comparison;
  const held = alloc5Percents(comparison.energy.backtest.heldAllocation);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">État du signal Énergie</h3>
          <SignalStatusBadge status={signal.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {signal.status === "active"
            ? "La tendance de l’indice Énergie est favorable : la surcouche est actuellement détenue."
            : signal.status === "inactive"
              ? "La tendance n’est pas suffisamment favorable : la surcouche n’est pas détenue."
              : "Donnée Énergie indisponible au dernier mois."}
        </p>
        <div className="text-xs text-muted-foreground">
          Dernier mois : {signal.lastMonth ? formatMonthKey(signal.lastMonth) : "—"} · Poids Énergie
          détenu {Math.round(signal.heldWeight * 100)} %
        </div>
      </Card>
      <Card className="gap-2 p-4">
        <h3 className="text-sm font-semibold">Allocation actuelle (avec Énergie)</h3>
        <AllocBar5 pcts={held} />
        <AllocValues5 pcts={held} />
      </Card>
    </div>
  );
}

// ─── 2. Signal et allocation ────────────────────────────────────────────────

function signalStats(history: EnergySignalState["history"]): SignalStats {
  const total = history.length;
  let active = 0;
  let unavailable = 0;
  let activations = 0;
  let deactivations = 0;
  let lastActivation: string | null = null;
  const runs: number[] = [];
  let prev: SignalMonthState | "" = "";
  let curRun = 0;
  for (const h of history) {
    if (h.state === "active") active++;
    if (h.state === "unavailable") unavailable++;
    if (h.state === "active") {
      if (prev !== "active") {
        activations++;
        lastActivation = h.date;
        curRun = 0;
      }
      curRun++;
    } else {
      if (prev === "active") {
        deactivations++;
        runs.push(curRun);
      }
    }
    prev = h.state;
  }
  if (prev === "active") runs.push(curRun);
  const avgActiveRun = runs.length ? runs.reduce((s, r) => s + r, 0) / runs.length : 0;
  return {
    total,
    active,
    unavailable,
    activationRate: total ? active / total : 0,
    activations,
    deactivations,
    avgActiveRun,
    lastActivation,
  };
}

function SignalSection({
  comparison,
  stats,
  window,
}: {
  comparison: EnergyLabComparison;
  stats: SignalStats;
  /** Fenêtre analysée (mois « YYYY-MM ») : mise en évidence sur la frise (le reste est atténué). */
  window: { start: string; end: string };
}) {
  const { signal } = comparison;
  const firstDate = signal.history[0]?.date ?? null;
  const lastDate = signal.history[stats.total - 1]?.date ?? null;
  // La frise garde TOUT l'historique du signal (jamais tronqué) ; les mois hors de la sous-période
  // analysée sont seulement atténués. `partial` = une vraie sous-période masque une partie de la frise.
  const inWindow = (date: string) => {
    const m = date.slice(0, 7);
    return m >= window.start && m <= window.end;
  };
  const partial = signal.history.some((h) => !inWindow(h.date));

  const stat = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-2">
      <span className="text-right whitespace-nowrap text-muted-foreground">{label} :</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">État du signal Énergie</h3>
          <SignalStatusBadge status={signal.status} />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {signal.status === "active"
            ? "La tendance de l’indice Énergie est actuellement favorable : la surcouche est détenue."
            : signal.status === "inactive"
              ? "La tendance n’est actuellement pas suffisamment favorable pour détenir l’indice Énergie."
              : "La donnée Énergie est indisponible au dernier mois analysé."}
        </p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {stat("Dernier mois analysé", signal.lastMonth ? formatMonthKey(signal.lastMonth) : "—")}
          {stat("Taux d’activation", `${Math.round(stats.activationRate * 100)} % des mois`)}
          {signal.reallocationRequired
            ? stat(
                "Poids Énergie",
                `détenu ${Math.round(signal.heldWeight * 100)} % · cible ${Math.round(signal.targetWeight * 100)} %`,
              )
            : stat("Poids Énergie", `${Math.round(signal.heldWeight * 100)} % (détenu = cible)`)}
          {stat(
            "Arbitrage nécessaire",
            signal.reallocationRequired ? "oui (détenu ≠ cible)" : "aucun",
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          La poche Énergie est activée de manière conditionnelle lorsque la tendance de l’indice
          Énergie devient favorable, puis financée au prorata des autres poches — c’est une
          exposition temporaire, jamais un pilier permanent.
        </p>
      </Card>

      <Card className="gap-0 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Historique du signal (mensuel)</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-[2px]"
                style={{ background: SLEEVE_META.energy.hex }}
              />
              Actif
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[2px] bg-muted-foreground/15" />
              Inactif
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[2px] bg-muted-foreground/35" />
              Indisponible
            </span>
          </div>
        </div>
        {stats.total > 0 ? (
          <>
            <div
              className="flex h-6 w-full overflow-hidden rounded"
              role="img"
              aria-label={`${stats.active} mois actifs sur ${stats.total}`}
            >
              {signal.history.map((h) => (
                <div
                  key={h.date}
                  className={cn(
                    "h-full flex-1",
                    signalCellClass[h.state],
                    partial && !inWindow(h.date) && "opacity-30",
                  )}
                  style={h.state === "active" ? { background: SLEEVE_META.energy.hex } : undefined}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{firstDate ? formatMonthKey(firstDate) : ""}</span>
              <span>{lastDate ? formatMonthKey(lastDate) : ""}</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{stats.active}</span> mois actifs sur{" "}
              {stats.total} ({Math.round(stats.activationRate * 100)} %)
              {stats.lastActivation
                ? ` · dernière activation ${formatMonthKey(stats.lastActivation)}`
                : ""}
              {stats.unavailable > 0 ? ` · ${stats.unavailable} mois sans donnée Énergie` : ""}.
              Frise jamais interpolée : un mois sans série reste marqué indisponible.
            </p>
            {partial && (
              <p className="mt-1 text-xs text-muted-foreground">
                Zone en pleine intensité = période analysée ({formatMonthKey(window.start)} –{" "}
                {formatMonthKey(window.end)}) ; l’historique antérieur reste affiché, atténué.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun historique de signal disponible.</p>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <AllocationCard
          variant={comparison.standard}
          label={STANDARD_LABEL}
          color={VARIANT_COLOR.standard}
        />
        <AllocationCard
          variant={comparison.energy}
          label={ENERGY_LABEL}
          color={VARIANT_COLOR.energy}
        />
      </div>
    </div>
  );
}

// ─── Allocation (5 poches) ──────────────────────────────────────────────────

function alloc5Percents(a: FinalAllocation): Record<LabAllocKey, number> {
  const raw = LAB_ALLOC_KEYS.map((k) => a[k] * 100);
  const out = raw.map((v) => Math.floor(v));
  const rest = 100 - out.reduce((s, v) => s + v, 0);
  const byFrac = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((x, y) => y.frac - x.frac);
  for (let n = 0; n < rest && n < byFrac.length; n++) out[byFrac[n].i] += 1;
  const result = {} as Record<LabAllocKey, number>;
  LAB_ALLOC_KEYS.forEach((k, i) => {
    result[k] = out[i];
  });
  return result;
}

const sameAlloc5 = (a: Record<LabAllocKey, number>, b: Record<LabAllocKey, number>): boolean =>
  LAB_ALLOC_KEYS.every((k) => a[k] === b[k]);

function AllocBar5({ pcts }: { pcts: Record<LabAllocKey, number> }) {
  const summary = LAB_ALLOC_KEYS.filter((k) => pcts[k] > 0)
    .map((k) => `${SLEEVE_META[k].label} ${pcts[k]} %`)
    .join(", ");
  return (
    <div className="flex h-3.5 w-full overflow-hidden rounded" role="img" aria-label={summary}>
      {LAB_ALLOC_KEYS.map((k) => {
        const w = pcts[k];
        if (w <= 0) return null;
        return (
          <Tooltip key={k}>
            <TooltipTrigger asChild>
              <div style={{ width: `${w}%`, background: SLEEVE_META[k].hex }} />
            </TooltipTrigger>
            <TooltipContent side="top">
              {SLEEVE_META[k].label} {w} %
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function AllocValues5({ pcts }: { pcts: Record<LabAllocKey, number> }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {LAB_ALLOC_KEYS.map((k) => (
        <span key={k} className="tabular-nums">
          <span
            className="mr-1 inline-block size-2 rounded-full align-middle"
            style={{ background: SLEEVE_META[k].hex }}
          />
          {SLEEVE_META[k].label} {pcts[k]} %
        </span>
      ))}
    </div>
  );
}

function AllocationCard({
  variant,
  label,
  color,
}: {
  variant: EnergyLabVariant;
  label: string;
  color: string;
}) {
  const held = alloc5Percents(variant.backtest.heldAllocation);
  const targetRaw = alloc5Percents(variant.backtest.targetAllocation);
  const target = sameAlloc5(held, targetRaw) ? null : targetRaw;
  return (
    <Card className="gap-2.5 p-4">
      <VariantChip label={label} color={color} />
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Allocation actuelle du modèle</p>
        <AllocBar5 pcts={held} />
        <AllocValues5 pcts={held} />
      </div>
      <div className="border-t pt-2">
        <p className="mb-1 text-xs text-muted-foreground">Allocation cible</p>
        {target ? (
          <>
            <AllocBar5 pcts={target} />
            <AllocValues5 pcts={target} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Identique à l’allocation actuelle</p>
        )}
      </div>
    </Card>
  );
}

// ─── 3. Performance (indicateurs + contributions) ───────────────────────────

interface IndicatorRow {
  label: string;
  tip: string;
  get: (m: VariantMetrics) => number | null;
  fmt: (v: number | null) => string;
  fmtDelta: (d: number) => string;
  higherBetter: boolean;
}

const PERF_ROWS: IndicatorRow[] = [
  {
    label: "Performance annualisée",
    tip: `Rendement annualisé géométrique (CAGR). ${COMMON_WINDOW_TIP}`,
    get: (m) => m.annualized,
    fmt: (v) => pct(v),
    fmtDelta: (d) => signed(d, "pt"),
    higherBetter: true,
  },
  {
    label: "Volatilité annualisée",
    tip: `Amplitude des variations mensuelles, annualisée. ${COMMON_WINDOW_TIP}`,
    get: (m) => m.volatility,
    fmt: (v) => pct(v),
    fmtDelta: (d) => signed(d, "pt"),
    higherBetter: false,
  },
  {
    label: "Sharpe",
    tip: `Excédent de rendement sur le cash local rapporté à la volatilité. ${COMMON_WINDOW_TIP}`,
    get: (m) => m.sharpe,
    fmt: (v) => ratio(v),
    fmtDelta: (d) => signed(d, "", 2),
    higherBetter: true,
  },
  {
    label: "Ratio de Calmar",
    tip: `Performance annualisée rapportée à la pire baisse (CAGR ÷ |max drawdown|). Dépend du chemin parcouru : à comparer sur des périodes identiques. ${COMMON_WINDOW_TIP}`,
    get: (m) => m.calmar,
    fmt: (v) => ratio(v),
    fmtDelta: (d) => signed(d, "", 2),
    higherBetter: true,
  },
  {
    label: "Meilleure année",
    tip: `Meilleure performance sur une année civile complète de la fenêtre commune. ${COMMON_WINDOW_TIP}`,
    get: (m) => m.bestYear,
    fmt: (v) => pct(v),
    fmtDelta: (d) => signed(d, "pt"),
    higherBetter: true,
  },
  {
    label: "Pire année",
    tip: `Pire performance sur une année civile complète de la fenêtre commune. ${COMMON_WINDOW_TIP}`,
    get: (m) => m.worstYear,
    fmt: (v) => pct(v),
    fmtDelta: (d) => signed(d, "pt"),
    higherBetter: true,
  },
];

function IndicatorTable({ metrics, rows }: { metrics: LabMetrics; rows: IndicatorRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className="sticky left-0 bg-background px-3 py-2 text-left font-medium text-muted-foreground">
              Indicateur
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              <span className="flex justify-end">
                <VariantChip label={STANDARD_LABEL} color={VARIANT_COLOR.standard} />
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              <span className="flex justify-end">
                <VariantChip label={ENERGY_LABEL} color={VARIANT_COLOR.energy} />
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-muted-foreground">
              Apport Énergie
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sv = r.get(metrics.standard);
            const ev = r.get(metrics.energy);
            const canDiff = sv !== null && ev !== null;
            const d = canDiff ? ev - sv : 0;
            const negligible =
              canDiff && r.fmtDelta(d).replace(/[^\d]/g, "").replace(/0/g, "") === "";
            return (
              <tr
                key={r.label}
                className="group border-b transition-colors last:border-0 hover:bg-muted/30"
              >
                <td className="sticky left-0 bg-background px-3 py-2 font-medium text-foreground group-hover:bg-muted/30">
                  <InfoLabel label={r.label} tip={r.tip} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.fmt(sv)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.fmt(ev)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right whitespace-nowrap tabular-nums",
                    !canDiff || negligible
                      ? "text-muted-foreground"
                      : deltaTone(d, r.higherBetter, false),
                  )}
                >
                  {!canDiff ? "—" : negligible ? "≈ identique" : r.fmtDelta(d)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const CONTRIB_TIP =
  "Les contributions additionnent les effets mensuels poids × rendement (nominal, sans look-ahead). Elles indiquent quelles poches ont porté la performance ; leur somme approche la performance cumulée, sans représenter directement la part du gain final capitalisé.";

function ContributionSection({ comparison }: { comparison: EnergyLabComparison }) {
  // La variante Énergie est déjà calculée sur la fenêtre commune → ses contributions sont
  // cohérentes avec les autres métriques. On montre ses sources de performance + la poche Énergie.
  const contrib = comparison.energy.backtest.contributions;
  const energyContribution = contrib.energy;
  const maxAbs = Math.max(1, ...LAB_ALLOC_KEYS.map((k) => Math.abs(contrib[k])));

  return (
    <div className="space-y-3">
      <Card className="gap-2 p-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold">Contribution de la poche Énergie</h3>
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            nominales
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="À propos des contributions"
                className="cursor-help text-muted-foreground/60 hover:text-foreground"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-80">
              <TooltipBody title="Contributions cumulées (nominales)">
                Les contributions sont calculées à partir des rendements NOMINAUX des poches. Le
                mode réel s’applique aux performances consolidées du portefeuille, pas à cette
                décomposition. {CONTRIB_TIP}
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {`${energyContribution >= 0 ? "+" : "−"}${nf(Math.abs(energyContribution), 1)} pts`}
        </div>
        <p className="text-xs text-muted-foreground">
          Contribution cumulée (nominale) de la poche Énergie à la performance de la variante «{" "}
          {ENERGY_LABEL} », sur la fenêtre commune.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold">Sources de performance (avec Énergie)</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Contributions cumulées (nominales) de chaque poche. La poche Énergie est financée au
          prorata des quatre poches cœur.
        </p>
        <div className="space-y-2.5">
          {LAB_ALLOC_KEYS.map((k) => {
            const v = contrib[k];
            return (
              <div key={k} className="grid grid-cols-[6rem_1fr_5rem] items-center gap-2.5 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: SLEEVE_META[k].hex }}
                  />
                  {SLEEVE_META[k].label}
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(Math.abs(v) / maxAbs) * 100}%`,
                      backgroundColor: SLEEVE_META[k].hex,
                    }}
                  />
                </span>
                <span className="text-right font-medium tabular-nums">
                  {`${v >= 0 ? "+" : "−"}${nf(Math.abs(v), 1)} pts`}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── 5. Coûts et rotation ────────────────────────────────────────────────────

/** Coût annuel estimé (%) à partir de la rotation annualisée (fraction) et d'une hypothèse de bps. */
function annualCostPct(turnover: number | null): number | null {
  return turnover === null ? null : turnover * 2 * (LAB_COST_BPS / 10000) * 100;
}

function CostsSection({ metrics, stats }: { metrics: LabMetrics; stats: SignalStats }) {
  const rows: { label: string; tip: string; s: number | null; e: number | null; d2?: number }[] = [
    {
      label: "Rotation annualisée",
      tip: `Part du portefeuille échangée en moyenne par an (transactions exécutées). ${COMMON_WINDOW_TIP}`,
      s: metrics.standard.turnover === null ? null : metrics.standard.turnover * 100,
      e: metrics.energy.turnover === null ? null : metrics.energy.turnover * 100,
    },
    {
      label: "Rotation sur 12 mois glissants",
      tip: "Somme des rotations mensuelles des 12 derniers mois.",
      s:
        metrics.standard.turnoverTrailing12 === null
          ? null
          : metrics.standard.turnoverTrailing12 * 100,
      e:
        metrics.energy.turnoverTrailing12 === null ? null : metrics.energy.turnoverTrailing12 * 100,
    },
    {
      label: `Coût annuel estimé (à ${LAB_COST_BPS} bps)`,
      tip: `Rotation annualisée × 2 × ${LAB_COST_BPS} bps. Estimation ; n’inclut ni spread ni glissement. ${COMMON_WINDOW_TIP}`,
      s: annualCostPct(metrics.standard.turnover),
      e: annualCostPct(metrics.energy.turnover),
    },
  ];
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[440px] text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Rotation et coûts
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                <span className="flex justify-end">
                  <VariantChip label={STANDARD_LABEL} color={VARIANT_COLOR.standard} />
                </span>
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                <span className="flex justify-end">
                  <VariantChip label={ENERGY_LABEL} color={VARIANT_COLOR.energy} />
                </span>
              </th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-muted-foreground">
                Écart
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const canDiff = r.s !== null && r.e !== null;
              const d = canDiff ? r.e! - r.s! : 0;
              const negligible = canDiff && Math.abs(d) < 0.05;
              const decimals = r.label.startsWith("Coût") ? 2 : 1;
              return (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">
                    <InfoLabel label={r.label} tip={r.tip} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(r.s, decimals)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(r.e, decimals)}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right whitespace-nowrap tabular-nums",
                      !canDiff || negligible ? "text-muted-foreground" : deltaTone(d, false, false),
                    )}
                  >
                    {!canDiff ? "—" : negligible ? "≈ identique" : signed(d, "pt", decimals)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Card className="gap-2 p-4">
        <h3 className="text-sm font-semibold">Activité de la surcouche</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Activations</span>
            <span className="font-medium tabular-nums">{stats.activations}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Désactivations</span>
            <span className="font-medium tabular-nums">{stats.deactivations}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Durée moyenne active</span>
            <span className="font-medium tabular-nums">
              {stats.avgActiveRun > 0 ? `${nf(stats.avgActiveRun, 0)} mois` : "—"}
            </span>
          </div>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Chaque activation et désactivation de la surcouche génère de la rotation supplémentaire par
        rapport au socle. Ce surcroît de rotation est un coût à mettre en regard de l’apport de
        performance et de la réduction éventuelle des pertes.
      </p>
    </div>
  );
}

// ─── 6. Méthodologie ─────────────────────────────────────────────────────────

function MethodologySection({ window }: { window: { start: string; end: string } | null }) {
  const block = (title: string, body: React.ReactNode) => (
    <Card className="gap-1.5 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Card>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {block(
          "Ce que compare ce laboratoire",
          <>
            Pour une même stratégie 4 Quadrants, il oppose le socle de référence à une variante
            enrichie d’une <em>surcouche Énergie</em>. Objectif : mesurer l’apport marginal de cette
            surcouche
            {window
              ? ` sur la fenêtre commune ${formatMonthKey(window.start)} – ${formatMonthKey(window.end)}`
              : ""}
            , à mêmes dates, même pays, même devise et même mode d’analyse.
          </>,
        )}
        {block(
          "La surcouche Énergie",
          "Une exposition mondiale aux matières premières énergétiques via un indice à rendement total (roll inclus). Ce n’est ni un panier d’actions pétrolières, ni un secteur boursier Énergie, ni un prix spot. Le modèle 4 Quadrants reste fondé sur quatre poches ; l’Énergie est une exposition temporaire qui s’y ajoute, pas un cinquième pilier permanent.",
        )}
        {block(
          "Activation conditionnelle",
          "La surcouche est activée lorsque la tendance de l’indice Énergie devient favorable, et désactivée sinon. Lorsqu’elle est détenue, elle est financée au prorata des autres poches, de sorte que l’allocation reste entièrement investie.",
        )}
        {block(
          "Fenêtre commune et portée",
          "Toutes les métriques comparatives sont recalculées sur la fenêtre commune aux deux stratégies : l’historique antérieur éventuellement disponible pour le modèle de référence est exclu des écarts comparatifs. Environnement de recherche interne : la surcouche n’est jamais active sur les pages publiques, qui restent le socle 4q-standard-v2.",
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Les paramètres exacts de la règle d’activation (fenêtre de tendance, seuils, pondération,
        financement) relèvent de la recherche interne et ne sont pas exposés.
      </p>
    </div>
  );
}

// ─── Crises ──────────────────────────────────────────────────────────────────

function LabCrisesSection({
  results,
  commonWindow,
}: {
  results: HistoricalCrisisResult[];
  commonWindow: { start: string; end: string } | null;
}) {
  // Emplacements d'affichage opaques → libellés/couleurs du labo (cf. lab-crises.ts). La section
  // partagée ne branche jamais sur la valeur de l'identifiant : cast contenu et sûr.
  const labels = {
    [LAB_CRISIS_SLOTS.standard]: STANDARD_LABEL,
    [LAB_CRISIS_SLOTS.energy]: ENERGY_LABEL,
  } as Record<ComparisonStrategyId, string>;
  const colors = {
    [LAB_CRISIS_SLOTS.standard]: VARIANT_COLOR.standard,
    [LAB_CRISIS_SLOTS.energy]: VARIANT_COLOR.energy,
  } as Record<ComparisonStrategyId, string>;
  const visibleIds: ComparisonStrategyId[] = [LAB_CRISIS_SLOTS.standard, LAB_CRISIS_SLOTS.energy];
  return (
    <HistoricalCrisesSection
      results={results}
      visibleIds={visibleIds}
      labels={labels}
      colors={colors}
      commonWindow={commonWindow}
    />
  );
}

// ─── Vue principale ─────────────────────────────────────────────────────────────

export function EnergyLabView({
  comparison,
  crises,
  mode,
}: {
  comparison: EnergyLabComparison;
  crises: {
    nominal: HistoricalCrisisResult[] | null;
    real: HistoricalCrisisResult[] | null;
  };
  mode: "nominal" | "real";
}) {
  const hasReal =
    comparison.standard.backtest.series.real != null &&
    comparison.energy.backtest.series.real != null;
  const real = mode === "real" && hasReal;
  const cpiMissing = mode === "real" && !hasReal;

  // Fenêtre STRICTEMENT commune (la variante Énergie est la plus limitante : elle exige la donnée
  // Énergie + le signal exécutable). On intersecte par sécurité.
  const stdStartM = comparison.standard.backtest.start.slice(0, 7);
  const enStartM = comparison.energy.backtest.start.slice(0, 7);
  const stdEndM = comparison.standard.backtest.end.slice(0, 7);
  const enEndM = comparison.energy.backtest.end.slice(0, 7);
  const winStart = stdStartM > enStartM ? stdStartM : enStartM;
  const winEnd = stdEndM < enEndM ? stdEndM : enEndM;
  const needsRewindow = stdStartM !== winStart || stdEndM !== winEnd;
  const commonWindow = { start: winStart, end: winEnd };

  // Métriques des DEUX variantes sur la fenêtre commune (mode sélectionné). `null` si CPI absent.
  const metrics: LabMetrics | null = useMemo(() => {
    if (cpiMissing) return null;
    const em = real
      ? comparison.energy.backtest.metrics.real!
      : comparison.energy.backtest.metrics.nominal;
    const stdBase = real
      ? comparison.standard.backtest.metrics.real!
      : comparison.standard.backtest.metrics.nominal;
    const stdSeries = real
      ? comparison.standard.backtest.series.real!
      : comparison.standard.backtest.series.nominal;
    const riskFree = riskFreeFromMetrics(em);
    // Socle : métriques moteur si la fenêtre coïncide déjà, sinon re-fenêtré sur la fenêtre commune.
    const stdSrc = needsRewindow ? windowMetrics(stdSeries, winStart, winEnd, riskFree) : stdBase;
    const build = (
      m: {
        annualized: number | null;
        volatility: number | null;
        sharpe: number | null;
        maxDrawdown: number | null;
        maxUnderwaterMonths: number | null;
        bestYear: number | null;
        worstYear: number | null;
      },
      variant: EnergyLabVariant,
    ): VariantMetrics => ({
      annualized: m.annualized,
      volatility: m.volatility,
      sharpe: m.sharpe,
      maxDrawdown: m.maxDrawdown,
      maxUnderwaterMonths: m.maxUnderwaterMonths,
      bestYear: m.bestYear,
      worstYear: m.worstYear,
      calmar: calmarOf(m.annualized, m.maxDrawdown),
      turnover: windowTurnoverAnnualized(variant.backtest.turnover.monthly, winStart, winEnd),
      turnoverTrailing12: windowTurnoverTrailing12(variant.backtest.turnover.monthly, winEnd),
    });
    return {
      standard: build(stdSrc, comparison.standard),
      energy: build(em, comparison.energy),
    };
  }, [comparison, real, cpiMissing, needsRewindow, winStart, winEnd]);

  // Courbes de performance (base 100 au DÉBUT DE LA FENÊTRE COMMUNE) + historique antérieur optionnel.
  const perfSeries: ChartSeries[] = useMemo(() => {
    if (cpiMissing) return [];
    const stdSeries = real
      ? comparison.standard.backtest.series.real!
      : comparison.standard.backtest.series.nominal;
    const enSeries = real
      ? comparison.energy.backtest.series.real!
      : comparison.energy.backtest.series.nominal;
    const stdReb = rebaseAt(stdSeries, winStart);
    const enReb = rebaseAt(enSeries, winStart);
    const series: ChartSeries[] = [
      {
        id: "standard",
        label: STANDARD_LABEL,
        color: VARIANT_COLOR.standard,
        data: clipSeries(stdReb, winStart, winEnd),
        width: 2,
      },
      {
        id: "energy",
        label: ENERGY_LABEL,
        color: VARIANT_COLOR.energy,
        data: clipSeries(enReb, winStart, winEnd),
        width: 2.4,
      },
    ];
    if (needsRewindow) {
      series.push({
        id: "standard-history",
        label: "Historique antérieur du socle",
        color: VARIANT_COLOR.standard,
        data: clipSeries(stdReb, stdStartM, winStart),
        dashed: true,
        width: 1.4,
      });
    }
    return series;
  }, [comparison, real, cpiMissing, needsRewindow, winStart, winEnd, stdStartM]);
  const perfMonths = perfSeries.reduce((m, s) => Math.max(m, s.data.length), 0);

  // Drawdowns sur la fenêtre commune (le sommet de référence repart au début de la fenêtre).
  const { drawSeries, floor } = useMemo(() => {
    if (cpiMissing) return { drawSeries: [] as ChartSeries[], floor: -10 };
    const stdSeries = real
      ? comparison.standard.backtest.series.real!
      : comparison.standard.backtest.series.nominal;
    const enSeries = real
      ? comparison.energy.backtest.series.real!
      : comparison.energy.backtest.series.nominal;
    const sDD = drawdownSeries(clipSeries(stdSeries, winStart, winEnd));
    const eDD = drawdownSeries(clipSeries(enSeries, winStart, winEnd));
    let worst = 0;
    for (const p of [...sDD, ...eDD]) if (p.value < worst) worst = p.value;
    const series: ChartSeries[] = [
      {
        id: "standard",
        label: STANDARD_LABEL,
        color: VARIANT_COLOR.standard,
        data: sDD,
        width: 2,
        fillOpacity: 0.16,
      },
      {
        id: "energy",
        label: ENERGY_LABEL,
        color: VARIANT_COLOR.energy,
        data: eDD,
        width: 2.4,
        fillOpacity: 0.16,
      },
    ];
    return { drawSeries: series, floor: Math.min(-5, Math.floor(worst / 10) * 10) };
  }, [comparison, real, cpiMissing, winStart, winEnd]);

  const stats = useMemo(() => signalStats(comparison.signal.history), [comparison.signal.history]);

  const activeCrises = real ? crises.real : crises.nominal;
  const modeLabel = real ? "réelle" : "nominale";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8">
        {/* Bandeau contexte + fenêtre comparative (UN SEUL bandeau expérimental persistant) */}
        <div className="space-y-2">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Laboratoire interne — cette variante n’affecte jamais les pages publiques ni le modèle 4
            Quadrants de référence.
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Période comparative :{" "}
              <span className="font-medium text-foreground">
                {formatMonthKey(winStart)} – {formatMonthKey(winEnd)}
              </span>{" "}
              — les deux stratégies et toutes leurs métriques sont recalculées sur cette période.
            </span>
            <span>
              Performance {modeLabel}, devise locale ({comparison.currency})
            </span>
          </div>
        </div>

        {/* 1. Vue d'ensemble */}
        <Section
          id="apercu"
          title="Vue d’ensemble"
          subtitle="Verdict synthétique de l’apport de la surcouche Énergie, sur la sélection courante."
        >
          {cpiMissing || !metrics ? (
            <CpiMissingCard />
          ) : (
            <div className="space-y-3">
              <VerdictCard comparison={comparison} metrics={metrics} />
              <DeltaKpiCards metrics={metrics} />
              <OverviewSignalAllocation comparison={comparison} />
            </div>
          )}
        </Section>

        {/* 2. Signal et allocation */}
        <Section
          id="signal-allocation"
          title="Signal et allocation"
          subtitle="État courant, historique mensuel du signal et allocations détenues / cibles des deux variantes."
        >
          <SignalSection comparison={comparison} stats={stats} window={commonWindow} />
        </Section>

        {/* 3. Performance */}
        <Section
          id="performance"
          title="Performance"
          subtitle="Courbe comparative, indicateurs de performance et sources de performance sur la fenêtre commune."
        >
          {cpiMissing || !metrics ? (
            <CpiMissingCard />
          ) : (
            <div className="space-y-4">
              <SeriesChartCard
                title="Performance cumulée"
                subtitle="Base 100 au début de la période comparative."
                series={perfSeries}
                defaultHidden={["standard-history"]}
                scaleToggle
                defaultScale={perfMonths > 120 ? "log" : "linear"}
                cumulativeTooltip
                height={360}
              />
              {needsRewindow && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  Le socle dispose d’un historique antérieur ({formatMonthKey(stdStartM)} –{" "}
                  {formatMonthKey(winStart)}) exclu des écarts comparatifs. Activez « Historique
                  antérieur du socle » dans la légende du graphe pour l’afficher en pointillé.
                </p>
              )}
              <IndicatorTable metrics={metrics} rows={PERF_ROWS} />
              <ContributionSection comparison={comparison} />
            </div>
          )}
        </Section>

        {/* 4. Risque et crises */}
        <Section
          id="risque"
          title="Risque et crises"
          subtitle="Baisses depuis les sommets et comportement pendant les crises documentées, sur la fenêtre commune."
        >
          {cpiMissing || !metrics ? (
            <CpiMissingCard />
          ) : (
            <div className="space-y-4">
              <SeriesChartCard
                title="Baisses depuis les sommets"
                subtitle="Recul par rapport au plus haut précédemment atteint, sur la période comparative."
                series={drawSeries}
                kpis={
                  <DrawdownKpiRow
                    blocks={[
                      {
                        label: STANDARD_LABEL,
                        color: VARIANT_COLOR.standard,
                        maxDrawdown: metrics.standard.maxDrawdown,
                        underwaterMonths: metrics.standard.maxUnderwaterMonths,
                      },
                      {
                        label: ENERGY_LABEL,
                        color: VARIANT_COLOR.energy,
                        maxDrawdown: metrics.energy.maxDrawdown,
                        underwaterMonths: metrics.energy.maxUnderwaterMonths,
                      },
                    ]}
                    delta={{
                      refLabel: STANDARD_LABEL,
                      maxDrawdown:
                        metrics.standard.maxDrawdown !== null && metrics.energy.maxDrawdown !== null
                          ? metrics.energy.maxDrawdown - metrics.standard.maxDrawdown
                          : null,
                      underwaterMonths:
                        metrics.standard.maxUnderwaterMonths !== null &&
                        metrics.energy.maxUnderwaterMonths !== null
                          ? metrics.energy.maxUnderwaterMonths -
                            metrics.standard.maxUnderwaterMonths
                          : null,
                    }}
                  />
                }
                areaFill
                percentTooltip
                yDomain={[floor, 0]}
                height={280}
              />
              <div>
                <h3 className="mb-1 text-base font-semibold">Comportement pendant les crises</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Socle vs socle + surcouche Énergie pendant des crises financières et
                  macroéconomiques documentées, entièrement couvertes par la période comparative.
                </p>
                {activeCrises ? (
                  <LabCrisesSection results={activeCrises} commonWindow={commonWindow} />
                ) : (
                  <Card className="p-6 text-center text-sm text-muted-foreground">
                    Aucune crise mesurable sur cette sélection.
                  </Card>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* 5. Coûts et rotation */}
        <Section
          id="couts"
          title="Coûts et rotation"
          subtitle="Le surcroît de rotation induit par l’activation de la surcouche fait partie du résultat."
        >
          {cpiMissing || !metrics ? (
            <CpiMissingCard />
          ) : (
            <CostsSection metrics={metrics} stats={stats} />
          )}
        </Section>

        {/* 6. Méthodologie */}
        <Section id="methodologie" title="Méthodologie">
          <MethodologySection window={commonWindow} />
        </Section>
      </div>
    </TooltipProvider>
  );
}

/** Sections de navigation interne (scrollspy) de l'onglet Énergie. */
export const ENERGY_LAB_SECTIONS = [
  { id: "apercu", label: "Vue d’ensemble" },
  { id: "signal-allocation", label: "Signal et allocation" },
  { id: "performance", label: "Performance" },
  { id: "risque", label: "Risque et crises" },
  { id: "couts", label: "Coûts et rotation" },
  { id: "methodologie", label: "Méthodologie" },
];
