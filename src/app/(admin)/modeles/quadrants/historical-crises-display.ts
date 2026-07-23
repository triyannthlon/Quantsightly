// Logique d'AFFICHAGE PURE de la section « Comportement pendant les crises ». Aucune
// dépendance React/DOM : testable en isolation. Le composant `.tsx` ne fait que rendre le
// résultat de ces fonctions — il ne recalcule RIEN sur les stratégies (cf. étape 1).

import type { ComparisonStrategyId } from "@/lib/coredata/model-comparison/types";
import type {
  HistoricalCrisisResult,
  HistoricalCrisisStrategyResult,
} from "@/lib/coredata/model-comparison/historical-stress/types";

/** Mesure affichée (bascule d'affichage — ne change aucun calcul). */
export type Measure = "performance" | "drawdown";
/** Périmètre affiché (filtre d'importance — ne change aucun calcul). */
export type Scope = "primary" | "all";

/**
 * Valeur d'une stratégie pour la mesure active : `null` si indisponible (jamais 0), sinon
 * la performance cumulée ou la perte maximale (%). Ne convertit JAMAIS une indispo en 0.
 */
export function strategyValue(s: HistoricalCrisisStrategyResult, measure: Measure): number | null {
  if (!s.available) return null;
  return measure === "performance" ? s.cumulativeReturn : s.maxDrawdown;
}

/** Filtre de périmètre : « principales » = importance `primary` ; « toutes » = tout. */
export function filterByScope(
  results: readonly HistoricalCrisisResult[],
  scope: Scope,
): HistoricalCrisisResult[] {
  return results.filter((r) => scope === "all" || r.crisis.importance === "primary");
}

/** Amplitude maximale (≥ 1) des valeurs visibles pour la mesure — échelle COMMUNE des barres. */
export function maxAbsValue(
  results: readonly HistoricalCrisisResult[],
  visibleIds: readonly ComparisonStrategyId[],
  measure: Measure,
): number {
  let m = 0;
  for (const r of results) {
    for (const s of r.strategies) {
      if (!visibleIds.includes(s.strategyId) || !s.available) continue;
      const v = strategyValue(s, measure);
      if (v != null) m = Math.max(m, Math.abs(v));
    }
  }
  return m || 1;
}

/**
 * Indisponibilité au NIVEAU CRISE : aucune stratégie visible n'est calculable (→ afficher
 * la ligne sans barres avec « Données indisponibles » + la raison, jamais un 0 trompeur).
 */
export function crisisUnavailability(
  r: HistoricalCrisisResult,
  visibleIds: readonly ComparisonStrategyId[],
): { allUnavailable: boolean; reason?: string } {
  const byId = new Map(r.strategies.map((s) => [s.strategyId, s]));
  const visible = visibleIds
    .map((id) => byId.get(id))
    .filter((s): s is HistoricalCrisisStrategyResult => !!s);
  const allUnavailable = visible.length > 0 && visible.every((s) => !s.available);
  const reason = visible.find((s) => !s.available)?.unavailableReason;
  return { allUnavailable, reason };
}

/**
 * Meilleure stratégie sur CETTE crise pour une métrique (repère FACTUEL, §16). Le max
 * gagne : performance la plus élevée, ou perte la MOINS profonde (la plus proche de 0).
 * `null` si moins de 2 stratégies disponibles (comparaison sans objet).
 */
export function bestByMetric(
  r: HistoricalCrisisResult,
  visibleIds: readonly ComparisonStrategyId[],
  metric: (s: HistoricalCrisisStrategyResult) => number | null,
): HistoricalCrisisStrategyResult | null {
  const byId = new Map(r.strategies.map((s) => [s.strategyId, s]));
  const avail = visibleIds
    .map((id) => byId.get(id))
    .filter((s): s is HistoricalCrisisStrategyResult => !!s && s.available && metric(s) != null);
  if (avail.length < 2) return null;
  return avail.reduce((a, s) => ((metric(s) ?? -Infinity) > (metric(a) ?? -Infinity) ? s : a));
}

// ─── Échelle / axe (communs à toutes les crises affichées) ───────────────────

/**
 * Échelle « ronde » : un pas lisible (1 / 2 / 2,5 / 5 / 10 · 10ⁿ) et une borne qui couvre
 * toutes les valeurs. Sert l'axe gradué ET la géométrie des barres.
 */
export function niceScale(maxAbs: number): { step: number; maxTick: number } {
  const m = maxAbs || 1;
  const pow = Math.pow(10, Math.floor(Math.log10(m / 4)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => m / s <= 5) ?? 10 * pow;
  const maxTick = Math.max(step, Math.ceil(m / step) * step);
  return { step, maxTick };
}

/** Graduations du domaine (symétrique en performance, ≤ 0 en perte maximale). */
export function tickValues(measure: Measure, step: number, maxTick: number): number[] {
  const round2 = (t: number) => Math.round(t * 100) / 100;
  const out: number[] = [];
  if (measure === "performance") {
    for (let t = -maxTick; t <= maxTick + 1e-9; t += step) out.push(round2(t));
  } else {
    for (let t = -maxTick; t <= 1e-9; t += step) out.push(round2(t));
  }
  return out;
}

/**
 * Géométrie x (0–100 %) avec axe zéro. Le domaine est piloté par `maxTick` (≥ maxAbs) :
 * marge naturelle aux barres + graduations exactement alignées. En « perte maximale »
 * (valeurs ≤ 0) une petite marge positive décale l'axe zéro du bord droit.
 */
export function geometry(
  measure: Measure,
  maxTick: number,
): { xOf: (v: number) => number; zeroX: number } {
  const lo = -maxTick;
  const hi = measure === "performance" ? maxTick : maxTick * 0.08;
  const span = hi - lo || 1;
  const xOf = (v: number) => ((v - lo) / span) * 100;
  return { xOf, zeroX: xOf(0) };
}
