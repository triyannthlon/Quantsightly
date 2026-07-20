import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "../types";
import type { FinalAllocation } from "./types";
import {
  backtestQuadrants,
  computePreRebalanceWeights,
  computeMonthlyTurnover,
  type WeightPoint,
} from "./backtest";

const D = ["2020-01-15", "2020-02-15", "2020-03-15"];
const alloc = (
  equities: number,
  bonds: number,
  gold: number,
  cash: number,
  energy = 0,
): FinalAllocation => ({
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

describe("turnover", () => {
  it("aucun changement → turnover 0", () => {
    const w = alloc(0.4, 0.3, 0.2, 0.1);
    expect(computeMonthlyTurnover(w, w)).toBeCloseTo(0, 12);
  });

  it("réallocation de 10 % → turnover 10 %", () => {
    // Actions 40→50, Obligations 30→20 : Σ|Δ| = 20 %, turnover unidirectionnel = 10 %.
    expect(
      computeMonthlyTurnover(alloc(0.4, 0.3, 0.2, 0.1), alloc(0.5, 0.2, 0.2, 0.1)),
    ).toBeCloseTo(0.1, 12);
  });

  it("bascule complète entre actifs → turnover 100 %", () => {
    // 50 % Actions / 50 % Or → 50 % Cash / 50 % Obligations : Σ|Δ| = 200 %, turnover = 100 %.
    expect(computeMonthlyTurnover(alloc(0.5, 0, 0.5, 0), alloc(0, 0.5, 0, 0.5))).toBeCloseTo(1, 12);
  });

  it("poids dérivés : somment à 1 ; même cible → turnover positif", () => {
    const post = alloc(0.25, 0.25, 0.25, 0.25);
    const pre = computePreRebalanceWeights(post, alloc(0.2, -0.1, 0, 0)); // actions +20 %, oblig −10 %
    expect(pre.equities + pre.bonds + pre.gold + pre.cash + pre.energy).toBeCloseTo(1, 12);
    // Revenir à la MÊME cible après dérive coûte un turnover > 0.
    expect(computeMonthlyTurnover(pre, post)).toBeGreaterThan(0);
  });

  it("via le backtest : 1er mois exclu (turnover null), annualisée = 12 × moyenne", () => {
    const weights: WeightPoint[] = D.map((date) => ({ date, allocation: alloc(1, 0, 0, 0) }));
    const res = backtestQuadrants({
      countryCode: "XX",
      weights,
      equityTotalReturn: ser([100, 110, 121]),
      bondTotalReturn: flat(100),
      cashTotalReturn: flat(100),
      gold: flat(50),
    });
    if (res.status !== "OK") return;
    expect(res.turnover.monthly[0].turnover).toBeNull(); // constitution initiale
    expect(res.turnover.annualized).toBeCloseTo(res.turnover.averageMonthly * 12, 12);
    // 100 % Actions maintenu chaque mois → aucun rééquilibrage → turnover ~0.
    expect(res.turnover.annualized).toBeCloseTo(0, 6);
  });
});

describe("backtest — fenêtrage (poids détenus à l'entrée)", () => {
  // 25 mois : 2015-01 → 2017-01.
  const M: string[] = [];
  for (let i = 0; i < 25; i++) {
    const y = 2015 + Math.floor(i / 12);
    const m = (i % 12) + 1;
    M.push(`${y}-${String(m).padStart(2, "0")}-15`);
  }
  const mser = (fn: (i: number) => number): EconomicDataPoint[] =>
    M.map((date, i) => ({ date, value: fn(i) }));
  const mflat = (v: number): EconomicDataPoint[] => M.map((date) => ({ date, value: v }));
  // Allocation qui alterne chaque mois → un rééquilibrage réel à chaque frontière.
  const weights: WeightPoint[] = M.map((date, i) => ({
    date,
    allocation: i % 2 === 0 ? alloc(0.5, 0.1, 0.2, 0.2) : alloc(0.1, 0.5, 0.2, 0.2),
  }));
  const input = {
    countryCode: "XX",
    weights,
    equityTotalReturn: mser((i) => 100 * 1.01 ** i),
    bondTotalReturn: mser((i) => 100 * 1.003 ** i),
    cashTotalReturn: mflat(100),
    gold: mser((i) => 50 * 1.002 ** i),
  };

  it("windowYears=null : 1er mois = constitution (turnover null), comportement inchangé", () => {
    const res = backtestQuadrants({ ...input });
    if (res.status !== "OK") return;
    expect(res.turnover.monthly[0].turnover).toBeNull();
  });

  it("fenêtre débutant après le modèle : 1er mois = transaction d'ENTRÉE réelle (≠ constitution)", () => {
    const full = backtestQuadrants({ ...input });
    const win = backtestQuadrants({ ...input, windowYears: 1 });
    if (full.status !== "OK" || win.status !== "OK") return;
    // La fenêtre démarre à 100, plus tard que le modèle, sur moins de mois.
    expect(win.series.nominal[0].value).toBe(100);
    expect(win.series.nominal[0].date > full.series.nominal[0].date).toBe(true);
    expect(win.metrics.nominal.months).toBeLessThan(full.metrics.nominal.months);
    // ⚠️ Le 1er mois de la fenêtre porte une VRAIE rotation (poids réellement dérivés
    // avant transaction), et NON une constitution : la transaction d'entrée est comptée.
    expect(win.turnover.monthly[0].turnover).not.toBeNull();
    expect(win.turnover.monthly[0].turnover as number).toBeGreaterThan(0);
  });
});
