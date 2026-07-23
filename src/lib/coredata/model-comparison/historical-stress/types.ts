// Contrats de données de la section « Comportement pendant les crises » (4Q vs Browne).
// Couche PURE (aucun accès base) : importable côté client comme le reste du module de
// comparaison. La source de vérité des crises est la table `economic_crises` (+ la vue
// `economic_crises_effective`) ; ce module ne recalcule NI Browne NI `4q-standard-v2` :
// il mesure les stratégies À L'INTÉRIEUR d'un épisode, à partir des séries mensuelles
// déjà produites par le moteur de comparaison (cf. `model-comparison/engine.ts`).

import type { ComparisonStrategyId } from "../types";

/** Catégorie documentaire d'une crise (miroir des valeurs de `economic_crises.category`). */
export type HistoricalCrisisCategory =
  | "energy"
  | "inflation"
  | "market"
  | "asset_bubble"
  | "financial"
  | "sovereign_debt"
  | "health"
  | "geopolitical"
  | "trade";

/** Statut d'un épisode. `closed` = borné ; `provisional` = bornes provisoires ; `ongoing` = en cours. */
export type HistoricalCrisisStatus = "closed" | "provisional" | "ongoing";

/** Importance éditoriale (pilote le filtre « Crises principales / Toutes les crises »). */
export type HistoricalCrisisImportance = "primary" | "secondary";

/**
 * Une crise du registre, telle que lue en base (dates normalisées « YYYY-MM-DD »).
 * `effectiveEndDate` vient de la vue `economic_crises_effective` (borne provisoire des
 * épisodes en cours = dernier mois civil clôturé, résolu côté base).
 */
export interface HistoricalCrisis {
  id: string;
  name: string;
  definition: string;
  /** Niveau de référence de départ (fin de mois). */
  startDate: string;
  /** Fin politique de la crise, ou `null` pour un épisode en cours. */
  endDate: string | null;
  /** Borne effective côté registre (vue) : `end_date` si borné, dernier mois clôturé sinon. */
  effectiveEndDate: string;
  category: HistoricalCrisisCategory;
  status: HistoricalCrisisStatus;
  importance: HistoricalCrisisImportance;
  includeInAggregates: boolean;
  displayOrder: number;
}

/** Raisons EXPLICITES d'indisponibilité d'une stratégie sur un épisode (jamais d'interpolation). */
export type HistoricalCrisisUnavailableReason =
  | "insufficient_history"
  | "start_observation_unavailable"
  | "non_contiguous_history"
  | "out_of_selected_period";

/** Libellés FR (l'UI n'expose jamais d'énumération technique). */
export const HISTORICAL_CRISIS_REASON_FR: Record<HistoricalCrisisUnavailableReason, string> = {
  insufficient_history: "Historique insuffisant",
  start_observation_unavailable: "Observation de départ indisponible",
  non_contiguous_history: "Historique mensuel non continu",
  out_of_selected_period: "Crise hors de la période sélectionnée",
};

/**
 * Résultat d'UNE stratégie sur UN épisode. `cumulativeReturn`/`maxDrawdown` sont en
 * POINTS DE POURCENTAGE (mêmes conventions que `ComparisonMetrics` : drawdown ≤ 0),
 * NETS de coûts et dans le mode sélectionné (nominal/réel). `null` quand indisponible.
 */
export interface HistoricalCrisisStrategyResult {
  strategyId: ComparisonStrategyId;
  available: boolean;
  /** Raison FR explicite si `available` est faux. */
  unavailableReason?: string;

  /** Performance cumulée nette pendant l'épisode (%). Non annualisée. */
  cumulativeReturn: number | null;
  /**
   * Perte maximale PENDANT la crise (%, ≤ 0). Drawdown recalculé en BASE 100 au DÉBUT de
   * la fenêtre de l'épisode — ce n'est PAS le drawdown global éventuellement commencé
   * avant la crise. Le sommet de référence est le plus haut atteint depuis le départ.
   */
  maxDrawdown: number | null;

  /** Date du sommet à l'origine du max drawdown. */
  peakDate: string | null;
  /** Date du point bas du max drawdown. */
  troughDate: string | null;
  /** Première date de retour au niveau du sommet (peut dépasser la fin de la crise). */
  recoveryDate: string | null;

  /** Mois du SOMMET au POINT BAS (durée de la chute). Défini dès qu'un drawdown existe. */
  monthsToTrough: number | null;
  /** Mois du POINT BAS à la 1ʳᵉ récupération du sommet. `null` si non récupéré. */
  recoveryAfterTroughMonths: number | null;
  /** Mois du SOMMET à la 1ʳᵉ récupération du sommet (durée TOTALE sous l'eau). `null` si non récupéré. */
  underwaterDurationMonths: number | null;
  /** `false` si le niveau du sommet n'est pas retrouvé à la date d'analyse. */
  recovered: boolean;
}

/** Résultat complet d'un épisode (l'ensemble des stratégies demandées, dans l'ordre). */
export interface HistoricalCrisisResult {
  crisis: HistoricalCrisis;
  /** Date de départ effectivement analysée (fin de mois de `startDate`). */
  effectiveStartDate: string;
  /** Date de fin effectivement analysée (clampée au dernier mois clôturé / à la période). */
  effectiveEndDate: string;
  /** Nombre de mois entre départ et fin effective. */
  durationMonths: number;
  /** `true` pour un épisode en cours ou à bornes provisoires. */
  provisional: boolean;
  strategies: HistoricalCrisisStrategyResult[];
}
