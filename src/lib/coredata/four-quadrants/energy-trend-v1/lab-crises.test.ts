import { describe, expect, it } from "vitest";

import type { EconomicDataPoint } from "../../types";
import type { HistoricalCrisis } from "../../model-comparison/historical-stress/types";
import type { EnergyLabComparison, EnergyLabVariant } from "./lab";
import { LAB_CRISIS_SLOTS, buildEnergyLabCrises } from "./lab-crises";

// Série mensuelle fin de mois base 100 (12 mois de 2008).
const series = (values: number[]): EconomicDataPoint[] =>
  values.map((value, i) => ({ date: `2008-${String(i + 1).padStart(2, "0")}-28`, value }));

const variant = (
  id: EnergyLabVariant["id"],
  label: string,
  nominal: EconomicDataPoint[],
  real: EconomicDataPoint[] | null,
): EnergyLabVariant =>
  ({
    id,
    label,
    overlay: id === "energy" ? "trend-v1" : "off",
    backtest: {
      status: "OK",
      series: { nominal, real },
    },
  }) as unknown as EnergyLabVariant;

const comparison = (real: boolean): EnergyLabComparison =>
  ({
    strategy: "dynamic",
    countryCode: "US",
    countryFr: "États-Unis",
    currency: "USD",
    standard: variant(
      "standard",
      "4Q Continue",
      series([100, 98, 95, 90, 85, 80, 82, 85, 88, 90, 92, 95]),
      real ? series([100, 97, 94, 89, 84, 79, 81, 84, 87, 89, 91, 94]) : null,
    ),
    energy: variant(
      "energy",
      "4Q Continue + Énergie",
      series([100, 99, 97, 94, 91, 88, 90, 93, 96, 98, 100, 103]),
      real ? series([100, 98, 96, 93, 90, 87, 89, 92, 95, 97, 99, 102]) : null,
    ),
    signal: {} as EnergyLabComparison["signal"],
  }) as EnergyLabComparison;

const crises: HistoricalCrisis[] = [
  {
    id: "gfc-2008",
    name: "Crise financière 2008",
    definition: "Crise financière mondiale.",
    startDate: "2008-01-28",
    endDate: "2008-06-28",
    effectiveEndDate: "2008-06-28",
    category: "financial",
    status: "closed",
    importance: "primary",
    includeInAggregates: true,
    displayOrder: 1,
  },
];

describe("buildEnergyLabCrises", () => {
  it("mesure les DEUX emplacements (socle + Énergie) sur l'épisode", () => {
    const results = buildEnergyLabCrises(comparison(false), "nominal", crises)!;
    expect(results).toHaveLength(1);
    const r = results[0];
    const byId = new Map(r.strategies.map((s) => [s.strategyId, s]));
    const std = byId.get(LAB_CRISIS_SLOTS.standard)!;
    const en = byId.get(LAB_CRISIS_SLOTS.energy)!;
    expect(std.available).toBe(true);
    expect(en.available).toBe(true);
    // Le socle chute davantage que le socle + Énergie sur cet épisode synthétique.
    expect(std.maxDrawdown!).toBeLessThan(en.maxDrawdown!);
    // Performances cumulées du départ (100) à la fin (juin) : socle −20 %, +Énergie −12 %.
    expect(std.cumulativeReturn!).toBeCloseTo(-20);
    expect(en.cumulativeReturn!).toBeCloseTo(-12);
  });

  it("mode réel : mesuré si les séries réelles existent", () => {
    const results = buildEnergyLabCrises(comparison(true), "real", crises);
    expect(results).not.toBeNull();
    expect(results![0].strategies).toHaveLength(2);
  });

  it("null en mode réel quand une variante n'a pas de série réelle (CPI absent)", () => {
    expect(buildEnergyLabCrises(comparison(false), "real", crises)).toBeNull();
  });
});
