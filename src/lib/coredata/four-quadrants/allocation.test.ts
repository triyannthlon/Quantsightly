import { describe, it, expect } from "vitest";
import { computeBinaryAllocation } from "./allocation-binary";
import { computeDynamicAllocation } from "./allocation-dynamic";
import { applyTransitionDeadZone } from "./transition";
import { energyScoreToWeight, applyEnergyOverlay } from "./energy-overlay";
import type { CoreAllocation } from "./types";

const sum = (a: CoreAllocation) => a.equities + a.bonds + a.gold + a.cash;
const T = 20;

describe("allocation binaire", () => {
  it("les quatre régimes clairs", () => {
    expect(computeBinaryAllocation(50, 50, T)).toEqual({ equities: 0.5, bonds: 0, gold: 0.5, cash: 0 });
    expect(computeBinaryAllocation(50, -50, T)).toEqual({ equities: 0.5, bonds: 0.5, gold: 0, cash: 0 });
    expect(computeBinaryAllocation(-50, 50, T)).toEqual({ equities: 0, bonds: 0, gold: 0.5, cash: 0.5 });
    expect(computeBinaryAllocation(-50, -50, T)).toEqual({ equities: 0, bonds: 0.5, gold: 0, cash: 0.5 });
  });

  it("transition activité seule / monétaire seule / double", () => {
    expect(computeBinaryAllocation(10, 50, T)).toEqual({ equities: 0.25, bonds: 0, gold: 0.5, cash: 0.25 });
    expect(computeBinaryAllocation(50, 10, T)).toEqual({ equities: 0.5, bonds: 0.25, gold: 0.25, cash: 0 });
    expect(computeBinaryAllocation(0, 0, T)).toEqual({ equities: 0.25, bonds: 0.25, gold: 0.25, cash: 0.25 });
  });

  it("somme = 1 sur une grille de coordonnées", () => {
    for (let x = -100; x <= 100; x += 25) {
      for (let y = -100; y <= 100; y += 25) {
        expect(sum(computeBinaryAllocation(x, y, T))).toBeCloseTo(1, 10);
      }
    }
  });
});

describe("allocation dynamique", () => {
  it("centre = 25/25/25/25", () => {
    expect(computeDynamicAllocation(0, 0, T)).toEqual({ equities: 0.25, bonds: 0.25, gold: 0.25, cash: 0.25 });
  });

  it("coins extrêmes → 50/50 par bloc", () => {
    expect(computeDynamicAllocation(100, 100, T)).toEqual({ equities: 0.5, bonds: 0, gold: 0.5, cash: 0 });
    expect(computeDynamicAllocation(-100, -100, T)).toEqual({ equities: 0, bonds: 0.5, gold: 0, cash: 0.5 });
  });

  it("valeur intermédiaire SANS zone morte (T = 0) — exemple de la spec", () => {
    const a = computeDynamicAllocation(20, 30, 0);
    expect(a.equities).toBeCloseTo(0.3, 10);
    expect(a.cash).toBeCloseTo(0.2, 10);
    expect(a.gold).toBeCloseTo(0.325, 10);
    expect(a.bonds).toBeCloseTo(0.175, 10);
  });

  it("valeur intermédiaire AVEC zone morte (T = 20) — exemple de la spec", () => {
    // x = 20 est neutralisé (|x| ≤ T) ; y = 30 → y_T = 12,5.
    const a = computeDynamicAllocation(20, 30, T);
    expect(a.equities).toBeCloseTo(0.25, 10);
    expect(a.cash).toBeCloseTo(0.25, 10);
    expect(a.gold).toBeCloseTo(0.28125, 10);
    expect(a.bonds).toBeCloseTo(0.21875, 10);
  });

  it("zone morte : dans [-T, T] → 0 ; continuité à la sortie", () => {
    expect(applyTransitionDeadZone(20, T)).toBe(0);
    expect(applyTransitionDeadZone(-20, T)).toBe(0);
    expect(applyTransitionDeadZone(20.0001, T)).toBeCloseTo(0, 3); // continu en sortie de bande
    expect(applyTransitionDeadZone(100, T)).toBeCloseTo(100, 10); // borne haute atteinte
  });

  it("somme = 1 sur une grille de coordonnées", () => {
    for (let x = -100; x <= 100; x += 25) {
      for (let y = -100; y <= 100; y += 25) {
        expect(sum(computeDynamicAllocation(x, y, T))).toBeCloseTo(1, 10);
      }
    }
  });
});

describe("overlay Énergie", () => {
  it("score ≤ 0 → poids nul (poche désactivée)", () => {
    expect(energyScoreToWeight(0)).toBe(0);
    expect(energyScoreToWeight(-50)).toBe(0);
  });

  it("score positif → poids proportionnel ; plafonné au maximum", () => {
    expect(energyScoreToWeight(50, 0.2)).toBeCloseTo(0.1, 10);
    expect(energyScoreToWeight(100, 0.2)).toBeCloseTo(0.2, 10);
    expect(energyScoreToWeight(150, 0.2)).toBeCloseTo(0.2, 10); // clampé à 100
  });

  it("réduction proportionnelle des quatre poches, somme finale = 1", () => {
    const base: CoreAllocation = { equities: 0.25, bonds: 0.25, gold: 0.25, cash: 0.25 };
    const final = applyEnergyOverlay(base, 0.2);
    expect(final.equities).toBeCloseTo(0.2, 10);
    expect(final.energy).toBe(0.2);
    const total = final.equities + final.bonds + final.gold + final.cash + final.energy;
    expect(total).toBeCloseTo(1, 10);
  });

  it("poids nul → allocation de base inchangée", () => {
    const base: CoreAllocation = { equities: 0.5, bonds: 0, gold: 0.5, cash: 0 };
    expect(applyEnergyOverlay(base, 0)).toEqual({ ...base, energy: 0 });
  });
});
