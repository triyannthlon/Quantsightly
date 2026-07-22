// Tests de RESTITUTION d'affichage des allocations (détenu / cible) — logique PURE,
// aucun calcul du moteur touché. Couvre les cinq garanties de la section Allocation :
//   1. cible différente        → pourcentages retournés (barre + 4 valeurs affichées) ;
//   2. cible identique         → null (libellé « Identique à l'allocation actuelle ») ;
//   3. stratégie indisponible  → exclue (aucune carte) ;
//   4. valeurs à 0 %           → toujours présentes ;
//   5. somme affichée          → exactement 100 % (arrondi au plus grand reste).
import { describe, it, expect } from "vitest";
import {
  ALLOC_KEYS,
  roundedAllocPercents,
  sameAllocPercents,
  resolveTargetPercents,
  strategiesWithAllocation,
} from "./helpers";

/** Allocation cœur (fractions ∈ [0,1]) — `energy` à 0 (surcouche dormante). */
const A = (equities: number, bonds: number, gold: number, cash: number) => ({
  equities,
  bonds,
  gold,
  cash,
  energy: 0,
});

const sum = (p: Record<string, number>) => ALLOC_KEYS.reduce((s, k) => s + p[k], 0);

describe("roundedAllocPercents — somme = 100 % (plus grand reste) et poches 0 % conservées", () => {
  it("cas exact 25/25/25/25", () => {
    expect(roundedAllocPercents(A(0.25, 0.25, 0.25, 0.25))).toEqual({
      equities: 25,
      bonds: 25,
      gold: 25,
      cash: 25,
    });
  });

  it("tiers (33,33 %) : arrondi naïf donnerait 99 % → ramené à 100 %", () => {
    const p = roundedAllocPercents(A(1 / 3, 1 / 3, 1 / 3, 0));
    expect(sum(p)).toBe(100);
    expect(p.cash).toBe(0);
  });

  it("demi-points (12,5 / 37,5) : arrondi naïf donnerait ≠ 100 % → ramené à 100 %", () => {
    const p = roundedAllocPercents(A(0.125, 0.125, 0.375, 0.375));
    expect(sum(p)).toBe(100);
  });

  it("poches à 0 % présentes dans le résultat (jamais masquées)", () => {
    const p = roundedAllocPercents(A(0.5, 0.5, 0, 0));
    expect(p.gold).toBe(0);
    expect(p.cash).toBe(0);
    expect(Object.keys(p).sort()).toEqual(["bonds", "cash", "equities", "gold"]);
    expect(sum(p)).toBe(100);
  });
});

describe("sameAllocPercents — identité au pourcentage affiché", () => {
  const q = () => roundedAllocPercents(A(0.25, 0.25, 0.25, 0.25));

  it("identiques → true", () => {
    expect(sameAllocPercents(q(), q())).toBe(true);
  });

  it("écart infime sous l'arrondi → toujours identiques (true)", () => {
    expect(sameAllocPercents(roundedAllocPercents(A(0.252, 0.25, 0.248, 0.25)), q())).toBe(true);
  });

  it("écart visible → différents (false)", () => {
    expect(sameAllocPercents(roundedAllocPercents(A(0.4, 0.1, 0.4, 0.1)), q())).toBe(false);
  });
});

describe("resolveTargetPercents — décision d'affichage de la cible", () => {
  const held = roundedAllocPercents(A(0.4, 0.1, 0.4, 0.1));

  it("cible différente → pourcentages retournés (barre + valeurs), somme = 100 %", () => {
    const target = resolveTargetPercents(A(0.25, 0.25, 0.25, 0.25), held);
    expect(target).not.toBeNull();
    expect(sum(target!)).toBe(100);
  });

  it("cible identique après arrondi → null (libellé « Identique »)", () => {
    const target = resolveTargetPercents(A(0.401, 0.1, 0.399, 0.1), held);
    expect(target).toBeNull();
  });

  it("cible omise (undefined) → null (identique par convention)", () => {
    expect(resolveTargetPercents(undefined, held)).toBeNull();
  });
});

describe("strategiesWithAllocation — stratégie indisponible exclue (aucune carte)", () => {
  type Row = { currentAllocation: ReturnType<typeof A> | null };

  it("currentAllocation = null → exclue ; allocation présente → conservée", () => {
    const rows: Row[] = [
      { currentAllocation: null },
      { currentAllocation: A(0.25, 0.25, 0.25, 0.25) },
    ];
    const kept = strategiesWithAllocation(rows);
    expect(kept).toHaveLength(1);
    expect(kept[0].currentAllocation).not.toBeNull();
  });
});
