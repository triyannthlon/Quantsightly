// Tests de la garde « mois courant exclu » (centralisée, horloge injectée).
import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "../types";
import { REALLOCATION_BAND, type BuildModelInput } from "../four-quadrants";
import { excludeCurrentMonth, withCurrentMonthExcluded } from "./guard";
import { computeModelComparison, type SharedComparisonInput } from ".";
import US from "../four-quadrants/__fixtures__/US.json";

const pt = (date: string, value: number): EconomicDataPoint => ({ date, value });

describe("excludeCurrentMonth", () => {
  const series = [pt("2025-11-30", 1), pt("2025-12-31", 2), pt("2026-01-15", 3)];

  it("retire une observation du mois courant, conserve le mois précédent", () => {
    const out = excludeCurrentMonth(series, "2026-01-21");
    expect(out.map((p) => p.date)).toEqual(["2025-11-30", "2025-12-31"]);
  });

  it("accepte une clé « YYYY-MM » comme référence", () => {
    expect(excludeCurrentMonth(series, "2026-01").map((p) => p.date)).toEqual([
      "2025-11-30",
      "2025-12-31",
    ]);
  });

  it("cas de janvier : décembre de l'année précédente reste le dernier mois admissible", () => {
    const out = excludeCurrentMonth(series, "2026-01-01");
    expect(out[out.length - 1].date).toBe("2025-12-31");
  });

  it("un mois entièrement clôturé antérieur est conservé", () => {
    // Référence en mars : janvier et février restent admissibles.
    const s = [pt("2026-01-31", 1), pt("2026-02-28", 2), pt("2026-03-10", 3)];
    expect(excludeCurrentMonth(s, "2026-03-15").map((p) => p.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
    ]);
  });
});

// ─── Intégration : même dernière date pour toutes les stratégies après la garde ──

interface Fixture {
  countryCode: string;
  signal: BuildModelInput;
  perf: {
    equityTotalReturn: EconomicDataPoint[];
    bondTotalReturn: EconomicDataPoint[];
    cashTotalReturn: EconomicDataPoint[];
    gold: EconomicDataPoint[];
    cpi?: EconomicDataPoint[];
  };
}
const FIX = US as unknown as Fixture;

/** Mois suivant une clé « YYYY-MM ». */
function nextMonthKey(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function withInjectedCurrentMonth(fix: Fixture, ym: string): SharedComparisonInput {
  const push = (s: EconomicDataPoint[]): EconomicDataPoint[] => [
    ...s,
    { date: `${ym}-15`, value: s[s.length - 1].value * 1.02 },
  ];
  return {
    countryCode: fix.countryCode,
    signal: {
      ...fix.signal,
      equityPrice: push(fix.signal.equityPrice),
      oil: push(fix.signal.oil),
      gold: push(fix.signal.gold),
      bond: push(fix.signal.bond),
    },
    perf: {
      equityTotalReturn: push(fix.perf.equityTotalReturn),
      bondTotalReturn: push(fix.perf.bondTotalReturn),
      cashTotalReturn: push(fix.perf.cashTotalReturn),
      gold: push(fix.perf.gold),
      cpi: fix.perf.cpi ? push(fix.perf.cpi) : undefined,
    },
    transitionWidth: 20,
    reallocationBand: REALLOCATION_BAND.v2,
  };
}

describe("withCurrentMonthExcluded — intégration comparaison", () => {
  const naturalLast = FIX.perf.equityTotalReturn[FIX.perf.equityTotalReturn.length - 1].date.slice(0, 7);
  const currentMonth = nextMonthKey(naturalLast);

  it("une observation du mois courant présente en base est ignorée par le moteur", () => {
    const injected = withInjectedCurrentMonth(FIX, currentMonth);

    // Sans garde : la fenêtre s'étend jusqu'au mois courant injecté.
    const raw = computeModelComparison(injected, { mode: "nominal", costBps: 25 });
    expect(raw.window!.end).toBe(currentMonth);

    // Avec garde : le mois courant est retiré, dernière date = dernier mois clôturé.
    const guarded = computeModelComparison(
      withCurrentMonthExcluded(injected, `${currentMonth}-21`),
      { mode: "nominal", costBps: 25 },
    );
    expect(guarded.window!.end).toBe(naturalLast);

    // Toutes les stratégies partagent la même dernière date.
    const ends = guarded.strategies
      .filter((s) => s.availability.status === "ok")
      .map((s) => s.metrics!.end.slice(0, 7));
    expect(new Set(ends).size).toBe(1);
    expect(ends[0]).toBe(naturalLast);
  });
});
