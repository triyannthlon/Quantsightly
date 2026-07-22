// Tests du moteur de comparaison sur pays réels (fixtures US/BR/DK partagées avec
// le 4Q). Vérifient la FENÊTRE COMMUNE STRICTE, l'égalité des dates entre
// stratégies, les coûts sur rotation exécutée, et les disponibilités explicites.
import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "../types";
import { REALLOCATION_BAND, type BuildModelInput } from "../four-quadrants";
import {
  computeModelComparison,
  type SharedComparisonInput,
  type ComparisonStrategyId,
} from ".";
import US from "../four-quadrants/__fixtures__/US.json";
import BR from "../four-quadrants/__fixtures__/BR.json";
import DK from "../four-quadrants/__fixtures__/DK.json";

interface PerfFixture {
  equityTotalReturn: EconomicDataPoint[];
  bondTotalReturn: EconomicDataPoint[];
  cashTotalReturn: EconomicDataPoint[];
  gold: EconomicDataPoint[];
  cpi?: EconomicDataPoint[];
}
interface Fixture {
  countryCode: string;
  signal: BuildModelInput;
  perf: PerfFixture;
}
const FIX: Record<string, Fixture> = {
  US: US as unknown as Fixture,
  BR: BR as unknown as Fixture,
  DK: DK as unknown as Fixture,
};

function shared(code: string, perf?: Partial<PerfFixture>, signalNull = false): SharedComparisonInput {
  return {
    countryCode: code,
    signal: signalNull ? null : FIX[code].signal,
    perf: { ...FIX[code].perf, ...perf },
    transitionWidth: 20,
    reallocationBand: REALLOCATION_BAND.v2,
  };
}

const okStrategies = (r: ReturnType<typeof computeModelComparison>) =>
  r.strategies.filter((s) => s.availability.status === "ok");
const byId = (r: ReturnType<typeof computeModelComparison>, id: ComparisonStrategyId) =>
  r.strategies.find((s) => s.id === id)!;

describe("computeModelComparison — fenêtre commune stricte", () => {
  for (const code of ["US", "BR", "DK"]) {
    it(`${code} : les 3 stratégies partagent EXACTEMENT les mêmes dates`, () => {
      const r = computeModelComparison(shared(code), { mode: "nominal", costBps: 25 });
      expect(r.window).not.toBeNull();
      const avail = okStrategies(r);
      expect(avail.length).toBeGreaterThanOrEqual(2);
      const dates0 = avail[0].cumulativeSeries.map((p) => p.date);
      for (const s of avail) {
        expect(s.metrics).not.toBeNull();
        // Dates de la courbe IDENTIQUES entre toutes les stratégies.
        expect(s.cumulativeSeries.map((p) => p.date)).toEqual(dates0);
        expect(s.metrics!.months).toBe(dates0.length);
        expect(s.metrics!.start.slice(0, 7)).toBe(r.window!.start);
        expect(s.metrics!.end.slice(0, 7)).toBe(r.window!.end);
      }
    });
  }

  it("le 4Q contraint la fenêtre : Browne n'est jamais comparé sur un historique plus long", () => {
    const all = computeModelComparison(shared("US"), {});
    const browneOnly = computeModelComparison(shared("US"), { strategyIds: ["browne"] });
    expect(all.window!.months).toBeLessThanOrEqual(browneOnly.window!.months);
    expect(all.window!.start >= browneOnly.window!.start).toBe(true);
  });

  it("les périodes courtes restreignent la fenêtre (5A ⊂ Max)", () => {
    const max = computeModelComparison(shared("US"), { period: null });
    const p5 = computeModelComparison(shared("US"), { period: 5 });
    expect(p5.window!.months).toBeLessThanOrEqual(max.window!.months);
    expect(p5.window!.end).toBe(max.window!.end); // même fin, début plus récent
    expect(p5.window!.start >= max.window!.start).toBe(true);
  });
});

