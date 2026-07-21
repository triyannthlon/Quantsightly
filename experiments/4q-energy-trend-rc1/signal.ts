// ─────────────────────────────────────────────────────────────────────────────
// `4q-energy-trend-rc1` — SIGNAL de tendance Énergie (PUR, testable isolément).
//
// Règle FIGÉE : energyActive_t = SPDYENT_t > SMA_L(SPDYENT)_t
//   • SMA_L INCLUT la clôture du mois t (moyenne de [t-L+1 … t]) ;
//   • n'utilise QUE les observations disponibles ≤ t (aucune info de t+1) ;
//   • strict « > » : si SPDYENT_t == SMA_L_t → INACTIF ;
//   • le signal du mois t est appliqué aux rendements de t+1 (géré par le backtest).
//
// Le signal utilise le NIVEAU USD de SPDYENT (mondial, identique à tous les pays).
// ⚠️ Aucune interpolation : un mois est DISPONIBLE seulement si les L observations
// mensuelles qui le terminent sont présentes, valides (>0) et CONTIGUËS. Sinon le
// mois est absent de la sortie → « signal indisponible » (la poche Énergie y sera 0).
// ─────────────────────────────────────────────────────────────────────────────

export interface SeriesPoint {
  date: string;
  value: number;
}

/** Lookback figé de la spécification rc1 (mois). */
export const SMA_LOOKBACK_RC1 = 6;

const monthKey = (date: string): string => date.slice(0, 7);
const monthIndex = (ym: string): number =>
  Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1);

/**
 * Signal de tendance mensuel. Renvoie `Map<"YYYY-MM", boolean>` UNIQUEMENT pour les
 * mois où le signal est disponible (≥ L observations valides contiguës). Un mois absent
 * = signal indisponible.
 *
 * @param series série SPDYENT (niveau USD), points mensuels (fin de mois).
 * @param lookback L (défaut = 6, la valeur figée rc1).
 */
export function computeTrendSignal(
  series: SeriesPoint[],
  lookback: number = SMA_LOOKBACK_RC1,
): Map<string, boolean> {
  if (lookback < 1) throw new Error("lookback must be ≥ 1");

  // Réduction mensuelle : dernière observation valide (>0) de chaque mois.
  const byMonth = new Map<string, number>();
  for (const p of series) {
    if (Number.isFinite(p.value) && p.value > 0) byMonth.set(monthKey(p.date), p.value);
  }
  const months = [...byMonth.keys()].sort();

  const out = new Map<string, boolean>();
  for (let i = lookback - 1; i < months.length; i++) {
    // Fenêtre [i-L+1 … i] : L mois présents, valides ET consécutifs (aucun trou).
    let contiguousValid = true;
    let sum = 0;
    for (let k = i - lookback + 1; k <= i; k++) {
      const v = byMonth.get(months[k]);
      if (v === undefined || !(v > 0)) {
        contiguousValid = false;
        break;
      }
      if (k > i - lookback + 1 && monthIndex(months[k]) !== monthIndex(months[k - 1]) + 1) {
        contiguousValid = false; // trou de calendrier → signal indisponible (pas d'interpolation)
        break;
      }
      sum += v;
    }
    if (!contiguousValid) continue;

    const sma = sum / lookback;
    out.set(months[i], byMonth.get(months[i])! > sma); // strict « > »
  }
  return out;
}
