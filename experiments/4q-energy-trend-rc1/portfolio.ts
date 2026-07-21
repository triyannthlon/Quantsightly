// ─────────────────────────────────────────────────────────────────────────────
// `4q-energy-trend-rc1` — construction de la CIBLE à 5 poches (PUR).
//
// Financement AU PRORATA (figé). Quand l'Énergie est active à poids `w` :
//   Actions = (1-w)·A_v2 · Oblig = (1-w)·O_v2 · Or = (1-w)·G_v2 · Cash = (1-w)·C_v2 · Énergie = w
// Quand inactive : cible EXACTEMENT `4q-standard-v2` avec 5ᵉ poche = 0.
// La bande v2 est appliquée UNE SEULE FOIS ensuite (dans le backtest, pas ici).
// ─────────────────────────────────────────────────────────────────────────────

export interface CoreAllocation {
  equities: number;
  bonds: number;
  gold: number;
  cash: number;
}
export interface FiveAllocation extends CoreAllocation {
  energy: number;
}

/** Poids cible figé de la poche Énergie (spécification rc1). */
export const ENERGY_WEIGHT_RC1 = 0.1;

/**
 * Cible à 5 poches. `active` = signal de tendance du mois ; `w` = poids Énergie (0.10).
 * Somme = 1 par construction (base v2 sommant à 1). Financement prorata des 4 poches.
 */
export function buildFivePocketTarget(
  base: CoreAllocation,
  active: boolean,
  w: number = ENERGY_WEIGHT_RC1,
): FiveAllocation {
  const energy = active ? w : 0;
  const k = 1 - energy;
  return {
    equities: base.equities * k,
    bonds: base.bonds * k,
    gold: base.gold * k,
    cash: base.cash * k,
    energy,
  };
}

/** Somme des 5 poches (contrôle d'invariant = 1). */
export function allocationSum(a: FiveAllocation): number {
  return a.equities + a.bonds + a.gold + a.cash + a.energy;
}
