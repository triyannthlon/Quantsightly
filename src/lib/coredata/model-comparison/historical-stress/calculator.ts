// Calculateur PUR de la section « Comportement pendant les crises ». Aucun accès base,
// aucune horloge : la date courante / le dernier mois clôturé sont résolus en AMONT
// (couche service, via la fenêtre du moteur de comparaison qui exclut déjà le mois
// courant). Ce module consomme UNIQUEMENT les séries mensuelles déjà calculées par le
// moteur (`cumulativeSeries` = base 100 NETTE, dans le mode sélectionné) — il ne
// recalcule ni Browne ni `4q-standard-v2`.
//
// Convention des dates (cf. `engine.ts`) : `start_date` est le NIVEAU DE RÉFÉRENCE ; la
// performance court sur les mois `> start_date` et `<= effective_end_date`. Le mois de
// départ n'est jamais compté comme un rendement (base 100). Données mensuelles fin de mois.

import { UNAVAILABLE_REASON_FR } from "../types";
import type { ComparisonStrategyId, CumulativePoint, ModelComparisonResult } from "../types";
import {
  HISTORICAL_CRISIS_REASON_FR,
  type HistoricalCrisis,
  type HistoricalCrisisResult,
  type HistoricalCrisisStrategyResult,
} from "./types";

// ─── Aides calendaires (clés « YYYY-MM ») ────────────────────────────────────

const monthKey = (d: string): string => d.slice(0, 7);
const monthIndex = (mk: string): number =>
  Number(mk.slice(0, 4)) * 12 + (Number(mk.slice(5, 7)) - 1);
const fromIndex = (i: number): string => {
  const y = Math.floor(i / 12);
  const m = i - y * 12 + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
};
/** Plus petit (plus ancien) des deux mois « YYYY-MM » (comparaison lexicographique valide). */
const minMonth = (a: string, b: string): string => (a <= b ? a : b);

// ─── Entrées du calculateur ──────────────────────────────────────────────────

/** Une stratégie + sa courbe NETTE base 100 (mode sélectionné) sur la fenêtre commune. */
export interface HistoricalStressStrategySeries {
  strategyId: ComparisonStrategyId;
  /** Disponibilité au niveau du moteur de comparaison (fenêtre commune). */
  available: boolean;
  /** Raison FR déjà résolue si la stratégie est indisponible au niveau moteur. */
  unavailableReason?: string;
  /** `cumulativeSeries` du moteur : base 100 nette, dans le mode sélectionné, fin de mois. */
  levels: readonly CumulativePoint[];
}

/** Fenêtre / bornes résolues par la couche service pour UN épisode. */
export interface CalculateHistoricalStressOptions {
  /** Départ effectif (fin de mois de `start_date`). */
  effectiveStartDate: string;
  /** Fin effective clampée (min entre fin de crise, dernier mois clôturé, fin de période). */
  effectiveEndDate: string;
  /** Dernier mois commun disponible : borne de la RECHERCHE DE RÉCUPÉRATION (peut dépasser la crise). */
  analysisEndDate: string;
  /** `true` pour un épisode en cours / à bornes provisoires. */
  provisional: boolean;
}

// ─── Mesure d'une stratégie sur un épisode ───────────────────────────────────

function unavailable(
  strategyId: ComparisonStrategyId,
  reason: string,
): HistoricalCrisisStrategyResult {
  return {
    strategyId,
    available: false,
    unavailableReason: reason,
    cumulativeReturn: null,
    maxDrawdown: null,
    peakDate: null,
    troughDate: null,
    recoveryDate: null,
    monthsToTrough: null,
    recoveryAfterTroughMonths: null,
    underwaterDurationMonths: null,
    recovered: false,
  };
}

