// Comparaison de modèles d'allocation (« 4 Quadrants vs Browne ») — couche PURE,
// sans accès base, importable côté client. Elle NE recalcule PAS les moteurs :
// elle NORMALISE leurs sorties (Browne + 4Q v2 binaire/dynamique) dans une
// structure homogène, sur une FENÊTRE COMMUNE STRICTE, avec les MÊMES conventions
// de métriques et de coûts pour toutes les stratégies.
//
// ⚠️ Architecture déclarative (cf. `registry.ts`) : ajouter une stratégie
// (ex. variantes Énergie) = une entrée de registre, sans réécrire ni le moteur de
// comparaison ni l'interface. Aucune variante Énergie n'est exposée aujourd'hui.

import type { EconomicDataPoint } from "../types";

/**
 * Identifiant déclaratif d'une stratégie comparable. La v1 publique n'expose que
 * les trois premières ; les variantes Énergie restent DORMANTES (non listées ici
 * pour ne pas être sélectionnables), ajoutables plus tard sans réécriture :
 *   | "quadrants-dynamic-v2-energy-trend-v1"
 *   | "quadrants-binary-v2-energy-trend-v1"
 */
export type ComparisonStrategyId =
  | "browne"
  | "quadrants-dynamic-v2"
  | "quadrants-binary-v2";

/** Mode d'analyse (comme les autres pages Modèles). Le réel déflate par le CPI local. */
export type ComparisonMode = "nominal" | "real";

/** Fenêtre d'analyse (identique aux onglets 4Q) : `null` = tout l'historique commun. */
export type ComparisonPeriodYears = number | null;

/**
 * Allocation affichée (4 poches cœur). La poche `energy` reste OPTIONNELLE et
 * ABSENTE pour toutes les stratégies publiques — jamais rendue dans l'UI v1. Elle
 * n'existe dans le type que pour accueillir les futures variantes Énergie.
 */
export interface Allocation {
  equities: number;
  bonds: number;
  gold: number;
  cash: number;
  energy?: number;
}

/** Un mois du chemin mesuré (net de coûts). */
export interface MonthlyReturn {
  date: string;
  /** Rendement brut du portefeuille (avant coûts). */
  gross: number;
  /** Rendement net (brut − coûts de transaction du mois). */
  net: number;
  /** Turnover unidirectionnel EXÉCUTÉ ce mois (½·Σ|Δw|). */
  turnover: number;
  /** Coût de transaction du mois (fraction) = (bps/10000)·2·turnover. */
  cost: number;
}

/** Point d'une courbe base 100 (net, mode sélectionné). */
export interface CumulativePoint {
  date: string;
  value: number;
}

/** Statistiques d'une fenêtre glissante (bloc « Performance glissante »). */
export interface RollingWindowStat {
  /** Longueur de la fenêtre en années (5 / 10 / 15). */
  windowYears: number;
  /** Nombre de fenêtres glissantes disponibles. */
  count: number;
  /** Médiane / meilleure / pire performance annualisée des fenêtres (%). */
  median: number | null;
  best: number | null;
  worst: number | null;
  /**
   * Part des fenêtres où la stratégie devance Browne (fraction ∈ [0,1]) — `null`
   * si Browne est absent de la comparaison ou si c'est Browne lui-même.
   */
  shareBeatingBrowne: number | null;
}

/**
 * Jeu de métriques COMPARABLES — mêmes formules pour toutes les stratégies,
 * calculées sur la courbe NETTE de la fenêtre commune (nominale ou réelle selon
 * le mode). Groupées par dimension pédagogique (Performance / Protection /
 * Risque de baisse / Coût de gestion).
 */
export interface ComparisonMetrics {
  months: number;
  start: string;
  end: string;

  // ── Performance ──
  /** Performance cumulée sur la fenêtre (%). */
  cumulative: number | null;
  /** Performance annualisée géométrique (CAGR, %). */
  annualized: number | null;
  /** Volatilité annualisée (%). */
  volatility: number | null;
  /** Sharpe = (CAGR − CAGR cash local) / volatilité (excédent sur le cash). */
  sharpe: number | null;
  /** Sortino = CAGR / downside deviation annualisée (MAR = 0). */
  sortino: number | null;

  // ── Protection ──
  /** Pire drawdown pic-à-creux (%, ≤ 0). */
  maxDrawdown: number | null;
  /** Recul depuis le dernier sommet à la dernière date (%, ≤ 0). */
  currentDrawdown: number | null;
  /** Plus longue durée sous le dernier sommet (mois). */
  maxUnderwaterMonths: number | null;
  /** Pire performance sur 12 mois glissants (%). */
  worstRolling12m: number | null;

