// Transformation des scores robustes en coordonnées bornées du plan, + intensité.

import { robustDeviationSeries, type RobustDeviationOptions } from "./robust-normalization";

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

/** Séries de coordonnées + scores robustes, alignées sur les log-ratios (null tant que l'historique est insuffisant). */
export interface CoordinateSeries {
  x: (number | null)[];
  y: (number | null)[];
  activityScore: (number | null)[];
  monetaryScore: (number | null)[];
}

/**
 * Façade : log-ratios d'activité et monétaires → coordonnées `x, y` + scores
 * robustes, en une passe. `x = 100·tanh(z_A/κ)`, `y = 100·tanh(z_M/κ)` (les deux
 * en convention directe — l'orientation « inflation en haut » vient du ratio
 * or/oblig, pas d'un signe). Source unique du calcul des coordonnées.
 */
export function computeCoordinates(
  activityLogRatios: number[],
  monetaryLogRatios: number[],
  kappa = DEFAULT_KAPPA,
  options?: RobustDeviationOptions,
): CoordinateSeries {
  const zA = robustDeviationSeries(activityLogRatios, options);
  const zM = robustDeviationSeries(monetaryLogRatios, options);
  return {
    activityScore: zA,
    monetaryScore: zM,
    x: zA.map((z) => (z === null ? null : activityCoordinate(z, kappa))),
    y: zM.map((z) => (z === null ? null : monetaryCoordinate(z, kappa))),
  };
}
