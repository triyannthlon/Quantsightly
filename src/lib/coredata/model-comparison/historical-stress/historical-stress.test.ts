import { describe, it, expect } from "vitest";
import type { ComparisonStrategyId, CumulativePoint } from "../types";
import {
  calculateHistoricalStress,
  buildHistoricalStressResults,
  type HistoricalStressStrategySeries,
} from "./calculator";
import type { HistoricalCrisis } from "./types";

// ─── Aides de test (mêmes conventions calendaires que le calculateur) ─────────

const monthIndex = (mk: string): number =>
  Number(mk.slice(0, 4)) * 12 + (Number(mk.slice(5, 7)) - 1);
const fromIndex = (i: number): string => {
  const y = Math.floor(i / 12);
  const m = i - y * 12 + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
};
const nextMonth = (mk: string): string => fromIndex(monthIndex(mk) + 1);

/** Courbe base 100 : une valeur par mois consécutif, dates fin de mois (`YYYY-MM-28`). */
function mkLevels(startMonth: string, values: number[]): CumulativePoint[] {
  const out: CumulativePoint[] = [];
  let m = startMonth;
  for (const v of values) {
    out.push({ date: `${m}-28`, value: v });
    m = nextMonth(m);
  }
  return out;
}

function strat(
  strategyId: ComparisonStrategyId,
  levels: CumulativePoint[],
  extra: Partial<HistoricalStressStrategySeries> = {},
): HistoricalStressStrategySeries {
  return { strategyId, available: true, levels, ...extra };
}

function crisis(partial: Partial<HistoricalCrisis>): HistoricalCrisis {
  return {
    id: "TEST",
    name: "Crise test",
    definition: "…",
    startDate: "2007-09-30",
    endDate: "2009-03-31",
    effectiveEndDate: "2009-03-31",
    category: "financial",
    status: "closed",
    importance: "primary",
    includeInAggregates: true,
    displayOrder: 1,
    ...partial,
  };
}

const BROWNE: ComparisonStrategyId = "browne";
const DYN: ComparisonStrategyId = "quadrants-dynamic-v2";
const BIN: ComparisonStrategyId = "quadrants-binary-v2";

// Exemple maître (drawdown & récupération à valeurs rondes) : base au départ = 100.
//   janv 100 (base) · févr 110 (sommet) · mars 88 · avr 77 (creux) · mai 90 · juin 99 (fin)
//   juil 105 · août 112 (retour au-dessus du sommet 110) · puis ≥ 112
const MASTER_START = "2020-01";
const MASTER = mkLevels(MASTER_START, [100, 110, 88, 77, 90, 99, 105, 112, 120, 120, 121, 122]);
const masterOptions = {
  effectiveStartDate: "2020-01-28",
  effectiveEndDate: "2020-06-28",
  analysisEndDate: "2020-12-28",
  provisional: false,
};

// ─── DATES ────────────────────────────────────────────────────────────────────

