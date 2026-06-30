import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "./types";
import {
  getAxisSignal,
  getQuadrant,
  getConvictionLevel,
  computeQuadrant,
} from "./quadrant";

// 85 dates mensuelles consécutives (84 d'historique + 1 point courant).
function months(n: number): string[] {
  const out: string[] = [];
  let y = 2019;
  let m = 1;
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-15`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// Série constante `base` sur les 84 premiers mois, puis `last` au mois courant.
function series(dates: string[], base: number, last: number): EconomicDataPoint[] {
  return dates.map((date, i) => ({ date, value: i < dates.length - 1 ? base : last }));
}

describe("getAxisSignal", () => {
  it("classe selon la bande neutre ±0,05", () => {
    expect(getAxisSignal(0.06)).toBe("ACCELERATING");
    expect(getAxisSignal(-0.06)).toBe("DECELERATING");
    expect(getAxisSignal(0.02)).toBe("NEUTRAL");
    expect(getAxisSignal(-0.05)).toBe("NEUTRAL"); // borne incluse dans le neutre
  });
});

describe("getQuadrant", () => {
  it("mappe les 4 combinaisons et TRANSITION dès qu'un axe est neutre", () => {
    expect(getQuadrant("ACCELERATING", "ACCELERATING")).toBe("GROWTH_UP_INFLATION_UP");
    expect(getQuadrant("ACCELERATING", "DECELERATING")).toBe("GROWTH_UP_INFLATION_DOWN");
    expect(getQuadrant("DECELERATING", "ACCELERATING")).toBe("GROWTH_DOWN_INFLATION_UP");
    expect(getQuadrant("DECELERATING", "DECELERATING")).toBe("GROWTH_DOWN_INFLATION_DOWN");
    expect(getQuadrant("ACCELERATING", "NEUTRAL")).toBe("TRANSITION");
    expect(getQuadrant("NEUTRAL", "DECELERATING")).toBe("TRANSITION");
  });
});

describe("getConvictionLevel", () => {
  it("prend la distance du plus faible des deux axes", () => {
    expect(getConvictionLevel(0.5, 0.05)).toBe("LOW"); // min 0,05 < 0,10
    expect(getConvictionLevel(0.5, 0.2)).toBe("MEDIUM"); // min 0,20
    expect(getConvictionLevel(0.4, 0.35)).toBe("HIGH"); // min 0,35 ≥ 0,30
  });
});

describe("computeQuadrant", () => {
  const dates = months(85);

  it("classe un boom inflationniste (croissance + inflation accélèrent)", () => {
    const r = computeQuadrant({
      countryCode: "XX",
      equity: series(dates, 100, 120), // actions/pétrole : ln(12) vs ln(10)
      oil: series(dates, 10, 10),
      gold: series(dates, 50, 60), // or/oblig : ln(6) vs ln(5)
      bond: series(dates, 10, 10),
    });
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.growthSignal).toBe("ACCELERATING");
    expect(r.inflationSignal).toBe("ACCELERATING");
    expect(r.quadrant).toBe("GROWTH_UP_INFLATION_UP");
    expect(r.regimeName).toBe("Boom inflationniste");
    expect(r.growthGap).toBeCloseTo(Math.log(1.2), 6);
    expect(r.inflationGap).toBeCloseTo(Math.log(1.2), 6);
    expect(r.convictionLevel).toBe("MEDIUM");
    expect(r.date).toBe("2026-01-15");
  });

  it("classe une contraction déflationniste (les deux décélèrent)", () => {
    const r = computeQuadrant({
      countryCode: "XX",
      equity: series(dates, 100, 80),
      oil: series(dates, 10, 10),
      gold: series(dates, 50, 40),
      bond: series(dates, 10, 10),
    });
    expect(r.status === "OK" && r.quadrant).toBe("GROWTH_DOWN_INFLATION_DOWN");
  });

  it("renvoie TRANSITION si un axe reste dans la bande neutre", () => {
    const r = computeQuadrant({
      countryCode: "XX",
      equity: series(dates, 100, 101), // gap ≈ ln(1,01) ≈ 0,01 → neutre
      oil: series(dates, 10, 10),
      gold: series(dates, 50, 60),
      bond: series(dates, 10, 10),
    });
    expect(r.status === "OK" && r.quadrant).toBe("TRANSITION");
  });

  it("signale les séries manquantes et l'historique insuffisant", () => {
    expect(
      computeQuadrant({ countryCode: "XX", equity: [], oil: [], gold: [], bond: [] }).status,
    ).toBe("MISSING_SERIES");
    const short = months(50);
    expect(
      computeQuadrant({
        countryCode: "XX",
        equity: series(short, 100, 120),
        oil: series(short, 10, 10),
        gold: series(short, 50, 60),
        bond: series(short, 10, 10),
      }).status,
    ).toBe("INSUFFICIENT_HISTORY");
  });
});
