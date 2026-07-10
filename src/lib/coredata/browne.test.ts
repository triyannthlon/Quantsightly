import { describe, it, expect } from "vitest";
import type { EconomicDataPoint } from "./types";
import {
  computeBrowne,
  computeRobustness,
  robustnessBadge,
  type BrowneResult,
} from "./browne";

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

// ─── Score de robustesse ─────────────────────────────────────────────────────

describe("computeRobustness — badges", () => {
  it("mappe le score aux 5 badges aux bonnes bornes", () => {
    expect(robustnessBadge(100)).toBe("Très robuste");
    expect(robustnessBadge(80)).toBe("Très robuste");
    expect(robustnessBadge(79)).toBe("Robuste");
    expect(robustnessBadge(65)).toBe("Robuste");
    expect(robustnessBadge(64)).toBe("Moyen");
    expect(robustnessBadge(50)).toBe("Moyen");
    expect(robustnessBadge(49)).toBe("Fragile");
    expect(robustnessBadge(35)).toBe("Fragile");
    expect(robustnessBadge(34)).toBe("Très fragile");
    expect(robustnessBadge(0)).toBe("Très fragile");
  });
});

describe("computeRobustness — indisponibilité", () => {
  it("missing_cpi sans inflation (pas de courbe réelle)", () => {
    const d = months(72);
    const r = computeBrowne({
      countryCode: "XX",
      equity: flat(d),
      bond: flat(d),
      cash: flat(d),
      gold: flat(d),
    });
    const rob = computeRobustness(r);
    expect(rob.available).toBe(false);
    if (!rob.available) expect(rob.reason).toBe("missing_cpi");
  });

  it("insufficient_history avec CPI mais moins de 61 mois", () => {
    const d = months(48); // 4 ans < 61 mois
    const r = computeBrowne({
      countryCode: "XX",
      equity: growSeries(d, 100, 0.005),
      bond: growSeries(d, 100, 0.005),
      cash: growSeries(d, 100, 0.005),
      gold: growSeries(d, 100, 0.005),
      inflation: flat(d),
    });
    const rob = computeRobustness(r);
    expect(rob.available).toBe(false);
    if (!rob.available) expect(rob.reason).toBe("insufficient_history");
  });

  it("insufficient_history sur un BrowneResult non-OK", () => {
    const d = months(5);
    const r = computeBrowne({
      countryCode: "XX",
      equity: flat(d),
      bond: flat(d),
      cash: flat(d),
      gold: flat(d),
    });
    expect(r.status).not.toBe("OK");
    const rob = computeRobustness(r);
    expect(rob.available).toBe(false);
    if (!rob.available) expect(rob.reason).toBe("insufficient_history");
  });
});