describe("dates", () => {
  it("start_date est la BASE, pas un rendement (aucun saut pré-départ compté)", () => {
    // Saut massif DANS le mois de départ : ne doit pas gonfler la perf de crise.
    const levels = mkLevels("2007-08", [100, 200, 210]); // août 100 · sept 200 (base) · oct 210
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], {
      effectiveStartDate: "2007-09-30",
      effectiveEndDate: "2007-10-31",
      analysisEndDate: "2007-10-31",
      provisional: false,
    });
    // 210/200 − 1 = 5 % (et non 210/100 − 1 = 110 %).
    expect(r.strategies[0].cumulativeReturn).toBeCloseTo(5, 6);
  });

  it("end_date est INCLUSE et aucun mois n'est compté deux fois", () => {
    const levels = mkLevels("2007-09", [100, 105, 110]); // sept base · oct · nov
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], {
      effectiveStartDate: "2007-09-30",
      effectiveEndDate: "2007-11-30",
      analysisEndDate: "2007-11-30",
      provisional: false,
    });
    // 2 rendements (oct, nov) : 110/100 − 1 = 10 %. durationMonths = 2.
    expect(r.strategies[0].cumulativeReturn).toBeCloseTo(10, 6);
    expect(r.durationMonths).toBe(2);
  });

  it("passage décembre → janvier : continuité et durée correctes", () => {
    const levels = mkLevels("2007-11", [100, 101, 102, 103]); // nov · déc · janv · févr
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], {
      effectiveStartDate: "2007-11-30",
      effectiveEndDate: "2008-02-28",
      analysisEndDate: "2008-02-28",
      provisional: false,
    });
    expect(r.strategies[0].available).toBe(true);
    expect(r.durationMonths).toBe(3);
    expect(r.strategies[0].cumulativeReturn).toBeCloseTo(3, 6);
  });

  it("épisode clôturé ENTIÈREMENT inclus dans la période → retenu", () => {
    const results = buildHistoricalStressResults({
      window: { start: "2005-01", end: "2012-12" },
      strategies: [
        strat(
          BROWNE,
          mkLevels(
            "2005-01",
            Array.from({ length: 96 }, (_, i) => 100 + i),
          ),
        ),
      ],
      crises: [
        crisis({
          id: "GFC",
          startDate: "2007-09-30",
          endDate: "2009-03-31",
          effectiveEndDate: "2009-03-31",
        }),
      ],
    });
    expect(results).toHaveLength(1);
    expect(results[0].crisis.id).toBe("GFC");
  });

  it("épisode clôturé PARTIELLEMENT couvert par la période → exclu", () => {
    // Fenêtre « 5 ans » 2021→2025 : la GFC 2007–2009 est hors période.
    const results = buildHistoricalStressResults({
      window: { start: "2021-01", end: "2025-12" },
      strategies: [
        strat(
          BROWNE,
          mkLevels(
            "2021-01",
            Array.from({ length: 60 }, (_, i) => 100 + i),
          ),
        ),
      ],
      crises: [
        crisis({
          id: "GFC",
          startDate: "2007-09-30",
          endDate: "2009-03-31",
          effectiveEndDate: "2009-03-31",
        }),
      ],
    });
    expect(results).toHaveLength(0);
  });

  it("épisode en cours : borné au dernier mois clôturé (mois courant exclu)", () => {
    // Vue (DB) : effEnd = juillet 2026 ; fenêtre du moteur : juin 2026 (juillet = mois courant exclu).
    const levels = mkLevels(
      "2020-01",
      Array.from({ length: 78 }, (_, i) => 100 + i),
    ); // …jusqu'à juin 2026
    const results = buildHistoricalStressResults({
      window: { start: "2020-01", end: "2026-06" },
      strategies: [strat(BROWNE, levels)],
      crises: [
        crisis({
          id: "ME_WAR",
          startDate: "2026-02-28",
          endDate: null,
          effectiveEndDate: "2026-07-31", // borne DB en avance
          status: "ongoing",
          importance: "primary",
          includeInAggregates: false,
        }),
      ],
    });
    expect(results).toHaveLength(1);
    // Clampé à window.end = 2026-06 (juillet exclu).
    expect(results[0].effectiveEndDate.slice(0, 7)).toBe("2026-06");
    expect(results[0].durationMonths).toBe(4); // févr → juin
    expect(results[0].provisional).toBe(true);
  });
});

// ─── SÉRIES / DISPONIBILITÉ ─────────────────────────────────────────────────

