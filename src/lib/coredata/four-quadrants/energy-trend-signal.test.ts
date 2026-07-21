// Tests unitaires de la surcouche `energy-trend-v1` : signal SMA6 (causal, indisponibilité
// sans interpolation, frontière stricte) + résolution du poids (mode `trend`, 10 % figé) +
// cible à 5 poches prorata (somme = 1). Complète la concordance moteur (experiments/).
import { describe, it, expect } from "vitest";
import {
  computeEnergyTrendSignal,
  energyTrendScores,
  ENERGY_TREND_V1_LOOKBACK,
} from "./energy-trend-signal";
import { resolveEnergyWeight, ENERGY_TREND_V1_WEIGHT, applyEnergyOverlay } from "./energy-overlay";
import { DEFAULT_FOUR_QUADRANTS_SETTINGS } from "./settings";
import type { EconomicDataPoint } from "../types";

/** Série mensuelle synthétique (départ 2000-01). `skip` = indices ABSENTS (vrai trou calendaire). */
function series(values: number[], startYear = 2000, skip: number[] = []): EconomicDataPoint[] {
  const out: EconomicDataPoint[] = [];
  for (let i = 0; i < values.length; i++) {
    if (skip.includes(i)) continue;
    const y = startYear + Math.floor(i / 12);
    const m = (i % 12) + 1;
    out.push({ date: `${y}-${String(m).padStart(2, "0")}-28`, value: values[i] });
  }
  return out;
}

describe("energy-trend-v1 — signal SMA6", () => {
  it("lookback figé = 6", () => {
    expect(ENERGY_TREND_V1_LOOKBACK).toBe(6);
  });

  it("première disponibilité = 6ᵉ observation (pas avant)", () => {
    const s = computeEnergyTrendSignal(series([10, 11, 12, 13, 14, 15, 16]));
    const months = [...s.keys()].sort();
    expect(months[0]).toBe("2000-06"); // 6ᵉ mois
    expect(s.has("2000-05")).toBe(false);
  });

  it("série strictement croissante ⇒ ACTIF ; strictement décroissante ⇒ INACTIF", () => {
    const up = computeEnergyTrendSignal(series([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(up.get("2000-06")).toBe(true);
    expect(up.get("2000-08")).toBe(true);
    const down = computeEnergyTrendSignal(series([8, 7, 6, 5, 4, 3, 2, 1]));
    expect(down.get("2000-06")).toBe(false);
    expect(down.get("2000-08")).toBe(false);
  });

  it("SPDYENT == SMA6 (série plate) ⇒ INACTIF (strict « > »)", () => {
    const flat = computeEnergyTrendSignal(series([100, 100, 100, 100, 100, 100, 100, 100]));
    expect(flat.get("2000-06")).toBe(false);
    expect(flat.get("2000-08")).toBe(false);
  });

  it("causal : modifier t+1… ne change pas le signal ≤ t", () => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = computeEnergyTrendSignal(series(base));
    const perturbed = base.map((v, i) => (i >= 6 ? v * 5 : v));
    const b = computeEnergyTrendSignal(series(perturbed));
    for (const m of ["2000-06"]) expect(b.get(m)).toBe(a.get(m)); // ≤ index 5 inchangé
  });

  it("trou de calendrier ⇒ 6 fenêtres indisponibles, reprise après (aucune interpolation)", () => {
    // 24 mois 2000-01..2001-12 avec un trou en index 8 (2000-09).
    const vals = Array.from({ length: 24 }, (_, i) => 100 + i);
    const s = computeEnergyTrendSignal(series(vals, 2000, [8]));
    for (const m of ["2000-09", "2000-10", "2000-11", "2000-12", "2001-01", "2001-02"])
      expect(s.has(m)).toBe(false);
    expect(s.has("2001-03")).toBe(true); // 6 mois propres après le trou
  });

  it("valeur ≤ 0 ⇒ mois exclu (pas d'interpolation)", () => {
    const vals = [10, 11, 12, 13, 14, 15, -1, 17, 18, 19, 20, 21, 22];
    const s = computeEnergyTrendSignal(series(vals));
    expect(s.has("2000-07")).toBe(false); // la valeur -1
    // les fenêtres incluant l'index 6 sont indisponibles ; reprise 6 mois après
    expect(s.has("2001-01")).toBe(true);
  });
});

describe("energy-trend-v1 — scores injectables", () => {
  it("100 actif / 0 inactif dispo ; mois indisponibles ABSENTS", () => {
    const sig = new Map<string, boolean>([
      ["2000-06", true],
      ["2000-07", false],
    ]);
    const scores = energyTrendScores(sig);
    expect(scores).toEqual([
      { date: "2000-06-01", value: 100 },
      { date: "2000-07-01", value: 0 },
    ]);
  });
});

describe("energy-trend-v1 — résolution du poids (mode `trend`)", () => {
  const trend = { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, energyMode: "trend" as const };

  it("poids figé = 10 %", () => {
    expect(ENERGY_TREND_V1_WEIGHT).toBe(0.1);
  });

  it("score > 0 ⇒ 10 % ; score 0 / null / négatif ⇒ 0 %", () => {
    expect(resolveEnergyWeight(trend, 100)).toBe(0.1);
    expect(resolveEnergyWeight(trend, 1)).toBe(0.1);
    expect(resolveEnergyWeight(trend, 0)).toBe(0);
    expect(resolveEnergyWeight(trend, null)).toBe(0);
    expect(resolveEnergyWeight(trend, -5)).toBe(0);
  });

  it("mode `disabled` reste à 0 (socle v2 inchangé)", () => {
    expect(resolveEnergyWeight(DEFAULT_FOUR_QUADRANTS_SETTINGS, 100)).toBe(0);
  });

  it("cible 5 poches prorata quand actif : somme = 1, 10 % Énergie, ×0,9 sur les 4 poches", () => {
    const base = { equities: 0.4, bonds: 0.2, gold: 0.3, cash: 0.1 };
    const target = applyEnergyOverlay(base, resolveEnergyWeight(trend, 100));
    expect(target.energy).toBeCloseTo(0.1, 12);
    expect(target.equities).toBeCloseTo(0.36, 12);
    expect(target.bonds).toBeCloseTo(0.18, 12);
    expect(target.gold).toBeCloseTo(0.27, 12);
    expect(target.cash).toBeCloseTo(0.09, 12);
    expect(target.equities + target.bonds + target.gold + target.cash + target.energy).toBeCloseTo(1, 12);
  });

  it("cible = socle v2 (Énergie 0) quand inactif", () => {
    const base = { equities: 0.4, bonds: 0.2, gold: 0.3, cash: 0.1 };
    const target = applyEnergyOverlay(base, resolveEnergyWeight(trend, 0));
    expect(target.energy).toBe(0);
    expect(target.equities).toBe(0.4);
  });
});
