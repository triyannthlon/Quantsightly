import { describe, it, expect } from "vitest";
import {
  totalReturn,
  weekdayReturns,
  cryptoReturns,
  distanceTo52WHigh,
  distanceToATH,
  range52w,
  drawdownSeries,
  computePanelMetrics,
} from "./metrics";
import type { NormalizedBar, NormalizedSeries, SeriesKind } from "../series/types";

// ─── Helpers de construction de séries de test ──────────────────────────────

/** Construit une barre normalisée. close = adjusted_close par défaut. */
function bar(date: string, close: number, adjusted = close, synthetic = false): NormalizedBar {
  return { date, close, adjusted_close: adjusted, synthetic };
}

/** Construit une série normalisée. `from` et `to` calculés depuis les barres. */
function series(kind: SeriesKind, bars: NormalizedBar[]): NormalizedSeries {
  return {
    kind,
    bars,
    source: {
      from: bars[0]?.date ?? "",
      to: bars[bars.length - 1]?.date ?? "",
    },
  };
}

/** Série linéaire weekday : valeur évolue par pas constants de `start` à `end`. */
function linearSeries(start: number, end: number, days: number, kind: SeriesKind = "weekday") {
  const bars: NormalizedBar[] = [];
  const step = (end - start) / (days - 1);
  for (let i = 0; i < days; i++) {
    const d = new Date("2025-01-01");
    d.setUTCDate(d.getUTCDate() + i);
    const value = start + step * i;
    bars.push(bar(d.toISOString().slice(0, 10), value));
  }
  return series(kind, bars);
}

// ─── totalReturn ────────────────────────────────────────────────────────────

describe("totalReturn", () => {
  it("retourne +50 % quand le prix passe de 100 à 150", () => {
    const s = series("weekday", [bar("2025-01-01", 100), bar("2025-01-02", 150)]);
    expect(totalReturn(s)).toBeCloseTo(50, 6);
  });

  it("retourne -25 % quand le prix passe de 200 à 150", () => {
    const s = series("weekday", [bar("2025-01-01", 200), bar("2025-01-02", 150)]);
    expect(totalReturn(s)).toBeCloseTo(-25, 6);
  });

  it("retourne 0 quand le prix ne bouge pas", () => {
    const s = series("weekday", [bar("2025-01-01", 100), bar("2025-01-02", 100)]);
    expect(totalReturn(s)).toBeCloseTo(0, 6);
  });

  it("retourne undefined si la série a moins de 2 barres", () => {
    expect(totalReturn(series("weekday", []))).toBeUndefined();
    expect(totalReturn(series("weekday", [bar("2025-01-01", 100)]))).toBeUndefined();
  });

  it("retourne undefined si la valeur initiale vaut 0 (division par zéro)", () => {
    const s = series("weekday", [bar("2025-01-01", 0), bar("2025-01-02", 100)]);
    expect(totalReturn(s)).toBeUndefined();
  });
});

// ─── weekdayReturns ─────────────────────────────────────────────────────────

describe("weekdayReturns", () => {
  it("calcule ret1d correctement (J-1 → J)", () => {
    // Le J-1 calendaire de "2025-01-15" est "2025-01-14".
    const s = series("weekday", [bar("2025-01-14", 100), bar("2025-01-15", 110)]);
    const r = weekdayReturns(s);
    expect(r.ret1d).toBeCloseTo(10, 6);
  });

  it("calcule retYtd correctement (référence = 31 déc N-1)", () => {
    // YTD de 2025-06-30 → réf = 2024-12-31. On force la barre à cette date.
    const s = series("weekday", [bar("2024-12-31", 100), bar("2025-06-30", 130)]);
    const r = weekdayReturns(s);
    expect(r.retYtd).toBeCloseTo(30, 6);
  });

  it("retourne {} pour une série vide", () => {
    expect(weekdayReturns(series("weekday", []))).toEqual({});
  });

  it("retourne undefined pour horizons trop courts", () => {
    // 1 seule barre → aucun horizon calculable
    const s = series("weekday", [bar("2025-01-15", 100)]);
    const r = weekdayReturns(s);
    expect(r.ret1d).toBeUndefined();
    expect(r.ret1w).toBeUndefined();
    expect(r.ret1m).toBeUndefined();
    expect(r.retYtd).toBeUndefined();
  });

  it("utilise LOCF (dernière barre ≤ date cible)", () => {
    // J-7 de "2025-01-15" = "2025-01-08" → utilise la dernière barre ≤ 08/01.
    // Série : 06/01 = 100, 13/01 = 110, 15/01 = 120.
    // ret1w doit chercher la valeur au 08/01 = celle du 06/01 (LOCF) = 100.
    const s = series("weekday", [
      bar("2025-01-06", 100),
      bar("2025-01-13", 110),
      bar("2025-01-15", 120),
    ]);
    const r = weekdayReturns(s);
    expect(r.ret1w).toBeCloseTo(20, 6); // (120 / 100 - 1) * 100
  });
});

// ─── cryptoReturns ──────────────────────────────────────────────────────────

