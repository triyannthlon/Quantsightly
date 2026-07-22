// Métriques COMPARABLES — SOURCE UNIQUE des formules appliquées identiquement à
// toutes les stratégies (Browne, 4Q dynamique, 4Q binaire). Fonctions PURES sur des
// courbes d'index (base 100) et des rendements mensuels. Aucune n'a d'état ni
// d'accès base. CAGR et volatilité délèguent à `computeKpis` (déjà partagé et testé)
// pour rester cohérents avec le reste de l'app.

import type { EconomicDataPoint } from "../types";
import { computeKpis } from "../compute";

/** Rendements mensuels simples `vₜ/vₜ₋₁ − 1` d'une courbe (points ≤ 0 ignorés). */
export function monthlyReturns(index: EconomicDataPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < index.length; i++) {
    const prev = index[i - 1].value;
    if (prev > 0) {
      const r = index[i].value / prev - 1;
      if (Number.isFinite(r)) out.push(r);
    }
  }
  return out;
}

/** Performance cumulée `dernier/premier − 1` (%). */
export function cumulativeReturnPct(index: EconomicDataPoint[]): number | null {
  if (index.length < 2) return null;
  const first = index[0].value;
  const last = index[index.length - 1].value;
  return first > 0 && last > 0 ? (last / first - 1) * 100 : null;
}

/** Rendement annualisé (CAGR, %) — via `computeKpis`. */
export function annualizedPct(index: EconomicDataPoint[]): number | null {
  return computeKpis(index).annualized;
}

/** Volatilité annualisée (%) — via `computeKpis`. */
export function volatilityPct(index: EconomicDataPoint[]): number | null {
  return computeKpis(index).volatility;
}

/** Pire drawdown pic-à-creux (%, ≤ 0). */
export function maxDrawdownPct(index: EconomicDataPoint[]): number | null {
  if (index.length < 2) return null;
  let peak = -Infinity;
  let mdd = 0;
  for (const p of index) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) {
      const dd = (p.value / peak - 1) * 100;
      if (dd < mdd) mdd = dd;
    }
  }
  return mdd;
}

/** Recul depuis le pic historique à la dernière date (%, ≤ 0). */
export function currentDrawdownPct(index: EconomicDataPoint[]): number | null {
  if (index.length < 2) return null;
  const last = index[index.length - 1].value;
  const peak = index.reduce((mx, p) => (p.value > mx ? p.value : mx), -Infinity);
  return peak > 0 && last > 0 ? (last / peak - 1) * 100 : null;
}

/** Plus longue série de mois consécutifs sous le dernier sommet. */
export function maxUnderwaterMonths(index: EconomicDataPoint[]): number | null {
  if (index.length < 2) return null;
  let peak = -Infinity;
  let run = 0;
  let maxRun = 0;
  for (const p of index) {
    if (p.value >= peak) {
      peak = p.value;
      run = 0;
    } else {
      run += 1;
      if (run > maxRun) maxRun = run;
    }
  }
  return maxRun;
}

/** Série de drawdown roulant (%, ≤ 0). */
export function drawdownSeries(index: EconomicDataPoint[]): EconomicDataPoint[] {
  let peak = -Infinity;
  return index.map((p) => {
    if (p.value > peak) peak = p.value;
    return { date: p.date, value: peak > 0 ? (p.value / peak - 1) * 100 : 0 };
  });
}

/**
 * Downside deviation ANNUALISÉE (%) — écart-type des rendements négatifs autour
 * de MAR = 0 : `sqrt(Σ min(r,0)² / n) · √12 · 100`. `null` si trop peu de points.
 */
export function downsideDeviationAnnualPct(returns: number[]): number | null {
  if (returns.length < 2) return null;
  const negSq = returns.reduce((s, r) => s + (r < 0 ? r * r : 0), 0);
  const dd = Math.sqrt(negSq / returns.length) * Math.sqrt(12) * 100;
  return dd;
}

/** Sortino = CAGR / downside deviation. `null` si downside nul (aucune baisse). */
export function sortino(annualized: number | null, downsideAnnualPct: number | null): number | null {
  if (annualized === null || downsideAnnualPct === null || downsideAnnualPct <= 0) return null;
  return annualized / downsideAnnualPct;
}

/** Sharpe = (CAGR − CAGR sans risque) / volatilité. */
export function sharpe(
  annualized: number | null,
  riskFreeAnnualized: number,
  volatility: number | null,
): number | null {
  if (annualized === null || volatility === null || volatility <= 0) return null;
  return (annualized - riskFreeAnnualized) / volatility;
}

/**
 * Pire performance sur une fenêtre glissante de `window` mois (%), calculée
 * directement sur la courbe (`vₜ₊w/vₜ − 1`). `null` si aucune fenêtre complète.
 */
export function worstRollingPct(index: EconomicDataPoint[], window: number): number | null {
  if (index.length <= window) return null;
  let worst: number | null = null;
  for (let i = 0; i + window < index.length; i++) {
    const a = index[i].value;
    const b = index[i + window].value;
    if (a > 0 && b > 0) {
      const r = (b / a - 1) * 100;
      if (worst === null || r < worst) worst = r;
    }
  }
  return worst;
}

/** Pire rendement mensuel (%). */
export function worstMonthPct(returns: number[]): number | null {
  return returns.length ? Math.min(...returns) * 100 : null;
}

/**
 * Expected Shortfall HISTORIQUE au niveau `alpha` (ex. 0.05, 0.01) : moyenne des
 * pires `alpha`-fractiles des rendements mensuels (%). `k = max(1, floor(alpha·n))`.
 * `null` si aucun rendement.
 */
export function expectedShortfallPct(returns: number[], alpha: number): number | null {
  if (!returns.length) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const k = Math.max(1, Math.floor(alpha * sorted.length));
  let sum = 0;
  for (let i = 0; i < k; i++) sum += sorted[i];
  return (sum / k) * 100;
}

/** Asymétrie (skewness) des rendements (moments de population). `null` si σ = 0. */
export function skewness(returns: number[]): number | null {
  const n = returns.length;
  if (n < 3) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const m2 = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const m3 = returns.reduce((s, r) => s + (r - mean) ** 3, 0) / n;
  const sd = Math.sqrt(m2);
  return sd > 0 ? m3 / sd ** 3 : null;
}

/** Kurtosis EXCÉDENTAIRE (kurtosis − 3) des rendements. `null` si σ = 0. */
export function excessKurtosis(returns: number[]): number | null {
  const n = returns.length;
  if (n < 4) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const m2 = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const m4 = returns.reduce((s, r) => s + (r - mean) ** 4, 0) / n;
  return m2 > 0 ? m4 / m2 ** 2 - 3 : null;
}

/**
 * Performances annualisées de chaque fenêtre glissante de `window` mois (%) :
 * pour chaque `i`, `(vₜ₊w/vₜ)^(12/window) − 1`. Tableau vide si aucune fenêtre.
 */
export function rollingAnnualizedReturns(index: EconomicDataPoint[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + window < index.length; i++) {
    const a = index[i].value;
    const b = index[i + window].value;
    if (a > 0 && b > 0) {
      const ann = (Math.pow(b / a, 12 / window) - 1) * 100;
      if (Number.isFinite(ann)) out.push(ann);
    }
  }
  return out;
}

/** Médiane d'un tableau (copie triée). `null` si vide. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
