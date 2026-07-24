import { describe, expect, it } from "vitest";

import type { EconomicDataPoint } from "../../types";
import type { TurnoverPoint } from "../backtest";
import {
  clipSeries,
  riskFreeFromMetrics,
  windowMetrics,
  windowTurnoverAnnualized,
  windowTurnoverTrailing12,
} from "./lab-window-metrics";

const pt = (date: string, value: number): EconomicDataPoint => ({ date, value });

describe("clipSeries", () => {
  it("borne inclusivement par mois « YYYY-MM »", () => {
    const s = [pt("2000-11-30", 1), pt("2001-01-31", 2), pt("2001-06-30", 3), pt("2002-01-31", 4)];
    expect(clipSeries(s, "2001-01", "2001-12").map((p) => p.value)).toEqual([2, 3]);
  });
});

describe("windowMetrics", () => {
  it("drawdown / sous l'eau / drawdown courant réinitialisés au début de la fenêtre", () => {
    // Sommet AVANT la fenêtre (150) ne doit PAS compter : la fenêtre repart de son 1er point.
    const s = [
      pt("2000-12-31", 150), // hors fenêtre (sommet antérieur ignoré)
      pt("2001-01-31", 100),
      pt("2001-02-28", 120),
      pt("2001-03-31", 90), // creux : −25 % depuis 120
      pt("2001-04-30", 108),
    ];
    const m = windowMetrics(s, "2001-01", "2001-04", null);
    expect(m.months).toBe(4);
    expect(m.maxDrawdown!).toBeCloseTo(-25, 6);
    expect(m.maxUnderwaterMonths).toBe(2);
    expect(m.currentDrawdown!).toBeCloseTo(-10, 6); // 108 vs sommet 120
    expect(m.sharpe).toBeNull(); // riskFree null
  });

  it("meilleure/pire année = rendements d'années civiles (year-end)", () => {
    const s = [pt("2001-12-31", 110), pt("2002-12-31", 99), pt("2003-12-31", 120)];
    const m = windowMetrics(s, "2001-01", "2003-12", null);
    expect(m.bestYear!).toBeCloseTo((120 / 99 - 1) * 100, 6);
    expect(m.worstYear!).toBeCloseTo((99 / 110 - 1) * 100, 6);
  });

  it("Sharpe = (annualisé − riskFree) / volatilité", () => {
    const s = [
      pt("2001-01-31", 100),
      pt("2001-02-28", 104),
      pt("2001-03-31", 103),
      pt("2001-04-30", 108),
    ];
    const withRf = windowMetrics(s, "2001-01", "2001-04", 2);
    const noRf = windowMetrics(s, "2001-01", "2001-04", 0);
    expect(withRf.annualized).not.toBeNull();
    expect(withRf.volatility).not.toBeNull();
    expect(withRf.sharpe!).toBeCloseTo((withRf.annualized! - 2) / withRf.volatility!, 9);
    expect(noRf.sharpe!).toBeCloseTo(withRf.annualized! / withRf.volatility!, 9);
  });
});

describe("riskFreeFromMetrics", () => {
  it("déduit le cash : riskFree = annualized − sharpe·volatility", () => {
    expect(riskFreeFromMetrics({ annualized: 10, sharpe: 0.5, volatility: 8 })).toBeCloseTo(6, 9);
  });
  it("null si une composante manque", () => {
    expect(riskFreeFromMetrics({ annualized: null, sharpe: 0.5, volatility: 8 })).toBeNull();
    expect(riskFreeFromMetrics({ annualized: 10, sharpe: null, volatility: 8 })).toBeNull();
  });
});

describe("windowTurnover", () => {
  const monthly: TurnoverPoint[] = [
    { date: "2001-01-31", turnover: null, grossTradedWeight: null }, // constitution
    { date: "2001-02-28", turnover: 0.1, grossTradedWeight: 0.2 },
    { date: "2001-03-31", turnover: 0.2, grossTradedWeight: 0.4 },
    { date: "2001-04-30", turnover: 0.3, grossTradedWeight: 0.6 },
  ];
  it("exclut le mois de départ (entrée) et annualise la moyenne × 12", () => {
    // moyenne(0.1, 0.2, 0.3) = 0.2 → × 12 = 2.4
    expect(windowTurnoverAnnualized(monthly, "2001-01", "2001-04")!).toBeCloseTo(2.4, 9);
  });
  it("null pour trailing-12 si moins de 12 mois", () => {
    expect(windowTurnoverTrailing12(monthly, "2001-04")).toBeNull();
  });
});
