// Tests de la BANDE DE RÉALLOCATION (`4q-standard-v2`, δ=5). Données synthétiques à
// prix plats (rendements nuls ⇒ poids dérivés = poids détenus) pour contrôler
// EXACTEMENT chaque décision de bande, + un cas t→t+1 et un cas de discontinuité.
// La non-régression sur pays réels vit dans standard-v1.test.ts / standard-v2.test.ts.
import { describe, it, expect } from "vitest";
import {
  backtestQuadrants,
  computePreRebalanceWeights,
  computeMonthlyTurnover,
  REALLOCATION_BAND,
  type WeightPoint,
} from ".";
import type { EconomicDataPoint } from "../types";

const V2 = REALLOCATION_BAND.v2 as number; // 0.05

function month(i: number): string {
  const y = 2000 + Math.floor(i / 12);
  const m = (i % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}-28`;
}
type A = { equities: number; bonds: number; gold: number; cash: number; energy: number };
const a = (eq: number, bd: number, go: number, ca: number): A => ({ equities: eq, bonds: bd, gold: go, cash: ca, energy: 0 });
function series(n: number, values?: number[]): EconomicDataPoint[] {
  return Array.from({ length: n }, (_, i) => ({ date: month(i), value: values ? values[i] : 100 }));
}
function flatPerf(n: number, eq?: number[]) {
  return { equityTotalReturn: series(n, eq), bondTotalReturn: series(n), cashTotalReturn: series(n), gold: series(n) };
}
function weights(targets: A[]): WeightPoint[] {
  return targets.map((allocation, i) => ({ date: month(i), allocation }));
}
function turns(bt: ReturnType<typeof backtestQuadrants>): (number | null)[] {
  return bt.status === "OK" ? bt.turnover.monthly.map((t) => t.turnover) : [];
}

describe("Bande de réallocation v2 — mécanique", () => {
  it("δ=0 / bande null / bande absente : chemins strictement identiques (= v1)", () => {
    const perf = flatPerf(6, [100, 105, 103, 108, 110, 107]);
    const tg = weights([a(0.25, 0.25, 0.25, 0.25), a(0.3, 0.25, 0.25, 0.2), a(0.28, 0.24, 0.26, 0.22), a(0.3, 0.25, 0.25, 0.2), a(0.25, 0.25, 0.25, 0.25), a(0.25, 0.25, 0.25, 0.25)]);
    const base = { countryCode: "T", weights: tg, ...perf };
    const r0 = backtestQuadrants(base);
    const rNull = backtestQuadrants({ ...base, reallocationBand: null });
    const rZero = backtestQuadrants({ ...base, reallocationBand: 0 });
    expect(JSON.stringify(rNull)).toBe(JSON.stringify(r0));
    expect(JSON.stringify(rZero)).toBe(JSON.stringify(r0));
  });

  it("frontière rotation = 5 % : conservée (seuil ≤ inclusif)", () => {
    const perf = flatPerf(2); // rendements nuls → dérivés = détenus
    const bt = backtestQuadrants({ countryCode: "T", weights: weights([a(0.25, 0.25, 0.25, 0.25), a(0.3, 0.25, 0.25, 0.2)]), ...perf, reallocationBand: V2 });
    expect(turns(bt)).toEqual([null, 0]); // rotation-vers-cible = 0,05 exactement → conservé
  });

  it("juste sous le seuil : conservé ; juste au-dessus : réalloué plein", () => {
    const perf = flatPerf(2);
    const below = backtestQuadrants({ countryCode: "T", weights: weights([a(0.25, 0.25, 0.25, 0.25), a(0.29, 0.25, 0.25, 0.21)]), ...perf, reallocationBand: V2 });
    expect(turns(below)).toEqual([null, 0]); // 0,04 → conservé
    const above = backtestQuadrants({ countryCode: "T", weights: weights([a(0.25, 0.25, 0.25, 0.25), a(0.31, 0.25, 0.25, 0.19)]), ...perf, reallocationBand: V2 });
    expect(turns(above)[1]).toBeCloseTo(0.06, 10); // 0,06 → réalloué
  });

  it("rotation calculée sur les poids DÉTENUS, pas la cible précédente", () => {
    const perf = flatPerf(3);
    const tg = weights([a(0.25, 0.25, 0.25, 0.25), a(0.3, 0.25, 0.25, 0.2), a(0.35, 0.25, 0.25, 0.15)]);
    const bt = backtestQuadrants({ countryCode: "T", weights: tg, ...perf, reallocationBand: V2 });
    // mois 1 : rotation vs détenu(25/25/25/25) = 0,05 → conservé (held reste 25/25/25/25)
    // mois 2 : rotation vs DÉTENU(25/25/25/25) = 0,10 > 0,05 → réalloué (turnover 0,10)
    //   (si—à tort—calculée vs cible précédente 30/25/25/20 : 0,05 → aurait conservé)
    expect(turns(bt)[1]).toBe(0);
    expect(turns(bt)[2]).toBeCloseTo(0.1, 10);
  });

  it("conservation sur plusieurs mois sous le seuil, puis réallocation", () => {
    const perf = flatPerf(5);
    const tg = weights([a(0.25, 0.25, 0.25, 0.25), a(0.26, 0.25, 0.25, 0.24), a(0.27, 0.25, 0.25, 0.23), a(0.28, 0.25, 0.25, 0.22), a(0.32, 0.25, 0.25, 0.18)]);
    const t = turns(backtestQuadrants({ countryCode: "T", weights: tg, ...perf, reallocationBand: V2 }));
    expect(t.slice(0, 4)).toEqual([null, 0, 0, 0]); // détenu conservé mois 1-3 (0,01/0,02/0,03)
    expect(t[4]).toBeCloseTo(0.07, 10); // réallocation mois 4 (0,07)
  });

  it("t → t+1 : les poids d'un mois gagnent le rendement du mois SUIVANT (aucune fuite)", () => {
    const perf = { equityTotalReturn: [{ date: month(0), value: 100 }, { date: month(1), value: 110 }], bondTotalReturn: series(2), cashTotalReturn: series(2), gold: series(2) };
    const bt = backtestQuadrants({ countryCode: "T", weights: weights([a(1, 0, 0, 0), a(0, 0, 0, 1)]), ...perf });
    expect(bt.status).toBe("OK");
    if (bt.status !== "OK") return;
    // poids détenus mois 1 = cible du mois 0 (100 % actions) → +10 % → nominal 110
    expect(bt.series.nominal[bt.series.nominal.length - 1].value).toBeCloseTo(110, 6);
  });

  it("poids dérivés normalisés à 100 % et jamais négatifs", () => {
    const drifted = computePreRebalanceWeights(
      { equities: 0.4, bonds: 0.3, gold: 0.2, cash: 0.1, energy: 0 },
      { equities: 0.5, bonds: -0.1, gold: 0.2, cash: 0, energy: 0 },
    );
    const sum = drifted.equities + drifted.bonds + drifted.gold + drifted.cash + drifted.energy;
    expect(sum).toBeCloseTo(1, 12);
    for (const v of [drifted.equities, drifted.bonds, drifted.gold, drifted.cash, drifted.energy]) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("turnover = ½·Σ|cible − détenu|", () => {
    expect(computeMonthlyTurnover(
      { equities: 0.3, bonds: 0.25, gold: 0.25, cash: 0.2, energy: 0 },
      { equities: 0.25, bonds: 0.25, gold: 0.25, cash: 0.25, energy: 0 },
    )).toBeCloseTo(0.05, 12);
  });

  it("chemin avec bande : tous les turnovers ∈ [0,1], nominal fini et positif", () => {
    const perf = flatPerf(6, [100, 108, 96, 112, 101, 119]);
    const tg = weights([a(0.25, 0.25, 0.25, 0.25), a(0.4, 0.2, 0.2, 0.2), a(0.3, 0.3, 0.2, 0.2), a(0.25, 0.25, 0.25, 0.25), a(0.5, 0.2, 0.2, 0.1), a(0.25, 0.25, 0.25, 0.25)]);
    const bt = backtestQuadrants({ countryCode: "T", weights: tg, ...perf, reallocationBand: V2 });
    expect(bt.status).toBe("OK");
    if (bt.status !== "OK") return;
    for (const t of bt.turnover.monthly) if (t.turnover != null) { expect(t.turnover).toBeGreaterThanOrEqual(0); expect(t.turnover).toBeLessThanOrEqual(1); }
    for (const p of bt.series.nominal) { expect(Number.isFinite(p.value)).toBe(true); expect(p.value).toBeGreaterThan(0); }
  });

  it("position courante : détenu ≠ cible sous v2 (mois bloqué type GB), perf = détenu, rotation nulle", () => {
    // Cash/oblig/or plats ; actions +10 % au dernier mois. Cibles dérivant lentement →
    // toutes les réallocations sont RETENUES par la bande → détenu reste ≈ 25/25/25/25.
    const perf = {
      equityTotalReturn: [100, 100, 100, 110].map((v, i) => ({ date: month(i), value: v })),
      bondTotalReturn: series(4),
      cashTotalReturn: series(4),
      gold: series(4),
    };
    const tg = weights([a(0.25, 0.25, 0.25, 0.25), a(0.26, 0.25, 0.25, 0.24), a(0.27, 0.25, 0.25, 0.23), a(0.28, 0.25, 0.25, 0.22)]);
    const v2 = backtestQuadrants({ countryCode: "T", weights: tg, ...perf, reallocationBand: V2 });
    expect(v2.status).toBe("OK");
    if (v2.status !== "OK") return;
    // Détenu (position réelle) ≠ cible (théorique du dernier mois).
    expect(v2.heldAllocation.equities).toBeCloseTo(0.2683, 3); // 25 % dérivé par +10 % actions
    expect(v2.targetAllocation.equities).toBeCloseTo(0.28, 6); // cible du dernier mois
    // Performance calculée sur les poids DÉTENUS (25 % actions), pas la cible (28 %).
    expect(v2.series.nominal.at(-1)!.value).toBeCloseTo(102.5, 4); // 25 %×(+10 %) → 102,5 (≠ 102,8)
    // Aucune réallocation exécutée : toutes les transactions sont nulles.
    for (const t of v2.turnover.monthly) if (t.turnover != null) expect(t.turnover).toBe(0);
    expect(v2.turnover.annualized).toBe(0);

    // v1 (sans bande) : réallocation pleine chaque mois → détenu === cible ; perf = 27 %.
    const v1 = backtestQuadrants({ countryCode: "T", weights: tg, ...perf });
    if (v1.status !== "OK") return;
    expect(v1.heldAllocation).toEqual(v1.targetAllocation);
    expect(v1.heldAllocation.equities).toBeCloseTo(0.28, 6);
    expect(v1.series.nominal.at(-1)!.value).toBeCloseTo(102.7, 4); // 27 % détenu au dernier mois
  });

  it("discontinuité de données : v1 et v2 renvoient le MÊME statut (garde-fou inchangé)", () => {
    // actions sans le mois 2000-03 (trou) ; autres poches complètes.
    const equityTotalReturn = [{ date: month(0), value: 100 }, { date: month(1), value: 101 }, { date: month(3), value: 103 }];
    const perf = { equityTotalReturn, bondTotalReturn: series(4), cashTotalReturn: series(4), gold: series(4) };
    const tg = weights([a(0.25, 0.25, 0.25, 0.25), a(0.25, 0.25, 0.25, 0.25), a(0.25, 0.25, 0.25, 0.25), a(0.25, 0.25, 0.25, 0.25)]);
    const v1 = backtestQuadrants({ countryCode: "T", weights: tg, ...perf });
    const v2 = backtestQuadrants({ countryCode: "T", weights: tg, ...perf, reallocationBand: V2 });
    expect(v1.status).toBe("NON_CONTIGUOUS_HISTORY");
    expect(v2.status).toBe(v1.status);
    expect(v2.availability).toEqual(v1.availability);
  });
});
