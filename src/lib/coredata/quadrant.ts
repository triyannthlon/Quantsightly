// Modèle macro-financier à 4 quadrants (Charles Gave) — couche PURE, testable,
// sans accès base (le chargement + la conversion de devise vivent dans
// `quadrant-service.ts`, côté serveur).
//
// Deux axes, calculés en log et dans la DEVISE DU PAYS :
//   X — Croissance : ln(actions / pétrole)
//   Y — Inflation  : ln(or / obligations 10 ans)
// Chaque ratio est comparé à sa moyenne mobile 7 ans (84 mois) EXCLUANT le mois
// courant (pour ne pas que le point influence sa propre référence). L'écart à la
// tendance, passé par un seuil neutre, donne le signal de chaque axe ; la
// combinaison des deux signaux donne le quadrant.

import type { EconomicDataPoint } from "./types";

export type AxisSignal = "ACCELERATING" | "NEUTRAL" | "DECELERATING";

export type Quadrant =
  | "GROWTH_UP_INFLATION_UP"
  | "GROWTH_UP_INFLATION_DOWN"
  | "GROWTH_DOWN_INFLATION_UP"
  | "GROWTH_DOWN_INFLATION_DOWN"
  | "TRANSITION";

export type ConvictionLevel = "LOW" | "MEDIUM" | "HIGH";

export type QuadrantStatus =
  | "OK"
  | "MISSING_SERIES"
  | "INSUFFICIENT_HISTORY"
  | "INVALID_VALUE"
  | "STALE_DATA";

/** Seuil neutre (écart relatif ≈ en log) en deçà duquel l'axe est « neutre ». */
export const DEFAULT_THRESHOLD = 0.05;
/** Fenêtre de la moyenne mobile : 7 ans = 84 mois. */
export const DEFAULT_LOOKBACK_MONTHS = 84;

// ─── Libellés & descriptions par quadrant ───────────────────────────────────

/** Libellé « Croissance … / Inflation … » (axe par axe). */
export const QUADRANT_LABELS: Record<Quadrant, string> = {
  GROWTH_UP_INFLATION_UP: "Croissance accélère / Inflation accélère",
  GROWTH_UP_INFLATION_DOWN: "Croissance accélère / Inflation décélère",
  GROWTH_DOWN_INFLATION_UP: "Croissance décélère / Inflation accélère",
  GROWTH_DOWN_INFLATION_DOWN: "Croissance décélère / Inflation décélère",
  TRANSITION: "Zone de transition",
};

/** Nom du régime dans le vocabulaire Gave de l'app (cohérent avec regime-macro.md). */
export const QUADRANT_REGIME: Record<Quadrant, string> = {
  GROWTH_UP_INFLATION_UP: "Boom inflationniste",
  GROWTH_UP_INFLATION_DOWN: "Boom déflationniste",
  GROWTH_DOWN_INFLATION_UP: "Contraction inflationniste",
  GROWTH_DOWN_INFLATION_DOWN: "Contraction déflationniste",
  TRANSITION: "Régime en transition",
};

export const QUADRANT_DESCRIPTIONS: Record<Quadrant, string> = {
  GROWTH_UP_INFLATION_UP:
    "Régime de reflation ou de croissance nominale forte. La croissance accélère, mais l’inflation aussi. Souvent favorable aux actifs réels, aux matières premières et à l’or ; les obligations longues peuvent être pénalisées par la remontée des anticipations d’inflation.",
  GROWTH_UP_INFLATION_DOWN:
    "Régime de croissance désinflationniste. La croissance accélère tandis que l’inflation ralentit — souvent le plus favorable aux actifs financiers traditionnels : les actions bénéficient de la croissance, les obligations de la baisse de l’inflation.",
  GROWTH_DOWN_INFLATION_UP:
    "Régime de stagflation. La croissance décélère alors que l’inflation accélère — généralement le plus difficile pour les portefeuilles classiques. Les actions souffrent, les obligations longues aussi ; l’or, les matières premières et le cash deviennent plus défensifs.",
  GROWTH_DOWN_INFLATION_DOWN:
    "Régime de ralentissement désinflationniste ou déflationniste. Croissance et inflation ralentissent — souvent favorable aux obligations longues si les taux baissent ; les actions sont fragilisées et le cash joue un rôle défensif.",
  TRANSITION:
    "Le signal n’est pas assez net pour classer le pays dans un des 4 quadrants. Au moins un des deux axes est proche de sa tendance longue : le régime est considéré comme instable ou en transition.",
};

