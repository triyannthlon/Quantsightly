import { describe, it, expect } from "vitest";
import type { ComparisonStrategyId } from "@/lib/coredata/model-comparison/types";
import type {
  HistoricalCrisisResult,
  HistoricalCrisisStrategyResult,
} from "@/lib/coredata/model-comparison/historical-stress/types";
import {
  bestByMetric,
  crisisUnavailability,
  filterByScope,
  geometry,
  maxAbsValue,
  niceScale,
  strategyValue,
  tickValues,
} from "./historical-crises-display";

const BROWNE: ComparisonStrategyId = "browne";
const DYN: ComparisonStrategyId = "quadrants-dynamic-v2";
const BIN: ComparisonStrategyId = "quadrants-binary-v2";

function strat(
  strategyId: ComparisonStrategyId,
  o: Partial<HistoricalCrisisStrategyResult> = {},
): HistoricalCrisisStrategyResult {
  return {
    strategyId,
    available: true,
    cumulativeReturn: 0,
    maxDrawdown: 0,
    peakDate: null,
    troughDate: null,
    recoveryDate: null,
    monthsToTrough: null,
    recoveryAfterTroughMonths: null,
    underwaterDurationMonths: null,
    recovered: false,
    ...o,
  };
}

function unavail(strategyId: ComparisonStrategyId, reason: string): HistoricalCrisisStrategyResult {
  return strat(strategyId, {
    available: false,
    cumulativeReturn: null,
    maxDrawdown: null,
    unavailableReason: reason,
  });
}

function res(
  strategies: HistoricalCrisisStrategyResult[],
  crisis: Partial<HistoricalCrisisResult["crisis"]> = {},
): HistoricalCrisisResult {
  return {
    crisis: {
      id: "X",
      name: "X",
      definition: "",
      startDate: "2007-09-30",
      endDate: "2009-03-31",
      effectiveEndDate: "2009-03-31",
      category: "financial",
      status: "closed",
      importance: "primary",
      includeInAggregates: true,
      displayOrder: 1,
      ...crisis,
    },
    effectiveStartDate: "2007-09-30",
    effectiveEndDate: "2009-03-31",
    durationMonths: 18,
    provisional: false,
    strategies,
  };
}

// ─── strategyValue ─────────────────────────────────────────────────────────────

describe("strategyValue", () => {
  it("sélectionne performance ou perte maximale selon la mesure", () => {
    const s = strat(BROWNE, { cumulativeReturn: 7.9, maxDrawdown: -12.8 });
    expect(strategyValue(s, "performance")).toBe(7.9);
    expect(strategyValue(s, "drawdown")).toBe(-12.8);
  });

  it("retourne null pour une stratégie indisponible (jamais 0)", () => {
    const s = unavail(BROWNE, "Historique insuffisant");
    expect(strategyValue(s, "performance")).toBeNull();
    expect(strategyValue(s, "drawdown")).toBeNull();
  });
});

// ─── filterByScope ─────────────────────────────────────────────────────────────

describe("filterByScope", () => {
  const primary = res([], { id: "P", importance: "primary" });
  const secondary = res([], { id: "S", importance: "secondary" });

  it("« principales » ne garde que l'importance primary", () => {
    const out = filterByScope([primary, secondary], "primary");
    expect(out.map((r) => r.crisis.id)).toEqual(["P"]);
  });

  it("« toutes » garde primary + secondary", () => {
    const out = filterByScope([primary, secondary], "all");
    expect(out.map((r) => r.crisis.id)).toEqual(["P", "S"]);
  });
});

// ─── maxAbsValue ───────────────────────────────────────────────────────────────

describe("maxAbsValue", () => {
  const r = res([
    strat(BROWNE, { cumulativeReturn: 5, maxDrawdown: -12 }),
    strat(DYN, { cumulativeReturn: -8, maxDrawdown: -20 }),
  ]);

  it("prend l'amplitude max des valeurs visibles pour la mesure", () => {
    expect(maxAbsValue([r], [BROWNE, DYN], "performance")).toBe(8); // max(|5|,|−8|)
    expect(maxAbsValue([r], [BROWNE, DYN], "drawdown")).toBe(20); // max(12,20)
  });

  it("ignore les stratégies non visibles", () => {
    expect(maxAbsValue([r], [BROWNE], "drawdown")).toBe(12);
  });

  it("ignore les stratégies indisponibles", () => {
    const r2 = res([strat(BROWNE, { maxDrawdown: -3 }), unavail(DYN, "Historique insuffisant")]);
    expect(maxAbsValue([r2], [BROWNE, DYN], "drawdown")).toBe(3);
  });

  it("plancher à 1 quand aucune valeur", () => {
    expect(maxAbsValue([], [BROWNE], "performance")).toBe(1);
  });
});

