import { describe, it, expect } from "vitest";
import {
  alignSeries,
  ratioSeries,
  differenceSeries,
  movingAverage,
  scaleSeries,
  commonDateBounds,
  filterByDateRange,
  usdPerUnitMap,
  convertCurrency,
  computeKpis,
} from "./compute";
import type { EconomicDataPoint } from "./types";

function pts(values: [string, number][]): EconomicDataPoint[] {
  return values.map(([date, value]) => ({ date, value }));
}

describe("alignSeries", () => {
  it("ne garde que les dates communes", () => {
    const a = pts([
      ["2020-01-31", 1],
      ["2020-02-29", 2],
      ["2020-03-31", 3],
    ]);
    const b = pts([
      ["2020-02-29", 20],
      ["2020-03-31", 30],
      ["2020-04-30", 40],
    ]);
    expect(alignSeries(a, b)).toEqual([
      { date: "2020-02-29", a: 2, b: 20 },
      { date: "2020-03-31", a: 3, b: 30 },
    ]);
  });
});

describe("ratioSeries", () => {
  it("calcule a/b sur les dates communes", () => {
    const a = pts([
      ["2020-01-31", 10],
      ["2020-02-29", 20],
    ]);
    const b = pts([
      ["2020-01-31", 2],
      ["2020-02-29", 5],
    ]);
    expect(ratioSeries(a, b)).toEqual([
      { date: "2020-01-31", value: 5 },
      { date: "2020-02-29", value: 4 },
    ]);
  });

  it("ignore les points où b vaut 0", () => {
    const a = pts([
      ["2020-01-31", 10],
      ["2020-02-29", 20],
    ]);
    const b = pts([
      ["2020-01-31", 0],
      ["2020-02-29", 5],
    ]);
    expect(ratioSeries(a, b)).toEqual([{ date: "2020-02-29", value: 4 }]);
  });
});

describe("differenceSeries", () => {
  it("calcule a-b sur les dates communes", () => {
    const a = pts([
      ["2020-01-31", 10],
      ["2020-02-29", 20],
    ]);
    const b = pts([
      ["2020-01-31", 3],
      ["2020-02-29", 25],
    ]);
    expect(differenceSeries(a, b)).toEqual([
      { date: "2020-01-31", value: 7 },
      { date: "2020-02-29", value: -5 },
    ]);
  });
});

describe("movingAverage", () => {
  it("fenêtre de 3 : démarre au 3e point, moyenne glissante", () => {
    const data = pts([
      ["2020-01-31", 3],
      ["2020-02-29", 6],
      ["2020-03-31", 9],
      ["2020-04-30", 12],
    ]);
    expect(movingAverage(data, 3)).toEqual([
      { date: "2020-03-31", value: 6 }, // (3+6+9)/3
      { date: "2020-04-30", value: 9 }, // (6+9+12)/3
    ]);
  });

  it("window <= 1 renvoie la série inchangée", () => {
    const data = pts([["2020-01-31", 3]]);
    expect(movingAverage(data, 1)).toEqual(data);
  });
});

describe("scaleSeries", () => {
  it("multiplie toutes les valeurs par le facteur (rebasage base 100)", () => {
    const data = pts([
      ["2020-01-31", 2],
      ["2020-02-29", 3],
    ]);
    const factor = 100 / data[0].value; // base 100 sur le premier point
    expect(scaleSeries(data, factor)).toEqual(
      pts([
        ["2020-01-31", 100],
        ["2020-02-29", 150],
      ]),
    );
  });
});

describe("commonDateBounds", () => {
  it("renvoie max des débuts et min des fins", () => {
    const a = pts([
      ["2005-01-31", 1],
      ["2020-01-31", 2],
    ]);
    const b = pts([
      ["2010-01-31", 1],
      ["2025-01-31", 2],
    ]);
    expect(commonDateBounds(a, b)).toEqual({ from: "2010-01-31", to: "2020-01-31" });
  });

  it("renvoie null si une série est vide", () => {
    expect(commonDateBounds([], pts([["2020-01-31", 1]]))).toBeNull();
  });
});

