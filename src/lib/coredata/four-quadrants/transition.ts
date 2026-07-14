import type { TransitionState } from "./types";

/** Demi-largeur de la bande neutre par axe, T ∈ [0, 50]. */
export const DEFAULT_TRANSITION_WIDTH = 20;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * État de transition : un axe est « en transition » quand |coord| ≤ T (T borné
 * à [0, 50]). Les deux axes sont évalués séparément. La zone de transition
 * n'affecte QUE l'état + l'allocation cible — jamais les coordonnées brutes, le
 * quadrant affiché, l'intensité, la vitesse, l'accélération ou la trajectoire.
 */
export function computeTransitionState(
  x: number,
  y: number,
  transitionWidth = DEFAULT_TRANSITION_WIDTH,
): TransitionState {
  const T = Math.max(0, Math.min(50, transitionWidth));
  const activityInTransition = Math.abs(x) <= T;
  const monetaryInTransition = Math.abs(y) <= T;
  if (activityInTransition && monetaryInTransition) return "double";
  if (activityInTransition) return "activity";
  if (monetaryInTransition) return "monetary";
  return "none";
}

/**
 * Zone morte progressive utilisée par l'allocation DYNAMIQUE : neutralise la
 * coordonnée dans [-T, T] (renvoie 0), puis rampe linéairement de 0 à ±100
 * entre ±T et ±100. Assure la continuité à la sortie de la bande.
 */
export function applyTransitionDeadZone(value: number, transitionWidth = DEFAULT_TRANSITION_WIDTH): number {
  const v = clamp(value, -100, 100);
  const T = clamp(transitionWidth, 0, 50);
  if (Math.abs(v) <= T) return 0;
  return Math.sign(v) * 100 * ((Math.abs(v) - T) / (100 - T));
}
