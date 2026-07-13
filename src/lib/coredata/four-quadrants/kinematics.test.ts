import { describe, it, expect } from "vitest";
import {
  theilSenSlope,
  computeVelocity,
  computeAcceleration,
  radialVelocity,
  directionalAcceleration,
} from "./kinematics";

describe("theilSenSlope", () => {
  it("pente positive / négative / nulle", () => {
    expect(theilSenSlope([1, 2, 3, 4, 5, 6])).toBe(1);
    expect(theilSenSlope([6, 5, 4, 3, 2, 1])).toBe(-1);
    expect(theilSenSlope([5, 5, 5, 5, 5, 5])).toBe(0);
  });

  it("robuste à un point aberrant", () => {
    // Une valeur folle en fin de série ne renverse pas la pente sous-jacente.
    expect(theilSenSlope([1, 2, 3, 4, 5, 99])).toBe(1);
  });
});

describe("computeVelocity", () => {
  it("angle correct : horizontal → 0°, vertical → 90°", () => {
    const rising = [0, 1, 2, 3, 4, 5];
    const flat = [3, 3, 3, 3, 3, 3];
    const vh = computeVelocity(rising, flat)!;
    expect(vh.x).toBeCloseTo(1, 10);
    expect(vh.y).toBeCloseTo(0, 10);
    expect(vh.angleDegrees).toBeCloseTo(0, 6);
    const vv = computeVelocity(flat, rising)!;
    expect(vv.angleDegrees).toBeCloseTo(90, 6);
    expect(vv.magnitude).toBeCloseTo(1, 10);
  });

  it("historique insuffisant → null", () => {
    expect(computeVelocity([1, 2, 3], [1, 2, 3], 6)).toBeNull();
  });
});

describe("computeAcceleration", () => {
  it("vitesse croissante → accélération positive ; axe plat → ≈ 0", () => {
    const quad = Array.from({ length: 12 }, (_, t) => t * t); // vitesse croissante
    const flat = new Array(12).fill(5);
    const a = computeAcceleration(quad, flat)!;
    expect(a.x).toBeGreaterThan(0);
    expect(a.y).toBeCloseTo(0, 10);
    expect(a.magnitude).toBeGreaterThan(0);
  });

  it("historique insuffisant → null", () => {
    expect(computeAcceleration([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6])).toBeNull();
  });
});

describe("vitesse radiale & accélération directionnelle", () => {
  it("radiale > 0 quand le régime se renforce ; null près du centre", () => {
    expect(radialVelocity(50, 0, 1, 0)!).toBeCloseTo(1, 10); // s'éloigne du centre
    expect(radialVelocity(50, 0, -1, 0)!).toBeCloseTo(-1, 10); // revient au centre
    expect(radialVelocity(2, 0, 1, 0)).toBeNull(); // trop proche du centre
  });

  it("directionnelle : > 0 accélère, < 0 ralentit, null si vitesse nulle", () => {
    expect(directionalAcceleration(1, 0, 1, 0)!).toBeCloseTo(1, 10);
    expect(directionalAcceleration(1, 0, -1, 0)!).toBeCloseTo(-1, 10);
    expect(directionalAcceleration(0, 0, 1, 0)).toBeNull();
  });
});
