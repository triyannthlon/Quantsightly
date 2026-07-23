// « Comportement lors des mois extrêmes des actions » — logique de calcul PURE, PARTAGÉE
// par Browne vs Actions ET 4 Quadrants vs Actions. Aucune dépendance React/DOM.
//
// Question posée : comment le modèle se comporte-t-il pendant les mois où le MARCHÉ ACTIONS
// local a le plus baissé / le plus monté ? Les mois extrêmes sont sélectionnés sur les
// rendements de l'INDICE ACTIONS, puis EXACTEMENT ces mêmes dates sont appliquées à toutes
// les séries. On ne sélectionne JAMAIS séparément les mois extrêmes de chaque stratégie.
//
// Entrées = séries base 100 déjà mode-correctes (nominal/réel), alignées sur la fenêtre
// commune, telles que produites par les moteurs (`series.equityBenchmark`/`equityReal` et
// `series.nominal`/`real`). Ce module NE recalcule aucun modèle.

import type { EconomicDataPoint } from "@/lib/coredata/types";

/** Nombre de mois extrêmes retenus de chaque côté (12 pires, 12 meilleurs). */
export const EXTREME_MONTHS_COUNT = 12;

/** Seuil sous lequel la moyenne actions des meilleurs mois est jugée numériquement négligeable
 *  (participation aux hausses = null plutôt qu'une division instable). */
const UPSIDE_EPS = 1e-6;

export type ExtremeView = "worst" | "best";

/** Une série déclarative (base 100, mode-correct, alignée sur la fenêtre commune). */
export interface ExtremeSeries {
  id: string;
  label: string;
  /** La série de RÉFÉRENCE (indice actions) qui sélectionne les mois extrêmes. */
  isEquity: boolean;
  levels: readonly EconomicDataPoint[];
}

/** Un mois extrême : sa date, le rendement des actions, et le rendement de chaque série (%). */
export interface ExtremeMonth {
  date: string;
  equityReturn: number;
  /** Rendement (%) par id de série ce mois (null si indisponible). */
  returns: Record<string, number | null>;
}

/** Synthèse FACTUELLE d'une série non-actions (aucun classement général). */
export interface ExtremeSynthesis {
  seriesId: string;
  /** Rendement moyen pendant les PIRES mois des actions (%). */
  avgDuringWorst: number | null;
  /** Rendement moyen pendant les MEILLEURS mois des actions (%). */
  avgDuringBest: number | null;
  /** Écart moyen modèle − actions pendant les pires mois, en POINTS de %. */
  avgOutperformanceWorst: number | null;
  /** « Mois mieux protégés » : nombre de pires mois où rendement modèle > rendement actions. */
  betterCount: number;
  /** Dénominateur : pires mois où le rendement du modèle est disponible. */
  evaluatedCount: number;
  /** Part = `betterCount / evaluatedCount` ∈ [0,1] (`null` si aucun mois évalué). */
  betterShare: number | null;
  /**
   * Participation moyenne aux hausses = moyenne(modèle) / moyenne(actions) sur les meilleurs mois
   * (ratio ; autorise > 1 et < 0). `null` si la moyenne actions est nulle / négligeable — jamais 0.
   */
  upsideParticipation: number | null;
}

export interface ExtremeMonthsResult {
  /** Nombre de mois retenus de chaque côté (min(12, mois disponibles)). */
  count: number;
  /** Pires mois des actions, du plus négatif au moins négatif. */
  worst: ExtremeMonth[];
  /** Meilleurs mois des actions, du plus positif au moins positif. */
  best: ExtremeMonth[];
  /** Une entrée par série NON-actions. */
  synthesis: ExtremeSynthesis[];
}

// ─── Aides ─────────────────────────────────────────────────────────────────────

const monthKey = (d: string): string => d.slice(0, 7);

/** Rendements mensuels simples d'une courbe base 100 (points ≤ 0 ignorés). */
function monthlyReturns(levels: readonly EconomicDataPoint[]): { date: string; r: number }[] {
  const out: { date: string; r: number }[] = [];
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1].value;
    if (prev > 0) {
      const r = levels[i].value / prev - 1;
      if (Number.isFinite(r)) out.push({ date: levels[i].date, r });
    }
  }
  return out;
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;

// ─── Calcul ──────────────────────────────────────────────────────────────────

/**
 * Sélectionne les 12 pires et 12 meilleurs mois de l'INDICE ACTIONS sur la fenêtre commune,
 * applique ces dates à toutes les séries, et produit une synthèse factuelle par modèle.
 */
