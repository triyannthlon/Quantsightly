// Non-régression « 4Q Standard v1 » — verrouille le comportement du moteur sur des
// PAYS RÉELS (séries capturées en fixtures). Toute évolution qui modifierait le
// régime, les coordonnées ou les métriques d'un pays représentatif fera échouer ce
// test → revue explicite avant de figer une nouvelle version.
//
// Fixtures = sorties de `getCountryQuadrantModel` (signal + perf, devise locale)
// ; golden = métriques capturées à la génération (déterministe, sans look-ahead).
// Régénérer : script scratch-recette (dump __fixtures__/{US,BR,DK}.json + golden.json).

import { describe, it, expect } from "vitest";
import {
  buildModel,
  backtestQuadrants,
  weightsFromModel,
  DEFAULT_FOUR_QUADRANTS_SETTINGS,
  type BuildModelInput,
  type QuadrantModelResult,
} from ".";
import type { EconomicDataPoint } from "../types";
import US from "./__fixtures__/US.json";
import BR from "./__fixtures__/BR.json";
import DK from "./__fixtures__/DK.json";
import golden from "./__fixtures__/golden.json";

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

const FIXTURES: Record<string, Fixture> = {
  US: US as unknown as Fixture,
  BR: BR as unknown as Fixture,
  DK: DK as unknown as Fixture,
};
type GoldenMetrics = {
  months: number;
  nomCAGR: number;
  realCAGR: number;
  vol: number;
  mdd: number;
  sharpeReal: number;
  turnover: number;
};
type GoldenPeriod = { status: string; reason: string | null } | GoldenMetrics;
interface GoldenLatest {
  regime: string;
  x: number;
  y: number;
  [period: string]: GoldenPeriod | string | number;
}
const GOLDEN = golden as unknown as Record<string, { latest: GoldenLatest }>;
const PERIODS: Record<string, number | null> = { MAX: null, "20A": 20, "10A": 10, "5A": 5 };

describe("4Q Standard v1 — non-régression sur pays réels (US, BR, DK)", () => {
  for (const code of ["US", "BR", "DK"] as const) {
    it(`${code} : régime, coordonnées et métriques par période inchangés`, () => {
      const fx = FIXTURES[code];
      const g = GOLDEN[code].latest;

      const model = buildModel(fx.signal, DEFAULT_FOUR_QUADRANTS_SETTINGS);
      expect(model.status).toBe("OK");
      if (model.status !== "OK") return;

      const latest: QuadrantModelResult = model.latest;
      expect(latest.quadrant).toBe(g.regime);
      expect(latest.x).toBeCloseTo(g.x, 3);
      expect(latest.y).toBeCloseTo(g.y, 3);

      for (const [pname, years] of Object.entries(PERIODS)) {
        const bt = backtestQuadrants({
          countryCode: code,
          weights: weightsFromModel(model),
          ...fx.perf,
          windowYears: years,
        });
        const gp = g[pname] as GoldenPeriod;
        if ("status" in gp) {
          // Cas d'indisponibilité figé (statut structuré).
          expect(bt.status).toBe(gp.status);
          continue;
        }
        expect(bt.status).toBe("OK");
        if (bt.status !== "OK") return;
        expect(bt.availability.status).toBe("OK");
        expect(bt.metrics.nominal.months).toBe(gp.months);
        expect(bt.metrics.nominal.annualized).toBeCloseTo(gp.nomCAGR, 3);
        expect(bt.metrics.real?.annualized ?? null).toBeCloseTo(gp.realCAGR, 3);
        expect(bt.metrics.nominal.volatility).toBeCloseTo(gp.vol, 3);
        expect(bt.metrics.nominal.maxDrawdown).toBeCloseTo(gp.mdd, 3);
        expect(bt.metrics.real?.sharpe ?? null).toBeCloseTo(gp.sharpeReal, 3);
        expect(bt.turnover.annualized).toBeCloseTo(gp.turnover, 3);
      }
    });
  }

  it("invariance : le régime/allocation courant ne dépend pas de la fenêtre", () => {
    // buildModel ne reçoit pas la période → latest identique quelle que soit la fenêtre.
    const model = buildModel(FIXTURES.US.signal, DEFAULT_FOUR_QUADRANTS_SETTINGS);
    expect(model.status).toBe("OK");
    if (model.status !== "OK") return;
    const ref = JSON.stringify(model.latest.finalAllocation);
    for (const years of [null, 20, 10, 5]) {
      const bt = backtestQuadrants({
        countryCode: "US",
        weights: weightsFromModel(model),
        ...FIXTURES.US.perf,
        windowYears: years,
      });
      expect(bt.status).toBe("OK");
    }
    // L'allocation vient du modèle (hors fenêtre) → constante.
    expect(JSON.stringify(model.latest.finalAllocation)).toBe(ref);
  });
});
