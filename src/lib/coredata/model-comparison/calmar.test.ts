// Ratio de Calmar (dérivé d'affichage) + raisons d'indisponibilité. Ces tests garantissent
// qu'un « — » à l'écran ne masque JAMAIS une erreur de calcul ni une donnée manquante
// inattendue : chaque cause est distinguée (historique / drawdown nul / anomalie).
import { describe, it, expect } from "vitest";
import { calmar, calmarUnavailableReason, CALMAR_MIN_MONTHS, type CalmarResult } from "./calmar";
import type { ComparisonMetrics } from "./types";

/** Métriques minimales — seuls `months`, `annualized`, `maxDrawdown` pilotent le Calmar. */
const M = (over: Partial<ComparisonMetrics>): ComparisonMetrics => ({
  months: 120,
  start: "2000-01",
  end: "2010-01",
  cumulative: null,
  annualized: 8,
  volatility: null,
  sharpe: null,
  sortino: null,
  maxDrawdown: -20,
  currentDrawdown: null,
  maxUnderwaterMonths: null,
  worstRolling12m: null,
  worstMonth: null,
  worstQuarter: null,
  expectedShortfall95: null,
  expectedShortfall99: null,
  downsideDeviation: null,
  skewness: null,
  excessKurtosis: null,
  annualizedTurnover: null,
  reallocationsPerYear: null,
  annualCostEstimate: null,
  cumulativeCost: null,
  rolling: [],
  ...over,
});

const notOk = (r: CalmarResult) => r as Exclude<CalmarResult, { kind: "ok" }>;

describe("calmar — ratio dérivé", () => {
  it("cas nominal : CAGR ÷ |max drawdown|", () => {
    expect(calmar(M({ annualized: 8, maxDrawdown: -20 }))).toEqual({ kind: "ok", value: 0.4 });
  });

  it("performance négative → Calmar négatif (reste calculable)", () => {
    const r = calmar(M({ annualized: -6, maxDrawdown: -20 }));
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value).toBeCloseTo(-0.3, 10);
  });

  it("exactement 36 mois → calculable", () => {
    expect(calmar(M({ months: CALMAR_MIN_MONTHS })).kind).toBe("ok");
  });
});

describe("calmar — indisponibilités distinguées (« — » + raison)", () => {
  it("historique < 36 mois → insufficient-history", () => {
    const r = calmar(M({ months: 35 }));
    expect(r.kind).toBe("insufficient-history");
    expect(calmarUnavailableReason(notOk(r))).toBe("Historique insuffisant : 36 mois minimum");
  });

  it("max drawdown nul → no-drawdown", () => {
    const r = calmar(M({ maxDrawdown: 0 }));
    expect(r.kind).toBe("no-drawdown");
    expect(calmarUnavailableReason(notOk(r))).toBe("Ratio non calculable : aucun drawdown observé");
  });

  it("valeur attendue absente (annualized ou maxDrawdown null) → anomaly", () => {
    expect(calmar(M({ annualized: null })).kind).toBe("anomaly");
    expect(calmar(M({ maxDrawdown: null })).kind).toBe("anomaly");
    expect(calmarUnavailableReason(notOk(calmar(M({ annualized: null }))))).toBe(
      "Valeur indisponible : donnée attendue manquante (anomalie)",
    );
  });

  it("priorité : historique trop court prime sur une donnée absente", () => {
    expect(calmar(M({ months: 12, annualized: null })).kind).toBe("insufficient-history");
  });
});
