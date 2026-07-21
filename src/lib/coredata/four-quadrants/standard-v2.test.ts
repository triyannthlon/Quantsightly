// Non-régression « 4Q Standard v2 » (bande de réallocation δ=5) — GOLDEN DISTINCT de
// v1 (golden-v2.json). Verrouille le comportement de v2 sur les mêmes pays réels que
// v1, et prouve les invariants entre versions :
//   • v2 ne change PAS les cibles du modèle → `latest` (régime/coords/allocation cible)
//     est IDENTIQUE à v1 ; la bande n'agit qu'à l'EXÉCUTION (backtest) ;
//   • v2 réduit (ou égale) la rotation vs v1 (efficience opérationnelle).
// Régénérer golden-v2.json après un changement VOLONTAIRE (scratch : gen-golden-v2.mts).
import { describe, it, expect } from "vitest";
import {
  buildModel,
  backtestQuadrants,
  weightsFromModel,
  DEFAULT_FOUR_QUADRANTS_SETTINGS,
  REALLOCATION_BAND,
  type BuildModelInput,
  type BacktestResult,
  type Strategy,
} from ".";
import { computeKpis } from "../compute";
import type { EconomicDataPoint } from "../types";
import US from "./__fixtures__/US.json";
import BR from "./__fixtures__/BR.json";
import DK from "./__fixtures__/DK.json";
import goldenV1 from "./__fixtures__/golden.json";
import goldenV2 from "./__fixtures__/golden-v2.json";

const BAND = REALLOCATION_BAND.v2;

interface PerfFixture {
  equityTotalReturn: EconomicDataPoint[];
  bondTotalReturn: EconomicDataPoint[];
  cashTotalReturn: EconomicDataPoint[];
  gold: EconomicDataPoint[];
  cpi?: EconomicDataPoint[];
}
interface Fixture { countryCode: string; signal: BuildModelInput; perf: PerfFixture }
const FIX: Record<string, Fixture> = { US: US as unknown as Fixture, BR: BR as unknown as Fixture, DK: DK as unknown as Fixture };

interface PeriodG {
  availStatus: string; availReason: string | null; months?: number; start?: string; end?: string;
  nomCAGR?: number | null; realCAGR?: number | null; volNom?: number | null; volReal?: number | null;
  mddNom?: number | null; mddReal?: number | null; sharpeNom?: number | null; sharpeReal?: number | null;
  inflationAnnualized?: number | null; realMultiple?: number | null; turnover?: number | null;
}
interface EntryG { latest: { quadrant: string; transitionState: string; x: number; y: number; allocation: { equities: number; bonds: number; gold: number; cash: number } }; periods: Record<string, PeriodG> }
const GV2 = goldenV2 as unknown as Record<string, EntryG>;
const GV1 = goldenV1 as unknown as Record<string, EntryG>;

const PERIODS: Record<string, number | null> = { MAX: null, "20A": 20, "10A": 10, "5A": 5 };
const STRATS: Strategy[] = ["binary", "dynamic"];
const ZONES = [0, 20, 50];
const P_PCT = 2, P_RATIO = 3, P_COORD = 2, P_WEIGHT = 4;

