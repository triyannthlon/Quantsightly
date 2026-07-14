import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "../types";
import type { FinalAllocation } from "./types";
import { backtestQuadrants, type WeightPoint } from "./backtest";

const D = ["2020-01-15", "2020-02-15", "2020-03-15"];
const alloc = (equities: number, bonds: number, gold: number, cash: number, energy = 0): FinalAllocation => ({
  equities,
  bonds,
  gold,
  cash,
  energy,
});
const flat = (v: number): EconomicDataPoint[] => D.map((date) => ({ date, value: v }));
const ser = (vals: number[]): EconomicDataPoint[] => D.map((date, i) => ({ date, value: vals[i] }));

describe("backtestQuadrants", () => {
  it("applique les poids de t aux rendements de t+1 (zéro look-ahead)", () => {
    // Mois 1 : 100 % Actions ; mois 2 : 100 % Cash.
    const weights: WeightPoint[] = [
      { date: D[0], allocation: alloc(1, 0, 0, 0) },
      { date: D[1], allocation: alloc(0, 0, 0, 1) },
      { date: D[2], allocation: alloc(0, 0, 1, 0) },
    ];
    const res = backtestQuadrants({
      countryCode: "XX",
      weights,
      equityTotalReturn: ser([100, 110, 121]), // +10 %/mois
      bondTotalReturn: flat(100),
      cashTotalReturn: flat(100), // 0 %
      gold: flat(50),
    });
    expect(res.status).toBe("OK");
    if (res.status !== "OK") return;
    // m1→m2 : poids du mois 1 (Actions) × +10 % ⇒ 110. (Look-ahead aurait donné 100 via le Cash du mois 2.)
    expect(res.series.nominal[1].value).toBeCloseTo(110, 6);
    // m2→m3 : poids du mois 2 (Cash) × 0 % ⇒ reste 110 (les actions +10 % sont ignorées).
    expect(res.series.nominal[2].value).toBeCloseTo(110, 6);
  });

  it("produit la courbe réelle déflatée par le CPI", () => {
    const weights: WeightPoint[] = D.map((date) => ({ date, allocation: alloc(1, 0, 0, 0) }));
    const res = backtestQuadrants({
      countryCode: "XX",
      weights,
      equityTotalReturn: ser([100, 110, 121]),
      bondTotalReturn: flat(100),
      cashTotalReturn: flat(100),
      gold: flat(50),
      cpi: ser([100, 110, 121]), // inflation qui suit exactement le nominal
    });
    if (res.status !== "OK") return;
    expect(res.series.real).not.toBeNull();
    const real = res.series.real!;
    // Nominal composé à 121 (+10 %/mois) ; inflation identique ⇒ réel plat à 100.
    expect(res.series.nominal[2].value).toBeCloseTo(121, 6);
    expect(real[real.length - 1].value).toBeCloseTo(100, 4);
    expect(res.metrics.real).not.toBeNull();
  });

  it("poche Énergie : contribue si la série est fournie, exigée si un poids > 0", () => {
    const weights: WeightPoint[] = D.map((date) => ({ date, allocation: alloc(0, 0, 0, 0, 1) })); // 100 % Énergie
    // Sans série énergie → MISSING_SERIES.
    expect(
      backtestQuadrants({
        countryCode: "XX",
        weights,
        equityTotalReturn: flat(100),
        bondTotalReturn: flat(100),
        cashTotalReturn: flat(100),
        gold: flat(50),
      }).status,
    ).toBe("MISSING_SERIES");
    // Avec série énergie → contribue.
    const res = backtestQuadrants({
      countryCode: "XX",
      weights,
      equityTotalReturn: flat(100),
      bondTotalReturn: flat(100),
      cashTotalReturn: flat(100),
      gold: flat(50),
      energyTotalReturn: ser([100, 120, 120]), // +20 % puis 0 %
    });
    if (res.status !== "OK") return;
    expect(res.series.nominal[1].value).toBeCloseTo(120, 6); // 100 % énergie × +20 %
  });

  it("statut MISSING_SERIES sur entrées vides", () => {
    expect(
      backtestQuadrants({
        countryCode: "XX",
        weights: [],
        equityTotalReturn: [],
        bondTotalReturn: [],
        cashTotalReturn: [],
        gold: [],
      }).status,
    ).toBe("MISSING_SERIES");
  });
});