describe("computeRobustness — composantes & score", () => {
  it("score 100 / « Très robuste » sur une courbe réelle idéale (croissance régulière, CPI plat)", () => {
    const d = months(72); // 6 ans ≥ 61 mois
    const grow = () => growSeries(d, 100, 0.005); // +0,5 %/mois → CAGR réel ≈ 6,17 %
    const r = computeBrowne({
      countryCode: "XX",
      equity: grow(),
      bond: grow(),
      cash: grow(),
      gold: grow(),
      inflation: flat(d), // CPI plat → réel = nominal
    });
    const rob = computeRobustness(r);
    expect(rob.available).toBe(true);
    if (!rob.available) return;
    // Croissance monotone, CPI plat : rendement fort, aucun risque, régularité parfaite.
    expect(rob.components.return).toBe(100); // CAGR réel ≈ 6,17 % ≥ 6 %
    expect(rob.components.drawdown).toBe(100); // MDD réel 0 %
    expect(rob.components.volatility).toBe(100); // vol réelle 0 %
    expect(rob.components.underwater).toBe(100); // jamais sous l'eau
    expect(rob.components.consistency).toBe(100); // toute fenêtre 5 ans positive
    expect(rob.score).toBe(100);
    expect(rob.badge).toBe("Très robuste");
    expect(rob.shortHistory).toBe(true); // 72 mois < 120 → historique court
  });

  it("courbe réelle plate : rendement faible, régularité nulle, risque nul → 63 « Moyen »", () => {
    const d = months(72);
    // Poches constantes → nominal exactement plat ; CPI plat → réel exactement 100
    // (on évite toute dérive flottante qui créerait des mois « sous l'eau » fantômes).
    const r = computeBrowne({
      countryCode: "XX",
      equity: flat(d),
      bond: flat(d),
      cash: flat(d),
      gold: flat(d),
      inflation: flat(d),
    });
    const rob = computeRobustness(r);
    expect(rob.available).toBe(true);
    if (!rob.available) return;
    // Réel plat : CAGR 0 % → 25 ; MDD 0 → 100 ; vol 0 → 100 ; sous l'eau 0 → 100 ;
    // aucune fenêtre STRICTEMENT positive → régularité 0.
    expect(rob.components.return).toBe(25);
    expect(rob.components.drawdown).toBe(100);
    expect(rob.components.volatility).toBe(100);
    expect(rob.components.underwater).toBe(100);
    expect(rob.components.consistency).toBe(0);
    // 0,30·25 + 0,25·100 + 0,15·100 + 0,15·100 + 0,15·0 = 62,5 → 63
    expect(rob.score).toBe(63);
    expect(rob.badge).toBe("Moyen");
  });

  it("fort rendement mais forte volatilité → ne sature PAS en « Très robuste »", () => {
    const d = months(84); // 7 ans
    // Chemin réel (4 poches identiques + CPI plat ⇒ réel = ce chemin) : forte dérive
    // haussière mais oscillations violentes + un krach soutenu → rendement élevé,
    // mais volatilité et drawdown élevés doivent brider le score.
    const rets: number[] = [];
    for (let i = 0; i < d.length - 1; i++) rets.push(i % 2 === 0 ? 0.09 : -0.055);
    rets[40] = -0.18;
    rets[41] = -0.16;
    rets[42] = -0.1;
    rets[43] = -0.08;
    const path = [100];
    for (const r of rets) path.push(path[path.length - 1] * (1 + r));
    const s = () => rawSeries(d, path);
    const r = computeBrowne({
      countryCode: "XX",
      equity: s(),
      bond: s(),
      cash: s(),
      gold: s(),
      inflation: flat(d),
      rebalance: "monthly", // 4 poches identiques ⇒ le portefeuille suit exactement le chemin
    });
    const rob = computeRobustness(r);
    expect(rob.available).toBe(true);
    if (!rob.available) return;
    expect(rob.components.return).toBe(100); // rendement réel très élevé → plafonne
    expect(rob.components.volatility).toBe(0); // volatilité réelle bien au-dessus de 15 %
    expect(rob.score).toBeLessThan(80); // ne doit PAS être « Très robuste »
    expect(rob.badge).not.toBe("Très robuste");
  });

  it("longue durée sous l'eau → fortement pénalisée", () => {
    const d = months(132); // 11 ans
    // Petit pic tôt (mois 6), léger recul, puis reste sous le pic ~9 ans avant de
    // repasser au-dessus tout à la fin : drawdown modéré mais durée sous l'eau énorme.
    const path = d.map((_, i) => {
      if (i <= 6) return 100 + i * 0.5; // pic à 103 au mois 6
      if (i < 126) return 101; // −1,9 % sous le pic, maintenu ~10 ans
      return 104 + (i - 126) * 0.2; // repasse au-dessus du pic à la toute fin
    });
    const s = () => rawSeries(d, path);
    const r = computeBrowne({
      countryCode: "XX",
      equity: s(),
      bond: s(),
      cash: s(),
      gold: s(),
      inflation: flat(d),
      rebalance: "monthly",
    });
    const rob = computeRobustness(r);
    expect(rob.available).toBe(true);
    if (!rob.available) return;
    expect(rob.components.underwater).toBeLessThan(20); // durée sous l'eau très longue
    expect(rob.badge).not.toBe("Très robuste"); // la durée sous l'eau tire le score vers le bas
  });

  it("shortHistory faux au-delà de 10 ans d'historique réel", () => {
    const d = months(132); // 11 ans ≥ 120 mois
    const grow = () => growSeries(d, 100, 0.005);
    const r = computeBrowne({
      countryCode: "XX",
      equity: grow(),
      bond: grow(),
      cash: grow(),
      gold: grow(),
      inflation: flat(d),
    });
    const rob = computeRobustness(r);
    expect(rob.available).toBe(true);
    if (!rob.available) return;
    expect(rob.shortHistory).toBe(false);
  });
});
