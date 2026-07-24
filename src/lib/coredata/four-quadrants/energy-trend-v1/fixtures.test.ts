import { describe, expect, it } from "vitest";

import signatures from "./__fixtures__/lab-signatures.json";
import type { EnergyLabSignature } from "./lab";

// Non-régression du laboratoire Énergie SANS DB : les fixtures de production (signatures compactes
// figées par `experiments/4q-energy-lab/lab-concordance.mts` sur la vraie base) doivent conserver
// leurs propriétés structurantes. La concordance BIT À BIT moteur↔fixtures est vérifiée par le
// script DB ; ici on garantit la forme + la valeur marginale de la surcouche.

const sigs = signatures as unknown as Record<string, EnergyLabSignature>;
const CASES = Object.keys(sigs);

describe("fixtures de production — laboratoire Énergie", () => {
  it("8 cas : US/FR/JP/BR × {dynamic, binary}", () => {
    expect(CASES.slice().sort()).toEqual(
      ["US", "FR", "JP", "BR"].flatMap((c) => [`${c}:dynamic`, `${c}:binary`]).sort(),
    );
  });

  it.each(CASES)("%s : la surcouche Énergie apporte une valeur marginale (≠ standard)", (key) => {
    const s = sigs[key];
    // Énergie ≠ standard, avec signal actif dans l'historique (pas un faux-identique).
    expect(JSON.stringify(s.energy)).not.toBe(JSON.stringify(s.standard));
    expect(s.signal.activeMonths).toBeGreaterThan(0);
    // Contribution Énergie : nulle côté standard, non nulle côté Énergie.
    expect(s.standard.contributions.energy).toBe(0);
    expect(s.energy.contributions.energy).not.toBe(0);
  });

  it.each(CASES)("%s : allocation 5 poches cohérente + overlays explicites", (key) => {
    const s = sigs[key];
    // Standard = 4 poches (énergie 0) ; Énergie = 5 poches, somme ≈ 1.
    expect(s.standard.held.energy).toBe(0);
    for (const a of [s.energy.held, s.energy.target]) {
      expect(a.equities + a.bonds + a.gold + a.cash + a.energy).toBeCloseTo(1, 6);
    }
    expect(s.standard.overlay).toBe("off");
    expect(s.energy.overlay).toBe("trend-v1");
    expect(s.standard.label).toMatch(/^4Q (Continue|Régime)$/);
    expect(s.energy.label).toMatch(/^4Q (Continue|Régime) \+ Énergie$/);
  });
});
