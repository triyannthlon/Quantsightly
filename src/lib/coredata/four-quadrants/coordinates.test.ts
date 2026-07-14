import { describe, it, expect } from "vitest";
import {
  scoreToCoordinate,
  activityCoordinate,
  monetaryCoordinate,
  regimeIntensity,
} from "./coordinates";
import { getQuadrant, QUADRANT_TO_REGIME_CODE } from "./quadrant";

describe("scoreToCoordinate", () => {
  it("z = 0 → 0 ; borné dans [-100, +100]", () => {
    expect(scoreToCoordinate(0)).toBe(0);
    expect(scoreToCoordinate(100)).toBeLessThanOrEqual(100);
    expect(scoreToCoordinate(-100)).toBeGreaterThanOrEqual(-100);
    expect(scoreToCoordinate(1000)).toBeCloseTo(100, 5);
    expect(scoreToCoordinate(-1000)).toBeCloseTo(-100, 5);
  });

  it("exemple de la spec : z ≈ 1,62 → x ≈ 67", () => {
    expect(scoreToCoordinate(1.62)).toBeCloseTo(67, 0);
  });

  it("activité et monétaire : même transformation directe (inflation en haut via le ratio or/oblig)", () => {
    expect(activityCoordinate(1)).toBeGreaterThan(0);
    expect(activityCoordinate(-1)).toBeLessThan(0);
    // Score monétaire > 0 = l'or bat les obligations (inflation) → y > 0 (haut).
    // L'orientation vient du ratio (or/oblig), PAS d'une inversion de signe.
    expect(monetaryCoordinate(1)).toBeGreaterThan(0);
    expect(monetaryCoordinate(-1)).toBeLessThan(0);
    expect(monetaryCoordinate(1)).toBe(activityCoordinate(1));
  });
});

describe("regimeIntensity", () => {
  it("centre = 0, coin = 100", () => {
    expect(regimeIntensity(0, 0)).toBe(0);
    expect(regimeIntensity(100, 100)).toBeCloseTo(100, 6);
    expect(regimeIntensity(100, 0)).toBeCloseTo(70.71, 1);
  });
});

describe("getQuadrant", () => {
  it("les quatre coins", () => {
    expect(getQuadrant(50, 50)).toBe("inflationary-boom");
    expect(getQuadrant(50, -50)).toBe("disinflationary-boom");
    expect(getQuadrant(-50, 50)).toBe("inflationary-contraction");
    expect(getQuadrant(-50, -50)).toBe("disinflationary-contraction");
  });

  it("pont vers les codes de palette TR/BR/TL/BL", () => {
    expect(QUADRANT_TO_REGIME_CODE[getQuadrant(50, 50)]).toBe("TR");
    expect(QUADRANT_TO_REGIME_CODE[getQuadrant(-50, -50)]).toBe("BL");
  });
});
