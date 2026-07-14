import { describe, it, expect } from "vitest";
import { DEFAULT_FOUR_QUADRANTS_SETTINGS } from "./settings";

describe("DEFAULT_FOUR_QUADRANTS_SETTINGS", () => {
  it("défauts produit conformes à la spec", () => {
    expect(DEFAULT_FOUR_QUADRANTS_SETTINGS).toEqual({
      strategy: "dynamic",
      transitionWidth: 20,
      energyMode: "disabled",
      energyMaxWeight: 0.2,
      velocityWindowMonths: 6,
      accelerationWindowMonths: 6,
    });
  });
});
