import { describe, it, expect } from "vitest";
import {
  availabilityMessage,
  availabilityLabel,
  type AvailabilityReason,
} from "./availability-message";

const ALL: AvailabilityReason[] = [
  "insufficient_history",
  "non_contiguous_history",
  "missing_signal_weight",
  "invalid_asset_value",
  "cpi_unavailable",
  "missing_series",
  "invalid_value",
];

describe("availabilityMessage", () => {
  it("déterministe : un même reason produit toujours le même message", () => {
    for (const r of ALL) {
      expect(availabilityMessage(r, "2016-04")).toBe(availabilityMessage(r, "2016-04"));
    }
  });

  it("ajoute le mois uniquement quand il localise une anomalie précise", () => {
    for (const [reason, ym, mois, annee] of [
      ["non_contiguous_history", "2016-04", "avr.", "2016"],
      ["missing_signal_weight", "2016-04", "avr.", "2016"],
      ["invalid_asset_value", "2015-11", "nov.", "2015"],
    ] as const) {
      const msg = availabilityMessage(reason, ym);
      expect(msg).toContain(mois);
      expect(msg).toContain(annee);
    }
    // Historique court et CPI absent : le mois n'apporte rien → jamais affiché.
    expect(availabilityMessage("insufficient_history", "2016-04")).not.toMatch(/\d{4}/);
    expect(availabilityMessage("cpi_unavailable", "2016-04")).not.toMatch(/\d{4}/);
  });

  it("couvre les 5 cas requis (+ variantes) sans jamais renvoyer 0, NaN ou un tiret", () => {
    for (const r of ALL) {
      const msg = availabilityMessage(r);
      expect(msg.length).toBeGreaterThan(3);
      expect(msg).not.toBe("—");
      expect(msg).not.toMatch(/NaN|undefined/);
      expect(availabilityLabel(r).length).toBeGreaterThan(0);
    }
  });
});
