import type { TransitionState } from "./types";

/** Demi-largeur de la bande neutre par axe, T ∈ [0, 50]. */
export const DEFAULT_TRANSITION_WIDTH = 20;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * État de transition : un axe est « en transition » quand |coord| ≤ T.
 * La zone de transition n'affecte QUE l'allocation, jamais les coordonnées
 * brutes ni la cinématique (vitesse / accélération).
 */
export function getTransitionState(x: number, y: number, transitionWidth = DEFAULT_TRANSITION_WIDTH): TransitionState {
  const activity = Math.abs(x) <= transitionWidth;
  const monetary = Math.abs(y) <= transitionWidth;
  if (activity && monetary) return "double";
  if (activity) return "activity";
  if (monetary) return "monetary";
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