  // ── Risque de baisse (sans hypothèse de normalité) ──
  /** Pire rendement mensuel (%). */
  worstMonth: number | null;
  /** Pire rendement sur 3 mois glissants (%). */
  worstQuarter: number | null;
  /** Expected Shortfall historique 95 % (moyenne des pires 5 % de mois, %). */
  expectedShortfall95: number | null;
  /** Expected Shortfall historique 99 % (moyenne des pires 1 % de mois, %). */
  expectedShortfall99: number | null;
  /** Downside deviation annualisée (%). */
  downsideDeviation: number | null;
  /** Asymétrie (skewness) des rendements mensuels. */
  skewness: number | null;
  /** Kurtosis excédentaire des rendements mensuels. */
  excessKurtosis: number | null;

  // ── Coût de gestion ──
  /** Rotation annualisée = turnover mensuel moyen × 12 (fraction). */
  annualizedTurnover: number | null;
  /** Nombre moyen de réallocations par an (mois avec turnover exécuté > 0). */
  reallocationsPerYear: number | null;
  /** Coût annuel estimé (%/an) sous l'hypothèse de coûts choisie. */
  annualCostEstimate: number | null;
  /** Coût cumulé sur la fenêtre (%, somme des coûts mensuels). */
  cumulativeCost: number | null;

  // ── Performance glissante (5 / 10 / 15 ans) ──
  rolling: RollingWindowStat[];
}

/** Raisons EXPLICITES d'indisponibilité (jamais d'interpolation ni de dernier signal). */
export type ComparisonUnavailableReason =
  | "insufficient_history"
  | "bond_series_unavailable"
  | "inflation_unavailable"
  | "cash_unavailable"
  | "non_contiguous_history"
  | "missing_series"
  | "invalid_value";

/** Libellés FR des raisons (l'UI n'expose jamais de formule propriétaire). */
export const UNAVAILABLE_REASON_FR: Record<ComparisonUnavailableReason, string> = {
  insufficient_history: "Historique insuffisant",
  bond_series_unavailable: "Série obligataire indisponible",
  inflation_unavailable: "Inflation indisponible",
  cash_unavailable: "Cash local indisponible",
  non_contiguous_history: "Historique non continu",
  missing_series: "Série indisponible",
  invalid_value: "Valeur d'actif invalide",
};

export type AvailabilityStatus =
  | { status: "ok" }
  | {
      status: "unavailable";
      reason: ComparisonUnavailableReason;
      /** Premier mois fautif (« YYYY-MM ») si localisable, sinon `null`. */
      firstInvalidMonth: string | null;
    };

/** Sortie NORMALISÉE d'une stratégie sur la fenêtre commune (structure homogène). */
export interface ComparisonStrategyResult {
  id: ComparisonStrategyId;
  label: string;
  description: string;
  availability: AvailabilityStatus;
  /** Chemin mensuel mesuré (net) — présent seulement si disponible. */
  monthlyReturns: MonthlyReturn[];
  /** Courbe cumulée nette base 100 (mode sélectionné). */
  cumulativeSeries: CumulativePoint[];
  /** Courbe de drawdown roulant (%, ≤ 0) de la courbe mesurée. */
  drawdownSeries: EconomicDataPoint[];
  /** Allocation RÉELLEMENT détenue à la date d'analyse (poche principale). */
  currentAllocation: Allocation | null;
  /** Allocation cible — fournie seulement si elle diffère de la détenue. */
  targetAllocation?: Allocation;
  metrics: ComparisonMetrics | null;
}

/** Fenêtre commune stricte effectivement retenue. */
export interface ComparisonWindow {
  start: string;
  end: string;
  months: number;
}

/** Résultat complet de la comparaison d'un pays. */
export interface ModelComparisonResult {
  countryCode: string;
  mode: ComparisonMode;
  /** Hypothèse de coûts appliquée (bps sur la rotation exécutée). */
  costBps: number;
  /** Fenêtre commune retenue (`null` si aucune comparaison possible). */
  window: ComparisonWindow | null;
  /** Une entrée par stratégie DEMANDÉE (dispo ou non, dans l'ordre demandé). */
  strategies: ComparisonStrategyResult[];
  /**
   * Raison globale si AUCUNE comparaison n'est possible (ex. réel sans CPI,
   * < 2 stratégies disponibles). `null` quand au moins une fenêtre existe.
   */
  disabledReason: ComparisonUnavailableReason | null;
}
