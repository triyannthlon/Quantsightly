import { describe, it, expect } from "vitest";
import {
  mean,
  median,
  medianAbsoluteDeviation,
  robustDeviationSeries,
  lastRobustDeviation,
  minMonthsForScore,
  DEFAULT_WINDOW,
} from "./robust-normalization";

describe("mean, median & MAD", () => {
  it("moyenne / médiane impaire / paire", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("MAD robuste à une valeur extrême", () => {
    // 10,11,11,12,12,13,50 → médiane 12 ; écarts |·| triés {0,0,1,1,1,2,38} → MAD 1.
    expect(medianAbsoluteDeviation([10, 11, 11, 12, 12, 13, 50])).toBe(1);
  });
});

describe("robustDeviationSeries", () => {
  it("null avant l'historique minimal (2·window − 1), un nombre ensuite", () => {
    const need = minMonthsForScore(); // 167 avec le défaut
    expect(need).toBe(2 * DEFAULT_WINDOW - 1);
    // 166 mois → aucun score possible.
    const short = Array.from({ length: need - 1 }, (_, t) => t * 0.01);
    expect(robustDeviationSeries(short).every((v) => v === null)).toBe(true);
    // 167 mois → seul le tout dernier point est scoré.
    const exact = Array.from({ length: need }, (_, t) => t * 0.01);
    const s = robustDeviationSeries(exact);
    expect(s[need - 1]).not.toBeNull();
    expect(s.slice(0, need - 1).every((v) => v === null)).toBe(true);
  });

  it("z = 0 sur la MM (série constante) et aucune division par zéro", () => {
    const r = new Array(200).fill(1.5);
    const last = lastRobustDeviation(r);
    expect(last).not.toBeNull();
    expect(Number.isFinite(last!)).toBe(true);
    expect(last).toBe(0); // écarts tous nuls → d=0 → z=0 (MAD nul absorbé par le plancher)
  });

  it("signe correct : ratio au-dessus de sa tendance antérieure → z > 0 ; en dessous → z < 0", () => {
    const up = Array.from({ length: 200 }, (_, t) => t * 0.01); // pente positive → point > MM antérieure
    const down = Array.from({ length: 200 }, (_, t) => -t * 0.01);
    expect(lastRobustDeviation(up)!).toBeGreaterThan(0);
    expect(lastRobustDeviation(down)!).toBeLessThan(0);
  });

  it("pipeline exact sur petite fenêtre (calcul à la main)", () => {
    // r = t², window = 3 (mois courant inclus) → premier score à t = 2·3 − 2 = 4.
    // Écarts d_i = r_i − moyenne(r[i-2..i]) :
    //   d₂=2,3333 · d₃=4,3333 · d₄=6,3333 · …
    // À t=4 : MAD({2,3333;4,3333;6,3333}) = 2 → s = 1,4826·2 = 2,9652
    //         → z = 6,3333 / 2,9652 ≈ 2,136.
    const r = [0, 1, 4, 9, 16, 25, 36, 49];
    const s = robustDeviationSeries(r, { window: 3, sigmaFloor: 1e-9 });
    expect(s[3]).toBeNull(); // t < 2·window − 2
    expect(s[4]).toBeCloseTo(2.136, 2);
  });
});
