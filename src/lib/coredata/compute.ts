// Algèbre de séries et indicateurs pour la page Exploration.
// Fonctions pures sur des `EconomicDataPoint[]` (données mensuelles fin de mois).

import type { EconomicDataPoint } from "./types";

/** Paire de valeurs alignées sur une même date. */
export interface AlignedPoint {
  date: string;
  a: number;
  b: number;
}

/** Intersection de deux séries sur leurs dates communes (les deux triées par date). */
export function alignSeries(a: EconomicDataPoint[], b: EconomicDataPoint[]): AlignedPoint[] {
  const byDate = new Map(b.map((p) => [p.date, p.value]));
  const out: AlignedPoint[] = [];
  for (const p of a) {
    const bv = byDate.get(p.date);
    if (bv !== undefined) out.push({ date: p.date, a: p.value, b: bv });
  }
  return out;
}

/** Ratio terme à terme `a / b` sur les dates communes (b = 0 → point ignoré). */
export function ratioSeries(a: EconomicDataPoint[], b: EconomicDataPoint[]): EconomicDataPoint[] {
  return alignSeries(a, b)
    .filter((p) => p.b !== 0)
    .map((p) => ({ date: p.date, value: p.a / p.b }));
}

/** Différence terme à terme `a - b` sur les dates communes. */
export function differenceSeries(
  a: EconomicDataPoint[],
  b: EconomicDataPoint[],
): EconomicDataPoint[] {
  return alignSeries(a, b).map((p) => ({ date: p.date, value: p.a - p.b }));
}

/**
 * Moyenne mobile glissante (fenêtre en nombre de points/mois). Les premiers
 * points, qui n'ont pas assez d'historique, sont omis du résultat.
 */
export function movingAverage(data: EconomicDataPoint[], window: number): EconomicDataPoint[] {
  if (window <= 1) return data;
  const out: EconomicDataPoint[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].value;
    if (i >= window) sum -= data[i - window].value;
    if (i >= window - 1) out.push({ date: data[i].date, value: sum / window });
  }
  return out;
}

/**
 * Bornes de la période commune à deux séries triées par date croissante.
 * Renvoie `null` si l'une des deux est vide.
 */
export function commonDateBounds(
  a: EconomicDataPoint[],
  b: EconomicDataPoint[],
): { from: string; to: string } | null {
  if (a.length === 0 || b.length === 0) return null;
  const aFirst = a[0].date;
  const bFirst = b[0].date;
  const aLast = a[a.length - 1].date;
  const bLast = b[b.length - 1].date;
  return {
    from: aFirst > bFirst ? aFirst : bFirst, // max des premières dates
    to: aLast < bLast ? aLast : bLast, //       min des dernières dates
  };
}

/** Multiplie toutes les valeurs par un facteur constant (rebasage, mise à l'échelle). */
export function scaleSeries(data: EconomicDataPoint[], factor: number): EconomicDataPoint[] {
  return data.map((p) => ({ date: p.date, value: p.value * factor }));
}

/** Restreint une série à une plage de dates ISO inclusive (bornes optionnelles). */
export function filterByDateRange(
  data: EconomicDataPoint[],
  from?: string,
  to?: string,
): EconomicDataPoint[] {
  if (!from && !to) return data;
  return data.filter((p) => (!from || p.date >= from) && (!to || p.date <= to));
}

// ─── Conversion de devise ───────────────────────────────────────────────────

/**
 * Construit la table `date → USD pour 1 unité de devise` à partir d'une série FX
 * spot et de son flag `reverse` (convention de cotation, cf. Chantier 4) :
 * - `reverse = true`  (EUR, GBP…) : la valeur est déjà « USD pour 1 unité ».
 * - `reverse = false` (JPY, KRW…) : la valeur est « unités pour 1 USD » → on inverse.
 */
export function usdPerUnitMap(fxData: EconomicDataPoint[], reverse: boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of fxData) {
    if (p.value === 0) continue;
    m.set(p.date, reverse ? p.value : 1 / p.value);
  }
  return m;
}

/**
 * Convertit une série de sa devise source vers une devise cible, via le pivot
 * USD. Une table `null` représente l'USD lui-même (facteur 1). Un point est omis
 * si l'un des taux manque à sa date.
 */
export function convertCurrency(
  data: EconomicDataPoint[],
  srcUsdPerUnit: Map<string, number> | null,
  tgtUsdPerUnit: Map<string, number> | null,
): EconomicDataPoint[] {
  const out: EconomicDataPoint[] = [];
  for (const p of data) {
    const src = srcUsdPerUnit ? srcUsdPerUnit.get(p.date) : 1;
    const tgt = tgtUsdPerUnit ? tgtUsdPerUnit.get(p.date) : 1;
    if (src === undefined || tgt === undefined || tgt === 0) continue;
    out.push({ date: p.date, value: (p.value * src) / tgt });
  }
  return out;
}

// ─── Indicateurs (KPIs) ─────────────────────────────────────────────────────

export interface SeriesKpis {
  /** Variation % sur le dernier mois (dernier point vs précédent). */
  lastMonth: number | null;
  /** Variation % sur 1 an (12 mois). */
  oneYear: number | null;
  /** Variation % sur 3 ans (36 mois). */
  threeYear: number | null;
  /** Variation % sur 5 ans (60 mois). */
  fiveYear: number | null;
  /** Rendement annualisé (CAGR) sur toute la plage. */
  annualized: number | null;
  /** Volatilité annualisée (écart-type des variations mensuelles × √12), en %. */
  volatility: number | null;
}

/** Variation % entre le dernier point et celui `n` mois plus tôt. */
function pctChangeOver(data: EconomicDataPoint[], n: number): number | null {
  if (data.length <= n) return null;
  const last = data[data.length - 1].value;
  const past = data[data.length - 1 - n].value;
  if (past === 0) return null;
  const r = (last / past - 1) * 100;
  return Number.isFinite(r) ? r : null;
}

export function computeKpis(data: EconomicDataPoint[]): SeriesKpis {
  const n = data.length;

  let annualized: number | null = null;
  if (n >= 2) {
    const first = data[0].value;
    const last = data[n - 1].value;
    const years = (n - 1) / 12;
    if (first > 0 && last > 0 && years > 0) {
      const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;
      annualized = Number.isFinite(cagr) ? cagr : null;
    }
  }

  let volatility: number | null = null;
  if (n >= 3) {
    const returns: number[] = [];
    for (let i = 1; i < n; i++) {
      const prev = data[i - 1].value;
      if (prev !== 0) {
        const r = data[i].value / prev - 1;
        if (Number.isFinite(r)) returns.push(r);
      }
    }
    if (returns.length >= 2) {
      const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance =
        returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
      volatility = Math.sqrt(variance) * Math.sqrt(12) * 100;
    }
  }

  return {
    lastMonth: pctChangeOver(data, 1),
    oneYear: pctChangeOver(data, 12),
    threeYear: pctChangeOver(data, 36),
    fiveYear: pctChangeOver(data, 60),
    annualized,
    volatility,
  };
}
