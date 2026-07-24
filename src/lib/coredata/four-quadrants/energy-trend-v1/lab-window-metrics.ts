// Laboratoire Énergie — RE-FENÊTRAGE PUR des métriques du socle sur la fenêtre commune.
//
// Le socle (overlay off) couvre parfois un historique plus long que la variante + Énergie
// (limitée par la disponibilité de l'indice Énergie). Comparer des métriques calculées sur des
// fenêtres différentes mélangerait « apport de l'Énergie » et « années de marché en plus ». Ce
// module recalcule les métriques du socle sur la fenêtre STRICTEMENT commune, sans toucher le
// moteur figé : il rejoue exactement la logique de `backtest.ts::metricsOf` (mêmes formules,
// `computeKpis` inclus) mais bornée à `[startMonth, endMonth]`. Les mesures sont invariantes à
// l'échelle (CAGR, rendements mensuels, ratios de drawdown) ⇒ le simple découpage réinitialise
// le sommet de référence au début de la fenêtre (aucun re-basage nécessaire pour les métriques).

import type { EconomicDataPoint } from "../../types";
import type { TurnoverPoint } from "../backtest";
import { computeKpis } from "../../compute";

const mk = (d: string): string => d.slice(0, 7);

/** Sous-ensemble de `BacktestMetrics` recalculable depuis la seule courbe (mêmes conventions). */
export interface WindowMetrics {
  months: number;
  annualized: number | null;
  volatility: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  currentDrawdown: number | null;
  maxUnderwaterMonths: number | null;
  bestYear: number | null;
  worstYear: number | null;
}

/** Points d'une courbe dont le mois ∈ [startMonth, endMonth] (clés « YYYY-MM »). */
export function clipSeries(
  series: readonly EconomicDataPoint[],
  startMonth: string,
  endMonth: string,
): EconomicDataPoint[] {
  return series.filter((p) => {
    const m = mk(p.date);
    return m >= startMonth && m <= endMonth;
  });
}

// ── Rejeu EXACT des helpers privés de backtest.ts (garder synchronisés) ──────────

function maxDrawdownPct(index: EconomicDataPoint[]): number | null {
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

function maxUnderwaterMonths(index: EconomicDataPoint[]): number | null {
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

function calendarYearReturns(index: EconomicDataPoint[]): number[] {
  const byYear = new Map<string, number>();
  for (const p of index) byYear.set(p.date.slice(0, 4), p.value);
  const years = [...byYear.keys()].sort();
  const out: number[] = [];
  for (let i = 1; i < years.length; i++) {
    const prev = byYear.get(years[i - 1])!;
    const cur = byYear.get(years[i])!;
    if (prev > 0) out.push((cur / prev - 1) * 100);
  }
  return out;
}

/**
 * Recalcule les métriques d'une courbe base 100 bornée à `[startMonth, endMonth]`. `riskFree` =
 * rendement annualisé du cash local SUR LA MÊME FENÊTRE (cf. `riskFreeFromMetrics`) ⇒ Sharpe en
 * excédent. Reproduit `metricsOf` à l'identique sur la fenêtre découpée.
 */
export function windowMetrics(
  series: readonly EconomicDataPoint[],
  startMonth: string,
  endMonth: string,
  riskFree: number | null,
): WindowMetrics {
  const clipped = clipSeries(series, startMonth, endMonth);
  const k = computeKpis(clipped);
  const last = clipped[clipped.length - 1]?.value;
  const peak = clipped.length
    ? clipped.reduce((mx, p) => (p.value > mx ? p.value : mx), -Infinity)
    : 0;
  const currentDrawdown =
    clipped.length >= 2 && peak > 0 && last > 0 ? (last / peak - 1) * 100 : null;
  const sharpe =
    k.annualized !== null && k.volatility !== null && k.volatility > 0 && riskFree !== null
      ? (k.annualized - riskFree) / k.volatility
      : null;
  const yearly = calendarYearReturns(clipped);
  return {
    months: clipped.length,
    annualized: k.annualized,
    volatility: k.volatility,
    sharpe,
    maxDrawdown: maxDrawdownPct(clipped),
    currentDrawdown,
    maxUnderwaterMonths: maxUnderwaterMonths(clipped),
    bestYear: yearly.length ? Math.max(...yearly) : null,
    worstYear: yearly.length ? Math.min(...yearly) : null,
  };
}

/**
 * Rendement annualisé du cash (taux sans risque) DÉDUIT algébriquement des métriques d'une
 * variante sur la fenêtre commune : `sharpe = (annualized − riskFree) / volatility`. La variante
 * + Énergie est déjà calculée sur la fenêtre commune ⇒ elle fournit le même cash local que le
 * socle re-fenêtré (même série, même fenêtre). `null` si une composante manque.
 */
export function riskFreeFromMetrics(m: {
  annualized: number | null;
  sharpe: number | null;
  volatility: number | null;
}): number | null {
  if (m.annualized === null || m.sharpe === null || m.volatility === null) return null;
  return m.annualized - m.sharpe * m.volatility;
}

/**
 * Rotation annualisée sur la fenêtre commune. Le mois de DÉPART (`startMonth`) est traité comme la
 * constitution (entrée) et exclu, symétriquement pour les deux variantes ; on annualise la moyenne
 * des rotations mensuelles restantes (× 12). `null` si aucun mois exploitable.
 */
export function windowTurnoverAnnualized(
  monthly: readonly TurnoverPoint[],
  startMonth: string,
  endMonth: string,
): number | null {
  const vals = monthly
    .filter((t) => {
      const m = mk(t.date);
      return m > startMonth && m <= endMonth && t.turnover !== null;
    })
    .map((t) => t.turnover as number);
  if (!vals.length) return null;
  return (vals.reduce((s, v) => s + v, 0) / vals.length) * 12;
}

/** Somme des 12 dernières rotations mensuelles valides jusqu'à `endMonth` ; `null` si < 12. */
export function windowTurnoverTrailing12(
  monthly: readonly TurnoverPoint[],
  endMonth: string,
): number | null {
  const vals = monthly
    .filter((t) => mk(t.date) <= endMonth && t.turnover !== null)
    .map((t) => t.turnover as number);
  const last12 = vals.slice(-12);
  return last12.length === 12 ? last12.reduce((s, v) => s + v, 0) : null;
}
