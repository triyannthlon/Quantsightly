// « Écart normalisé robuste à la moyenne mobile sur sept ans » — le cœur du
// modèle. Ce N'EST PAS un z-score robuste académique : le point zéro est calé
// sur la MOYENNE MOBILE ANTÉRIEURE (le franchissement de la tendance = le côté
// du quadrant), pas sur la médiane historique.
//
// Benchmark = les 84 mois ANTÉRIEURS (le mois courant est comparé à ce repère
// mais NE contribue PAS à son propre benchmark — aligné avec `quadrant.ts`) :
//   μ_{t-1} = (1/84) · Σ_{i=1..84} r_{t-i}                 (MM7 antérieure, hors mois courant)
//   d_t     = r_t − μ_{t-1}                                (écart courant à la tendance)
//   s_{t-1} = max(1,4826 · MAD(d_{t-84}, …, d_{t-1}), s_min)   (MAD sur les ÉCARTS antérieurs)
//   z_t     = d_t / s_{t-1}
//
// Le MAD porte sur les écarts roulants antérieurs : un score valide exige donc
// ≈ 2·window + 1 mois d'historique (169 avec le défaut). En deçà → `null`
// (« ne pas produire artificiellement un score complet »).

/** Fenêtre commune (MM7 antérieure ET fenêtre du MAD) = 7 ans = 84 mois. */
export const DEFAULT_WINDOW = 84;
/** Constante rendant le MAD comparable à un écart-type sous loi ≈ normale. */
export const MAD_TO_SIGMA = 1.4826;
/** Plancher de dispersion (évite division par zéro / scores géants en période plate). */
export const DEFAULT_SIGMA_FLOOR = 1e-6;

/** Moyenne arithmétique. */
export function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Médiane (copie triée, ne mute pas l'entrée). */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Median Absolute Deviation : médiane des écarts absolus à la médiane. */
export function medianAbsoluteDeviation(values: number[]): number {
  if (values.length === 0) return NaN;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

export interface RobustDeviationOptions {
  /** Fenêtre de la MM7 antérieure et du MAD des écarts (défaut 84). */
  window?: number;
  sigmaFloor?: number;
}

/** Nombre minimal de mois pour un score valide, avec cette fenêtre (2·window + 1). */
export function minMonthsForScore(window = DEFAULT_WINDOW): number {
  return 2 * window + 1;
}

/**
 * Série des écarts normalisés robustes zₜ, alignée sur `logRatios` (même
 * longueur) : `null` tant que l'historique est insuffisant, un nombre ensuite.
 */
export function robustDeviationSeries(
  logRatios: number[],
  options: RobustDeviationOptions = {},
): (number | null)[] {
  const W = options.window ?? DEFAULT_WINDOW;
  const floor = options.sigmaFloor ?? DEFAULT_SIGMA_FLOOR;
  const n = logRatios.length;

  // 1) Écarts antérieurs d_i = r_i − μ_{i-1}, μ_{i-1} = moyenne des W mois AVANT i.
  //    Somme glissante O(n) : à l'entrée de l'itération i, `sum` = r[i-W .. i-1].
  const d: (number | null)[] = new Array(n).fill(null);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (i >= W) d[i] = logRatios[i] - sum / W; // sum = r[i-W .. i-1] à ce point
    sum += logRatios[i];
    if (i >= W) sum -= logRatios[i - W];
  }

  // 2) z_t = d_t / max(1,4826 · MAD(d[t-W .. t-1]), s_min).
  const out: (number | null)[] = new Array(n).fill(null);
  for (let t = 2 * W; t < n; t++) {
    const dt = d[t];
    if (dt === null) continue;
    const windowResiduals: number[] = [];
    let complete = true;
    for (let k = t - W; k < t; k++) {
      const e = d[k];
      if (e === null) {
        complete = false;
        break;
      }
      windowResiduals.push(e);
    }
    if (!complete) continue;
    const s = Math.max(MAD_TO_SIGMA * medianAbsoluteDeviation(windowResiduals), floor);
    out[t] = dt / s;
  }
  return out;
}

/** Dernier score robuste disponible, ou `null` si l'historique est insuffisant. */
export function lastRobustDeviation(logRatios: number[], options: RobustDeviationOptions = {}): number | null {
  const series = robustDeviationSeries(logRatios, options);
  for (let t = series.length - 1; t >= 0; t--) {
    if (series[t] !== null) return series[t];
  }
  return null;
}
