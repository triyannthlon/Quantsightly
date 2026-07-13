import type { CoreAllocation } from "./types";
import { DEFAULT_TRANSITION_WIDTH } from "./transition";

/**
 * Méthode 1 — Allocation binaire. Deux blocs indépendants de 50 % :
 *   • bloc activité  : 50 % Actions (x > T) OU 50 % Liquidités (x < −T) OU 25/25 en transition ;
 *   • bloc monétaire : 50 % Or (y > T) OU 50 % Obligations (y < −T) OU 25/25 en transition.
 * Seul le bloc réellement en transition est neutralisé. Somme = 1.
 */
export function computeBinaryAllocation(
  x: number,
  y: number,
  transitionWidth = DEFAULT_TRANSITION_WIDTH,
): CoreAllocation {
  const T = transitionWidth;
  let equities = 0;
  let cash = 0;
  let bonds = 0;
  let gold = 0;

  if (x > T) equities = 0.5;
  else if (x < -T) cash = 0.5;
  else {
    equities = 0.25;
    cash = 0.25;
  }

  if (y > T) gold = 0.5;
  else if (y < -T) bonds = 0.5;
  else {
    gold = 0.25;
    bonds = 0.25;
  }

  return { equities, bonds, gold, cash };
}
