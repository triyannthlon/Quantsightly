import type { CoreAllocation } from "./types";
import { applyTransitionDeadZone, DEFAULT_TRANSITION_WIDTH } from "./transition";

/**
 * Méthode 2 — Allocation dynamique (DQAE). Transforme continûment les
 * coordonnées (passées par la zone morte) en pondérations :
 *   Actions     = 0,25·(1 + x_T/100)     Liquidités  = 0,25·(1 − x_T/100)
 *   Or          = 0,25·(1 + y_T/100)     Obligations = 0,25·(1 − y_T/100)
 * où x_T, y_T sont les coordonnées après zone morte. Somme = 1 par construction.
 */
export function computeDynamicAllocation(
  x: number,
  y: number,
  transitionWidth = DEFAULT_TRANSITION_WIDTH,
): CoreAllocation {
  const xAdjusted = applyTransitionDeadZone(x, transitionWidth);
  const yAdjusted = applyTransitionDeadZone(y, transitionWidth);
  const equities = 0.25 * (1 + xAdjusted / 100);
  const cash = 0.25 * (1 - xAdjusted / 100);
  const gold = 0.25 * (1 + yAdjusted / 100);
  const bonds = 0.25 * (1 - yAdjusted / 100);
  return { equities, bonds, gold, cash };
}