export function computeExtremeMonths(series: readonly ExtremeSeries[]): ExtremeMonthsResult {
  const equity = series.find((s) => s.isEquity);
  const empty: ExtremeMonthsResult = { count: 0, worst: [], best: [], synthesis: [] };
  if (!equity) return empty;

  // Rendements mensuels de CHAQUE série, indexés par mois « YYYY-MM ».
  const returnsById = new Map<string, Map<string, number>>();
  for (const s of series) {
    const m = new Map<string, number>();
    for (const { date, r } of monthlyReturns(s.levels)) m.set(monthKey(date), r);
    returnsById.set(s.id, m);
  }

  const eqReturns = monthlyReturns(equity.levels);
  const sorted = [...eqReturns].sort((a, b) => a.r - b.r);
  const n = sorted.length;
  const k = Math.min(EXTREME_MONTHS_COUNT, n);

  const worstRaw = sorted.slice(0, k); // du plus négatif au moins négatif
  const bestRaw = sorted.slice(n - k).reverse(); // du plus positif au moins positif

  const toMonth = (e: { date: string; r: number }): ExtremeMonth => {
    const mk = monthKey(e.date);
    const returns: Record<string, number | null> = {};
    for (const s of series) {
      const v = returnsById.get(s.id)?.get(mk);
      returns[s.id] = v == null ? null : v * 100;
    }
    return { date: e.date, equityReturn: e.r * 100, returns };
  };

  // Synthèse factuelle par série non-actions (valeurs mensuelles, non annualisées).
  const others = series.filter((s) => !s.isEquity);
  const synthesis: ExtremeSynthesis[] = others.map((s) => {
    const map = returnsById.get(s.id);
    const modelOn = (list: { date: string; r: number }[]) =>
      list.map((e) => map?.get(monthKey(e.date))).filter((v): v is number => v != null);

    const worstModel = modelOn(worstRaw);
    const bestModel = modelOn(bestRaw);

    // « Mois mieux protégés » (modèle > actions) + écart moyen, sur les pires mois évalués.
    let evaluatedCount = 0;
    let betterCount = 0;
    const diffsWorst: number[] = [];
    for (const e of worstRaw) {
      const mv = map?.get(monthKey(e.date));
      if (mv == null) continue;
      evaluatedCount += 1;
      if (mv > e.r) betterCount += 1;
      diffsWorst.push(mv - e.r);
    }
    const meanDiffWorst = mean(diffsWorst);

    // Participation aux hausses = moyenne(modèle) / moyenne(actions) sur les meilleurs mois.
    const meanEqBest = mean(bestRaw.map((e) => e.r));
    const meanModelBest = mean(bestModel);
    const upsideParticipation =
      meanEqBest != null && Math.abs(meanEqBest) > UPSIDE_EPS && meanModelBest != null
        ? meanModelBest / meanEqBest
        : null;

    const avgWorst = mean(worstModel);
    const avgBest = mean(bestModel);

    return {
      seriesId: s.id,
      avgDuringWorst: avgWorst == null ? null : avgWorst * 100,
      avgDuringBest: avgBest == null ? null : avgBest * 100,
      avgOutperformanceWorst: meanDiffWorst == null ? null : meanDiffWorst * 100,
      betterCount,
      evaluatedCount,
      betterShare: evaluatedCount ? betterCount / evaluatedCount : null,
      upsideParticipation,
    };
  });

  return { count: k, worst: worstRaw.map(toMonth), best: bestRaw.map(toMonth), synthesis };
}

/** Jeu de séries base 100 produit par un moteur (Browne / 4Q) : commun aux deux pages. */
export interface ModeledSeriesSet {
  nominal: readonly EconomicDataPoint[];
  real: readonly EconomicDataPoint[] | null;
  equityBenchmark: readonly EconomicDataPoint[];
  equityReal: readonly EconomicDataPoint[] | null;
}

/**
 * Construit les séries déclaratives `[Actions, modèle]` à partir d'un jeu moteur, selon le mode
 * actif. `null` si les niveaux requis sont absents (ex. réel sans CPI) ou trop courts — la carte
 * affiche alors un état « indisponible » plutôt que des valeurs fausses.
 */
export function buildEquityModelSeries(
  set: ModeledSeriesSet,
  realMode: boolean,
  model: { id: string; label: string },
): ExtremeSeries[] | null {
  const equityLevels = realMode ? set.equityReal : set.equityBenchmark;
  const modelLevels = realMode ? set.real : set.nominal;
  if (!equityLevels || !modelLevels || equityLevels.length < 2 || modelLevels.length < 2) {
    return null;
  }
  return [
    { id: "equity", label: "Actions locales", isEquity: true, levels: equityLevels },
    { id: model.id, label: model.label, isEquity: false, levels: modelLevels },
  ];
}
