import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "@/lib/coredata/types";
import { computeExtremeMonths, EXTREME_MONTHS_COUNT, type ExtremeSeries } from "./extreme-months";

// ─── Aides ───────────────────────────────────────────────────────────────────

const monthIndex = (mk: string) => Number(mk.slice(0, 4)) * 12 + (Number(mk.slice(5, 7)) - 1);
const fromIndex = (i: number) => {
  const y = Math.floor(i / 12);
  return `${y}-${String(i - y * 12 + 1).padStart(2, "0")}`;
};
const nextMonth = (mk: string) => fromIndex(monthIndex(mk) + 1);

/** Courbe base 100 à partir d'une liste de rendements mensuels (date = fin de mois). */
function levels(startMonth: string, rets: number[]): EconomicDataPoint[] {
  const out: EconomicDataPoint[] = [{ date: `${startMonth}-28`, value: 100 }];
  let m = startMonth;
  let v = 100;
  for (const r of rets) {
    m = nextMonth(m);
    v *= 1 + r;
    out.push({ date: `${m}-28`, value: v });
  }
  return out;
}

function series(id: string, isEquity: boolean, startMonth: string, rets: number[]): ExtremeSeries {
  return { id, label: id, isEquity, levels: levels(startMonth, rets) };
}

// 24 rendements ACTIONS : 12 négatifs croissants en amplitude puis 12 positifs.
const EQ_RETS = [
  -0.01, -0.02, -0.03, -0.04, -0.05, -0.06, -0.07, -0.08, -0.09, -0.1, -0.11, -0.12, 0.01, 0.02,
  0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12,
];
const EQUITY = series("equity", true, "2000-01", EQ_RETS);
const HALF = series(
  "half",
  false,
  "2000-01",
  EQ_RETS.map((r) => r / 2),
);
const AMP = series(
  "amp",
  false,
  "2000-01",
  EQ_RETS.map((r) => r * 1.5),
);

// ─── Sélection des mois extrêmes ───────────────────────────────────────────────

describe("sélection des mois extrêmes (sur l'indice actions)", () => {
  it("retient 12 pires + 12 meilleurs, triés par rendement actions", () => {
    const r = computeExtremeMonths([EQUITY, HALF]);
    expect(r.count).toBe(EXTREME_MONTHS_COUNT);
    // Pire = le plus négatif (−12 % en janv. 2001) → le moins négatif (−1 % en févr. 2000).
    expect(r.worst[0].date.slice(0, 7)).toBe("2001-01");
    expect(r.worst[0].equityReturn).toBeCloseTo(-12, 4);
    expect(r.worst[11].date.slice(0, 7)).toBe("2000-02");
    expect(r.worst[11].equityReturn).toBeCloseTo(-1, 4);
    // Meilleur = le plus positif (+12 % en janv. 2002).
    expect(r.best[0].date.slice(0, 7)).toBe("2002-01");
    expect(r.best[0].equityReturn).toBeCloseTo(12, 4);
  });

  it("applique EXACTEMENT les mêmes dates à toutes les séries", () => {
    const r = computeExtremeMonths([EQUITY, HALF, AMP]);
    for (const mth of [...r.worst, ...r.best]) {
      expect(mth.returns).toHaveProperty("equity");
      expect(mth.returns).toHaveProperty("half");
      expect(mth.returns).toHaveProperty("amp");
      expect(mth.returns.half).not.toBeNull();
      expect(mth.returns.amp).not.toBeNull();
    }
    // Sur le pire mois : modèle demi = moitié, modèle amplifié = 1,5×.
    expect(r.worst[0].returns.equity).toBeCloseTo(-12, 4);
    expect(r.worst[0].returns.half).toBeCloseTo(-6, 4);
    expect(r.worst[0].returns.amp).toBeCloseTo(-18, 4);
  });

  it("moins de 12 mois disponibles → count = min", () => {
    const r = computeExtremeMonths([series("equity", true, "2000-01", [-0.02, -0.01, 0.03, 0.05])]);
    expect(r.count).toBe(4);
  });

  it("aucune série actions → résultat vide", () => {
    const r = computeExtremeMonths([HALF, AMP]);
    expect(r).toEqual({ count: 0, worst: [], best: [], synthesis: [] });
  });
});

// ─── Synthèse factuelle ────────────────────────────────────────────────────────

describe("synthèse factuelle", () => {
  const r = computeExtremeMonths([EQUITY, HALF, AMP]);
  const synHalf = r.synthesis.find((s) => s.seriesId === "half")!;
  const synAmp = r.synthesis.find((s) => s.seriesId === "amp")!;

  it("une entrée par série NON-actions", () => {
    expect(r.synthesis.map((s) => s.seriesId)).toEqual(["half", "amp"]);
  });

  it("rendement moyen pendant les pires / meilleurs mois", () => {
    // moyenne actions pires = −6,5 % ; meilleurs = +6,5 %.
    expect(synHalf.avgDuringWorst).toBeCloseTo(-3.25, 4); // moitié
    expect(synHalf.avgDuringBest).toBeCloseTo(3.25, 4);
    expect(synAmp.avgDuringWorst).toBeCloseTo(-9.75, 4); // 1,5×
    expect(synAmp.avgDuringBest).toBeCloseTo(9.75, 4);
  });

  it("« mois mieux protégés » : compteurs + part (modèle > actions)", () => {
    // demi : moins négatif que les actions à chaque pire mois → 12/12 ; amplifié → 0/12.
    expect(synHalf.betterCount).toBe(12);
    expect(synHalf.evaluatedCount).toBe(12);
    expect(synHalf.betterShare).toBe(1);
    expect(synAmp.betterCount).toBe(0);
    expect(synAmp.evaluatedCount).toBe(12);
    expect(synAmp.betterShare).toBe(0);
  });

  it("écart moyen pendant les pires mois (points modèle − actions)", () => {
    // demi : (r/2 − r) = −r/2 ; sur pires (r<0) → positif ; moyenne = +3,25 pts.
    expect(synHalf.avgOutperformanceWorst).toBeCloseTo(3.25, 4);
    // amplifié : (1,5r − r) = 0,5r ; sur pires (r<0) → négatif ; moyenne = −3,25 pts.
    expect(synAmp.avgOutperformanceWorst).toBeCloseTo(-3.25, 4);
  });

  it("participation moyenne aux hausses = moyenne(modèle)/moyenne(actions) sur les meilleurs mois", () => {
    expect(synHalf.upsideParticipation).toBeCloseTo(0.5, 6);
    expect(synAmp.upsideParticipation).toBeCloseTo(1.5, 6);
  });

  it("participation = null si la moyenne actions des meilleurs mois est négligeable (jamais 0)", () => {
    const flat = computeExtremeMonths([
      series("equity", true, "2000-01", [0, 0, 0, 0]),
      series("m", false, "2000-01", [0.01, 0.02, -0.01, 0.03]),
    ]);
    expect(flat.synthesis[0].upsideParticipation).toBeNull();
  });

  it("accepte 2 séries (Actions + 1 modèle)", () => {
    const r2 = computeExtremeMonths([EQUITY, HALF]);
    expect(r2.synthesis).toHaveLength(1);
    expect(r2.synthesis[0].seriesId).toBe("half");
  });
});
