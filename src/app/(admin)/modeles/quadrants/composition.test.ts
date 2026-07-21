// Test de transformation : décision d'affichage « détenu vs cible » (UI v2).
// Vérifie que la divergence se base sur les POURCENTAGES affichés (pas sur un seuil).
import { describe, it, expect } from "vitest";
import { compositionDiverges } from "./helpers";

const A = (equities: number, bonds: number, gold: number, cash: number) => ({ equities, bonds, gold, cash, energy: 0 });

describe("compositionDiverges — détenu vs cible", () => {
  it("allocations identiques au pourcentage affiché → pas de divergence", () => {
    expect(compositionDiverges(A(0.25, 0.25, 0.25, 0.25), A(0.25, 0.25, 0.25, 0.25))).toBe(false);
    // Écart infime (< 0,5 pt) → même % arrondi → pas de bloc secondaire.
    expect(compositionDiverges(A(0.252, 0.25, 0.248, 0.25), A(0.25, 0.25, 0.25, 0.25))).toBe(false);
  });

  it("écart visible au pourcentage → divergence (cas GB, poids conservés)", () => {
    expect(compositionDiverges(A(0.4, 0.02, 0.48, 0.1), A(0.34, 0.06, 0.44, 0.16))).toBe(true);
    expect(compositionDiverges(A(0.2683, 0.2439, 0.2439, 0.2439), A(0.28, 0.25, 0.25, 0.22))).toBe(true);
  });
});
