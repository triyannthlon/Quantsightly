/**
 * Couche MARKETS — métriques sur série normalisée
 * ============================================
 *
 * Toutes les métriques ici assument que leur entrée est une
 * NormalizedSeries, c'est-à-dire :
 *   • `bars` triées par date croissante,
 *   • continuité garantie sur le calendrier visé (pas de trou),
 *   • `adjusted_close` toujours défini.
 *
 * Cette hypothèse simplifie énormément le code par rapport à des
 * métriques travaillant sur du brut : plus besoin de LOCF à la volée,
 * plus besoin de gérer les jours manquants. Les modèles peuvent se
 * concentrer sur le calcul mathématique.
 *
 * Convention
 * ----------
 *  • Les rendements sont calculés sur `adjusted_close` (corrigé des
 *    splits et dividendes).
 *  • Le flag `synthetic` reste à la disposition du modèle s'il veut
 *    pondérer ou exclure certaines barres.
 *
 * Statut
 * ------
 * Fichier volontairement minimal : on ajoutera ici, étape par étape,
 * les métriques propriétaires (perfs multi-horizons, volatilités,
 * drawdowns, ratios risque/rendement, etc.).
 * Une seule fonction d'exemple ci-dessous pour amorcer le pattern.
 */

import type { NormalizedSeries, NormalizedBar } from "../series/types";
export type { EodBar } from "../series/types";

/************** drawdownSeries *****/
export function drawdownSeries(bars: NormalizedBar[]): { date: string; value: number }[] {
  /**
   * Série temporelle du drawdown roulant (en %) par rapport au pic historique
   * courant à chaque barre.
   *
   * Formule : `(adjusted_close_t / max(adjusted_close_{0..t}) − 1) × 100`
   *
   * Retourne des valeurs ≤ 0 :
   *   • 0     → barre au niveau du pic (nouveau sommet)
   *   • -10   → 10 % en dessous du pic le plus récent
   *
   * Utilisé pour la sparkline des cards « Max DD » et « DD courant ».
   *
   * @param bars  Barres normalisées triées par date croissante.
   * @returns     Tableau `{ date, value }` de même longueur que `bars`.
   */

  let peak = -Infinity;

  return bars.map((b) => {
    const p = b.adjusted_close;
    if (p > peak) peak = p;
    return { date: b.date, value: peak > 0 ? (p / peak - 1) * 100 : 0 };
  });
}

// ── Formatters ────────────────────────────────────────────────

export function formatPrice(value: number | undefined, currency?: string): string {
  if (value === undefined) return "—";
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
  };
  if (currency === "GBX" || currency === "GBp") {
    return new Intl.NumberFormat("fr-FR", opts).format(value) + " p";
  }
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        ...opts,
      }).format(value);
    } catch {
      /* devise non reconnue par Intl */
    }
  }
  return new Intl.NumberFormat("fr-FR", opts).format(value);
}

