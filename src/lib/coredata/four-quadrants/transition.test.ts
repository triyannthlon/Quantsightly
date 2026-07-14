import { describe, it, expect } from "vitest";
import { computeTransitionState, applyTransitionDeadZone } from "./transition";
import { computeBinaryAllocation } from "./allocation-binary";
import { computeDynamicAllocation } from "./allocation-dynamic";

describe("computeTransitionState", () => {
  it("les quatre états (T = 20)", () => {
    expect(computeTransitionState(40, 50, 20)).toBe("none");
    expect(computeTransitionState(10, 50, 20)).toBe("activity");
    expect(computeTransitionState(50, 10, 20)).toBe("monetary");
    expect(computeTransitionState(10, -10, 20)).toBe("double");
  });

  it("borne la largeur de transition à [0, 50]", () => {
    expect(computeTransitionState(30, 30, 100)).toBe("double"); // T clampé à 50 → |30| ≤ 50
    expect(computeTransitionState(30, 30, -5)).toBe("none"); // T clampé à 0 → |30| > 0
  });
});

describe("applyTransitionDeadZone", () => {
  it("neutralise dans [-T, T] et sature aux bornes", () => {
    expect(applyTransitionDeadZone(0, 20)).toBe(0);
    expect(applyTransitionDeadZone(20, 20)).toBe(0);
    expect(applyTransitionDeadZone(-20, 20)).toBe(0);
    expect(applyTransitionDeadZone(100, 20)).toBe(100);
    expect(applyTransitionDeadZone(-100, 20)).toBe(-100);
  });

  it("continuité juste après la sortie de bande", () => {
    expect(applyTransitionDeadZone(20.0001, 20)).toBeCloseTo(0, 3);
    expect(applyTransitionDeadZone(20.0001, 20)).toBeGreaterThan(0);
  });

  it("borne T à [0, 50] et la valeur à [-100, 100]", () => {
    // T clampé à 50 : sgn·100·((60−50)/(100−50)) = 100·10/50 = 20.
    expect(applyTransitionDeadZone(60, 100)).toBeCloseTo(20, 10);
    // valeur clampée à ±100.
    expect(applyTransitionDeadZone(150, 20)).toBe(100);
    expect(applyTransitionDeadZone(-150, 20)).toBe(-100);
  });
});

describe("propriétés des allocations sous zone de transition", () => {
  it("somme = 1, aucun poids négatif, aucun NaN (binaire & dynamique)", () => {
    for (let x = -100; x <= 100; x += 20) {
      for (let y = -100; y <= 100; y += 20) {
        for (const alloc of [computeBinaryAllocation(x, y, 20), computeDynamicAllocation(x, y, 20)]) {
          const weights = [alloc.equities, alloc.bonds, alloc.gold, alloc.cash];
          expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 10);
          for (const w of weights) {
            expect(w).toBeGreaterThanOrEqual(0);
            expect(Number.isNaN(w)).toBe(false);
          }
        }
      }
    }
  });
});
