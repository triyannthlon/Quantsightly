import { describe, expect, it } from "vitest";

import type { BacktestResult, QuadrantModel } from "../index";
import { buildEnergyLabComparison, energyLabSignature } from "./lab";

// Fabriques synthétiques minimales (on ne teste QUE la logique d'assemblage, pas le moteur).
const okBacktest = (energyHeld: number, energyTarget: number): BacktestResult =>
  ({
    status: "OK",
    countryCode: "US",
    availability: { status: "OK", reason: null, firstInvalidMonth: null },
    start: "2000-01",
    end: "2020-12",
    series: {
      nominal: [],
      real: null,
      equityBenchmark: [],
      equityReal: null,
      inflationIndex: null,
      sleeves: { equities: [], bonds: [], cash: [], gold: [] },
    },
    metrics: {
      nominal: {
        months: 251,
        cumulative: 100,
        annualized: 6,
        volatility: 10,
        maxDrawdown: -20,
        currentDrawdown: -2,
        sharpe: 0.5,
        bestYear: 20,
        worstYear: -10,
        maxUnderwaterMonths: 24,
      },
      real: null,
      equity: {
        months: 251,
        cumulative: 80,
        annualized: 5,
        volatility: 15,
        maxDrawdown: -50,
        currentDrawdown: -5,
        sharpe: 0.3,
        bestYear: 30,
        worstYear: -40,
        maxUnderwaterMonths: 60,
      },
      equityReal: null,
    },
    contributions: {
      equities: 3,
      bonds: 1,
      gold: 0.5,
      cash: 0.2,
      energy: energyHeld > 0 ? 0.9 : 0,
    },
    turnover: { monthly: [], averageMonthly: 0.02, annualized: 0.24, trailing12Months: null },
    heldAllocation: { equities: 0.24, bonds: 0.24, gold: 0.24, cash: 0.24, energy: energyHeld },
    targetAllocation: { equities: 0.23, bonds: 0.23, gold: 0.23, cash: 0.23, energy: energyTarget },
  }) as BacktestResult;

const failedBacktest = (): BacktestResult =>
  ({
    status: "MISSING_SERIES",
    countryCode: "US",
    availability: { status: "UNAVAILABLE", reason: "missing_series", firstInvalidMonth: null },
  }) as BacktestResult;

const model = (scores: (number | null)[]): QuadrantModel =>
  ({
    status: "OK",
    countryCode: "US",
    monthlyResults: scores.map(
      (energyScore, i) =>
        ({ date: `2020-${String(i + 1).padStart(2, "0")}-01`, energyScore }) as never,
    ),
    latest: {
      date: `2020-${String(scores.length).padStart(2, "0")}-01`,
      energyScore: scores[scores.length - 1],
    } as never,
  }) as unknown as QuadrantModel;

const build = (over: Partial<Parameters<typeof buildEnergyLabComparison>[0]> = {}) =>
  buildEnergyLabComparison({
    strategy: "dynamic",
    countryCode: "US",
    countryFr: "États-Unis",
    currency: "USD",
    standardBacktest: okBacktest(0, 0),
    energyBacktest: okBacktest(0.1, 0.1),
    energyModel: model([null, 0, 100, 100]),
    ...over,
  });

describe("buildEnergyLabComparison", () => {
  it("étiquettes standard vs + Énergie, overlays EXPLICITES", () => {
    const c = build()!;
    expect(c.standard.label).toBe("4Q Continue");
    expect(c.standard.overlay).toBe("off");
    expect(c.energy.label).toBe("4Q Continue + Énergie");
    expect(c.energy.overlay).toBe("trend-v1");
  });

  it("binary → 4Q Régime", () => {
    expect(build({ strategy: "binary" })!.energy.label).toBe("4Q Régime + Énergie");
  });

  it("état du signal : dernier mois, poids détenu/cible, frise mensuelle (jamais interpolée)", () => {
    const c = build()!;
    expect(c.signal.lastMonth).toBe("2020-04-01");
    expect(c.signal.status).toBe("active");
    expect(c.signal.heldWeight).toBeCloseTo(0.1);
    expect(c.signal.targetWeight).toBeCloseTo(0.1);
    expect(c.signal.reallocationRequired).toBe(false);
    expect(c.signal.history.map((h) => h.state)).toEqual([
      "unavailable",
      "inactive",
      "active",
      "active",
    ]);
  });

  it("réallocation requise quand détenu ≠ cible (bande)", () => {
    expect(build({ energyBacktest: okBacktest(0.05, 0.1) })!.signal.reallocationRequired).toBe(
      true,
    );
  });

  it("null si un backtest ou le modèle énergie n'est pas OK", () => {
    expect(build({ standardBacktest: failedBacktest() })).toBeNull();
    expect(build({ energyBacktest: failedBacktest() })).toBeNull();
    expect(
      build({ energyModel: { status: "MISSING_SERIES" } as unknown as QuadrantModel }),
    ).toBeNull();
  });
});

describe("energyLabSignature (golden compact de production)", () => {
  it("compte mois actifs/indisponibles + expose métriques, contributions, allocation", () => {
    const sig = energyLabSignature(build()!);
    expect(sig.signal.activeMonths).toBe(2);
    expect(sig.signal.unavailableMonths).toBe(1);
    expect(sig.energy.metricsNominal.annualized).toBe(6);
    expect(sig.energy.metricsNominal.sharpe).toBe(0.5);
    expect(sig.energy.held.energy).toBeCloseTo(0.1);
    expect(sig.energy.contributions.energy).toBeCloseTo(0.9);
    expect(sig.standard.contributions.energy).toBe(0); // standard = aucune poche énergie
    expect(sig.energy.turnoverAnnualized).toBeCloseTo(0.24);
  });
});