describe("séries & disponibilité", () => {
  it("deux stratégies mesurées sur les MÊMES dates", () => {
    const a = mkLevels(MASTER_START, [100, 110, 88, 77, 90, 99]);
    const b = mkLevels(MASTER_START, [100, 101, 102, 103, 104, 105]);
    const r = calculateHistoricalStress(
      crisis({}),
      [strat(BROWNE, a), strat(DYN, b)],
      masterOptions,
    );
    expect(r.strategies).toHaveLength(2);
    expect(r.strategies.every((s) => s.available)).toBe(true);
    // b : monotone → perf 105/100 − 1 = 5 %, aucun drawdown.
    expect(r.strategies[1].cumulativeReturn).toBeCloseTo(5, 6);
    expect(r.strategies[1].maxDrawdown).toBeCloseTo(0, 6);
  });

  it("trois stratégies", () => {
    const a = mkLevels(MASTER_START, [100, 110, 88, 77, 90, 99]);
    const b = mkLevels(MASTER_START, [100, 101, 102, 103, 104, 105]);
    const c = mkLevels(MASTER_START, [100, 95, 90, 85, 80, 75]);
    const r = calculateHistoricalStress(
      crisis({}),
      [strat(BROWNE, a), strat(DYN, b), strat(BIN, c)],
      masterOptions,
    );
    expect(r.strategies.map((s) => s.strategyId)).toEqual([BROWNE, DYN, BIN]);
    expect(r.strategies[2].cumulativeReturn).toBeCloseTo(-25, 6); // 75/100 − 1
  });

  it("mois manquant (trou) → historique non continu", () => {
    const levels = mkLevels(MASTER_START, [100, 110, 88, 77, 90, 99]);
    levels.splice(3, 1); // retire avril 2020 → trou
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions);
    expect(r.strategies[0].available).toBe(false);
    expect(r.strategies[0].unavailableReason).toBe("Historique mensuel non continu");
  });

  it("observation de départ absente → raison explicite", () => {
    // Les niveaux commencent APRÈS le mois de départ demandé.
    const levels = mkLevels("2020-03", [100, 101, 102]);
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions);
    expect(r.strategies[0].available).toBe(false);
    expect(r.strategies[0].unavailableReason).toBe("Observation de départ indisponible");
  });

  it("historique insuffisant : la série s'arrête avant la fin de crise", () => {
    const levels = mkLevels(MASTER_START, [100, 110, 88]); // s'arrête en mars, fin demandée = juin
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions);
    expect(r.strategies[0].available).toBe(false);
    expect(r.strategies[0].unavailableReason).toBe("Historique insuffisant");
  });

  it("stratégie indisponible au niveau moteur → raison propagée", () => {
    const r = calculateHistoricalStress(
      crisis({}),
      [
        strat(BROWNE, [], {
          available: false,
          unavailableReason: "Série obligataire indisponible",
        }),
      ],
      masterOptions,
    );
    expect(r.strategies[0].available).toBe(false);
    expect(r.strategies[0].unavailableReason).toBe("Série obligataire indisponible");
    expect(r.strategies[0].cumulativeReturn).toBeNull();
  });

  it("le calculateur consomme les niveaux VERBATIM (nominal vs réel, coûts) donnent des résultats distincts", () => {
    // Le mode (nominal/réel) et les coûts sont encodés dans les niveaux nets fournis par le moteur.
    const nominal = mkLevels(MASTER_START, [100, 110, 88, 77, 90, 99]);
    const real = mkLevels(MASTER_START, [100, 108, 86, 75, 87, 95]); // déflaté
    const rNom = calculateHistoricalStress(crisis({}), [strat(BROWNE, nominal)], masterOptions);
    const rReal = calculateHistoricalStress(crisis({}), [strat(BROWNE, real)], masterOptions);
    expect(rNom.strategies[0].cumulativeReturn).toBeCloseTo(-1, 6); // 99/100 − 1
    expect(rReal.strategies[0].cumulativeReturn).toBeCloseTo(-5, 6); // 95/100 − 1
    expect(rNom.strategies[0].cumulativeReturn).not.toBeCloseTo(
      rReal.strategies[0].cumulativeReturn!,
      3,
    );
  });
});

// ─── CALCULS (perf, drawdown, point bas, récupération) ───────────────────────