// ─── crisisUnavailability ──────────────────────────────────────────────────────

describe("crisisUnavailability", () => {
  it("toutes les stratégies visibles indisponibles → allUnavailable + raison", () => {
    const r = res([
      unavail(BROWNE, "Historique insuffisant"),
      unavail(DYN, "Observation de départ indisponible"),
    ]);
    const u = crisisUnavailability(r, [BROWNE, DYN]);
    expect(u.allUnavailable).toBe(true);
    expect(u.reason).toBe("Historique insuffisant");
  });

  it("au moins une disponible → pas d'indisponibilité crise", () => {
    const r = res([strat(BROWNE), unavail(DYN, "x")]);
    expect(crisisUnavailability(r, [BROWNE, DYN]).allUnavailable).toBe(false);
  });

  it("aucune stratégie visible → pas d'indisponibilité (rien à afficher)", () => {
    const r = res([strat(BIN)]);
    expect(crisisUnavailability(r, [BROWNE, DYN]).allUnavailable).toBe(false);
  });
});

// ─── bestByMetric ──────────────────────────────────────────────────────────────

describe("bestByMetric", () => {
  const r = res([
    strat(BROWNE, { cumulativeReturn: -0.4, maxDrawdown: -12.8 }),
    strat(DYN, { cumulativeReturn: 7.9, maxDrawdown: -9.2 }),
    strat(BIN, { cumulativeReturn: 16.6, maxDrawdown: -12.2 }),
  ]);

  it("performance : la plus élevée gagne", () => {
    expect(bestByMetric(r, [BROWNE, DYN, BIN], (s) => s.cumulativeReturn)?.strategyId).toBe(BIN);
  });

  it("perte maximale : la MOINS profonde gagne (la plus proche de 0)", () => {
    expect(bestByMetric(r, [BROWNE, DYN, BIN], (s) => s.maxDrawdown)?.strategyId).toBe(DYN);
  });

  it("moins de 2 stratégies disponibles → null", () => {
    const r2 = res([strat(BROWNE, { cumulativeReturn: 3 }), unavail(DYN, "x")]);
    expect(bestByMetric(r2, [BROWNE, DYN], (s) => s.cumulativeReturn)).toBeNull();
  });
});

// ─── niceScale ─────────────────────────────────────────────────────────────────

describe("niceScale", () => {
  it("choisit un pas rond couvrant l'amplitude", () => {
    expect(niceScale(12.8)).toEqual({ step: 5, maxTick: 15 });
    expect(niceScale(16.6)).toEqual({ step: 5, maxTick: 20 });
    expect(niceScale(3)).toEqual({ step: 1, maxTick: 3 });
  });

  it("borne toujours ≥ maxAbs", () => {
    for (const m of [0.5, 2.2, 7.4, 22, 48]) {
      expect(niceScale(m).maxTick).toBeGreaterThanOrEqual(m);
    }
  });
});

// ─── tickValues ────────────────────────────────────────────────────────────────

describe("tickValues", () => {
  it("performance : symétrique autour de 0, inclut 0", () => {
    const t = tickValues("performance", 5, 15);
    expect(t).toEqual([-15, -10, -5, 0, 5, 10, 15]);
  });

  it("perte maximale : ≤ 0, inclut 0", () => {
    const t = tickValues("drawdown", 5, 15);
    expect(t).toEqual([-15, -10, -5, 0]);
    expect(t.every((v) => v <= 0)).toBe(true);
    expect(t).toContain(0);
  });
});

// ─── geometry ──────────────────────────────────────────────────────────────────

describe("geometry", () => {
  it("performance : axe zéro au centre (50 %), extrêmes aux bords", () => {
    const g = geometry("performance", 20);
    expect(g.zeroX).toBeCloseTo(50, 6);
    expect(g.xOf(20)).toBeCloseTo(100, 6);
    expect(g.xOf(-20)).toBeCloseTo(0, 6);
  });

  it("perte maximale : axe zéro décalé du bord droit (marge), barres vers la gauche", () => {
    const g = geometry("drawdown", 20);
    expect(g.zeroX).toBeGreaterThan(88);
    expect(g.zeroX).toBeLessThan(100); // pas collé au bord droit
    expect(g.xOf(-20)).toBeCloseTo(0, 6);
    // une valeur négative se place à gauche de l'axe zéro
    expect(g.xOf(-10)).toBeLessThan(g.zeroX);
  });

  it("xOf est monotone croissante", () => {
    const g = geometry("performance", 10);
    expect(g.xOf(-5)).toBeLessThan(g.xOf(0));
    expect(g.xOf(0)).toBeLessThan(g.xOf(5));
  });
});
