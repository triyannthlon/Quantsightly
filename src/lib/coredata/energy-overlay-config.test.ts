import { afterEach, describe, expect, it } from "vitest";

import { readEnergyLabEnabled, readEnergyOverlay } from "./energy-overlay-config";

// Sauvegarde/restaure l'environnement (les tests mutent process.env).
const SAVED_OVERLAY = process.env.QS_ENERGY_OVERLAY;
const SAVED_LAB = process.env.QS_ENERGY_LAB_ENABLED;
const restore = (key: string, saved: string | undefined) => {
  if (saved === undefined) delete process.env[key];
  else process.env[key] = saved;
};
afterEach(() => {
  restore("QS_ENERGY_OVERLAY", SAVED_OVERLAY);
  restore("QS_ENERGY_LAB_ENABLED", SAVED_LAB);
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

// `readEnergyLabEnabled` = GATE UI SEUL (aucun calcul). `on` strict ⇒ true, sinon false.
describe("readEnergyLabEnabled (gate UI seul, aucun calcul de portefeuille)", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["off", false],
    ["bidon", false],
    ["ON", false], // pas "on" strict
    ["on", true],
    ["  on  ", true], // trim
  ] as const)("QS_ENERGY_LAB_ENABLED=%o → %s", (v, expected) => {
    setEnv("QS_ENERGY_LAB_ENABLED", v);
    expect(readEnergyLabEnabled()).toBe(expected);
  });

  it("les deux flags sont INDÉPENDANTS : activer le labo ne change pas la sélection de variante", () => {
    setEnv("QS_ENERGY_LAB_ENABLED", "on");
    setEnv("QS_ENERGY_OVERLAY", "trend-v1");
    // Le gate UI est ON, mais rien ici ne pilote un calcul : la variante produit reste un
    // argument explicite ("off") côté service — les deux lectures ne se contaminent pas.
    expect(readEnergyLabEnabled()).toBe(true);
    expect(readEnergyOverlay()).toBe("trend-v1"); // valeur brute, mais NON lue par le produit
  });
});
