// Registre DÉCLARATIF des stratégies comparables + adaptateurs. Chaque stratégie
// RÉUTILISE son moteur validé (`computeBrowne` / `buildModel` + `backtestQuadrants`)
// et NORMALISE sa sortie en `StrategyPath` (courbe brute + turnover exécuté mensuel
// + allocation détenue/cible + disponibilité). Aucune logique de calcul recréée.
//
// ⚠️ Extensibilité : ajouter une stratégie (ex. variantes Énergie) = une entrée
// ici, sans toucher au moteur de comparaison ni à l'UI. Les variantes Énergie ne
// sont PAS enregistrées aujourd'hui (dormantes) — `energyMode: "disabled"` garantit
// qu'aucune poche Énergie n'apparaît dans les sorties publiques.

import type { EconomicDataPoint } from "../types";
import {
  buildModel,
  backtestQuadrants,
  weightsFromModel,
  DEFAULT_FOUR_QUADRANTS_SETTINGS,
  type BuildModelInput,
  type Strategy,
  type QuadrantModelStatus,
  type BacktestStatus,
  type FinalAllocation,
} from "../four-quadrants";
import { computeBrowne, DEFAULT_REBALANCE, type BrowneStatus, type SleeveKey } from "../browne";
import type { Allocation, ComparisonStrategyId, ComparisonUnavailableReason } from "./types";

/** Séries de PERFORMANCE partagées (devise locale) — communes à toutes les stratégies. */
export interface SharedComparisonPerf {
  equityTotalReturn: EconomicDataPoint[];
  bondTotalReturn: EconomicDataPoint[];
  cashTotalReturn: EconomicDataPoint[];
  gold: EconomicDataPoint[];
  cpi?: EconomicDataPoint[];
}

/**
 * Entrée partagée d'une comparaison. Les MÊMES séries de perf alimentent Browne et
 * le 4Q ⇒ mêmes rendements mensuels, même cash, même inflation par construction.
 */
export interface SharedComparisonInput {
  countryCode: string;
  /** Séries SIGNAL du 4Q (`null` ⇒ 4Q indisponible ; Browne reste possible). */
  signal: BuildModelInput | null;
  perf: SharedComparisonPerf;
  /** Demi-largeur de la zone de transition (réglage global partagé). */
  transitionWidth: number;
  /** Bande de réallocation active (v2 = δ 5 pts ; `null` = v1). */
  reallocationBand: number | null;
}

/** Chemin NORMALISÉ d'une stratégie sur l'historique complet (avant fenêtre/coûts). */
export type StrategyPath =
  | {
      status: "OK";
      /** Courbe nominale BRUTE (sans coûts) base 100, historique complet. */
      nominalGross: EconomicDataPoint[];
      /** Turnover exécuté par mois : clé « YYYY-MM » → turnover (`null` = constitution). */
      turnoverByMonth: Map<string, number | null>;
      /** Allocation réellement détenue au dernier mois. */
      held: Allocation;
      /** Allocation cible au dernier mois. */
      target: Allocation;
    }
  | {
      status: "UNAVAILABLE";
      reason: ComparisonUnavailableReason;
      firstInvalidMonth: string | null;
    };

// ─── Mapping des statuts moteurs → raisons de comparaison ─────────────────────

const MODEL_STATUS_REASON: Record<Exclude<QuadrantModelStatus, "OK">, ComparisonUnavailableReason> = {
  MISSING_SERIES: "missing_series",
  INVALID_VALUE: "invalid_value",
  INSUFFICIENT_HISTORY: "insufficient_history",
};

const BACKTEST_STATUS_REASON: Record<Exclude<BacktestStatus, "OK">, ComparisonUnavailableReason> = {
  MISSING_SERIES: "missing_series",
  INVALID_VALUE: "invalid_value",
  INSUFFICIENT_HISTORY: "insufficient_history",
  MISSING_SIGNAL_WEIGHT: "insufficient_history",
  NON_CONTIGUOUS_HISTORY: "non_contiguous_history",
  INVALID_ASSET_VALUE: "invalid_value",
};

const BROWNE_STATUS_REASON: Record<Exclude<BrowneStatus, "OK">, ComparisonUnavailableReason> = {
  MISSING_SERIES: "missing_series",
  INSUFFICIENT_HISTORY: "insufficient_history",
  INVALID_VALUE: "invalid_value",
};

function unavailable(
  reason: ComparisonUnavailableReason,
  firstInvalidMonth: string | null = null,
): StrategyPath {
  return { status: "UNAVAILABLE", reason, firstInvalidMonth };
}

/** Allocation finale 4Q (5 poches) → 4 poches cœur (l'Énergie publique = 0, omise). */
function coreOf(a: FinalAllocation): Allocation {
  return { equities: a.equities, bonds: a.bonds, gold: a.gold, cash: a.cash };
}

