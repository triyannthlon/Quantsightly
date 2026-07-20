// Non-régression « 4Q Standard v1 » — verrouille le comportement du moteur sur des
// PAYS RÉELS (séries capturées en fixtures). Toute évolution INVOLONTAIRE du moteur
// (régime, coordonnées, allocation, métriques par période) fait échouer ce test. Une
// évolution VOLONTAIRE se régénère explicitement (voir plus bas) et s'explique dans le
// commit — les tolérances numériques ci-dessous absorbent le bruit flottant sans
// masquer un vrai changement.
//
// Couverture : {US long+CPI, BR moyen, DK court} × {binaire, dynamique} × zone neutre
// {0, 20, 50} × période {Max, 20A, 10A, 5A} × modes (nominal + réel + inflation via
// les métriques capturées) + un cas dérivé SANS CPI (US, CPI retiré) → réel/inflation
// doivent rester `null`, jamais fabriqués.
//
// Régénérer le golden après un changement VOLONTAIRE (le moteur pur suffit, aucune
// base) : un script chargeant __fixtures__/{US,BR,DK}.json et réécrivant golden.json
// avec la même matrice (cf. historique : scratch-golden).

import { describe, it, expect } from "vitest";
import {
  buildModel,
  backtestQuadrants,
  weightsFromModel,
  DEFAULT_FOUR_QUADRANTS_SETTINGS,
  type BuildModelInput,
  type BacktestResult,
  type QuadrantModelResult,
  type Strategy,
} from ".";
import { computeKpis } from "../compute";
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
const FIX: Record<string, Fixture> = {
  US: US as unknown as Fixture,
  BR: BR as unknown as Fixture,
  DK: DK as unknown as Fixture,
};

interface AllocG {
  equities: number;
  bonds: number;
  gold: number;
  cash: number;
}
interface LatestG {
  quadrant: string;
  transitionState: string;
  x: number;
  y: number;
  allocation: AllocG;
}
interface PeriodG {
  availStatus: string;
  availReason: string | null;
  months?: number;
  start?: string;
  end?: string;
  nomCAGR?: number | null;
  realCAGR?: number | null;
  volNom?: number | null;
  volReal?: number | null;
  mddNom?: number | null;
  mddReal?: number | null;
  sharpeNom?: number | null;
  sharpeReal?: number | null;
  inflationAnnualized?: number | null;
  realMultiple?: number | null;
  turnover?: number | null;
}
interface EntryG {
  latest: LatestG;
  periods: Record<string, PeriodG>;
}
const GOLDEN = golden as unknown as Record<string, EntryG>;

const PERIODS: Record<string, number | null> = { MAX: null, "20A": 20, "10A": 10, "5A": 5 };
const STRATS: Strategy[] = ["binary", "dynamic"];
const NEUTRAL_ZONES = [0, 20, 50];

// Tolérances numériques EXPLICITES (précision `toBeCloseTo` : |Δ| < 0.5·10⁻ᵖ).
const P_PCT = 2; // pourcentages (CAGR, vol, max DD, inflation) → 0.005 pt
const P_RATIO = 3; // Sharpe, rotation, multiple → 0.0005
const P_COORD = 2; // coordonnées x/y
const P_WEIGHT = 4; // poids d'allocation

function closeOrNull(got: number | null | undefined, exp: number | null | undefined, prec: number) {
  if (exp === null || exp === undefined) {
    expect(got == null).toBe(true);
    return;
  }
  expect(got ?? NaN).toBeCloseTo(exp, prec);
}

/** Extrait les résultats structurants d'un backtest (mêmes champs que le golden). */
function extract(bt: BacktestResult): PeriodG {
  if (bt.status !== "OK") {
    return { availStatus: bt.availability.status, availReason: bt.availability.reason };
  }
  const m = bt.metrics;
  const real = bt.series.real;
  const realMultiple =
    real && real.length >= 2 && real[0].value > 0 ? real[real.length - 1].value / real[0].value : null;
  const inflationAnnualized = bt.series.inflationIndex
    ? computeKpis(bt.series.inflationIndex).annualized
    : null;
  return {
    availStatus: bt.availability.status,
    availReason: bt.availability.reason,
    months: m.nominal.months,
    start: bt.start.slice(0, 7),
    end: bt.end.slice(0, 7),
    nomCAGR: m.nominal.annualized,
    realCAGR: m.real?.annualized ?? null,
    volNom: m.nominal.volatility,
    volReal: m.real?.volatility ?? null,
    mddNom: m.nominal.maxDrawdown,
    mddReal: m.real?.maxDrawdown ?? null,
    sharpeNom: m.nominal.sharpe,
    sharpeReal: m.real?.sharpe ?? null,
    inflationAnnualized,
    realMultiple,
    turnover: bt.turnover.annualized,
  };
}

