// Tests unitaires des métriques comparables (fonctions pures, réponses connues).
import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "../types";
import {
  monthlyReturns,
  cumulativeReturnPct,
  maxDrawdownPct,
  currentDrawdownPct,
  maxUnderwaterMonths,
  downsideDeviationAnnualPct,
  sortino,
  sharpe,
  worstRollingPct,
  worstMonthPct,
  expectedShortfallPct,
  skewness,
  excessKurtosis,
  rollingAnnualizedReturns,
  median,
} from "./metrics";

const idx = (values: number[]): EconomicDataPoint[] =>
  values.map((value, i) => ({ date: `2000-${String((i % 12) + 1).padStart(2, "0")}-28`, value }));

describe("model-comparison/metrics", () => {
  it("rendements mensuels ignorent les points ≤ 0", () => {
    expect(monthlyReturns(idx([100, 110, 99]))).toEqual([expect.closeTo(0.1, 10), expect.closeTo(-0.1, 10)]);
  });

  it("performance cumulée = dernier/premier − 1", () => {
    expect(cumulativeReturnPct(idx([100, 110]))).toBeCloseTo(10, 10);
    expect(cumulativeReturnPct(idx([100, 90]))).toBeCloseTo(-10, 10);
    expect(cumulativeReturnPct(idx([100]))).toBeNull();
  });

  it("max drawdown = pire creux pic-à-creux", () => {
    // pic 120 (idx1) → creux 90 (idx2) = −25 %.
    expect(maxDrawdownPct(idx([100, 120, 90, 145]))).toBeCloseTo(-25, 10);
    expect(maxDrawdownPct(idx([100, 110, 120]))).toBe(0); // monotone
  });

  it("drawdown courant = dernier vs pic historique", () => {
    expect(currentDrawdownPct(idx([100, 120, 90]))).toBeCloseTo(-25, 10);
    expect(currentDrawdownPct(idx([100, 120, 130]))).toBe(0);
  });

  it("durée max sous l'eau = plus longue série sous le sommet", () => {
    // pic 120 (idx1) ; 90,95,100 sous l'eau (3 mois) ; 130 repasse au-dessus.
    expect(maxUnderwaterMonths(idx([100, 120, 90, 95, 100, 130]))).toBe(3);
    expect(maxUnderwaterMonths(idx([100, 110, 120]))).toBe(0);
  });

  it("downside deviation annualisée (MAR = 0)", () => {
    // rendements [+10 %, −10 %] → sqrt(0,01/2)·√12·100 ≈ 24,495.
    const rets = monthlyReturns(idx([100, 110, 99]));
    expect(downsideDeviationAnnualPct(rets)).toBeCloseTo(24.4949, 3);
  });

  it("Sortino = CAGR / downside ; null si aucune baisse", () => {
    expect(sortino(10, 20)).toBeCloseTo(0.5, 10);
    expect(sortino(10, 0)).toBeNull();
    expect(sortino(null, 20)).toBeNull();
  });

  it("Sharpe = (CAGR − cash) / vol", () => {
    expect(sharpe(10, 2, 16)).toBeCloseTo(0.5, 10);
    expect(sharpe(10, 2, 0)).toBeNull();
  });

  it("pire fenêtre glissante (sur la courbe)", () => {
    // 1 mois : +10, −10, +10 → −10 ; 2 mois : ≈ −1 sur les deux fenêtres.
    const c = idx([100, 110, 99, 108.9]);
    expect(worstRollingPct(c, 1)).toBeCloseTo(-10, 6);
    expect(worstRollingPct(c, 2)).toBeCloseTo(-1, 6);
    expect(worstRollingPct(idx([100, 110]), 12)).toBeNull(); // pas de fenêtre complète
  });

  it("pire mois", () => {
    expect(worstMonthPct(monthlyReturns(idx([100, 110, 99])))).toBeCloseTo(-10, 6);
    expect(worstMonthPct([])).toBeNull();
  });

  it("Expected Shortfall historique = moyenne des pires α-fractiles", () => {
    const rets = [-0.05, -0.03, -0.01, 0.02, 0.04];
    expect(expectedShortfallPct(rets, 0.05)).toBeCloseTo(-5, 6); // k=1 → pire mois
    expect(expectedShortfallPct(rets, 0.4)).toBeCloseTo(-4, 6); // k=2 → moyenne(−5,−3)
    expect(expectedShortfallPct([], 0.05)).toBeNull();
  });

  it("skewness ≈ 0 sur des rendements symétriques", () => {
    expect(skewness([-0.1, 0, 0.1])).toBeCloseTo(0, 10);
    expect(skewness([0.01, 0.01])).toBeNull(); // < 3 points
  });

  it("kurtosis excédentaire : null si écart-type nul", () => {
    expect(excessKurtosis([0.01, 0.01, 0.01, 0.01])).toBeNull();
    expect(excessKurtosis([-0.1, 0, 0.1])).toBeNull(); // < 4 points
    expect(typeof excessKurtosis([-0.2, -0.05, 0, 0.05, 0.2])).toBe("number");
  });

  it("performances annualisées glissantes", () => {
    // 13 points, fenêtre 12 mois, ×1,1 sur l'année → une fenêtre à +10 %.
    const c = idx([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 110]);
    const roll = rollingAnnualizedReturns(c, 12);
    expect(roll).toHaveLength(1);
    expect(roll[0]).toBeCloseTo(10, 6);
  });

  it("médiane", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