function measureStrategy(
  s: HistoricalStressStrategySeries,
  startMonth: string,
  endMonth: string,
  analysisEndMonth: string,
): HistoricalCrisisStrategyResult {
  if (!s.available) {
    return unavailable(
      s.strategyId,
      s.unavailableReason ?? HISTORICAL_CRISIS_REASON_FR.insufficient_history,
    );
  }
  if (!s.levels.length) {
    return unavailable(s.strategyId, HISTORICAL_CRISIS_REASON_FR.insufficient_history);
  }

  // Niveaux indexés par mois (premier point par mois — les séries sont fin de mois).
  const byMonth = new Map<string, { value: number; date: string }>();
  for (const p of s.levels) {
    const mk = monthKey(p.date);
    if (!byMonth.has(mk)) byMonth.set(mk, { value: p.value, date: p.date });
  }

  const base = byMonth.get(startMonth);
  if (!base) {
    return unavailable(s.strategyId, HISTORICAL_CRISIS_REASON_FR.start_observation_unavailable);
  }

  const lastMonth = monthKey(s.levels[s.levels.length - 1].date);
  if (monthIndex(endMonth) > monthIndex(lastMonth)) {
    return unavailable(s.strategyId, HISTORICAL_CRISIS_REASON_FR.insufficient_history);
  }

  // Continuité mensuelle STRICTE entre le départ et la fin effective (aucun mois manquant).
  const startIdx = monthIndex(startMonth);
  const endIdx = monthIndex(endMonth);
  for (let i = startIdx; i <= endIdx; i++) {
    if (!byMonth.has(fromIndex(i))) {
      return unavailable(s.strategyId, HISTORICAL_CRISIS_REASON_FR.non_contiguous_history);
    }
  }

  // Performance = niveau(fin) / niveau(départ) − 1 (≡ produit des rendements nets du mois
  // de départ EXCLU à la fin INCLUSE), dans le mode sélectionné. Non annualisée.
  const endLevel = byMonth.get(endMonth)!;
  const cumulativeReturn = (endLevel.value / base.value - 1) * 100;

  // Drawdown dans [départ .. fin], base 100 au départ. ⚠️ REBASÉ au DÉBUT de la crise :
  // ce n'est pas le drawdown global éventuellement commencé avant l'épisode. Le sommet de
  // référence est le plus haut atteint DEPUIS le départ (initialisé au niveau de départ).
  let runningMax = base.value;
  let runningMaxDate = base.date;
  let runningMaxIdx = startIdx;
  let maxDd = 0;
  let peakDate = base.date;
  let peakIdx = startIdx;
  let troughDate = base.date;
  let troughIdx = startIdx;
  let peakValueAtTrough = base.value;
  for (let i = startIdx; i <= endIdx; i++) {
    const pt = byMonth.get(fromIndex(i))!;
    if (pt.value > runningMax) {
      runningMax = pt.value;
      runningMaxDate = pt.date;
      runningMaxIdx = i;
    }
    const dd = (pt.value / runningMax - 1) * 100;
    if (dd < maxDd) {
      maxDd = dd;
      troughDate = pt.date;
      troughIdx = i;
      peakDate = runningMaxDate;
      peakIdx = runningMaxIdx;
      peakValueAtTrough = runningMax;
    }
  }
  // Durée de la CHUTE (sommet → point bas). Toujours définie si la stratégie est mesurée
  // (0 quand il n'y a pas de repli : sommet et « point bas » = niveau de départ).
  const monthsToTrough = troughIdx - peakIdx;

  // Récupération : après le point bas (au-delà de la crise si besoin, jusqu'au dernier
  // mois d'analyse), première date où le niveau retrouve le sommet précédant le point bas.
  let recovered = false;
  let recoveryDate: string | null = null;
  let recoveryAfterTroughMonths: number | null = null;
  let underwaterDurationMonths: number | null = null;
  if (maxDd < 0) {
    const analysisEndIdx = monthIndex(analysisEndMonth);
    for (let i = troughIdx + 1; i <= analysisEndIdx; i++) {
      const pt = byMonth.get(fromIndex(i));
      if (!pt) continue; // au-delà de la crise, on tolère un trou sans invalider la mesure
      if (pt.value >= peakValueAtTrough) {
        recovered = true;
        recoveryDate = pt.date;
        recoveryAfterTroughMonths = i - troughIdx; // point bas → récupération
        underwaterDurationMonths = i - peakIdx; // sommet → récupération (total sous l'eau)
        break;
      }
    }
  } else {
    // Aucun repli sous le niveau de départ : rien à récupérer (durées nulles, non « null »).
    recovered = true;
    recoveryDate = troughDate;
    recoveryAfterTroughMonths = 0;
    underwaterDurationMonths = 0;
  }

  return {
    strategyId: s.strategyId,
    available: true,
    cumulativeReturn,
    maxDrawdown: maxDd,
    peakDate,
    troughDate,
    recoveryDate,
    monthsToTrough,
    recoveryAfterTroughMonths,
    underwaterDurationMonths,
    recovered,
  };
}

/**
 * Mesure UN épisode pour toutes les stratégies demandées (mêmes dates, même mode, même
 * hypothèse de coûts — par construction, car les courbes viennent de la même comparaison).
 */
