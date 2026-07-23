// Pas de directive client en tête ici : ce composant est importé uniquement par
// quadrants-view.tsx (qui EST la frontière cliente), il est donc compilé côté client
// via son parent. Une directive redondante créerait une frontière imbriquée.

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipBody,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  SLEEVE_META,
  ALLOC_KEYS,
  roundedAllocPercents,
  resolveTargetPercents,
  strategiesWithAllocation,
  type AllocKey,
} from "./helpers";
import {
  SeriesChartCard,
  DrawdownKpiRow,
  type ChartSeries,
  type DrawdownKpiBlock,
  type DrawdownKpiDelta,
} from "../series-chart-card";
// ⚠️ Sous-modules PURS uniquement (types + constantes) : ce composant CLIENT ne doit
// PAS tirer le moteur `model-comparison` ni `browne.ts` dans le bundle client.
import type {
  ComparisonStrategyId,
  ComparisonStrategyResult,
  ComparisonMetrics,
  ModelComparisonResult,
} from "@/lib/coredata/model-comparison/types";
import { UNAVAILABLE_REASON_FR } from "@/lib/coredata/model-comparison/types";
import { ROLLING_WINDOWS_YEARS } from "@/lib/coredata/model-comparison/constants";
import type { HistoricalCrisisResult } from "@/lib/coredata/model-comparison/historical-stress/types";
import { HistoricalCrisesSection } from "./historical-crises-section";
// Sous-module PUR (type-only + fonctions, aucun moteur) : dérivation d'affichage du Calmar.
import { calmar, calmarUnavailableReason } from "@/lib/coredata/model-comparison/calmar";

// Filtre d'AFFICHAGE (n'altère jamais les calculs — cf. §6).
export type ComparisonFilter = "all" | "dyn_browne" | "bin_browne" | "dyn_bin";

const FILTER_IDS: Record<ComparisonFilter, ComparisonStrategyId[]> = {
  all: ["browne", "quadrants-dynamic-v2", "quadrants-binary-v2"],
  dyn_browne: ["browne", "quadrants-dynamic-v2"],
  bin_browne: ["browne", "quadrants-binary-v2"],
  dyn_bin: ["quadrants-dynamic-v2", "quadrants-binary-v2"],
};

/** Question éditoriale propre à chaque paire (§10). */
const PAIR_QUESTION: Record<Exclude<ComparisonFilter, "all">, string> = {
  dyn_browne:
    "L’adaptation continue au régime macroéconomique apporte-t-elle un avantage par rapport à une allocation permanente ?",
  bin_browne:
    "Une allocation plus concentrée par régime améliore-t-elle suffisamment la performance pour compenser ses changements plus marqués ?",
  dyn_bin:
    "La continuité de l’allocation est-elle préférable à une sélection plus tranchée des actifs ?",
};