export function formatPct(value: number | undefined): string {
  if (value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} %`;
}

export function formatForexRate(value: number | undefined): string {
  if (value === undefined) return "—";
  const decimals = Math.abs(value) < 10 ? 4 : 4;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/************** totalReturn *****/
export function totalReturn(series: NormalizedSeries): number | undefined {
  /**
   * Rendement total entre la 1ʳᵉ et la dernière barre (en %).
   *
   * Formule : `(last / first - 1) × 100`
   * Calculé sur `adjusted_close` (corrige splits + dividendes).
   *
   * @returns `undefined` si la série est trop courte (< 2 barres) ou si la valeur initiale vaut 0.
   *
   * @example
   *   // série de 252 jours, prix passe de 100 à 150 totalReturn(series)  // → 50  (soit +50 %)
   */

  const { bars } = series;

  if (bars.length < 2) return undefined;

  const first = bars[0].adjusted_close;
  const last = bars[bars.length - 1].adjusted_close;

  if (first === 0) return undefined;

  return (last / first - 1) * 100;
}

/******* isoDaysBefore *****/
function isoDaysBefore(anchorISO: string, days: number): string {
  /** Date ISO (YYYY-MM-DD) décalée de N jours calendaires en arrière, en UTC. */

  const d = new Date(`${anchorISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/******* isoMonthsBefore *****/
function isoMonthsBefore(anchorISO: string, months: number): string {
  /** Date ISO décalée de N mois calendaires en arrière, en UTC. */

  const d = new Date(`${anchorISO}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/******* ytdRefDate *****/
function ytdRefDate(anchorISO: string): string {
  /** Référence YTD : 31 décembre de l'année N-1 (relative à l'ancre). */

  const year = Number(anchorISO.slice(0, 4));
  return `${year - 1}-12-31`;
}

/******* findBarIndex *****/
function findBarIndex(bars: NormalizedBar[], targetDate: string): number {
  /**
   * Renvoie l'indice de la DERNIÈRE barre dont date ≤ targetDate,
   * ou `-1` si aucune barre n'est ≤ targetDate.
   *
   * Préconditions : `bars` est trié par `date` croissante (ce que
   * garantit toujours une NormalizedSeries).
   */

  let lo = 0;
  let hi = bars.length - 1;
  let result = -1;

  while (lo <= hi) {
    //(1)
    //(1)
    const mid = (lo + hi) >>> 1;
    if (bars[mid].date <= targetDate) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  } //(1)

  return result;
}

/******* pct *****/
function pct(lastAdj: number, refAdj: number | undefined): number | undefined {
  /**
   * `(last / ref - 1) × 100`, ou `undefined` si `ref` invalide.
   */

  if (refAdj === undefined || refAdj === 0) return undefined;

  return (lastAdj / refAdj - 1) * 100;
}

/************** weekdayReturns *****/
export function weekdayReturns(series: NormalizedSeries): {
  ret1d?: number;
  ret1w?: number;
  ret1m?: number;
  retYtd?: number;
} {
  /**
   * Rendements 1D / 1W / 1M / YTD calculés sur une série normalisée.
   *
   * Conventions de l'horizon :
   *   - 1D  : ancre − 1 jour calendaire    (= jour ouvré précédent)
   *   - 1W  : ancre − 7 jours calendaires  (≈ 5 jours ouvrés)
   *   - 1M  : ancre − 1 mois calendaire    (via LOCF)
   *   - YTD : 31 décembre de l'année N-1   (via LOCF)
   *
   * Calculés sur `adjusted_close` (corrigé splits/dividendes).
   *
   * Pour chaque horizon, on cherche par RECHERCHE BINAIRE la dernière
   * barre de la série dont date ≤ date cible. Comme la série est
   * normalisée (continue, sans trou), c'est trivial — pas besoin de
   * LOCF à la volée.
   *
   * NB : fonctionne sur n'importe quelle `NormalizedSeries`, mais les
   * libellés (1W = 7 jours) supposent un calendrier weekday.
   * Pour la crypto (1d/7d/30d), on définira `cryptoReturns` plus tard.
   *
   * @returns `{ ret1d, ret1w, ret1m, retYtd }` ; chaque champ est
   *          `undefined` si la série est trop courte pour cet horizon.
   */

  const { bars } = series;
  if (bars.length === 0) return {};

  const last = bars[bars.length - 1];
  const lastAdj = last.adjusted_close;
  const anchor = last.date;

  const at = (refDate: string): number | undefined => {
    const idx = findBarIndex(bars, refDate);
    return idx < 0 ? undefined : bars[idx].adjusted_close;
  }; /** Lit la valeur ajustée à une date cible, via LOCF. */

  return {
    ret1d: pct(lastAdj, at(isoDaysBefore(anchor, 1))),
    ret1w: pct(lastAdj, at(isoDaysBefore(anchor, 7))),
    ret1m: pct(lastAdj, at(isoMonthsBefore(anchor, 1))),
    retYtd: pct(lastAdj, at(ytdRefDate(anchor))),
  };
}

/************** distanceTo52WHigh *****/
export function distanceTo52WHigh(series: NormalizedSeries): number | undefined {
  /**
   * Distance (en %) entre le close du JOUR ANCRE et le PLUS HAUT close
   * observé sur les 252 dernières sessions (≈ 52 semaines de trading).
   *
   * Formule :
   *     distanceTo52WHigh = (close_t / max(close_{t-251 … t}) − 1) × 100
   *
   * Conventions clés
   * ----------------
   *  • On utilise `close` NOMINAL (pas `adjusted_close`) : on raisonne sur
   *    le PRIX DE MARCHÉ tel qu'il s'affichait à l'écran chaque jour.
   *  • Fenêtre adaptée au CALENDRIER de la série :
   *      - 252 sessions pour une série WEEKDAY (≈ 52 semaines de trading),
   *      - 365 jours    pour une série CALENDAR (crypto 7j/7).
   *    Si la série est plus courte, on prend tout ce qui est disponible.
   *  • Le max INCLUT le close du jour ancre : si le titre marque un
   *    nouveau plus haut aujourd'hui, la distance vaut exactement 0.
   *
   * Interprétation
   * --------------
   *  • La valeur est ≤ 0 (sauf cas marginal d'égalité = 0).
   *  • `−3.45` → le close est 3,45 % en dessous du plus haut 52 sessions.
   *  • `0`     → le close EST le plus haut 52 sessions (record).
   *
   * @returns `undefined` si la série est vide ou si le max vaut 0.
   */

  const { bars } = series;
  if (bars.length === 0) return undefined;

  const lastClose = bars[bars.length - 1].close;

  // Fenêtre = 252 (weekday) ou 365 (calendar) dernières barres.
  const sessions = series.kind === "calendar" ? 365 : 252;
  const start = Math.max(0, bars.length - sessions);

  let maxClose = -Infinity;

  for (
    let i = start;
    i < bars.length;
    i++ //(1)
  ) {
    //(1)
    if (bars[i].close > maxClose) {
      maxClose = bars[i].close;
    }
  } //(1)

  if (maxClose === -Infinity || maxClose === 0) return undefined;

  return (lastClose / maxClose - 1) * 100;
}

/************** distanceToATH *****/
export function distanceToATH(series: NormalizedSeries): number | undefined {
  /**
   * Distance (en %) entre le close du jour ancre et le PLUS HAUT close
   * observé sur TOUTE la série disponible (ATH = All-Time High).
   *
   * Même convention que distanceTo52WHigh (close nominal, valeur ≤ 0).
   * Pertinent surtout pour la crypto, dont les historiques sont courts
   * et dont l'ATH est un indicateur de marché très suivi.
   *
   * @returns `undefined` si la série est vide ou si l'ATH vaut 0.
   */

  const { bars } = series;
  if (bars.length === 0) return undefined;

  const lastClose = bars[bars.length - 1].close;

  let athClose = -Infinity;
  for (const b of bars) {
    if (b.close > athClose) athClose = b.close;
  }

  if (athClose === -Infinity || athClose === 0) return undefined;

  return (lastClose / athClose - 1) * 100;
}

/************** cryptoReturns *****/
export function cryptoReturns(series: NormalizedSeries): {
  ret1d?: number;
  ret7d?: number;
  ret30d?: number;
  retYtd?: number;
} {
  /**
   * Rendements 1D / 7D / 30D / YTD pour une série CRYPTO (calendrier 7j/7).
   *
   * Conventions de l'horizon (jours calendaires, marché ouvert 7j/7) :
   *   - 1D  : ancre − 1 jour
   *   - 7D  : ancre − 7 jours
   *   - 30D : ancre − 30 jours
   *   - YTD : 31 décembre de l'année N-1
   *
   * Calculés sur `adjusted_close'. Comme la série crypto n'a pas de
   * splits/dividendes, `adjusted_close == close` en pratique.
   *
   * Même algorithme que `weekdayReturns` (recherche binaire LOCF) ;
   * seuls les horizons changent (1W → 7D, 1M → 30D).
   *
   * @returns `{ ret1d, ret7d, ret30d, retYtd }` ; chaque champ est
   *          `undefined` si la série est trop courte pour cet horizon.
   */

  const { bars } = series;
  if (bars.length === 0) return {};

  const last = bars[bars.length - 1];
  const lastAdj = last.adjusted_close;
  const anchor = last.date;

  const at = (refDate: string): number | undefined => {
    const idx = findBarIndex(bars, refDate);
    return idx < 0 ? undefined : bars[idx].adjusted_close;
  };

  return {
    ret1d: pct(lastAdj, at(isoDaysBefore(anchor, 1))),
    ret7d: pct(lastAdj, at(isoDaysBefore(anchor, 7))),
    ret30d: pct(lastAdj, at(isoDaysBefore(anchor, 30))),
    retYtd: pct(lastAdj, at(ytdRefDate(anchor))),
  };
}

/************** range52w *****/
export function range52w(series: NormalizedSeries): { high52w?: number; low52w?: number } {
  /**
   * 52 semaines glissantes — bornes plus haut / plus bas.
   *
   * Renvoie le MAX et le MIN du `close` NOMINAL observés sur les
   * 252 dernières sessions (weekday) ou 365 jours (calendar).
   *
   * Utilisé principalement pour le FOREX où la colonne « 52W Range »
   * affiche la fourchette [low — high] plutôt qu'une distance % au
   * plus haut. Les autres types n'en ont pas besoin.
   *
   * Conventions identiques à `distanceTo52WHigh` :
   *  • Calcul sur `close` nominal (pas `adjusted_close`).
   *  • Fenêtre calendrier-aware (252 weekday OU 365 calendar).
   *  • Si la série est plus courte que la fenêtre → on prend tout
   *    ce qui est disponible.
   *
   * @returns `{ high52w, low52w }`, chacun `undefined` si la série
   *          est vide.
   */

  const { bars } = series;
  if (bars.length === 0) return {};

  const sessions = series.kind === "calendar" ? 365 : 252;
  const start = Math.max(0, bars.length - sessions);

  let maxClose = -Infinity;
  let minClose = Infinity;

  for (
    let i = start;
    i < bars.length;
    i++ //(1)
  ) {
    //(1)
    const c = bars[i].close;
    if (c > maxClose) maxClose = c;
    if (c < minClose) minClose = c;
  } //(1)

  if (maxClose === -Infinity) return {};

  return { high52w: maxClose, low52w: minClose };
}

// ── Métriques panel ───────────────────────────────────────────
//   Utilisées par <AssetPanel> (accordion screener + cards dashboard).
//   Toutes calculées sur adjusted_close.

export type PanelMetrics = {
  cumulativeReturn?: number; // % — rendement total (last/first − 1)
  annualizedReturn?: number; // % — CAGR sur toute la série
  annualizedVolatility?: number; // % — écart-type annualisé des log-rendements
  maxDrawdown?: number; // % ≤ 0 — pire creux pic-à-creux
  currentDrawdown?: number; // % ≤ 0 — recul depuis le dernier pic
  sharpe?: number; // ratio — perf ann. / vol ann. (rf = 0)
  positiveDaysPct?: number; // % — nb jours (rendement > 0) / nb jours total
  periodHigh?: number; // close le plus haut sur la période
  periodLow?: number; // close le plus bas sur la période
};

/************** computePanelMetrics *****/
export function computePanelMetrics(series: NormalizedSeries): PanelMetrics {
  const { bars, kind } = series;
  if (bars.length < 2) return {};

  const annualFactor = kind === "calendar" ? 365 : 252;

  // Barres réelles uniquement (exclure LOCF pour les rendements journaliers)
  const real = bars.filter((b) => !b.synthetic);
  if (real.length < 2) return {};

  const first = real[0].adjusted_close;
  const last = real[real.length - 1].adjusted_close;

  // 0. Rendement cumulé (total return brut sur la période)
  let cumulativeReturn: number | undefined;
  if (first > 0 && last > 0) cumulativeReturn = (last / first - 1) * 100;

  // 1. Rendement annualisé (CAGR)
  let annualizedReturn: number | undefined;
  if (first > 0 && last > 0)
    annualizedReturn = (Math.pow(last / first, annualFactor / real.length) - 1) * 100;

  // 2. Volatilité annualisée (écart-type des log-rendements)
  let annualizedVolatility: number | undefined;
  const logRets: number[] = [];
  for (
    let i = 1;
    i < real.length;
    i++ //(a)
  ) {
    //(a)
    const p = real[i - 1].adjusted_close;
    const c = real[i].adjusted_close;
    if (p > 0 && c > 0) logRets.push(Math.log(c / p));
  } //(a)
  if (logRets.length > 1) {
    const mean = logRets.reduce((s, r) => s + r, 0) / logRets.length;
    const vari = logRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (logRets.length - 1);
    annualizedVolatility = Math.sqrt(vari * annualFactor) * 100;
  }

  // 3. Max Drawdown (sur toute la série, adjusted_close)
  let maxDrawdown: number | undefined;
  let peakAll = -Infinity;
  let maxDD = 0;
  for (const b of bars) {
    //(b)
    //(b)
    const p = b.adjusted_close;
    if (p > peakAll) peakAll = p;
    if (peakAll > 0) {
      const dd = (p / peakAll - 1) * 100;
      if (dd < maxDD) maxDD = dd;
    }
  } //(b)
  if (peakAll > -Infinity) maxDrawdown = maxDD;

  // 4. Drawdown courant (recul depuis le pic historique)
  let currentDrawdown: number | undefined;
  if (peakAll > 0 && last > 0) currentDrawdown = (last / peakAll - 1) * 100;

  // 5. Ratio de Sharpe (rf = 0)
  let sharpe: number | undefined;
  if (
    annualizedReturn !== undefined &&
    annualizedVolatility !== undefined &&
    annualizedVolatility > 0
  )
    sharpe = annualizedReturn / annualizedVolatility;

  // 6. % jours haussiers (rendement journalier > 0 sur barres réelles)
  let positiveDaysPct: number | undefined;
  if (real.length > 1) {
    let pos = 0;
    for (let i = 1; i < real.length; i++)
      if (real[i].adjusted_close > real[i - 1].adjusted_close) pos++;
    positiveDaysPct = (pos / (real.length - 1)) * 100;
  }

  // 7. Range période (haut/bas sur close nominal de toutes les barres)
  let periodHigh: number | undefined;
  let periodLow: number | undefined;
  if (bars.length > 0) {
    let hi = -Infinity,
      lo = Infinity;
    for (const b of bars) {
      if (b.close > hi) hi = b.close;
      if (b.close < lo) lo = b.close;
    }
    periodHigh = hi;
    periodLow = lo;
  }

  return {
    cumulativeReturn,
    annualizedReturn,
    annualizedVolatility,
    maxDrawdown,
    currentDrawdown,
    sharpe,
    positiveDaysPct,
    periodHigh,
    periodLow,
  };
}
