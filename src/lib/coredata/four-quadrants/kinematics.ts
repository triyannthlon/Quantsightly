import type { Acceleration, Velocity } from "./types";
import { median } from "./robust-normalization";

// Cinématique du régime : vitesse et accélération du point (x, y) dans le plan.
// Calculées sur les coordonnées BRUTES (la zone de transition ne doit pas
// modifier la dynamique économique mesurée). Métriques INFORMATIVES : elles ne
// modifient pas directement l'allocation cible en v1.

/** Fenêtre de la vitesse (mois). */
export const DEFAULT_VELOCITY_WINDOW = 6;
/** Fenêtre de l'accélération (mois). */
export const DEFAULT_ACCEL_WINDOW = 6;

/**
 * Pente robuste de Theil–Sen : médiane des pentes (vⱼ − vᵢ)/(j − i) sur toutes
 * les paires i < j, l'indice servant de temps (unité : par pas de temps).
 */
export function theilSenSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const slopes: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      slopes.push((values[j] - values[i]) / (j - i));
    }
  }
  return median(slopes);
}

/**
 * Vitesse à la dernière date = pentes Theil–Sen de x et y sur les `window`
 * derniers mois. `null` si l'historique est plus court que la fenêtre.
 */
export function computeVelocity(xs: number[], ys: number[], window = DEFAULT_VELOCITY_WINDOW): Velocity | null {
  if (xs.length < window || ys.length < window) return null;
  const x = theilSenSlope(xs.slice(-window));
  const y = theilSenSlope(ys.slice(-window));
  return { x, y, magnitude: Math.hypot(x, y), angleDegrees: (Math.atan2(y, x) * 180) / Math.PI };
}

/** Série de vitesse (Theil–Sen glissant) alignée : v[t] défini pour t ≥ window − 1. */
export function velocitySeries(coords: number[], window = DEFAULT_VELOCITY_WINDOW): (number | null)[] {
  const out: (number | null)[] = new Array(coords.length).fill(null);
  for (let t = window - 1; t < coords.length; t++) {
    out[t] = theilSenSlope(coords.slice(t - window + 1, t + 1));
  }
  return out;
}

/**
 * Accélération = pente Theil–Sen de la série de vitesse sur les `accelWindow`
 * derniers points. `null` si l'on ne dispose pas d'assez de vitesses.
 */
export function computeAcceleration(
  xs: number[],
  ys: number[],
  velocityWindow = DEFAULT_VELOCITY_WINDOW,
  accelWindow = DEFAULT_ACCEL_WINDOW,
): Acceleration | null {
  const vx = velocitySeries(xs, velocityWindow).filter((v): v is number => v !== null);
  const vy = velocitySeries(ys, velocityWindow).filter((v): v is number => v !== null);
  if (vx.length < accelWindow || vy.length < accelWindow) return null;
  const x = theilSenSlope(vx.slice(-accelWindow));
  const y = theilSenSlope(vy.slice(-accelWindow));
  return { x, y, magnitude: Math.hypot(x, y) };
}

/**
 * Vitesse radiale : projection de la vitesse sur la direction centre→point.
 * > 0 : le régime se renforce ; < 0 : retour vers le centre ; ≈ 0 : déplacement
 * latéral. `null` si le point est trop proche du centre (direction indéfinie).
 */
export function radialVelocity(
  x: number,
  y: number,
  vx: number,
  vy: number,
  minDistance = 5,
): number | null {
  const dist = Math.hypot(x, y);
  if (dist < minDistance) return null;
  return (x * vx + y * vy) / dist;
}

/**
 * Accélération directionnelle : projection de l'accélération sur la direction du
 * mouvement. > 0 : le déplacement accélère ; < 0 : il ralentit. `null` si la
 * vitesse est quasi nulle (direction indéfinie).
 */
export function directionalAcceleration(
  vx: number,
  vy: number,
  ax: number,
  ay: number,
  minSpeed = 1e-6,
): number | null {
  const speed = Math.hypot(vx, vy);
  if (speed < minSpeed) return null;
  return (vx * ax + vy * ay) / speed;
}