/** Allocation Browne (equity/bond/cash/gold) → forme homogène (equities/bonds/gold/cash). */
function browneAlloc(a: Record<SleeveKey, number>): Allocation {
  return { equities: a.equity, bonds: a.bond, gold: a.gold, cash: a.cash };
}

// ─── Adaptateurs ──────────────────────────────────────────────────────────────

/** 4 Quadrants (dynamique ou binaire), `4q-standard-v2`, sans Énergie. */
function buildQuadrantsPath(shared: SharedComparisonInput, strategy: Strategy): StrategyPath {
  if (!shared.signal) return unavailable("missing_series");
  const model = buildModel(shared.signal, {
    ...DEFAULT_FOUR_QUADRANTS_SETTINGS,
    strategy,
    transitionWidth: shared.transitionWidth,
    energyMode: "disabled", // aucune poche Énergie exposée (surcouche dormante)
  });
  if (model.status !== "OK") return unavailable(MODEL_STATUS_REASON[model.status]);

  const bt = backtestQuadrants({
    countryCode: shared.countryCode,
    weights: weightsFromModel(model),
    equityTotalReturn: shared.perf.equityTotalReturn,
    bondTotalReturn: shared.perf.bondTotalReturn,
    cashTotalReturn: shared.perf.cashTotalReturn,
    gold: shared.perf.gold,
    cpi: shared.perf.cpi,
    windowYears: null, // historique complet : le moteur de comparaison fenêtre lui-même
    reallocationBand: shared.reallocationBand,
  });
  if (bt.status !== "OK") {
    return unavailable(BACKTEST_STATUS_REASON[bt.status], bt.availability.firstInvalidMonth);
  }
  return {
    status: "OK",
    nominalGross: bt.series.nominal,
    turnoverByMonth: new Map(bt.turnover.monthly.map((t) => [t.date.slice(0, 7), t.turnover])),
    held: coreOf(bt.heldAllocation),
    target: coreOf(bt.targetAllocation),
  };
}

/** Portefeuille de Browne (25/25/25/25, rééquilibrage annuel) — règles inchangées. */
function buildBrownePath(shared: SharedComparisonInput): StrategyPath {
  const r = computeBrowne({
    countryCode: shared.countryCode,
    equity: shared.perf.equityTotalReturn,
    bond: shared.perf.bondTotalReturn,
    cash: shared.perf.cashTotalReturn,
    gold: shared.perf.gold,
    inflation: shared.perf.cpi,
    rebalance: DEFAULT_REBALANCE, // "annual" — fréquence/mois inchangés
  });
  if (r.status !== "OK") return unavailable(BROWNE_STATUS_REASON[r.status]);
  return {
    status: "OK",
    nominalGross: r.series.nominal,
    turnoverByMonth: new Map(r.turnover.monthly.map((t) => [t.date.slice(0, 7), t.turnover])),
    held: browneAlloc(r.heldAllocation),
    target: browneAlloc(r.targetAllocation),
  };
}

// ─── Registre ─────────────────────────────────────────────────────────────────

export interface ComparisonStrategyDef {
  id: ComparisonStrategyId;
  /** Libellé court (légendes, puces, colonnes). */
  label: string;
  /** Description conceptuelle (bloc « Lecture pédagogique »). */
  description: string;
  build: (shared: SharedComparisonInput) => StrategyPath;
}

export const COMPARISON_STRATEGIES: Record<ComparisonStrategyId, ComparisonStrategyDef> = {
  browne: {
    id: "browne",
    label: "Browne",
    description:
      "Une allocation permanente et symétrique conçue pour traverser différents environnements économiques sans chercher à prévoir le régime dominant.",
    build: buildBrownePath,
  },
  "quadrants-dynamic-v2": {
    id: "quadrants-dynamic-v2",
    label: "4Q Continue",
    description:
      "Méthode dérivée Quantsightly : les pondérations des quatre actifs évoluent progressivement selon la position dans le plan macroéconomique.",
    build: (shared) => buildQuadrantsPath(shared, "dynamic"),
  },
  "quadrants-binary-v2": {
    id: "quadrants-binary-v2",
    label: "4Q Régime",
    description:
      "Méthode originale 50/50 : le régime macroéconomique sélectionne deux actifs, pondérés à parts égales.",
    build: (shared) => buildQuadrantsPath(shared, "binary"),
  },
};

/** Stratégies exposées publiquement dans la v1 (ordre d'affichage). */
export const PUBLIC_STRATEGY_IDS: ComparisonStrategyId[] = [
  "browne",
  "quadrants-dynamic-v2",
  "quadrants-binary-v2",
];