const STRATEGY_COLOR: Record<ComparisonStrategyId, string> = {
  browne: "#6C93C7", // bleu
  "quadrants-dynamic-v2": "#E8833A", // orange (accent produit)
  "quadrants-binary-v2": "#4FB6A0", // sarcelle
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const nf = (v: number, d = 1) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number | null, d = 1) => (v === null ? "—" : `${nf(v, d)} %`);
const ratio = (v: number | null, d = 2) => (v === null ? "—" : nf(v, d));
const months = (v: number | null) => (v === null ? "—" : `${Math.round(v)} mois`);
const perYear = (v: number | null, d = 1) => (v === null ? "—" : `${nf(v, d)}/an`);
const signed = (v: number, unit: string, d = 1) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(Math.abs(v), d)} ${unit}`;

// ─── Définition des lignes de métriques ───────────────────────────────────────

type MetricKey = keyof ComparisonMetrics;

interface MetricRow {
  key: MetricKey | "calmar";
  label: string;
  fmt: (v: number | null) => string;
  higherBetter: boolean;
  /** Formatte l'écart (déjà en unité de la métrique). */
  diff: (d: number) => string;
  tip: string;
  /**
   * Valeur DÉRIVÉE optionnelle, calculée à partir des métriques déjà présentes (aucun
   * nouveau calcul moteur). Si absente, la valeur est lue directement via `key`.
   */
  get?: (m: ComparisonMetrics) => number | null;
  /**
   * Raison d'indisponibilité (infobulle + `aria-label`) quand la valeur est `null` : la
   * cellule reste « — » mais explique POURQUOI. `null` = pas d'explication particulière.
   */
  unavailableReason?: (m: ComparisonMetrics) => string | null;
}

const ROW: Record<string, MetricRow> = {
  annualized: {
    key: "annualized",
    label: "Performance annualisée",
    fmt: (v) => pct(v),
    higherBetter: true,
    diff: (d) => signed(d, "pt"),
    tip: "Rendement annualisé géométrique (CAGR) net de coûts sur la période.",
  },
  volatility: {
    key: "volatility",
    label: "Volatilité annualisée",
    fmt: (v) => pct(v),
    higherBetter: false,
    diff: (d) => signed(d, "pt"),
    tip: "Amplitude générale des variations mensuelles, annualisée.",
  },
  sharpe: {
    key: "sharpe",
    label: "Sharpe",
    fmt: (v) => ratio(v),
    higherBetter: true,
    diff: (d) => signed(d, "", 2),
    tip: "Excédent de rendement sur le cash local, rapporté à la volatilité. Un critère parmi d’autres.",
  },
  sortino: {
    key: "sortino",
    label: "Sortino",
    fmt: (v) => ratio(v),
    higherBetter: true,
    diff: (d) => signed(d, "", 2),
    tip: "Rendement rapporté à la seule volatilité baissière (pertes).",
  },
  calmar: {
    key: "calmar",
    label: "Ratio de Calmar",
    // Dérivé (CAGR net ÷ |max drawdown|, même série) : cf. `calmar()`. La cellule affiche
    // « — » quand il n'est pas calculable ; la RAISON est portée par l'infobulle + aria.
    get: (m) => {
      const c = calmar(m);
      return c.kind === "ok" ? c.value : null;
    },
    unavailableReason: (m) => {
      const c = calmar(m);
      return c.kind === "ok" ? null : calmarUnavailableReason(c);
    },
    fmt: (v) => ratio(v),
    higherBetter: true,
    diff: (d) => signed(d, "", 2),
    tip: "Le ratio de Calmar compare la performance annualisée à la pire baisse observée. Plus il est élevé, plus la performance obtenue est importante au regard du max drawdown.",
  },
  maxDrawdown: {
    key: "maxDrawdown",
    label: "Max drawdown",
    fmt: (v) => pct(v),
    higherBetter: true,
    diff: (d) => signed(d, "pt"),
    tip: "Pire perte du pic au creux sur la période.",
  },
  maxUnderwaterMonths: {
    key: "maxUnderwaterMonths",
    label: "Durée maximale sous l’eau",
    fmt: (v) => months(v),
    higherBetter: false,
    diff: (d) => signed(d, "mois", 0),
    tip: "Plus longue période passée sous un sommet avant d’y revenir.",
  },
  worstRolling12m: {
    key: "worstRolling12m",
    label: "Pire 12 mois glissants",
    fmt: (v) => pct(v),
    higherBetter: true,
    diff: (d) => signed(d, "pt"),
    tip: "Pire performance observée sur une fenêtre de 12 mois consécutifs.",
  },
  annualizedTurnover: {
    key: "annualizedTurnover",
    label: "Rotation annualisée",
    fmt: (v) => pct(v === null ? null : v * 100),
    higherBetter: false,
    diff: (d) => signed(d * 100, "pt"),
    tip: "Part du portefeuille échangée en moyenne par an (transactions exécutées).",
  },
  reallocationsPerYear: {
    key: "reallocationsPerYear",
    label: "Fréquence de réallocation",
    fmt: (v) => perYear(v),
    higherBetter: false,
    diff: (d) => signed(d, "/an"),
    tip: "Nombre moyen de mois par an où le portefeuille est effectivement réajusté.",
  },
  cumulativeCost: {
    key: "cumulativeCost",
    label: "Coûts cumulés",
    fmt: (v) => pct(v, 2),
    higherBetter: false,
    diff: (d) => signed(d, "pt", 2),
    tip: "Coûts de transaction cumulés sur la période, sous l’hypothèse de coûts retenue.",
  },
  worstMonth: {
    key: "worstMonth",
    label: "Pire mois",
    fmt: (v) => pct(v),
    higherBetter: true,
    diff: (d) => signed(d, "pt"),
    tip: "Pire rendement mensuel observé.",
  },
  worstQuarter: {
    key: "worstQuarter",
    label: "Pire trimestre",
    fmt: (v) => pct(v),
    higherBetter: true,
    diff: (d) => signed(d, "pt"),
    tip: "Pire rendement sur 3 mois consécutifs.",
  },
  expectedShortfall95: {
    key: "expectedShortfall95",
    label: "Expected Shortfall 95 %",
    fmt: (v) => pct(v),
    higherBetter: true,
    diff: (d) => signed(d, "pt"),
    tip: "Perte moyenne des 5 % de pires mois (sans hypothèse de loi normale).",
  },
  expectedShortfall99: {
    key: "expectedShortfall99",
    label: "Expected Shortfall 99 %",
    fmt: (v) => pct(v),
    higherBetter: true,
    diff: (d) => signed(d, "pt"),
    tip: "Perte moyenne des 1 % de pires mois.",
  },
  downsideDeviation: {
    key: "downsideDeviation",
    label: "Downside deviation",
    fmt: (v) => pct(v),
    higherBetter: false,
    diff: (d) => signed(d, "pt"),
    tip: "Volatilité des seuls rendements négatifs, annualisée.",
  },
  skewness: {
    key: "skewness",
    label: "Asymétrie (skewness)",
    fmt: (v) => ratio(v),
    higherBetter: true,
    diff: (d) => signed(d, "", 2),
    tip: "Asymétrie des rendements : négative = pertes plus marquées.",
  },
  excessKurtosis: {
    key: "excessKurtosis",
    label: "Kurtosis excédentaire",
    fmt: (v) => ratio(v),
    higherBetter: false,
    diff: (d) => signed(d, "", 2),
    tip: "Épaisseur des queues : plus élevé = événements extrêmes plus fréquents.",
  },
  annualCostEstimate: {
    key: "annualCostEstimate",
    label: "Coûts annualisés estimés",
    fmt: (v) => pct(v, 2),
    higherBetter: false,
    diff: (d) => signed(d, "pt", 2),
    tip: "Coût de transaction moyen par an sous l’hypothèse retenue.",
  },
};

// ─── Primitives d'affichage ───────────────────────────────────────────────────

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

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-3 py-2 text-left font-medium text-muted-foreground", className)}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 tabular-nums", className)}>{children}</td>;
}

/** Pastille de couleur + libellé de stratégie. */
function StrategyChip({ s }: { s: ComparisonStrategyResult }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-foreground">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: STRATEGY_COLOR[s.id] }}
      />
      {s.label}
    </span>
  );
}

/**
 * Ton (favorable / défavorable / neutre) d'un écart selon le sens de la métrique.
 * `soft` = variante moins contrastée (écart secondaire, mode « toutes »).
 * `negligible` = écart nul à l'affichage → neutre (cf. §5).
 */
function diffTone(
  d: number,
  higherBetter: boolean,
  opts?: { negligible?: boolean; soft?: boolean },
): string {
  if (opts?.negligible || Math.abs(d) < 1e-9) return "text-muted-foreground";
  const good = higherBetter ? d > 0 : d < 0;
  if (opts?.soft) {
    return good
      ? "text-emerald-600/70 dark:text-emerald-400/70"
      : "text-red-600/70 dark:text-red-400/70";
  }
  return good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

/** Nom court d'une stratégie pour les en-têtes d'écart (« 4Q Continue » → « Continue »). */
const shortLabel = (s: ComparisonStrategyResult) => s.label.replace(/^4Q\s+/, "");

/**
 * L'écart est-il négligeable À L'AFFICHAGE ? On le formate via `row.diff` (mêmes
 * arrondis et unité que la cellule) et on regarde si la magnitude ne contient que
 * des zéros — évite de colorer « +0,0 pt » en vert/rouge (cf. §5).
 */
function diffIsNegligible(row: MetricRow, d: number): boolean {
  const digits = row.diff(d).replace(/[^\d]/g, "");
  return digits.length > 0 && /^0+$/.test(digits);
}

type MetricGroup = { label?: string; rows: MetricRow[] };

/**
 * Libellé de métrique + infobulle SOMBRE partagée (icône « i » → `TooltipBody`). Même
 * environnement que « 4 Quadrants vs Actions » : définitions identiques, tooltip unique.
 */
function MetricLabel({ label, tip }: { label: string; tip: string }) {
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
        <TooltipContent side="top" className="max-w-64">
          <TooltipBody title={label}>{tip}</TooltipBody>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

/**
 * Rendu d'une cellule de valeur : la valeur formatée, ou « — » ENRICHI d'une infobulle
 * SOMBRE (+ `aria-label`) quand la métrique porte une raison d'indisponibilité (ex. Calmar).
 */
function cellValue(r: MetricRow, s: ComparisonStrategyResult, v: number | null) {
  if (v === null && r.unavailableReason && s.metrics) {
    const reason = r.unavailableReason(s.metrics);
    if (reason)
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              aria-label={reason}
              className="cursor-help decoration-dotted underline-offset-2 hover:underline"
            >
              {r.fmt(v)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">
            {reason}
          </TooltipContent>
        </Tooltip>
      );
  }
  return r.fmt(v);
}

// ─── Tableau de métriques — s'ADAPTE au nombre de stratégies affichées ─────────
// • 2 stratégies (paire) → colonne « Écart vs <référence> », référence = 1ʳᵉ colonne :
//     – paire avec Browne     : écart = stratégie − Browne
//     – Continue vs Régime    : écart = Régime − Continue
// • 3 stratégies (toutes) → pas de colonne d'écart unique (elle ne peut représenter
//     les deux variantes 4Q) ; à la place un écart secondaire discret « vs <référence> »
//     sous chaque valeur non-référence.
function MetricTable({
  groups,
  strategies,
}: {
  groups: MetricGroup[];
  strategies: ComparisonStrategyResult[];
}) {
  const reference = strategies[0] ?? null;
  const refShort = reference ? shortLabel(reference) : "";
  const isPair = strategies.length === 2;
  const isTrio = strategies.length >= 3;
  const colCount = 1 + strategies.length + (isPair ? 1 : 0);
  const raw = (s: ComparisonStrategyResult | null | undefined, r: MetricRow) => {
    if (!s?.metrics) return null;
    return r.get ? r.get(s.metrics) : (s.metrics[r.key as MetricKey] as number | null);
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <Th className="sticky left-0 bg-background">Indicateur</Th>
            {strategies.map((s) => (
              <Th key={s.id} className="text-right">
                <span className="flex justify-end">
                  <StrategyChip s={s} />
                </span>
              </Th>
            ))}
            {isPair && <Th className="whitespace-nowrap text-right">Écart vs {refShort}</Th>}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <Fragment key={g.label ?? `g${gi}`}>
              {g.label && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="bg-muted/20 px-3 pt-2.5 pb-1 text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {g.label}
                  </td>
                </tr>
              )}
              {g.rows.map((r) => {
                const refV = raw(reference, r);
                return (
                  <tr
                    key={r.key}
                    className="group border-b transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <Td className="sticky left-0 bg-background font-medium text-foreground group-hover:bg-muted/30">
                      <MetricLabel label={r.label} tip={r.tip} />
                    </Td>
                    {strategies.map((s) => {
                      const v = raw(s, r);
                      const showSecondary =
                        isTrio && s.id !== reference?.id && v !== null && refV !== null;
                      const d = showSecondary ? v! - refV! : 0;
                      const neg = showSecondary && diffIsNegligible(r, d);
                      return (
                        <Td key={s.id} className="text-right">
                          <div>{cellValue(r, s, v)}</div>
                          {showSecondary && (
                            <div
                              className={cn(
                                "whitespace-nowrap text-xs",
                                neg
                                  ? "text-muted-foreground"
                                  : diffTone(d, r.higherBetter, { soft: true }),
                              )}
                            >
                              {neg ? "≈ identique" : `${r.diff(d)} vs ${refShort}`}
                            </div>
                          )}
                        </Td>
                      );
                    })}
                    {isPair &&
                      (() => {
                        const ov = raw(strategies[1], r);
                        const canDiff = refV !== null && ov !== null;
                        const d = canDiff ? ov! - refV! : 0;
                        const neg = canDiff && diffIsNegligible(r, d);
                        return (
                          <Td
                            className={cn(
                              "whitespace-nowrap text-right",
                              !canDiff || neg
                                ? "text-muted-foreground"
                                : diffTone(d, r.higherBetter),
                            )}
                          >
                            {!canDiff ? "—" : neg ? "≈ identique" : r.diff(d)}
                          </Td>
                        );
                      })()}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Regroupement des indicateurs principaux — hiérarchie visuelle Performance / Risque (§4).
 * La gestion (rotation, fréquence, coûts) n'apparaît QUE dans la section dédiée
 * « Coûts et rééquilibrages » plus bas, pour éviter les doublons.
 */
const INDICATEUR_GROUPS: MetricGroup[] = [
  { label: "Performance", rows: [ROW.annualized, ROW.sharpe] },
  {
    label: "Risque",
    rows: [ROW.volatility, ROW.maxDrawdown, ROW.maxUnderwaterMonths, ROW.worstRolling12m],
  },
];

// ─── Blocs ────────────────────────────────────────────────────────────────────

/**
 * Bloc 1 — « Repères sur la sélection actuelle ». Lecture STRICTEMENT déterministe et
 * factuelle des métriques déjà présentes dans `ComparisonStrategyResult` : chaque carte
 * nomme une métrique explicite et le modèle qui la mène SUR LA SÉLECTION VISIBLE (jamais
 * un classement général). Aucun score composite, aucune pondération, aucun texte éditorial.
 * Les ex æquo au % affiché sont présentés comme tels. Aucun calcul sous-jacent modifié.
 */
interface SynthesisDimension {
  title: string;
  pick: (m: ComparisonMetrics) => number | null;
  /** true = la valeur la plus élevée mène ; false = la plus faible mène. */
  higher: boolean;
  format: (v: number) => string;
  /** Formulation du leader unique. */
  phrase: string;
}

const SYNTHESIS_DIMENSIONS: SynthesisDimension[] = [
  {
    title: "Performance annualisée",
    pick: (m) => m.annualized,
    higher: true,
    format: (v) => pct(v),
    phrase: "affiche la performance annualisée la plus élevée",
  },
  {
    title: "Rendement ajusté du risque",
    pick: (m) => m.sharpe,
    higher: true,
    format: (v) => ratio(v),
    phrase: "présente le Sharpe le plus élevé",
  },
  {
    title: "Perte maximale",
    pick: (m) => m.maxDrawdown,
    higher: true, // le max drawdown le MOINS négatif protège le mieux
    format: (v) => pct(v),
    phrase: "enregistre le max drawdown le moins profond",
  },
  {
    title: "Rotation",
    pick: (m) => m.annualizedTurnover,
    higher: false, // la rotation la plus FAIBLE = coûts les plus bas
    format: (v) => pct(v * 100),
    phrase: "présente la rotation annualisée la plus faible",
  },
];

/** Énumération française « a, b et c ». */
function joinFr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function SynthesisCards({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const withM = strategies.filter((s) => s.metrics);
  if (withM.length < 2) return null;

  const cards = SYNTHESIS_DIMENSIONS.map((dim) => {
    // Uniquement les stratégies dont la métrique est disponible sur la sélection.
    const rows = withM
      .map((s) => ({ s, v: dim.pick(s.metrics!) }))
      .filter((x): x is { s: ComparisonStrategyResult; v: number } => x.v !== null);
    if (!rows.length) return null; // métrique indisponible → carte masquée

    // Meilleur par valeur RÉELLE, puis ex æquo = même VALEUR AFFICHÉE (arrondi identique à
    // l'interface) : on ne départage jamais deux valeurs visuellement identiques.
    const best = rows.reduce((b, x) => ((dim.higher ? x.v > b.v : x.v < b.v) ? x : b), rows[0]);
    const bestShown = dim.format(best.v);
    const winners = rows.filter((x) => dim.format(x.v) === bestShown);

    const body =
      winners.length === 1
        ? `${best.s.label} ${dim.phrase} sur la période sélectionnée : ${bestShown}.`
        : `${joinFr(winners.map((w) => w.s.label))} présentent des résultats équivalents sur cette métrique.`;

    return { title: dim.title, body };
  }).filter(Boolean) as { title: string; body: string }[];

  if (!cards.length) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} className="gap-1.5 p-4">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">{c.title}</p>
            <p className="text-sm text-muted-foreground">{c.body}</p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Ces repères décrivent la période sélectionnée et ne constituent pas un classement général
        des modèles.
      </p>
    </div>
  );
}

/** Bloc 2 — performance cumulée nette (base 100), carte partagée du module. */
function CumulativeChart({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const series: ChartSeries[] = strategies
    .filter((s) => s.metrics)
    .map((s) => ({
      id: s.id,
      label: s.label,
      color: STRATEGY_COLOR[s.id],
      data: s.cumulativeSeries,
      width: s.id === "browne" ? 2 : 2.4,
    }));
  // Défaut Log sur les fenêtres longues (> 120 mois), comme Vue pays : plus lisible.
  const months = series.reduce((m, s) => Math.max(m, s.data.length), 0);
  return (
    <SeriesChartCard
      title="Performance cumulée nette de coûts"
      subtitle="Base 100 au début de la fenêtre commune."
      series={series}
      scaleToggle
      defaultScale={months > 120 ? "log" : "linear"}
      cumulativeTooltip
      height={360}
      emptyLabel="Sélectionnez au moins une série."
    />
  );
}

/** Bloc 4 — drawdowns comparés (carte partagée + synthèse KPI par stratégie). */
function DrawdownChart({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const withM = strategies.filter((s) => s.metrics);
  const series: ChartSeries[] = withM.map((s) => ({
    id: s.id,
    label: s.label,
    color: STRATEGY_COLOR[s.id],
    data: s.drawdownSeries,
    width: s.id === "browne" ? 2 : 2.4,
    fillOpacity: 0.1,
  }));
  // Plancher d'axe commun à toutes les stratégies (comme Vue pays) : stable au masquage.
  let worst = 0;
  for (const s of withM) for (const p of s.drawdownSeries) if (p.value < worst) worst = p.value;
  const floor = Math.min(-5, Math.floor(worst / 10) * 10);
  return (
    <SeriesChartCard
      title="Drawdowns successifs"
      subtitle="Pertes depuis le dernier sommet, sur la même chronologie."
      series={series}
      kpis={<DrawdownKpis strategies={withM} />}
      areaFill
      percentTooltip
      yDomain={[floor, 0]}
      height={280}
    />
  );
}

/** Synthèse KPI du drawdown (composant partagé) : un bloc par stratégie + écart en paire. */
function DrawdownKpis({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const blocks: DrawdownKpiBlock[] = strategies.map((s) => ({
    label: s.label,
    color: STRATEGY_COLOR[s.id],
    maxDrawdown: s.metrics?.maxDrawdown ?? null,
    underwaterMonths: s.metrics?.maxUnderwaterMonths ?? null,
  }));
  // Écart uniquement en comparaison par PAIRE (réf = 1ʳᵉ colonne). Jamais en « Toutes ».
  let delta: DrawdownKpiDelta | null = null;
  if (strategies.length === 2) {
    const ref = strategies[0].metrics;
    const cmp = strategies[1].metrics;
    delta = {
      refLabel: shortLabel(strategies[0]),
      maxDrawdown:
        ref?.maxDrawdown != null && cmp?.maxDrawdown != null
          ? cmp.maxDrawdown - ref.maxDrawdown
          : null,
      underwaterMonths:
        ref?.maxUnderwaterMonths != null && cmp?.maxUnderwaterMonths != null
          ? cmp.maxUnderwaterMonths - ref.maxUnderwaterMonths
          : null,
    };
  }
  return <DrawdownKpiRow blocks={blocks} delta={delta} />;
}

/** Bloc 5 — performances annualisées glissantes (5/10/15 ans). */
function RollingSection({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const withM = strategies.filter((s) => s.metrics);
  // La colonne « % devant Browne » n'a de sens que si Browne est AFFICHÉ (dans le filtre
  // « Continue vs Régime », Browne est exclu → la référence serait invisible).
  const hasBrowne = withM.some((s) => s.id === "browne");
  return (
    <div className="space-y-4">
      {ROLLING_WINDOWS_YEARS.map((years) => {
        const anyData = withM.some(
          (s) => (s.metrics!.rolling.find((r) => r.windowYears === years)?.count ?? 0) > 0,
        );
        if (!anyData) return null;
        return (
          <div key={years} className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <Th>Fenêtres {years} ans</Th>
                  <Th className="text-right">Médiane</Th>
                  <Th className="text-right">Pire</Th>
                  <Th className="text-right">Meilleure</Th>
                  {hasBrowne && <Th className="text-right">% devant Browne</Th>}
                  <Th className="text-right"># fenêtres</Th>
                </tr>
              </thead>
              <tbody>
                {withM.map((s) => {
                  const r = s.metrics!.rolling.find((x) => x.windowYears === years);
                  if (!r || r.count === 0)
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <Td>
                          <StrategyChip s={s} />
                        </Td>
                        <Td className="text-right text-muted-foreground">—</Td>
                        <Td className="text-right text-muted-foreground">—</Td>
                        <Td className="text-right text-muted-foreground">—</Td>
                        {hasBrowne && <Td className="text-right text-muted-foreground">—</Td>}
                        <Td className="text-right text-muted-foreground">0</Td>
                      </tr>
                    );
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <Td>
                        <StrategyChip s={s} />
                      </Td>
                      <Td className="text-right">{pct(r.median)}</Td>
                      <Td className="text-right">{pct(r.worst)}</Td>
                      <Td className="text-right">{pct(r.best)}</Td>
                      {hasBrowne && (
                        <Td className="text-right">
                          {s.id === "browne" || r.shareBeatingBrowne === null
                            ? "—"
                            : pct(r.shareBeatingBrowne * 100, 0)}
                        </Td>
                      )}
                      <Td className="text-right text-muted-foreground">{r.count}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/** Bloc 7 — rotation, coûts, écart brut/net. */
function CostSection({
  strategies,
  gross,
}: {
  strategies: ComparisonStrategyResult[];
  gross: Map<ComparisonStrategyId, number | null>;
}) {
  return (
    <div className="space-y-3">
      <MetricTable
        groups={[
          {
            rows: [
              ROW.annualizedTurnover,
              ROW.reallocationsPerYear,
              ROW.annualCostEstimate,
              ROW.cumulativeCost,
            ],
          },
        ]}
        strategies={strategies}
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <Th>Écart brut − net (coût de gestion sur la performance)</Th>
              {strategies.map((s) => (
                <Th key={s.id} className="text-right">
                  <span className="flex justify-end">
                    <StrategyChip s={s} />
                  </span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td className="font-medium text-foreground">Coût cumulé en performance</Td>
              {strategies.map((s) => {
                const g = gross.get(s.id);
                const net = s.metrics?.cumulative ?? null;
                const drag = g !== null && g !== undefined && net !== null ? g - net : null;
                return (
                  <Td key={s.id} className="text-right text-muted-foreground">
                    {drag === null ? "—" : `−${nf(drag, 1)} pt`}
                  </Td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Browne : rééquilibrage annuel (rotation faible). Le 4 Quadrants adapte l’allocation aux
        régimes, mais la bande de réallocation limite les transactions : seules les transactions
        réellement exécutées sont comptées, jamais les changements de cible non exécutés.
      </p>
    </div>
  );
}

/** Barre empilée d'allocation (largeurs = pourcentages affichés, somme = 100 %). */
function AllocBar({ pcts }: { pcts: Record<AllocKey, number> }) {
  // Récapitulatif accessible (lecteurs d'écran) — évite de rendre chaque segment focusable
  // (surcharge du parcours clavier) ; les infobulles souris restent un complément.
  const summary = ALLOC_KEYS.filter((k) => pcts[k] > 0)
    .map((k) => `${SLEEVE_META[k].label} ${pcts[k]} %`)
    .join(", ");
  return (
    <div className="flex h-3.5 w-full overflow-hidden rounded" role="img" aria-label={summary}>
      {ALLOC_KEYS.map((k) => {
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

/** Valeurs détaillées : TOUTES les poches, y compris celles à 0 %. */
function AllocValues({ pcts }: { pcts: Record<AllocKey, number> }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {ALLOC_KEYS.map((k) => (
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

/** Intitulé + barre + valeurs complètes. */
function AllocBlock({ label, pcts }: { label: string; pcts: Record<AllocKey, number> }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <AllocBar pcts={pcts} />
      <AllocValues pcts={pcts} />
    </div>
  );
}

/**
 * Bloc 8 — allocation DÉTENUE puis CIBLE, restitution complète (barre + valeurs, mêmes
 * ordre / couleurs / arrondi). La cible n'est JAMAIS une barre seule ni une zone vide :
 *  • si elle diffère de la détenue (après arrondi) → barre + valeurs complètes ;
 *  • si elle est identique après arrondi → « Identique à l'allocation actuelle ».
 * Le moteur ne renseigne `targetAllocation` que lorsqu'elle diverge (engine.ts) ; son
 * absence signifie donc « identique », pas « indisponible ». Pour Browne, la cible
 * permanente 25/25/25/25 s'affiche dès que la détenue a dérivé ; pour 4Q elle reste
 * indicative (cf. sous-titre de section : pas une instruction de transaction).
 */
function AllocationSection({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {strategiesWithAllocation(strategies).map((s) => {
        const held = roundedAllocPercents(s.currentAllocation!);
        const target = resolveTargetPercents(s.targetAllocation, held);
        return (
          <Card key={s.id} className="gap-2.5 p-4">
            <StrategyChip s={s} />
            <AllocBlock label="Allocation actuelle du modèle" pcts={held} />
            <div className="border-t pt-2">
              <p className="mb-1 text-xs text-muted-foreground">Allocation cible</p>
              {target ? (
                <>
                  <AllocBar pcts={target} />
                  <AllocValues pcts={target} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Identique à l’allocation actuelle</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** Bloc 9 — lecture pédagogique + questions par paire. */
function PedagogySection({
  strategies,
  filter,
}: {
  strategies: ComparisonStrategyResult[];
  filter: ComparisonFilter;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {strategies.map((s) => (
          <Card key={s.id} className="gap-1.5 p-4">
            <StrategyChip s={s} />
            <p className="text-sm text-muted-foreground">{s.description}</p>
          </Card>
        ))}
      </div>
      {filter !== "all" && (
        <Card className="gap-1 border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            La question de cette comparaison
          </p>
          <p className="text-sm">{PAIR_QUESTION[filter]}</p>
        </Card>
      )}
      <p className="text-sm text-muted-foreground">
        Browne privilégie la stabilité de la structure. Les modèles 4 Quadrants cherchent à adapter
        l’allocation au contexte macroéconomique. La comparaison doit porter à la fois sur la
        performance, le risque, les pertes et le coût des ajustements.
      </p>
    </div>
  );
}

/**
 * Accordéon — analyse avancée du risque. Fermé par défaut et HORS navigation
 * principale : regroupe les mesures techniques (queues de distribution, pertes
 * extrêmes) pour garder la lecture de premier niveau simple. Aucun calcul modifié.
 */
function AdvancedRiskSection({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">Analyse avancée du risque</span>
          <span className="text-sm text-muted-foreground">
            Mesures complémentaires pour analyser les pertes extrêmes et la distribution des
            rendements.
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-4">
        <MetricTable
          groups={[
            { label: "Rendement ajusté au risque", rows: [ROW.sortino, ROW.calmar] },
            {
              label: "Pertes et risque extrême",
              rows: [
                ROW.worstMonth,
                ROW.worstQuarter,
                ROW.expectedShortfall95,
                ROW.expectedShortfall99,
                ROW.downsideDeviation,
              ],
            },
            { label: "Forme de la distribution", rows: [ROW.skewness, ROW.excessKurtosis] },
          ]}
          strategies={strategies}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Vue principale ────────────────────────────────────────────────────────────

export function QuadrantsVsBrowneView({
  result,
  grossResult,
  crisisResults,
  filter,
  costBps,
}: {
  result: ModelComparisonResult;
  grossResult: ModelComparisonResult;
  crisisResults: HistoricalCrisisResult[];
  filter: ComparisonFilter;
  costBps: number;
}) {
  const visibleIds = FILTER_IDS[filter];
  const strategies = visibleIds
    .map((id) => result.strategies.find((s) => s.id === id))
    .filter((s): s is ComparisonStrategyResult => !!s);
  const available = strategies.filter((s) => s.availability.status === "ok");

  // Libellés publics par stratégie, lus depuis le résultat (pas d'import du registre moteur
  // côté client). Sert la légende + les tooltips de la section « crises ».
  const strategyLabels = useMemo(() => {
    const m = {} as Record<ComparisonStrategyId, string>;
    for (const s of result.strategies) m[s.id] = s.label;
    return m;
  }, [result]);
  const crisisVisibleIds = available.map((s) => s.id);

  const grossById = useMemo(
    () =>
      new Map<ComparisonStrategyId, number | null>(
        grossResult.strategies.map((s) => [s.id, s.metrics?.cumulative ?? null]),
      ),
    [grossResult],
  );

  // Indisponibilités explicites.
  const unavailable = strategies.filter((s) => s.availability.status === "unavailable");

  if (available.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Comparaison indisponible
        {result.disabledReason ? ` — ${UNAVAILABLE_REASON_FR[result.disabledReason]}` : ""}.
      </Card>
    );
  }

  const w = result.window;
  const modeLabel = result.mode === "real" ? "réelle" : "nominale";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8">
        {/* Bandeau fenêtre + hypothèses */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {w && (
            <span>
              Fenêtre commune :{" "}
              <span className="font-medium text-foreground">
                {w.start} → {w.end}
              </span>{" "}
              ({w.months} mois)
            </span>
          )}
          <span>
            Performance {modeLabel}, nette de coûts ({costBps} bps)
          </span>
          <span>Résultats exprimés dans la devise locale du pays</span>
        </div>

        {unavailable.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {unavailable.map((s) => (
              <div key={s.id}>
                {s.label} indisponible
                {s.availability.status === "unavailable"
                  ? ` — ${UNAVAILABLE_REASON_FR[s.availability.reason]}`
                  : ""}
                .
              </div>
            ))}
          </div>
        )}

        <Section
          id="synthese"
          title="Repères sur la sélection actuelle"
          subtitle="Synthèse calculée automatiquement à partir du pays, de la période et des paramètres sélectionnés."
        >
          <SynthesisCards strategies={available} />
        </Section>

        <Section id="performance">
          <CumulativeChart strategies={available} />
        </Section>

        <Section id="drawdowns">
          <DrawdownChart strategies={available} />
        </Section>

        <Section
          id="crises"
          title="Comportement pendant les crises"
          subtitle="Comparaison des stratégies pendant des crises financières et macroéconomiques historiques documentées."
        >
          <HistoricalCrisesSection
            results={crisisResults}
            visibleIds={crisisVisibleIds}
            labels={strategyLabels}
            colors={STRATEGY_COLOR}
            commonWindow={result.window}
          />
        </Section>

        <Section
          id="indicateurs"
          title="Indicateurs comparatifs"
          subtitle="Une valeur élevée n’est pas toujours favorable : volatilité, rotation et drawdown plus élevés sont défavorables."
        >
          <MetricTable groups={INDICATEUR_GROUPS} strategies={available} />
        </Section>

        <Section
          id="glissante"
          title="Performance glissante"
          subtitle="Une stratégie domine-t-elle seulement sur la période totale, ou aussi sur des fenêtres intermédiaires ?"
        >
          <RollingSection strategies={available} />
        </Section>

        <Section
          id="couts"
          title="Coûts et rééquilibrages"
          subtitle="Le coût de gestion fait partie intégrante du résultat."
        >
          <CostSection strategies={available} gross={grossById} />
        </Section>

        <Section
          id="allocation"
          title="Allocation actuelle"
          subtitle="Poids réellement détenus à la date d’analyse. L’allocation cible n’est pas une instruction de transaction."
        >
          <AllocationSection strategies={available} />
        </Section>

        <AdvancedRiskSection strategies={available} />

        <Section id="lecture" title="Lecture pédagogique">
          <PedagogySection strategies={strategies} filter={filter} />
        </Section>
      </div>
    </TooltipProvider>
  );
}

/** Sections de navigation interne (scrollspy) de l'onglet. */
export const VS_BROWNE_SECTIONS = [
  { id: "synthese", label: "Synthèse" },
  { id: "performance", label: "Performance" },
  { id: "drawdowns", label: "Drawdowns" },
  { id: "crises", label: "Crises" },
  { id: "indicateurs", label: "Indicateurs" },
  { id: "glissante", label: "Glissante" },
  { id: "couts", label: "Coûts" },
  { id: "allocation", label: "Allocation" },
  { id: "lecture", label: "Lecture" },
];
