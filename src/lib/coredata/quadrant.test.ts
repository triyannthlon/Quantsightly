import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "./types";
import { getAxisSignal, getQuadrant, getConvictionLevel, computeQuadrant } from "./quadrant";

// `n` dates mensuelles consécutives à partir de 2019-01 (≥ 167 pour un score valide).
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

// Série constante `base`, puis `last` au seul dernier mois (clôturé). Avec des
// résidus tous nuls sauf le dernier, la dispersion robuste tombe sur son plancher
// → la coordonnée sature à ±100 (signal net) ; `base === last` → coordonnée 0.
function series(dates: string[], base: number, last: number): EconomicDataPoint[] {
  return dates.map((date, i) => ({ date, value: i < dates.length - 1 ? base : last }));
}

describe("getAxisSignal", () => {
  it("classe selon la bande neutre ±T (T = 20, coords normalisées)", () => {
    expect(getAxisSignal(25)).toBe("ACCELERATING");
    expect(getAxisSignal(-25)).toBe("DECELERATING");
    expect(getAxisSignal(10)).toBe("NEUTRAL");
    expect(getAxisSignal(20)).toBe("NEUTRAL"); // borne incluse dans le neutre
    expect(getAxisSignal(-20)).toBe("NEUTRAL");
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
  it("prend la distance normalisée du plus faible des deux axes", () => {
    expect(getConvictionLevel(80, 10)).toBe("LOW"); // min 10 < 20
    expect(getConvictionLevel(80, 35)).toBe("MEDIUM"); // min 35 < 50
    expect(getConvictionLevel(70, 60)).toBe("HIGH"); // min 60 ≥ 50
  });
});

describe("computeQuadrant", () => {
  const dates = months(170);

  it("classe un boom inflationniste (croissance + inflation accélèrent)", () => {
    const r = computeQuadrant({
      countryCode: "XX",
      equity: series(dates, 100, 120), // actions/pétrole en hausse
      oil: series(dates, 10, 10),
      gold: series(dates, 50, 60), // or/oblig en hausse
      bond: series(dates, 10, 10),
    });
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.growthSignal).toBe("ACCELERATING");
    expect(r.inflationSignal).toBe("ACCELERATING");
    expect(r.quadrant).toBe("GROWTH_UP_INFLATION_UP");
    expect(r.regimeName).toBe("Boom inflationniste");
    expect(r.x).toBeCloseTo(100, 5); // coordonnée saturée (dispersion au plancher)
    expect(r.y).toBeCloseTo(100, 5);
    expect(r.convictionLevel).toBe("HIGH");
    expect(r.date).toBe(dates[dates.length - 1]);
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
      equity: series(dates, 100, 100), // actions/pétrole plat → coordonnée 0 → neutre
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
    const short = months(100); // < 167 mois
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