function closeOrNull(got: number | null | undefined, exp: number | null | undefined, prec: number) {
  if (exp === null || exp === undefined) { expect(got == null).toBe(true); return; }
  expect(got ?? NaN).toBeCloseTo(exp, prec);
}
function extract(bt: BacktestResult): PeriodG {
  if (bt.status !== "OK") return { availStatus: bt.availability.status, availReason: bt.availability.reason };
  const m = bt.metrics, real = bt.series.real;
  const realMultiple = real && real.length >= 2 && real[0].value > 0 ? real[real.length - 1].value / real[0].value : null;
  const inflationAnnualized = bt.series.inflationIndex ? computeKpis(bt.series.inflationIndex).annualized : null;
  return {
    availStatus: bt.availability.status, availReason: bt.availability.reason,
    months: m.nominal.months, start: bt.start.slice(0, 7), end: bt.end.slice(0, 7),
    nomCAGR: m.nominal.annualized, realCAGR: m.real?.annualized ?? null, volNom: m.nominal.volatility, volReal: m.real?.volatility ?? null,
    mddNom: m.nominal.maxDrawdown, mddReal: m.real?.maxDrawdown ?? null, sharpeNom: m.nominal.sharpe, sharpeReal: m.real?.sharpe ?? null,
    inflationAnnualized, realMultiple, turnover: bt.turnover.annualized,
  };
}
function assertPeriod(got: PeriodG, g: PeriodG) {
  expect(got.availStatus).toBe(g.availStatus);
  expect(got.availReason ?? null).toBe(g.availReason ?? null);
  if (got.months === undefined || g.months === undefined) return;
  expect(got.months).toBe(g.months); expect(got.start).toBe(g.start); expect(got.end).toBe(g.end);
  closeOrNull(got.nomCAGR, g.nomCAGR, P_PCT); closeOrNull(got.realCAGR, g.realCAGR, P_PCT);
  closeOrNull(got.volNom, g.volNom, P_PCT); closeOrNull(got.volReal, g.volReal, P_PCT);
  closeOrNull(got.mddNom, g.mddNom, P_PCT); closeOrNull(got.mddReal, g.mddReal, P_PCT);
  closeOrNull(got.sharpeNom, g.sharpeNom, P_RATIO); closeOrNull(got.sharpeReal, g.sharpeReal, P_RATIO);
  closeOrNull(got.inflationAnnualized, g.inflationAnnualized, P_PCT); closeOrNull(got.realMultiple, g.realMultiple, P_RATIO);
  closeOrNull(got.turnover, g.turnover, P_RATIO);
}
function runCase(code: string, strategy: Strategy, T: number, stripCpi: boolean, g: EntryG) {
  const settings = { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: T };
  const model = buildModel(FIX[code].signal, settings);
  expect(model.status).toBe("OK");
  if (model.status !== "OK") return;
  // v2 ne modifie pas les cibles → latest identique au golden (et à v1).
  expect(model.latest.finalAllocation.equities).toBeCloseTo(g.latest.allocation.equities, P_WEIGHT);
  expect(model.latest.finalAllocation.cash).toBeCloseTo(g.latest.allocation.cash, P_WEIGHT);
  expect(model.latest.x).toBeCloseTo(g.latest.x, P_COORD);
  const perf: PerfFixture = stripCpi ? { ...FIX[code].perf, cpi: undefined } : FIX[code].perf;
  for (const [pname, years] of Object.entries(PERIODS)) {
    const bt = backtestQuadrants({ countryCode: code, weights: weightsFromModel(model), ...perf, windowYears: years, reallocationBand: BAND });
    assertPeriod(extract(bt), g.periods[pname]);
  }
}

describe("4Q Standard v2 (bande δ=5) — non-régression (golden distinct de v1)", () => {
  for (const code of ["US", "BR", "DK"]) {
    for (const strategy of STRATS) {
      for (const T of ZONES) {
        it(`${code} · ${strategy} · zone neutre ${T}`, () => {
          runCase(code, strategy, T, false, GV2[`${code}|${strategy}|T${T}`]);
        });
      }
    }
  }
  it("US sans CPI (dynamique, zone 20) : réel & inflation restent null", () => {
    runCase("US", "dynamic", 20, true, GV2["US_NOCPI|dynamic|T20"]);
  });

  it("invariant : v2 partage les cibles (`latest`) de v1 — régime/coords/allocation identiques", () => {
    // La bande n'agit qu'à l'exécution : les cibles du modèle sont inchangées.
    // (golden v1 stocké arrondi, v2 pleine précision → comparaison aux tolérances.)
    for (const key of Object.keys(GV2)) {
      const v2 = GV2[key].latest, v1 = GV1[key].latest;
      expect(v2.quadrant).toBe(v1.quadrant);
      expect(v2.transitionState).toBe(v1.transitionState);
      expect(v2.x).toBeCloseTo(v1.x, P_COORD);
      expect(v2.y).toBeCloseTo(v1.y, P_COORD);
      expect(v2.allocation.equities).toBeCloseTo(v1.allocation.equities, P_WEIGHT);
      expect(v2.allocation.bonds).toBeCloseTo(v1.allocation.bonds, P_WEIGHT);
      expect(v2.allocation.gold).toBeCloseTo(v1.allocation.gold, P_WEIGHT);
      expect(v2.allocation.cash).toBeCloseTo(v1.allocation.cash, P_WEIGHT);
    }
  });

  it("invariant : v2 réduit la rotation vs v1 (dynamique, MAX)", () => {
    for (const code of ["US", "BR", "DK"]) {
      const v1 = GV1[`${code}|dynamic|T20`].periods.MAX.turnover;
      const v2 = GV2[`${code}|dynamic|T20`].periods.MAX.turnover;
      if (v1 != null && v2 != null) expect(v2).toBeLessThanOrEqual(v1 + 1e-9);
    }
  });
});
