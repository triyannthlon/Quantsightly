// Transformation des scores robustes en coordonnées bornées du plan, + intensité.

/** Aplatissement de la sigmoïde tanh. Plus κ est grand, plus la montée est douce. */
export const DEFAULT_KAPPA = 2;

/**
 * Score robuste → coordonnée bornée [-100, +100] via `100·tanh(z/κ)`.
 * Repères : z=0 → 0 ; z≈±1 (signal établi) → ±46 ; z≈±2 (signal fort) → ±76.
 */
export function scoreToCoordinate(z: number, kappa = DEFAULT_KAPPA): number {
  return 100 * Math.tanh(z / kappa);
}

/** Coordonnée d'activité x = 100·tanh(z/κ). x>0 ⇒ efficacité énergétique / expansion. */
export function activityCoordinate(activityScore: number, kappa = DEFAULT_KAPPA): number {
  return scoreToCoordinate(activityScore, kappa);
}

/**
 * Coordonnée monétaire y = 100·tanh(z/κ) — MÊME transformation directe que
 * l'activité (PAS d'inversion de signe). L'orientation « inflation en haut »
 * vient du ratio lui-même (`monetaryRatio = or / oblig`), pas d'un signe : z>0
 * (l'or bat les obligations) ⇒ y>0 (haut = inflation).
 */
export function monetaryCoordinate(monetaryScore: number, kappa = DEFAULT_KAPPA): number {
  return scoreToCoordinate(monetaryScore, kappa);
}

/**
 * Intensité du régime = distance du point au centre, ramenée à [0, 100].
 * Calculée sur les coordonnées BRUTES (avant zone de transition).
 */
export function regimeIntensity(x: number, y: number): number {
  return Math.hypot(x, y) / Math.SQRT2;
}
