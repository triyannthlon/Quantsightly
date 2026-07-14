// Modèle macro-financier à 4 quadrants (Charles Gave) — couche PURE, testable,
// sans accès base (le chargement + la conversion de devise vivent dans
// `quadrant-service.ts`, côté serveur).
//
// Deux axes, calculés en log et dans la DEVISE DU PAYS :
//   X — Croissance : ln(actions / pétrole)
//   Y — Inflation  : ln(or / obligations 10 ans)
//
// ⚠️ Depuis 2026-07-13, ce moteur PARTAGE la convention du module « 4 Quadrants »
// (`four-quadrants/`), devenue la convention par défaut — AUCUNE divergence entre
// les deux moteurs :
//   • MM7 sur 84 mois INCLUANT le dernier mois clôturé ;
//   • écart normalisé robuste (MAD sur la même fenêtre → `tanh`) → coordonnées
//     `x, y ∈ [-100, +100]` (cf. `four-quadrants/robust-normalization`) ;
//   • bande neutre = seuil `T` sur les coordonnées normalisées (`|coord| ≤ T`).
// L'écart brut à la MM7 + le seuil ±0,05 de l'ancienne version sont ABANDONNÉS.

import type { EconomicDataPoint } from "./types";
import {
  robustDeviationSeries,
  activityCoordinate,
  monetaryCoordinate,
  mean,
  minMonthsForScore,
  DEFAULT_WINDOW,
  DEFAULT_TRANSITION_WIDTH,
} from "./four-quadrants";

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

/** Demi-largeur de la bande neutre `T`, sur l'échelle normalisée [-100, +100]. */
export const DEFAULT_THRESHOLD = DEFAULT_TRANSITION_WIDTH;
/** Fenêtre de la moyenne mobile : 7 ans = 84 mois (mois courant inclus). */
export const DEFAULT_LOOKBACK_MONTHS = DEFAULT_WINDOW;

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

/** Coordonnée normalisée → signal de l'axe, avec bande neutre ±T. */
export function getAxisSignal(coord: number, threshold = DEFAULT_THRESHOLD): AxisSignal {
  if (coord > threshold) return "ACCELERATING";
  if (coord < -threshold) return "DECELERATING";
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

/** Force du régime = distance (normalisée) du plus FAIBLE des deux axes au centre. */
export function getConvictionLevel(x: number, y: number): ConvictionLevel {
  const minAbs = Math.min(Math.abs(x), Math.abs(y));
  if (minAbs < 20) return "LOW";
  if (minAbs < 50) return "MEDIUM";
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

/** Coordonnées normalisées (activité, monnaie) à partir des séries de log-ratios. */
function coordinateSeries(growth: number[], inflation: number[]): {
  x: (number | null)[];
  y: (number | null)[];
} {
  const zG = robustDeviationSeries(growth);
  const zI = robustDeviationSeries(inflation);
  return {
    x: zG.map((z) => (z === null ? null : activityCoordinate(z))),
    y: zI.map((z) => (z === null ? null : monetaryCoordinate(z))),
  };
}

// ─── Résultat ───────────────────────────────────────────────────────────────

export interface QuadrantMetrics {
  growthRatio: number;
  inflationRatio: number;
  growthMA7Y: number;
  inflationMA7Y: number;
  /** Écart brut à la MM7 (mois courant inclus) — informatif. */
  growthGap: number;
  inflationGap: number;
  /** Coordonnées normalisées robustes [-100, +100] qui pilotent la classification. */
  x: number;
  y: number;
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
  if (valid.length < minMonthsForScore(lookbackMonths)) {
    return fail("INSUFFICIENT_HISTORY", valid[valid.length - 1].date);
  }

  const growth = valid.map((p) => Math.log(p.equity / p.oil));
  const inflation = valid.map((p) => Math.log(p.gold / p.bond));
  const { x: xs, y: ys } = coordinateSeries(growth, inflation);
  const last = valid.length - 1;
  const x = xs[last];
  const y = ys[last];
  if (x === null || y === null) return fail("INSUFFICIENT_HISTORY", valid[last].date);

  const growthMA7Y = mean(growth.slice(-lookbackMonths));
  const inflationMA7Y = mean(inflation.slice(-lookbackMonths));
  const growthSignal = getAxisSignal(x, threshold);
  const inflationSignal = getAxisSignal(y, threshold);
  const quadrant = getQuadrant(growthSignal, inflationSignal);

  return {
    status: "OK",
    countryCode,
    date: valid[last].date,
    threshold,
    lookbackMonths,
    growthRatio: growth[last],
    inflationRatio: inflation[last],
    growthMA7Y,
    inflationMA7Y,
    growthGap: growth[last] - growthMA7Y,
    inflationGap: inflation[last] - inflationMA7Y,
    x,
    y,
    growthSignal,
    inflationSignal,
    quadrant,
    quadrantLabel: QUADRANT_LABELS[quadrant],
    regimeName: QUADRANT_REGIME[quadrant],
    quadrantDescription: QUADRANT_DESCRIPTIONS[quadrant],
    convictionLevel: getConvictionLevel(x, y),
  };
}

// ─── Historique mensuel des régimes ─────────────────────────────────────────

export interface QuadrantHistoryPoint {
  /** Fin de mois `YYYY-MM-DD`. */
  date: string;
  growthSignal: AxisSignal;
  inflationSignal: AxisSignal;
  quadrant: Quadrant;
}

export type QuadrantHistoryResult =
  | {
      status: "OK";
      countryCode: string;
      threshold: number;
      lookbackMonths: number;
      points: QuadrantHistoryPoint[];
    }
  | {
      status: Exclude<QuadrantStatus, "OK">;
      countryCode: string;
      threshold: number;
      lookbackMonths: number;
      points: [];
    };

/**
 * Régime de chaque mois pour lequel on dispose d'assez d'antériorité (≥ 2·84−1
 * mois). Même normalisation que `computeQuadrant`, appliquée glissante via
 * `robustDeviationSeries`. Le dernier point est identique à `computeQuadrant`.
 */
export function computeQuadrantHistory(input: ComputeQuadrantInput): QuadrantHistoryResult {
  const { countryCode } = input;
  const threshold = input.threshold ?? DEFAULT_THRESHOLD;
  const lookbackMonths = input.lookbackMonths ?? DEFAULT_LOOKBACK_MONTHS;
  const fail = (status: Exclude<QuadrantStatus, "OK">): QuadrantHistoryResult => ({
    status,
    countryCode,
    threshold,
    lookbackMonths,
    points: [],
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
  const valid = aligned.filter((p) => p.equity > 0 && p.oil > 0 && p.gold > 0 && p.bond > 0);
  if (valid.length === 0) return fail("INVALID_VALUE");
  if (valid.length < minMonthsForScore(lookbackMonths)) return fail("INSUFFICIENT_HISTORY");

  const growth = valid.map((p) => Math.log(p.equity / p.oil));
  const inflation = valid.map((p) => Math.log(p.gold / p.bond));
  const { x: xs, y: ys } = coordinateSeries(growth, inflation);

  const points: QuadrantHistoryPoint[] = [];
  for (let i = 0; i < valid.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x === null || y === null) continue;
    const growthSignal = getAxisSignal(x, threshold);
    const inflationSignal = getAxisSignal(y, threshold);
    points.push({
      date: valid[i].date,
      growthSignal,
      inflationSignal,
      quadrant: getQuadrant(growthSignal, inflationSignal),
    });
  }

  return { status: "OK", countryCode, threshold, lookbackMonths, points };
}
