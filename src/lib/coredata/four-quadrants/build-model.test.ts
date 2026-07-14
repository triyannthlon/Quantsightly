import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "../types";
import { buildModel, type BuildModelInput } from "./build-model";
import { DEFAULT_FOUR_QUADRANTS_SETTINGS } from "./settings";

// `n` mois à partir de 2010-01.
function months(n: number): string[] {
  const out: string[] = [];
  let y = 2010;
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

function ser(dates: string[], fn: (i: number) => number): EconomicDataPoint[] {
  return dates.map((date, i) => ({ date, value: fn(i) }));
}

// Séries synthétiques : tendance + oscillation → résidus non nuls → coords non saturées.
function synthetic(n: number): BuildModelInput {
  const dates = months(n);
  return {
    countryCode: "XX",
    equityPrice: ser(dates, (i) => 100 * 1.004 ** i * (1 + 0.03 * Math.sin(i / 3))),
    oil: ser(dates, () => 30),
    gold: ser(dates, (i) => 1500 * 1.003 ** i * (1 + 0.03 * Math.cos(i / 4))),
    bond: ser(dates, () => 100),
  };
}

const sumCore = (a: { equities: number; bonds: number; gold: number; cash: number }) =>
  a.equities + a.bonds + a.gold + a.cash;

describe("buildModel", () => {
  it("produit la série mensuelle complète + snapshot latest (dynamique par défaut)", () => {
    const model = buildModel(synthetic(180));
    expect(model.status).toBe("OK");
    if (model.status !== "OK") return;

    // 180 mois → premier score à l'indice 166 → 14 résultats mensuels.
    expect(model.monthlyResults.length).toBe(14);
    expect(model.latest).toBe(model.monthlyResults[model.monthlyResults.length - 1]);
    expect(model.settings).toBe(DEFAULT_FOUR_QUADRANTS_SETTINGS);

    for (const r of model.monthlyResults) {
      expect(Number.isFinite(r.x)).toBe(true);
      expect(Math.abs(r.x)).toBeLessThanOrEqual(100);
      expect(Math.abs(r.y)).toBeLessThanOrEqual(100);
      expect(r.strategy).toBe("dynamic");
      expect(sumCore(r.baseAllocation)).toBeCloseTo(1, 10);
      // Énergie désactivée par défaut → poids 0, somme des 5 poches = 1.
      expect(r.energyScore).toBeNull();
      expect(r.finalAllocation.energy).toBe(0);
      const total =
        r.finalAllocation.equities +
        r.finalAllocation.bonds +
        r.finalAllocation.gold +
        r.finalAllocation.cash +
        r.finalAllocation.energy;
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it("séries intermédiaires cohérentes (vitesse/accél. plus courtes)", () => {
    const model = buildModel(synthetic(180));
    if (model.status !== "OK") return;
    const n = model.monthlyResults.length;
    expect(model.series.x).toHaveLength(n);
    expect(model.series.regimeIntensity).toHaveLength(n);
    // La vitesse démarre après `velocityWindowMonths` coords ; l'accél. après la vitesse.
    expect(model.series.velocity.length).toBeLessThan(n);
    expect(model.series.acceleration.length).toBeLessThan(model.series.velocity.length);
    // Premier mois = partiel (pas encore de vitesse), dernier = complet.
    expect(model.monthlyResults[0].dataStatus).toBe("partial");
    expect(model.latest.dataStatus).toBe("complete");
    expect(model.latest.velocity).not.toBeNull();
    expect(model.latest.acceleration).not.toBeNull();
  });

  it("architecture Énergie prête : mode fixe → poids appliqué, somme = 1", () => {
    const model = buildModel(synthetic(180), {
      ...DEFAULT_FOUR_QUADRANTS_SETTINGS,
      energyMode: "fixed",
      energyFixedWeight: 0.1,
    });
    if (model.status !== "OK") return;
    const r = model.latest;
    expect(r.finalAllocation.energy).toBeCloseTo(0.1, 10);
    expect(r.finalAllocation.equities).toBeCloseTo(r.baseAllocation.equities * 0.9, 10);
    const total =
      r.finalAllocation.equities +
      r.finalAllocation.bonds +
      r.finalAllocation.gold +
      r.finalAllocation.cash +
      r.finalAllocation.energy;
    expect(total).toBeCloseTo(1, 10);
  });

  it("stratégie binaire : allocation par blocs, somme = 1", () => {
    const model = buildModel(synthetic(180), { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "binary" });
    if (model.status !== "OK") return;
    expect(model.latest.strategy).toBe("binary");
    expect(sumCore(model.latest.baseAllocation)).toBeCloseTo(1, 10);
  });

  it("statuts : séries manquantes / historique insuffisant", () => {
    expect(
      buildModel({ countryCode: "XX", equityPrice: [], oil: [], gold: [], bond: [] }).status,
    ).toBe("MISSING_SERIES");
    expect(buildModel(synthetic(100)).status).toBe("INSUFFICIENT_HISTORY");
  });
});
