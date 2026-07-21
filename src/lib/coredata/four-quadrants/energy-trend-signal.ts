// Signal de tendance de la surcouche `energy-trend-v1` (mode `energyMode="trend"`).
// Couche PURE (aucun accès base) : le service charge la série SPDYENT (niveau USD) et
// appelle cette fonction, puis injecte le résultat dans `buildModel` (via `energyScore`).
//
// Règle FIGÉE, non configurable : `active_t = SPDYENT_t > SMA_L(SPDYENT)_t`, avec
//   • `SMA_L` INCLUANT la clôture du mois `t` (moyenne de `[t-L+1 … t]`) ;
//   • uniquement les observations disponibles ≤ `t` (aucune information de `t+1`) ;
//   • strict « > » : si `SPDYENT_t == SMA_L_t` ⇒ INACTIF ;
//   • la décision du mois `t` est appliquée aux rendements de `t+1` (géré par le backtest).
//
// ⚠️ AUCUNE interpolation ni « dernier signal connu ». Un mois n'est DISPONIBLE que si les
// `L` observations mensuelles qui le terminent sont présentes, valides (> 0) et CONTIGUËS.
// Sinon il est absent de la sortie ⇒ « signal indisponible » (la poche Énergie y reste à 0,
// comme le candidat validé `4q-energy-trend-rc1`).

import type { EconomicDataPoint } from "../types";

/** Lookback FIGÉ de `energy-trend-v1` (mois). Non configurable. */
export const ENERGY_TREND_V1_LOOKBACK = 6;

const monthKey = (date: string): string => date.slice(0, 7);
const monthIndex = (ym: string): number =>
  Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1);

/**
 * Signal de tendance mensuel `SPDYENT > SMA_L`. Renvoie `Map<"YYYY-MM", boolean>`
 * UNIQUEMENT pour les mois où le signal est disponible (≥ `lookback` observations
 * valides et contiguës). Un mois absent = signal indisponible (jamais interpolé).
 *
 * @param series série SPDYENT (niveau USD), points mensuels fin de mois.
 * @param lookback `L` (défaut = `ENERGY_TREND_V1_LOOKBACK` = 6).
 */
export function computeEnergyTrendSignal(
  series: EconomicDataPoint[],
  lookback: number = ENERGY_TREND_V1_LOOKBACK,
): Map<string, boolean> {
  if (lookback < 1) throw new Error("lookback must be ≥ 1");

  // Réduction mensuelle : dernière observation valide (> 0) de chaque mois.
  const byMonth = new Map<string, number>();
  for (const p of series) {
    if (Number.isFinite(p.value) && p.value > 0) byMonth.set(monthKey(p.date), p.value);
  }
  const months = [...byMonth.keys()].sort();

  const out = new Map<string, boolean>();
  for (let i = lookback - 1; i < months.length; i++) {
    // Fenêtre `[i-L+1 … i]` : `L` mois présents, valides ET consécutifs (aucun trou).
    let contiguousValid = true;
    let sum = 0;
    for (let k = i - lookback + 1; k <= i; k++) {
      const v = byMonth.get(months[k]);
      if (v === undefined || !(v > 0)) {
        contiguousValid = false;
        break;
      }
      if (k > i - lookback + 1 && monthIndex(months[k]) !== monthIndex(months[k - 1]) + 1) {
        contiguousValid = false; // trou de calendrier ⇒ indisponible (pas d'interpolation)
        break;
      }
      sum += v;
    }
    if (!contiguousValid) continue;

    out.set(months[i], byMonth.get(months[i])! > sum / lookback); // strict « > »
  }
  return out;
}

/**
 * Score Énergie injectable dans `buildModel` pour le mode `trend`, à partir du signal :
 * `100` quand ACTIF, `0` quand disponible mais inactif ; les mois indisponibles sont
 * ABSENTS (⇒ `energyScore` `null` côté moteur ⇒ poids 0). On ne fabrique jamais un signal.
 */
export function energyTrendScores(
  signal: Map<string, boolean>,
): { date: string; value: number }[] {
  return [...signal.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, active]) => ({ date: `${ym}-01`, value: active ? 100 : 0 }));
}