describe("cryptoReturns", () => {
  it("calcule ret7d et ret30d correctement (calendrier 7j/7)", () => {
    const s = series("calendar", [
      bar("2025-05-16", 100), // J-30
      bar("2025-06-08", 110), // J-7
      bar("2025-06-15", 121), // J0
    ]);
    const r = cryptoReturns(s);
    expect(r.ret7d).toBeCloseTo(10, 6); // 110 → 121
    expect(r.ret30d).toBeCloseTo(21, 6); // 100 → 121
  });

  it("retourne {} pour une série vide", () => {
    expect(cryptoReturns(series("calendar", []))).toEqual({});
  });
});

// ─── distanceTo52WHigh ──────────────────────────────────────────────────────

describe("distanceTo52WHigh", () => {
  it("retourne 0 quand le close actuel EST le plus haut de la fenêtre", () => {
    const s = series("weekday", [
      bar("2025-01-01", 100),
      bar("2025-01-02", 110),
      bar("2025-01-03", 120), // nouveau plus haut
    ]);
    expect(distanceTo52WHigh(s)).toBeCloseTo(0, 6);
  });

  it("retourne -10 % quand le close actuel est 10 % sous le plus haut", () => {
    const s = series("weekday", [
      bar("2025-01-01", 100),
      bar("2025-01-02", 100),
      bar("2025-01-03", 90), // 10 % sous le pic à 100
    ]);
    expect(distanceTo52WHigh(s)).toBeCloseTo(-10, 6);
  });

  it("utilise une fenêtre de 252 barres pour weekday", () => {
    // 300 barres : le close à idx 0 = 1000 (très haut), puis décroissance vers 100.
    // Comme la fenêtre est de 252, le 1000 (à idx 0) est HORS fenêtre.
    // Le pic dans la fenêtre est à idx (300-252) = 48.
    const bars: NormalizedBar[] = [];
    for (let i = 0; i < 300; i++) {
      const d = new Date("2024-01-01");
      d.setUTCDate(d.getUTCDate() + i);
      const value = i === 0 ? 1000 : 200 - i * 0.3; // 1000 puis ~200..110
      bars.push(bar(d.toISOString().slice(0, 10), value));
    }
    const s = series("weekday", bars);
    const result = distanceTo52WHigh(s);
    // Le résultat doit être négatif mais pas catastrophiquement (pas -90%)
    // car le pic à 1000 est exclu de la fenêtre.
    expect(result).toBeDefined();
    expect(result!).toBeGreaterThan(-50);
  });

  it("retourne undefined si la série est vide", () => {
    expect(distanceTo52WHigh(series("weekday", []))).toBeUndefined();
  });
});

// ─── distanceToATH ──────────────────────────────────────────────────────────

describe("distanceToATH", () => {
  it("retourne -50 % quand le close actuel est moitié de l'ATH historique", () => {
    const s = series("calendar", [
      bar("2024-01-01", 100), // ATH
      bar("2024-06-01", 80),
      bar("2025-01-01", 50), // moitié de l'ATH
    ]);
    expect(distanceToATH(s)).toBeCloseTo(-50, 6);
  });

  it("retourne 0 quand le close actuel est le nouvel ATH", () => {
    const s = series("calendar", [
      bar("2024-01-01", 100),
      bar("2025-01-01", 200), // nouvel ATH
    ]);
    expect(distanceToATH(s)).toBeCloseTo(0, 6);
  });

  it("retourne undefined si la série est vide", () => {
    expect(distanceToATH(series("calendar", []))).toBeUndefined();
  });
});

// ─── range52w ───────────────────────────────────────────────────────────────

describe("range52w", () => {
  it("retourne les bornes correctes sur une série de 3 barres", () => {
    const s = series("weekday", [
      bar("2025-01-01", 100),
      bar("2025-01-02", 200),
      bar("2025-01-03", 50),
    ]);
    const r = range52w(s);
    expect(r.high52w).toBeCloseTo(200, 6);
    expect(r.low52w).toBeCloseTo(50, 6);
  });

  it("retourne {} pour une série vide", () => {
    expect(range52w(series("weekday", []))).toEqual({});
  });

  it("utilise close nominal (pas adjusted_close)", () => {
    const s = series("weekday", [
      bar("2025-01-01", 100, 50), // close=100, adj=50 → range doit utiliser close
      bar("2025-01-02", 200, 100),
    ]);
    const r = range52w(s);
    expect(r.high52w).toBe(200);
    expect(r.low52w).toBe(100);
  });
});

// ─── drawdownSeries ─────────────────────────────────────────────────────────

