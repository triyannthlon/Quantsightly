import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "./types";
import { computeBrowne, type BrowneResult } from "./browne";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** `n` dates mensuelles consécutives `YYYY-MM-15` à partir de (y, m). */
function months(n: number, y = 2000, m = 1): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-15`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Série constante. */
function constSeries(dates: string[], value: number): EconomicDataPoint[] {
  return dates.map((date) => ({ date, value }));
}

/** Série géométrique `start·(1+rate)^i`. */
function growSeries(dates: string[], start: number, rate: number): EconomicDataPoint[] {
  return dates.map((date, i) => ({ date, value: start * (1 + rate) ** i }));
}

/** Série à valeurs explicites (alignée sur `dates`). */
function rawSeries(dates: string[], values: number[]): EconomicDataPoint[] {
  return dates.map((date, i) => ({ date, value: values[i] }));
}

/** Rétrécit un `BrowneResult` à sa variante OK (échoue le test sinon). */
function ok(r: BrowneResult): Extract<BrowneResult, { status: "OK" }> {
  if (r.status !== "OK") throw new Error(`attendu OK, reçu ${r.status}`);
  return r;
}

const flat = (dates: string[]) => constSeries(dates, 100);

// ─── Statuts ─────────────────────────────────────────────────────────────────

describe("computeBrowne — statuts", () => {
  it("MISSING_SERIES si une poche est vide", () => {
    const d = months(24);
    const r = computeBrowne({
      countryCode: "XX",
      equity: flat(d),
      bond: flat(d),
      cash: flat(d),
      gold: [],
    });
    expect(r.status).toBe("MISSING_SERIES");
  });

  it("INSUFFICIENT_HISTORY sous le seuil de mois", () => {
    const d = months(5);
    const r = computeBrowne({
      countryCode: "XX",
      equity: flat(d),
      bond: flat(d),
      cash: flat(d),
      gold: flat(d),
    });
    expect(r.status).toBe("INSUFFICIENT_HISTORY");
  });
});

// ─── Rééquilibrage ───────────────────────────────────────────────────────────

describe("computeBrowne — rééquilibrage", () => {
  it("l'index nominal démarre à 100", () => {
    const d = months(24);
    const r = ok(
      computeBrowne({ countryCode: "XX", equity: flat(d), bond: flat(d), cash: flat(d), gold: flat(d) }),
    );
    expect(r.series.nominal[0].value).toBe(100);
    expect(r.start).toBe(d[0]);
    expect(r.end).toBe(d[d.length - 1]);
    expect(r.months).toBe(24);
  });

  it("mensuel ⇒ moyenne équipondérée des poches (une seule croît de 2 %/mois)", () => {
    const d = months(25);
    const r = ok(
      computeBrowne({
        countryCode: "XX",
        equity: growSeries(d, 100, 0.02), // +2 %/mois
        bond: flat(d),
        cash: flat(d),
        gold: flat(d),
        rebalance: "monthly",
      }),
    );
    // rp mensuel = 0,25·2 % = 0,5 % → nominal[k] = 100·1,005^k
    for (let k = 0; k < d.length; k++) {
      expect(r.series.nominal[k].value).toBeCloseTo(100 * 1.005 ** k, 6);
    }
  });

  it("aucun rééquilibrage (buy & hold) laisse courir le gagnant → terminal plus haut que mensuel", () => {
    const d = months(60);
    const sleeves = {
      countryCode: "XX",
      equity: growSeries(d, 100, 0.02),
      bond: flat(d),
      cash: flat(d),
      gold: flat(d),
    } as const;
    const none = ok(computeBrowne({ ...sleeves, rebalance: "none" }));
    const monthly = ok(computeBrowne({ ...sleeves, rebalance: "monthly" }));
    const last = (r: ReturnType<typeof ok>) => r.series.nominal[r.series.nominal.length - 1].value;
    expect(last(none)).toBeGreaterThan(last(monthly));
  });
});

// ─── Benchmark actions ───────────────────────────────────────────────────────

describe("computeBrowne — benchmark actions", () => {
  it("rebase l'indice actions à 100 et suit sa croissance", () => {
    const d = months(24);
    const r = ok(
      computeBrowne({
        countryCode: "XX",
        equity: growSeries(d, 250, 0.01), // niveau arbitraire, +1 %/mois
        bond: flat(d),
        cash: flat(d),
        gold: flat(d),
      }),
    );
    expect(r.series.equityBenchmark[0].value).toBe(100);
    for (let k = 0; k < d.length; k++) {
      expect(r.series.equityBenchmark[k].value).toBeCloseTo(100 * 1.01 ** k, 6);
    }
  });
});

// ─── Courbe réelle (déflation) ───────────────────────────────────────────────

describe("computeBrowne — courbe réelle", () => {
  it("null sans inflation", () => {
    const d = months(24);
    const r = ok(
      computeBrowne({ countryCode: "XX", equity: flat(d), bond: flat(d), cash: flat(d), gold: flat(d) }),
    );
    expect(r.series.real).toBeNull();
    expect(r.metrics.real).toBeNull();
  });

  it("réel plat quand nominal et CPI croissent au même rythme", () => {
    const d = months(24);
    const r = ok(
      computeBrowne({
        countryCode: "XX",
        equity: growSeries(d, 100, 0.01), // toutes les poches +1 %/mois
        bond: growSeries(d, 100, 0.01),
        cash: growSeries(d, 100, 0.01),
        gold: growSeries(d, 100, 0.01),
        inflation: growSeries(d, 100, 0.01), // CPI +1 %/mois
      }),
    );
    expect(r.series.real).not.toBeNull();
    for (const pt of r.series.real!) expect(pt.value).toBeCloseTo(100, 6);
  });
});

// ─── Métriques ───────────────────────────────────────────────────────────────

describe("computeBrowne — métriques", () => {
  it("MDD nul sur une courbe monotone croissante", () => {
    const d = months(24);
    const r = ok(
      computeBrowne({
        countryCode: "XX",
        equity: growSeries(d, 100, 0.01),
        bond: growSeries(d, 100, 0.01),
        cash: growSeries(d, 100, 0.01),
        gold: growSeries(d, 100, 0.01),
      }),
    );
    expect(r.metrics.nominal.maxDrawdown).toBe(0);
    expect(r.metrics.nominal.currentDrawdown).toBe(0); // toujours au sommet
    expect(r.metrics.nominal.sharpe).not.toBeNull();
    expect(r.metrics.nominal.sharpe!).toBeGreaterThan(0);
  });

  it("MDD et cumulé sur une courbe avec creux connu (4 poches identiques)", () => {
    const d = months(14);
    // pic 120 (idx 1) → creux 90 (idx 2) = −25 % ; fin 145 → cumulé +45 %
    const path = [100, 120, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145];
    const s = () => rawSeries(d, path);
    const r = ok(
      computeBrowne({ countryCode: "XX", equity: s(), bond: s(), cash: s(), gold: s(), rebalance: "monthly" }),
    );
    // 4 poches identiques ⇒ le portefeuille suit exactement le chemin rebasé (base 100 = path[0]).
    expect(r.series.nominal[r.series.nominal.length - 1].value).toBeCloseTo(145, 6);
    expect(r.metrics.nominal.cumulative).toBeCloseTo(45, 6);
    expect(r.metrics.nominal.maxDrawdown).toBeCloseTo(-25, 6);
  });
});

// ─── Alignement ──────────────────────────────────────────────────────────────

describe("computeBrowne — alignement", () => {
  it("intersecte les poches sur leurs mois communs", () => {
    const dEq = months(24, 2000, 1); // 2000-01 → 2001-12
    const dGold = months(24, 2000, 2); // 2000-02 → 2002-01 (décalé d'un mois)
    const r = ok(
      computeBrowne({
        countryCode: "XX",
        equity: flat(dEq),
        bond: flat(dEq),
        cash: flat(dEq),
        gold: flat(dGold),
      }),
    );
    // intersection = 23 mois (2000-02 → 2001-12), départ au 2ᵉ mois.
    expect(r.months).toBe(23);
    expect(r.start).toBe(dEq[1]);
  });
});

// ─── Métriques avancées ──────────────────────────────────────────────────────

describe("computeBrowne — Sortino / Calmar / pire année / sous l'eau", () => {
  it("pire année et temps sous l'eau sur un profil par paliers annuels", () => {
    const d = months(36, 2000, 1); // 2000-01 → 2002-12
    // 2000 = 100, 2001 = 80 (−20 %), 2002 = 88 (+10 %) ; 4 poches identiques.
    const path = d.map((date) => {
      const y = Number(date.slice(0, 4));
      return y === 2000 ? 100 : y === 2001 ? 80 : 88;
    });
    const s = () => rawSeries(d, path);
    const r = ok(
      computeBrowne({ countryCode: "XX", equity: s(), bond: s(), cash: s(), gold: s(), rebalance: "monthly" }),
    );
    expect(r.metrics.nominal.worstYear).toBeCloseTo(-20, 6); // 80/100 − 1
    expect(r.metrics.nominal.bestYear).toBeCloseTo(10, 6); // 88/80 − 1
    expect(r.metrics.nominal.currentDrawdown).toBeCloseTo(-12, 6); // 88/100 − 1 (dernier vs pic)
    expect(r.metrics.nominal.maxUnderwaterMonths).toBe(24); // jan 2001 → déc 2002, jamais revenu à 100
  });

  it("Sortino et Calmar null sur une courbe monotone (pas de baisse, pas de drawdown)", () => {
    const d = months(24);
    const r = ok(
      computeBrowne({
        countryCode: "XX",
        equity: growSeries(d, 100, 0.01),
        bond: growSeries(d, 100, 0.01),
        cash: growSeries(d, 100, 0.01),
        gold: growSeries(d, 100, 0.01),
      }),
    );
    expect(r.metrics.nominal.sortino).toBeNull();
    expect(r.metrics.nominal.calmar).toBeNull();
  });

  it("Sortino et Calmar définis et positifs quand il y a des baisses", () => {
    const d = months(14);
    const path = [100, 120, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145];
    const s = () => rawSeries(d, path);
    const r = ok(
      computeBrowne({ countryCode: "XX", equity: s(), bond: s(), cash: s(), gold: s(), rebalance: "monthly" }),
    );
    expect(r.metrics.nominal.sortino).not.toBeNull();
    expect(r.metrics.nominal.sortino!).toBeGreaterThan(0);
    // Calmar = annualisé / |MDD| ; MDD = −25 % ⇒ Calmar = annualisé / 25.
    expect(r.metrics.nominal.calmar).toBeCloseTo(r.metrics.nominal.annualized! / 25, 6);
  });
});

// ─── Séries par poche & contributions ────────────────────────────────────────

describe("computeBrowne — poches", () => {
  it("expose chaque poche rebasée 100 et attribue la contribution au bon actif", () => {
    const d = months(25);
    const r = ok(
      computeBrowne({
        countryCode: "XX",
        equity: growSeries(d, 100, 0.02), // seule poche qui bouge : +2 %/mois
        bond: flat(d),
        cash: flat(d),
        gold: flat(d),
        rebalance: "monthly",
      }),
    );
    // Séries par poche, base 100.
    expect(r.series.sleeves.equity[0].value).toBe(100);
    expect(r.series.sleeves.equity[24].value).toBeCloseTo(100 * 1.02 ** 24, 6);
    expect(r.series.sleeves.bond.every((pt) => pt.value === 100)).toBe(true);

    // Contribution (Σ w·r) : mensuel ⇒ 24 mois × 0,25 × 2 % = 12 %.
    expect(r.metrics.sleeves.equity.contribution).toBeCloseTo(12, 6);
    expect(r.metrics.sleeves.bond.contribution).toBeCloseTo(0, 6);
    expect(r.metrics.sleeves.cash.contribution).toBeCloseTo(0, 6);
    expect(r.metrics.sleeves.gold.contribution).toBeCloseTo(0, 6);

    // Meilleur/pire mois de la poche actions = +2 % (croissance constante).
    expect(r.metrics.sleeves.equity.bestMonth).toBeCloseTo(2, 6);
    expect(r.metrics.sleeves.equity.worstMonth).toBeCloseTo(2, 6);
    expect(r.metrics.sleeves.bond.maxDrawdown).toBe(0);
  });
});

// ─── Inflation cumulée ───────────────────────────────────────────────────────

describe("computeBrowne — inflation cumulée", () => {
  it("null sans inflation, sinon base 100 suivant le CPI", () => {
    const d = months(24);
    const sansCpi = ok(
      computeBrowne({ countryCode: "XX", equity: flat(d), bond: flat(d), cash: flat(d), gold: flat(d) }),
    );
    expect(sansCpi.series.inflationIndex).toBeNull();
    expect(sansCpi.series.equityReal).toBeNull();
    expect(sansCpi.metrics.equityReal).toBeNull();

    const avecCpi = ok(
      computeBrowne({
        countryCode: "XX",
        equity: flat(d),
        bond: flat(d),
        cash: flat(d),
        gold: flat(d),
        inflation: growSeries(d, 100, 0.01), // CPI +1 %/mois
      }),
    );
    expect(avecCpi.series.inflationIndex).not.toBeNull();
    expect(avecCpi.series.equityReal).not.toBeNull();
    expect(avecCpi.metrics.equityReal).not.toBeNull();
    expect(avecCpi.series.inflationIndex![0].value).toBe(100);
    for (let k = 0; k < d.length; k++) {
      expect(avecCpi.series.inflationIndex![k].value).toBeCloseTo(100 * 1.01 ** k, 6);
    }
  });
});