// ─── Fonctions de classification (pures) ────────────────────────────────────

/** Écart à la tendance → signal de l'axe, avec bande neutre ±threshold. */
export function getAxisSignal(gap: number, threshold = DEFAULT_THRESHOLD): AxisSignal {
  if (gap > threshold) return "ACCELERATING";
  if (gap < -threshold) return "DECELERATING";
  return "NEUTRAL";
}

/** Combinaison des deux signaux → quadrant (TRANSITION dès qu'un axe est neutre). */
export function getQuadrant(growth: AxisSignal, inflation: AxisSignal): Quadrant {
  if (growth === "ACCELERATING" && inflation === "ACCELERATING") return "GROWTH_UP_INFLATION_UP";
  if (growth === "ACCELERATING" && inflation === "DECELERATING") return "GROWTH_UP_INFLATION_DOWN";
  if (growth === "DECELERATING" && inflation === "ACCELERATING") return "GROWTH_DOWN_INFLATION_UP";
  if (growth === "DECELERATING" && inflation === "DECELERATING") return "GROWTH_DOWN_INFLATION_DOWN";
  return "TRANSITION";
}

/** Force du régime = distance du plus FAIBLE des deux axes à sa bande neutre. */
export function getConvictionLevel(growthGap: number, inflationGap: number): ConvictionLevel {
  const minAbs = Math.min(Math.abs(growthGap), Math.abs(inflationGap));
  if (minAbs < 0.1) return "LOW";
  if (minAbs < 0.3) return "MEDIUM";
  return "HIGH";
}

// ─── Mensualisation & alignement ────────────────────────────────────────────

/**
 * Ramène une série à un point par mois = dernière valeur disponible du mois
 * (no-op si la série est déjà mensuelle). Dates supposées `YYYY-MM-DD` triées.
 */
