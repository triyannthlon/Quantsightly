import type { CoreAllocation, FinalAllocation } from "./types";

// Surcouche Énergie, appliquée APRÈS l'allocation des quatre poches principales.
// v1 : le moteur accepte un `energyScore ∈ [-100, +100]` FOURNI par la couche
// macro (on ne fige pas ici la formule du score). La performance de la poche
// s'appuiera sur un indice Énergie investissable (MSCI World Energy), converti
// en devise locale par le service — géré au backtest, pas ici.

/** Poids maximal de la poche Énergie (défaut 20 %). */
export const DEFAULT_MAX_ENERGY_WEIGHT = 0.2;

/**
 * Score énergie → poids de la poche : 0 si le score est ≤ 0, sinon montée
 * linéaire jusqu'à `maxWeight` à +100. Ex. score 50, max 20 % → 10 %.
 */
export function energyScoreToWeight(energyScore: number, maxWeight = DEFAULT_MAX_ENERGY_WEIGHT): number {
  if (energyScore <= 0) return 0;
  const e = Math.min(energyScore, 100);
  return maxWeight * (e / 100);
}

/**
 * Applique l'overlay : la poche Énergie est financée au PRORATA des quatre
 * poches de base (chacune multipliée par 1 − w_E). Somme des cinq = 1.
 */
export function applyEnergyOverlay(base: CoreAllocation, energyWeight: number): FinalAllocation {
  const energy = Math.max(0, Math.min(1, energyWeight));
  const multiplier = 1 - energy;
  return {
    equities: base.equities * multiplier,
    bonds: base.bonds * multiplier,
    gold: base.gold * multiplier,
    cash: base.cash * multiplier,
    energy,
  };
}
