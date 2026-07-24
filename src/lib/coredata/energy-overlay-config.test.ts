import { afterEach, describe, expect, it } from "vitest";

import { readEnergyOverlay } from "./energy-overlay-config";

// Sauvegarde/restaure l'environnement (les tests mutent process.env).
const SAVED_OVERLAY = process.env.QS_ENERGY_OVERLAY;
const restore = (key: string, saved: string | undefined) => {
  if (saved === undefined) delete process.env[key];
  else process.env[key] = saved;
};
afterEach(() => {
  restore("QS_ENERGY_OVERLAY", SAVED_OVERLAY);
});
const setEnv = (key: string, v: string | undefined) => {
  if (v === undefined) delete process.env[key];
  else process.env[key] = v;
};

// `readEnergyOverlay` = RÉSERVÉ scripts/concordance (jamais un chemin produit). On vérifie
// seulement qu'il reste sûr par défaut (toute valeur ≠ "trend-v1" ⇒ "off").
describe("readEnergyOverlay (réservé scripts/concordance, sûr par défaut)", () => {
  it.each([
    [undefined, "off"],
    ["", "off"],
    ["bidon", "off"],
    ["OFF", "off"], // pas "off" strict → sûr = off
    ["off", "off"],
    ["trend-v1", "trend-v1"],
    ["  trend-v1  ", "trend-v1"], // trim
  ] as const)("QS_ENERGY_OVERLAY=%o → %s", (v, expected) => {
    setEnv("QS_ENERGY_OVERLAY", v);
    expect(readEnergyOverlay()).toBe(expected);
  });
});