describe("calculs", () => {
  it("performance cumulée, max drawdown, sommet & point bas connus", () => {
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, MASTER)], masterOptions);
    const s = r.strategies[0];
    expect(s.cumulativeReturn).toBeCloseTo(-1, 6); // 99/100 − 1
    expect(s.maxDrawdown).toBeCloseTo(-30, 6); // 77/110 − 1
    expect(s.peakDate?.slice(0, 7)).toBe("2020-02"); // sommet 110
    expect(s.troughDate?.slice(0, 7)).toBe("2020-04"); // creux 77
  });

  it("récupération APRÈS la fin de la crise (dans la période d'analyse)", () => {
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, MASTER)], masterOptions);
    const s = r.strategies[0];
    // Retour ≥ 110 en août 2020 (après la fin juin) : 4 mois après le creux d'avril.
    expect(s.recovered).toBe(true);
    expect(s.recoveryDate?.slice(0, 7)).toBe("2020-08");
    expect(s.recoveryAfterTroughMonths).toBe(4);
  });

  it("récupération À L'INTÉRIEUR de la crise", () => {
    // Creux en mars, retour au sommet dès mai (avant la fin juin).
    const levels = mkLevels(MASTER_START, [100, 120, 90, 130, 130, 131]);
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions);
    const s = r.strategies[0];
    expect(s.troughDate?.slice(0, 7)).toBe("2020-03");
    expect(s.recovered).toBe(true);
    expect(s.recoveryDate?.slice(0, 7)).toBe("2020-04"); // 130 ≥ sommet 120
    expect(s.recoveryAfterTroughMonths).toBe(1);
  });

  it("aucune récupération à la date d'analyse", () => {
    const levels = mkLevels(MASTER_START, [100, 110, 88, 77, 80, 82, 84, 86, 88, 90, 92, 94]);
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions);
    const s = r.strategies[0];
    expect(s.maxDrawdown).toBeCloseTo(-30, 6);
    expect(s.recovered).toBe(false);
    expect(s.recoveryDate).toBeNull();
    expect(s.recoveryAfterTroughMonths).toBeNull();
    expect(s.underwaterDurationMonths).toBeNull();
  });

  it("performance POSITIVE", () => {
    const levels = mkLevels(MASTER_START, [100, 105, 108, 112, 115, 118]);
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions);
    expect(r.strategies[0].cumulativeReturn).toBeCloseTo(18, 6);
  });

  it("performance NÉGATIVE", () => {
    const levels = mkLevels(MASTER_START, [100, 95, 90, 85, 80, 78]);
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions);
    expect(r.strategies[0].cumulativeReturn).toBeCloseTo(-22, 6);
  });
});

// ─── PÉRIODE & STATUTS (données pour l'UI de l'étape 2) ───────────────────────

describe("période & statuts", () => {
  const longSeries = mkLevels(
    "2005-01",
    Array.from({ length: 300 }, (_, i) => 100 + i * 0.5),
  );

  it("épisode PROVISOIRE borné et inclus → provisional = true", () => {
    const results = buildHistoricalStressResults({
      window: { start: "2005-01", end: "2026-06" },
      strategies: [strat(BROWNE, longSeries)],
      crises: [
        crisis({
          id: "TARIFF_2025",
          startDate: "2025-01-31",
          endDate: "2025-04-30",
          effectiveEndDate: "2025-04-30",
          status: "provisional",
          importance: "secondary",
          includeInAggregates: false,
        }),
      ],
    });
    expect(results).toHaveLength(1);
    expect(results[0].provisional).toBe(true);
    expect(results[0].crisis.importance).toBe("secondary");
  });

  it("épisode clôturé → provisional = false", () => {
    const results = buildHistoricalStressResults({
      window: { start: "2005-01", end: "2026-06" },
      strategies: [strat(BROWNE, longSeries)],
      crises: [
        crisis({
          id: "COVID",
          startDate: "2020-01-31",
          endDate: "2020-03-31",
          effectiveEndDate: "2020-03-31",
        }),
      ],
    });
    expect(results[0].provisional).toBe(false);
  });

  it("rendu dans l'ordre display_order (l'importance NE filtre PAS ici — l'UI s'en charge)", () => {
    const results = buildHistoricalStressResults({
      window: { start: "2005-01", end: "2026-06" },
      strategies: [strat(BROWNE, longSeries)],
      crises: [
        crisis({
          id: "B",
          displayOrder: 90,
          startDate: "2010-04-30",
          endDate: "2012-07-31",
          effectiveEndDate: "2012-07-31",
        }),
        crisis({
          id: "A",
          displayOrder: 80,
          startDate: "2007-09-30",
          endDate: "2009-03-31",
          effectiveEndDate: "2009-03-31",
        }),
        crisis({
          id: "C",
          displayOrder: 150,
          importance: "secondary",
          startDate: "2025-01-31",
          endDate: "2025-04-30",
          effectiveEndDate: "2025-04-30",
          status: "provisional",
        }),
      ],
    });
    expect(results.map((r) => r.crisis.id)).toEqual(["A", "B", "C"]);
  });
});

// ─── DURÉES (trois durées distinctes, testées séparément) ─────────────────────