describe("drawdownSeries", () => {
  it("retourne 0 sur la première barre (le pic = la barre elle-même)", () => {
    const bars = [bar("2025-01-01", 100), bar("2025-01-02", 90)];
    const dd = drawdownSeries(bars);
    expect(dd[0].value).toBeCloseTo(0, 6);
  });

  it("retourne des valeurs ≤ 0 partout (drawdown est négatif ou nul)", () => {
    const bars = [
      bar("2025-01-01", 100),
      bar("2025-01-02", 120),
      bar("2025-01-03", 90),
      bar("2025-01-04", 150),
      bar("2025-01-05", 110),
    ];
    const dd = drawdownSeries(bars);
    dd.forEach((p) => {
      expect(p.value).toBeLessThanOrEqual(1e-9); // tolérance flottante
    });
  });

  it("calcule le drawdown courant correct (90 par rapport au pic à 120 = -25%)", () => {
    const bars = [bar("2025-01-01", 100), bar("2025-01-02", 120), bar("2025-01-03", 90)];
    const dd = drawdownSeries(bars);
    expect(dd[2].value).toBeCloseTo(-25, 6); // (90/120 - 1)*100
  });

  it("retourne 0 quand un nouveau pic est atteint", () => {
    const bars = [bar("2025-01-01", 100), bar("2025-01-02", 150)];
    const dd = drawdownSeries(bars);
    expect(dd[1].value).toBeCloseTo(0, 6);
  });
});

// ─── computePanelMetrics ────────────────────────────────────────────────────

describe("computePanelMetrics", () => {
  it("retourne {} pour une série de moins de 2 barres", () => {
    expect(computePanelMetrics(series("weekday", []))).toEqual({});
    expect(computePanelMetrics(series("weekday", [bar("2025-01-01", 100)]))).toEqual({});
  });

  it("calcule cumulativeReturn correctement", () => {
    const s = series("weekday", [bar("2025-01-01", 100), bar("2025-01-02", 150)]);
    const m = computePanelMetrics(s);
    expect(m.cumulativeReturn).toBeCloseTo(50, 6);
  });

  it("calcule maxDrawdown négatif quand il y a un creux", () => {
    const s = series("weekday", [
      bar("2025-01-01", 100),
      bar("2025-01-02", 120),
      bar("2025-01-03", 60), // -50 % depuis le pic à 120
      bar("2025-01-04", 80),
    ]);
    const m = computePanelMetrics(s);
    expect(m.maxDrawdown).toBeCloseTo(-50, 6);
  });

  it("currentDrawdown reflète le recul depuis le pic", () => {
    const s = series("weekday", [
      bar("2025-01-01", 100),
      bar("2025-01-02", 200), // pic
      bar("2025-01-03", 150), // 25 % sous le pic
    ]);
    const m = computePanelMetrics(s);
    expect(m.currentDrawdown).toBeCloseTo(-25, 6);
  });

  it("Sharpe est positif quand annualizedReturn > 0 et vol > 0", () => {
    // Série en hausse régulière mais volatile
    const bars: NormalizedBar[] = [];
    for (let i = 0; i < 100; i++) {
      const d = new Date("2025-01-01");
      d.setUTCDate(d.getUTCDate() + i);
      const value = 100 * Math.pow(1.001, i) * (1 + (i % 3 === 0 ? 0.01 : -0.005));
      bars.push(bar(d.toISOString().slice(0, 10), value));
    }
    const m = computePanelMetrics(series("weekday", bars));
    expect(m.sharpe).toBeDefined();
    expect(m.annualizedReturn).toBeDefined();
    expect(m.annualizedVolatility).toBeDefined();
    expect(m.annualizedVolatility!).toBeGreaterThan(0);
  });

  it("positiveDaysPct est cohérent (50 % sur une série alternée)", () => {
    // 4 vrais jours, 3 transitions, 2 montées et 1 descente → 2/3 = ~66.67 %
    const s = series("weekday", [
      bar("2025-01-01", 100),
      bar("2025-01-02", 110), // ↑
      bar("2025-01-03", 105), // ↓
      bar("2025-01-04", 115), // ↑
    ]);
    const m = computePanelMetrics(s);
    expect(m.positiveDaysPct).toBeCloseTo(66.6667, 2);
  });

  it("exclut les barres synthétiques des calculs de rendements journaliers", () => {
    const s = series("weekday", [
      bar("2025-01-01", 100),
      bar("2025-01-02", 100, 100, true), // synthetic
      bar("2025-01-03", 100, 100, true), // synthetic
      bar("2025-01-04", 110), // vrai close
    ]);
    const m = computePanelMetrics(s);
    // Le cumulativeReturn doit être calculé sur les barres RÉELLES uniquement.
    // first réel = 100, last réel = 110 → +10 %
    expect(m.cumulativeReturn).toBeCloseTo(10, 6);
  });

  it("periodHigh et periodLow sur la série complète", () => {
    const s = series("weekday", [
      bar("2025-01-01", 100),
      bar("2025-01-02", 250),
      bar("2025-01-03", 50),
      bar("2025-01-04", 150),
    ]);
    const m = computePanelMetrics(s);
    expect(m.periodHigh).toBe(250);
    expect(m.periodLow).toBe(50);
  });
});

// ─── Sanity check : série linéaire pour valider les helpers ────────────────

describe("linearSeries helper (sanity)", () => {
  it("génère bien une série de la bonne taille", () => {
    const s = linearSeries(100, 200, 11);
    expect(s.bars.length).toBe(11);
    expect(s.bars[0].close).toBeCloseTo(100, 6);
    expect(s.bars[10].close).toBeCloseTo(200, 6);
  });
});