export function calculateHistoricalStress(
  crisis: HistoricalCrisis,
  strategies: readonly HistoricalStressStrategySeries[],
  options: CalculateHistoricalStressOptions,
): HistoricalCrisisResult {
  const startMonth = monthKey(options.effectiveStartDate);
  const endMonth = monthKey(options.effectiveEndDate);
  const analysisEndMonth = monthKey(options.analysisEndDate);

  return {
    crisis,
    effectiveStartDate: options.effectiveStartDate,
    effectiveEndDate: options.effectiveEndDate,
    durationMonths: monthIndex(endMonth) - monthIndex(startMonth),
    provisional: options.provisional,
    strategies: strategies.map((s) => measureStrategy(s, startMonth, endMonth, analysisEndMonth)),
  };
}

// ─── Orchestration multi-crises (fenêtre commune + période, PURE) ─────────────

/** Fenêtre commune (clés « YYYY-MM ») telle que retenue par le moteur de comparaison. */
export interface HistoricalStressWindow {
  start: string;
  end: string;
}

export interface BuildHistoricalStressInput {
  /** `ModelComparisonResult.window` (mois « YYYY-MM ») — encode période + dernier mois clôturé. */
  window: HistoricalStressWindow;
  /** Une entrée par stratégie de la comparaison (id, disponibilité, courbe nette base 100). */
  strategies: readonly HistoricalStressStrategySeries[];
  /** Le registre complet des crises (déjà lu en base). */
  crises: readonly HistoricalCrisis[];
}

/**
 * Applique le filtre de période (section 6) et le clamp de fin effective, puis mesure
 * chaque épisode retenu. N'exclut PAS par importance (primaire/secondaire) : l'UI filtre.
 * Épisodes rendus dans l'ordre `display_order`.
 *
 * Compatibilité période :
 *  - épisode BORNÉ (closed/provisional) : retenu seulement s'il est ENTIÈREMENT inclus
 *    (`start >= window.start` ET `end <= window.end`) ;
 *  - épisode EN COURS : retenu dès lors que `start >= window.start` et `effEnd > start`.
 */
export function buildHistoricalStressResults(
  input: BuildHistoricalStressInput,
): HistoricalCrisisResult[] {
  const { window, strategies, crises } = input;

  // Carte mois → date réelle (fin de mois), depuis la 1ʳᵉ stratégie disponible (dates communes).
  const ref = strategies.find((s) => s.available && s.levels.length);
  const dateByMonth = new Map<string, string>();
  if (ref) {
    for (const p of ref.levels) {
      const mk = monthKey(p.date);
      if (!dateByMonth.has(mk)) dateByMonth.set(mk, p.date);
    }
  }

  const results: HistoricalCrisisResult[] = [];
  for (const crisis of crises) {
    const startMonth = monthKey(crisis.startDate);
    const rawEndMonth = crisis.endDate
      ? monthKey(crisis.endDate)
      : monthKey(crisis.effectiveEndDate);
    const endMonth = minMonth(rawEndMonth, window.end);

    const included = crisis.endDate
      ? startMonth >= window.start && monthKey(crisis.endDate) <= window.end
      : startMonth >= window.start && monthIndex(endMonth) > monthIndex(startMonth);
    if (!included) continue;

    const effectiveStartDate = dateByMonth.get(startMonth) ?? crisis.startDate;
    const effectiveEndDate = dateByMonth.get(endMonth) ?? crisis.effectiveEndDate;
    const analysisEndDate = dateByMonth.get(window.end) ?? effectiveEndDate;

    results.push(
      calculateHistoricalStress(crisis, strategies, {
        effectiveStartDate,
        effectiveEndDate,
        analysisEndDate,
        provisional: crisis.status !== "closed",
      }),
    );
  }

  return results.sort((a, b) => a.crisis.displayOrder - b.crisis.displayOrder);
}

/**
 * Adaptateur PUR : dérive les résultats de crises d'un `ModelComparisonResult` déjà
 * calculé (mêmes fenêtre / mode / coûts que la comparaison affichée). Permet de
 * réutiliser la comparaison de la page sans relancer le moteur. `[]` si aucune fenêtre.
 */
export function historicalStressFromComparison(
  comparison: ModelComparisonResult,
  crises: readonly HistoricalCrisis[],
): HistoricalCrisisResult[] {
  if (!comparison.window) return [];
  return buildHistoricalStressResults({
    window: { start: comparison.window.start, end: comparison.window.end },
    strategies: comparison.strategies.map((s) => ({
      strategyId: s.id,
      available: s.availability.status === "ok",
      unavailableReason:
        s.availability.status === "unavailable"
          ? UNAVAILABLE_REASON_FR[s.availability.reason]
          : undefined,
      levels: s.cumulativeSeries,
    })),
    crises,
  });
}
