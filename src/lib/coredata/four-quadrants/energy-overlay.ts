import type { CoreAllocation, FinalAllocation } from "./types";
import type { FourQuadrantsModelSettings } from "./settings";

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

/** Alias au nom d'interface cible (identique à `applyEnergyOverlay`). */
export const computeEnergyOverlay = applyEnergyOverlay;

/**
 * Résout le poids de la poche Énergie selon le MODE du modèle, sans figer la
 * formule du score (différée) :
 *   • `disabled`  → 0 (défaut V1) ;
 *   • `fixed`     → `energyFixedWeight` (borné [0,1]) ;
 *   • `automatic` → `energyScoreToWeight(energyScore, energyMaxWeight)` (score injecté).
 * L'architecture est prête ; l'activation ne changera pas la structure.
 */
export function resolveEnergyWeight(
  settings: FourQuadrantsModelSettings,
  energyScore: number | null,
): number {
  switch (settings.energyMode) {
    case "disabled":
      return 0;
    case "fixed":
      return Math.max(0, Math.min(1, settings.energyFixedWeight ?? 0));
    case "automatic":
      return energyScoreToWeight(energyScore ?? 0, settings.energyMaxWeight);
  }
}