export function toMonthly(data: EconomicDataPoint[]): EconomicDataPoint[] {
  const byMonth = new Map<string, EconomicDataPoint>();
  for (const p of data) byMonth.set(p.date.slice(0, 7), p); // dernier point du mois écrase
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

interface QuadPoint {
  date: string;
  equity: number;
  oil: number;
  gold: number;
  bond: number;
}

/** Intersection des 4 séries sur leurs dates (mois) communes. */
function align4(
  equity: EconomicDataPoint[],
  oil: EconomicDataPoint[],
  gold: EconomicDataPoint[],
  bond: EconomicDataPoint[],
): QuadPoint[] {
  const key = (p: EconomicDataPoint) => p.date.slice(0, 7);
  const oM = new Map(oil.map((p) => [key(p), p.value]));
  const gM = new Map(gold.map((p) => [key(p), p.value]));
  const bM = new Map(bond.map((p) => [key(p), p.value]));
  const out: QuadPoint[] = [];
  for (const p of equity) {
    const m = key(p);
    const o = oM.get(m);
    const g = gM.get(m);
    const b = bM.get(m);
    if (o !== undefined && g !== undefined && b !== undefined) {
      out.push({ date: p.date, equity: p.value, oil: o, gold: g, bond: b });
    }
  }
  return out;
}

// ─── Résultat ───────────────────────────────────────────────────────────────

export interface QuadrantMetrics {
  growthRatio: number;
  inflationRatio: number;
  growthMA7Y: number;
  inflationMA7Y: number;
  growthGap: number;
  inflationGap: number;
  growthSignal: AxisSignal;
  inflationSignal: AxisSignal;
  quadrant: Quadrant;
  quadrantLabel: string;
  regimeName: string;
  quadrantDescription: string;
  convictionLevel: ConvictionLevel;
}

export type QuadrantResult =
  | ({
      status: "OK";
      countryCode: string;
      date: string;
      threshold: number;
      lookbackMonths: number;
    } & QuadrantMetrics)
  | {
      status: Exclude<QuadrantStatus, "OK">;
      countryCode: string;
      date: string | null;
      threshold: number;
      lookbackMonths: number;
    };

export interface ComputeQuadrantInput {
  countryCode: string;
  /** Séries déjà converties dans la devise du pays (mensuelles ou journalières). */
  equity: EconomicDataPoint[];
  oil: EconomicDataPoint[];
  gold: EconomicDataPoint[];
  bond: EconomicDataPoint[];
  threshold?: number;
  lookbackMonths?: number;
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Calcule le positionnement d'un pays dans les 4 quadrants à sa dernière date
 * disponible. Renvoie un statut explicite si le calcul est impossible.
 */
export function computeQuadrant(input: ComputeQuadrantInput): QuadrantResult {
  const { countryCode } = input;
  const threshold = input.threshold ?? DEFAULT_THRESHOLD;
  const lookbackMonths = input.lookbackMonths ?? DEFAULT_LOOKBACK_MONTHS;
  const fail = (status: Exclude<QuadrantStatus, "OK">, date: string | null = null): QuadrantResult => ({
    status,
    countryCode,
    date,
    threshold,
    lookbackMonths,
  });

  if (!input.equity.length || !input.oil.length || !input.gold.length || !input.bond.length) {
    return fail("MISSING_SERIES");
  }

  const aligned = align4(
    toMonthly(input.equity),
    toMonthly(input.oil),
    toMonthly(input.gold),
    toMonthly(input.bond),
  );
  // Le log exige des valeurs strictement positives (prix/total-return le sont).
  const valid = aligned.filter((p) => p.equity > 0 && p.oil > 0 && p.gold > 0 && p.bond > 0);
  if (valid.length === 0) return fail("INVALID_VALUE");
  if (valid.length < lookbackMonths + 1) {
    return fail("INSUFFICIENT_HISTORY", valid[valid.length - 1].date);
  }

  const ratios = valid.map((p) => ({
    date: p.date,
    growth: Math.log(p.equity / p.oil),
    inflation: Math.log(p.gold / p.bond),
  }));

  const lastIndex = ratios.length - 1;
  const last = ratios[lastIndex];
  const prev = ratios.slice(lastIndex - lookbackMonths, lastIndex); // 84 mois AVANT le courant
  const growthMA7Y = average(prev.map((r) => r.growth));
  const inflationMA7Y = average(prev.map((r) => r.inflation));
  const growthGap = last.growth - growthMA7Y;
  const inflationGap = last.inflation - inflationMA7Y;
  const growthSignal = getAxisSignal(growthGap, threshold);
  const inflationSignal = getAxisSignal(inflationGap, threshold);
  const quadrant = getQuadrant(growthSignal, inflationSignal);

  return {
    status: "OK",
    countryCode,
    date: last.date,
    threshold,
    lookbackMonths,
    growthRatio: last.growth,
    inflationRatio: last.inflation,
    growthMA7Y,
    inflationMA7Y,
    growthGap,
    inflationGap,
    growthSignal,
    inflationSignal,
    quadrant,
    quadrantLabel: QUADRANT_LABELS[quadrant],
    regimeName: QUADRANT_REGIME[quadrant],
    quadrantDescription: QUADRANT_DESCRIPTIONS[quadrant],
    convictionLevel: getConvictionLevel(growthGap, inflationGap),
  };
}