describe("filterByDateRange", () => {
  const data = pts([
    ["2020-01-31", 1],
    ["2020-02-29", 2],
    ["2020-03-31", 3],
  ]);

  it("borne inclusive des deux côtés", () => {
    expect(filterByDateRange(data, "2020-02-01", "2020-03-31")).toEqual(
      pts([
        ["2020-02-29", 2],
        ["2020-03-31", 3],
      ]),
    );
  });

  it("sans bornes : série inchangée", () => {
    expect(filterByDateRange(data)).toEqual(data);
  });
});

describe("usdPerUnitMap", () => {
  it("reverse=true → valeur telle quelle (USD pour 1 unité)", () => {
    const m = usdPerUnitMap(pts([["2020-01-31", 1.2]]), true);
    expect(m.get("2020-01-31")).toBe(1.2);
  });

  it("reverse=false → inverse (unités pour 1 USD)", () => {
    const m = usdPerUnitMap(pts([["2020-01-31", 8]]), false);
    expect(m.get("2020-01-31")).toBeCloseTo(0.125, 10);
  });

  it("ignore les valeurs nulles", () => {
    const m = usdPerUnitMap(pts([["2020-01-31", 0]]), false);
    expect(m.has("2020-01-31")).toBe(false);
  });
});

describe("convertCurrency", () => {
  it("devise source → USD (cible = null)", () => {
    const data = pts([["2020-01-31", 100]]);
    const src = usdPerUnitMap(pts([["2020-01-31", 8]]), false); // 1 unité = 0,125 USD
    expect(convertCurrency(data, src, null)).toEqual([{ date: "2020-01-31", value: 12.5 }]);
  });

  it("USD (source = null) → devise cible", () => {
    const data = pts([["2020-01-31", 100]]);
    const tgt = usdPerUnitMap(pts([["2020-01-31", 0.125]]), true); // 1 unité = 0,125 USD
    expect(convertCurrency(data, null, tgt)).toEqual([{ date: "2020-01-31", value: 800 }]);
  });

  it("omet les dates où un taux manque", () => {
    const data = pts([
      ["2020-01-31", 100],
      ["2020-02-29", 100],
    ]);
    const src = usdPerUnitMap(pts([["2020-01-31", 8]]), false);
    expect(convertCurrency(data, src, null)).toHaveLength(1);
  });
});

describe("computeKpis", () => {
  it("variations sur 1 / 12 mois et CAGR sur série mensuelle régulière", () => {
    // 13 points : +1% composé par mois.
    const data: EconomicDataPoint[] = [];
    let v = 100;
    for (let i = 0; i <= 12; i++) {
      data.push({ date: `2020-${String(i + 1).padStart(2, "0")}-15`, value: v });
      v *= 1.01;
    }
    const k = computeKpis(data);
    expect(k.lastMonth).toBeCloseTo(1, 5);
    expect(k.oneYear).toBeCloseTo((1.01 ** 12 - 1) * 100, 4);
    expect(k.annualized).toBeCloseTo((1.01 ** 12 - 1) * 100, 4);
  });

  it("renvoie null quand l'historique est insuffisant", () => {
    const k = computeKpis(pts([["2020-01-31", 100]]));
    expect(k.lastMonth).toBeNull();
    expect(k.oneYear).toBeNull();
    expect(k.annualized).toBeNull();
    expect(k.volatility).toBeNull();
  });

  it("volatilité nulle pour une série parfaitement constante", () => {
    const data = pts([
      ["2020-01-31", 100],
      ["2020-02-29", 100],
      ["2020-03-31", 100],
      ["2020-04-30", 100],
    ]);
    expect(computeKpis(data).volatility).toBeCloseTo(0, 10);
  });
});
