// « Écart normalisé robuste à la moyenne mobile sur sept ans » — le cœur du
// modèle. Ce N'EST PAS un z-score robuste académique : le point zéro est calé
// sur la MOYENNE MOBILE (le franchissement de la tendance = le côté du quadrant),
// pas sur la médiane historique.
//
// ⚠️ Quantsightly ne travaille QUE sur des mois CLÔTURÉS : le moteur tourne après
// disponibilité des données définitives du dernier mois. Ce mois est donc complet
// et ENTRE dans la moyenne mobile et la dispersion (aucun biais d'anticipation).
// Fenêtre = [t-83 … t] (84 observations, mois courant INCLUS) :
//   MM84_t  = (1/84) · Σ_{i=0..83} r_{t-i}                    (MM7, mois courant inclus)
//   d_t     = r_t − MM84_t                                    (écart courant à la tendance)
//   MAD_t   = MAD(d_{t-83}, …, d_t)                           (MAD sur les écarts de la fenêtre)
//   z_t     = d_t / max(1,4826 · MAD_t, s_min)
//
// (Aujourd'hui `quadrant.ts` — page Régimes macro — EXCLUT encore le mois courant
//  de sa MM7. Décision Yann : les 2 moteurs doivent converger sur CETTE convention
//  — mois courant inclus, aucune divergence — dette à exécuter à la finalisation 4Q.)
//
// Le MAD porte sur les écarts roulants : un score valide exige donc ≈ 2·window − 1
// mois d'historique (167 avec le défaut). En deçà → `null` (« ne pas produire
// artificiellement un score complet »).

/** Fenêtre commune (MM7 ET fenêtre du MAD) = 7 ans = 84 mois, mois courant inclus. */
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
  /** Fenêtre de la MM7 et du MAD des écarts (défaut 84, mois courant inclus). */
  window?: number;
  sigmaFloor?: number;
}

/** Nombre minimal de mois pour un score valide, avec cette fenêtre (2·window − 1). */
export function minMonthsForScore(window = DEFAULT_WINDOW): number {
  return 2 * window - 1;
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

  // 1) Écarts d_i = r_i − MM84_i, MM84_i = moyenne des W mois SE TERMINANT à i
  //    (mois courant inclus). Somme glissante O(n) : sum = r[i-W+1 .. i].
  const d: (number | null)[] = new Array(n).fill(null);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += logRatios[i];
    if (i >= W) sum -= logRatios[i - W];
    if (i >= W - 1) d[i] = logRatios[i] - sum / W;
  }

  // 2) z_t = d_t / max(1,4826 · MAD(d[t-W+1 .. t]), s_min).
  const out: (number | null)[] = new Array(n).fill(null);
  for (let t = 2 * W - 2; t < n; t++) {
    const dt = d[t];
    if (dt === null) continue;
    const windowResiduals: number[] = [];
    let complete = true;
    for (let k = t - W + 1; k <= t; k++) {
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