describe("durées : chute / récupération / sous l'eau", () => {
  it("monthsToTrough = sommet → point bas (sommet APRÈS le départ)", () => {
    // MASTER : sommet févr (110), creux avr (77) → 2 mois.
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, MASTER)], masterOptions);
    expect(r.strategies[0].peakDate?.slice(0, 7)).toBe("2020-02");
    expect(r.strategies[0].troughDate?.slice(0, 7)).toBe("2020-04");
    expect(r.strategies[0].monthsToTrough).toBe(2);
  });

  it("monthsToTrough mesuré depuis le DÉPART quand le sommet est le niveau de départ", () => {
    // Repli immédiat : sommet = départ (janv 100), creux mars (80), récup mai (105).
    const levels = mkLevels(MASTER_START, [100, 90, 80, 85, 105, 106]);
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions);
    const s = r.strategies[0];
    expect(s.peakDate?.slice(0, 7)).toBe("2020-01");
    expect(s.troughDate?.slice(0, 7)).toBe("2020-03");
    expect(s.monthsToTrough).toBe(2); // janv → mars
    expect(s.recoveryAfterTroughMonths).toBe(2); // mars → mai
    expect(s.underwaterDurationMonths).toBe(4); // janv → mai
  });

  it("les trois durées sur MASTER : 2 / 4 / 6", () => {
    // sommet févr → creux avr (2) → récup août : 4 depuis le creux, 6 depuis le sommet.
    const s = calculateHistoricalStress(crisis({}), [strat(BROWNE, MASTER)], masterOptions)
      .strategies[0];
    expect(s.monthsToTrough).toBe(2);
    expect(s.recoveryAfterTroughMonths).toBe(4);
    expect(s.underwaterDurationMonths).toBe(6);
    // Cohérence arithmétique : sous l'eau = chute + remontée.
    expect(s.underwaterDurationMonths).toBe(s.monthsToTrough! + s.recoveryAfterTroughMonths!);
  });

  it("non récupéré : monthsToTrough défini, les deux durées de récupération = null", () => {
    const levels = mkLevels(MASTER_START, [100, 110, 88, 77, 80, 82, 84, 86, 88, 90, 92, 94]);
    const s = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions)
      .strategies[0];
    expect(s.recovered).toBe(false);
    expect(s.monthsToTrough).toBe(2); // sommet févr → creux avr, connu même sans récupération
    expect(s.recoveryAfterTroughMonths).toBeNull();
    expect(s.underwaterDurationMonths).toBeNull();
  });

  it("aucun repli : les trois durées valent 0 (pas null) et recovered = true", () => {
    const levels = mkLevels(MASTER_START, [100, 101, 102, 103, 104, 105]);
    const s = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], masterOptions)
      .strategies[0];
    expect(s.maxDrawdown).toBeCloseTo(0, 6);
    expect(s.recovered).toBe(true);
    expect(s.monthsToTrough).toBe(0);
    expect(s.recoveryAfterTroughMonths).toBe(0);
    expect(s.underwaterDurationMonths).toBe(0);
  });

  it("indisponible : les trois durées sont null", () => {
    const s = calculateHistoricalStress(
      crisis({}),
      [strat(BROWNE, [], { available: false, unavailableReason: "Historique insuffisant" })],
      masterOptions,
    ).strategies[0];
    expect(s.monthsToTrough).toBeNull();
    expect(s.recoveryAfterTroughMonths).toBeNull();
    expect(s.underwaterDurationMonths).toBeNull();
  });
});

// ─── CONCORDANCE (ratio de niveaux == produit des rendements nets) ───────────

describe("concordance perf", () => {
  it("cumulativeSeries_end / cumulativeSeries_start − 1 == produit des rendements nets de la fenêtre", () => {
    // Rendements nets mensuels des mois > départ (oct…févr), niveaux composés base 100.
    const rets = [0.03, -0.12, -0.08, 0.05, 0.11];
    const values = [100];
    for (const r of rets) values.push(values[values.length - 1] * (1 + r));
    const levels = mkLevels("2007-09", values); // sept(base) · oct · nov · déc · janv · févr
    const r = calculateHistoricalStress(crisis({}), [strat(BROWNE, levels)], {
      effectiveStartDate: "2007-09-30",
      effectiveEndDate: "2008-02-28",
      analysisEndDate: "2008-02-28",
      provisional: false,
    });
    const product = rets.reduce((acc, x) => acc * (1 + x), 1) - 1;
    expect(r.durationMonths).toBe(5);
    expect(r.strategies[0].cumulativeReturn! / 100).toBeCloseTo(product, 10);
  });
});