function assertLatest(latest: QuadrantModelResult, g: LatestG) {
  expect(latest.quadrant).toBe(g.quadrant);
  expect(latest.transitionState).toBe(g.transitionState);
  expect(latest.x).toBeCloseTo(g.x, P_COORD);
  expect(latest.y).toBeCloseTo(g.y, P_COORD);
  expect(latest.finalAllocation.equities).toBeCloseTo(g.allocation.equities, P_WEIGHT);
  expect(latest.finalAllocation.bonds).toBeCloseTo(g.allocation.bonds, P_WEIGHT);
  expect(latest.finalAllocation.gold).toBeCloseTo(g.allocation.gold, P_WEIGHT);
  expect(latest.finalAllocation.cash).toBeCloseTo(g.allocation.cash, P_WEIGHT);
}

function assertPeriod(got: PeriodG, g: PeriodG) {
  expect(got.availStatus).toBe(g.availStatus);
  expect(got.availReason ?? null).toBe(g.availReason ?? null);
  if (got.months === undefined || g.months === undefined) return; // (défensif)
  expect(got.months).toBe(g.months);
  expect(got.start).toBe(g.start);
  expect(got.end).toBe(g.end);
  closeOrNull(got.nomCAGR, g.nomCAGR, P_PCT);
  closeOrNull(got.realCAGR, g.realCAGR, P_PCT);
  closeOrNull(got.volNom, g.volNom, P_PCT);
  closeOrNull(got.volReal, g.volReal, P_PCT);
  closeOrNull(got.mddNom, g.mddNom, P_PCT);
  closeOrNull(got.mddReal, g.mddReal, P_PCT);
  closeOrNull(got.sharpeNom, g.sharpeNom, P_RATIO);
  closeOrNull(got.sharpeReal, g.sharpeReal, P_RATIO);
  closeOrNull(got.inflationAnnualized, g.inflationAnnualized, P_PCT);
  closeOrNull(got.realMultiple, g.realMultiple, P_RATIO);
  closeOrNull(got.turnover, g.turnover, P_RATIO);
}

function runCase(code: string, strategy: Strategy, T: number, stripCpi: boolean, g: EntryG) {
  const settings = { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: T };
  const model = buildModel(FIX[code].signal, settings);
  expect(model.status).toBe("OK");
  if (model.status !== "OK") return;
  assertLatest(model.latest, g.latest);
  const perf: PerfFixture = stripCpi ? { ...FIX[code].perf, cpi: undefined } : FIX[code].perf;
  for (const [pname, years] of Object.entries(PERIODS)) {
    const bt = backtestQuadrants({
      countryCode: code,
      weights: weightsFromModel(model),
      ...perf,
      windowYears: years,
    });
    assertPeriod(extract(bt), g.periods[pname]);
  }
}

describe("4Q Standard v1 — non-régression (pays réels × stratégies × zone neutre × périodes)", () => {
  for (const code of ["US", "BR", "DK"]) {
    for (const strategy of STRATS) {
      for (const T of NEUTRAL_ZONES) {
        it(`${code} · ${strategy} · zone neutre ${T}`, () => {
          runCase(code, strategy, T, false, GOLDEN[`${code}|${strategy}|T${T}`]);
        });
      }
    }
  }

  it("US sans CPI (dynamique, zone 20) : réel & inflation restent null, jamais fabriqués", () => {
    runCase("US", "dynamic", 20, true, GOLDEN["US_NOCPI|dynamic|T20"]);
  });

  it("invariance : le régime/allocation courant ne dépend pas de la fenêtre", () => {
    const model = buildModel(FIX.US.signal, DEFAULT_FOUR_QUADRANTS_SETTINGS);
    expect(model.status).toBe("OK");
    if (model.status !== "OK") return;
    const ref = JSON.stringify(model.latest.finalAllocation);
    for (const years of [null, 20, 10, 5]) {
      const bt = backtestQuadrants({
        countryCode: "US",
        weights: weightsFromModel(model),
        ...FIX.US.perf,
        windowYears: years,
      });
      expect(bt.status).toBe("OK");
    }
    expect(JSON.stringify(model.latest.finalAllocation)).toBe(ref); // vient du modèle, hors fenêtre
  });
});