describe("computeModelComparison — coûts sur rotation exécutée", () => {
  it("0 bps ⇒ net ≡ brut (aucun coût)", () => {
    const r0 = computeModelComparison(shared("US"), { costBps: 0 });
    for (const s of okStrategies(r0)) {
      expect(s.metrics!.cumulativeCost).toBeCloseTo(0, 10);
      for (const m of s.monthlyReturns) {
        expect(m.cost).toBe(0);
        expect(m.net).toBeCloseTo(m.gross, 12);
      }
    }
  });

  it("25 bps ⇒ coût cumulé > 0 et performance nette < performance sans coûts (rotation présente)", () => {
    const r0 = computeModelComparison(shared("US"), { costBps: 0 });
    const r25 = computeModelComparison(shared("US"), { costBps: 25 });
    for (const id of ["quadrants-dynamic-v2", "quadrants-binary-v2"] as const) {
      const a = byId(r0, id);
      const b = byId(r25, id);
      expect(b.metrics!.cumulativeCost).toBeGreaterThan(0);
      expect(b.metrics!.cumulative!).toBeLessThan(a.metrics!.cumulative!);
      expect(b.metrics!.annualizedTurnover!).toBeGreaterThan(0);
    }
    // Browne : coûts positifs (dérive → rééquilibrage annuel), mais rotation plus faible que le 4Q.
    expect(byId(r25, "browne").metrics!.cumulativeCost).toBeGreaterThanOrEqual(0);
    expect(byId(r25, "browne").metrics!.reallocationsPerYear!).toBeLessThan(
      byId(r25, "quadrants-dynamic-v2").metrics!.reallocationsPerYear!,
    );
  });
});

describe("computeModelComparison — mode réel", () => {
  it("disponible avec CPI", () => {
    const r = computeModelComparison(shared("US"), { mode: "real" });
    expect(r.disabledReason).toBeNull();
    expect(okStrategies(r).length).toBeGreaterThanOrEqual(2);
    for (const s of okStrategies(r)) expect(s.metrics).not.toBeNull();
  });

  it("indisponible sans CPI (raison explicite, jamais d'interpolation)", () => {
    const r = computeModelComparison(shared("US", { cpi: [] }), { mode: "real" });
    expect(r.window).toBeNull();
    expect(r.disabledReason).toBe("inflation_unavailable");
    for (const s of r.strategies) {
      expect(s.availability.status).toBe("unavailable");
      if (s.availability.status === "unavailable") {
        expect(s.availability.reason).toBe("inflation_unavailable");
      }
    }
  });
});

describe("computeModelComparison — disponibilités explicites", () => {
  it("série obligataire indisponible", () => {
    const r = computeModelComparison(shared("US", { bondTotalReturn: [] }), {});
    expect(r.disabledReason).toBe("bond_series_unavailable");
    expect(r.window).toBeNull();
  });

  it("cash local indisponible", () => {
    const r = computeModelComparison(shared("US", { cashTotalReturn: [] }), {});
    expect(r.disabledReason).toBe("cash_unavailable");
  });

  it("signal 4Q absent : Browne comparable, 4Q indisponibles (missing_series)", () => {
    const r = computeModelComparison(shared("US", undefined, true), {});
    expect(byId(r, "browne").availability.status).toBe("ok");
    expect(r.window).not.toBeNull();
    for (const id of ["quadrants-dynamic-v2", "quadrants-binary-v2"] as const) {
      const q = byId(r, id);
      expect(q.availability.status).toBe("unavailable");
      if (q.availability.status === "unavailable") expect(q.availability.reason).toBe("missing_series");
      expect(q.metrics).toBeNull();
    }
  });
});

describe("computeModelComparison — allocations & absence d'Énergie", () => {
  it("allocation détenue exposée (somme 1), aucune poche Énergie", () => {
    const r = computeModelComparison(shared("US"), {});
    for (const s of okStrategies(r)) {
      expect(s.currentAllocation).not.toBeNull();
      const a = s.currentAllocation!;
      expect(a.equities + a.bonds + a.gold + a.cash).toBeCloseTo(1, 6);
      expect(a.energy).toBeUndefined(); // surcouche Énergie DORMANTE : jamais exposée
    }
  });

  it("% de fenêtres devant Browne : null pour Browne lui-même, borné [0,1] sinon", () => {
    const r = computeModelComparison(shared("US"), {});
    for (const stat of byId(r, "browne").metrics!.rolling) {
      expect(stat.shareBeatingBrowne).toBeNull();
    }
    for (const stat of byId(r, "quadrants-dynamic-v2").metrics!.rolling) {
      if (stat.shareBeatingBrowne !== null) {
        expect(stat.shareBeatingBrowne).toBeGreaterThanOrEqual(0);
        expect(stat.shareBeatingBrowne).toBeLessThanOrEqual(1);
      }
    }
  });
});
