// `buildModel()` — POINT D'ENTRÉE UNIQUE et SOURCE DE VÉRITÉ du moteur 4 Quadrants.
// Reçoit les séries de marché (signal) + les paramètres du modèle, renvoie une
// SÉRIE MENSUELLE COMPLÈTE de résultats. Toute la logique (graphe, trajectoire,
// vitesse, accélération, backtest, KPI, comparaisons, UI) s'appuie sur cette
// série — aucun autre composant ne recalcule les coordonnées.
//
// ⚠️ Couche PURE, sans accès base (le chargement + la conversion de devise vivent
// dans un service serveur dédié). ⚠️ Séparation stricte : ce module ne calcule
// QUE les signaux macro (coordonnées, quadrant, cinématique, allocation cible) à
// partir des RATIOS DE MARCHÉ. Le CPI et les rendements réels vivent dans le
// backtest, jamais ici.

import type { EconomicDataPoint } from "../types";
import type {
  Acceleration,
  CoreAllocation,
  DataStatus,
  FinalAllocation,
  Quadrant,
  Strategy,
  TimeSeries,
  TransitionState,
  Velocity,
} from "./types";
import { computeCoordinates, regimeIntensity } from "./coordinates";
import { getQuadrant } from "./quadrant";
import { computeTransitionState } from "./transition";
import { computeBinaryAllocation } from "./allocation-binary";
import { computeDynamicAllocation } from "./allocation-dynamic";
import { computeEnergyOverlay, resolveEnergyWeight } from "./energy-overlay";
import { rollingSlope, radialVelocity } from "./kinematics";
import { minMonthsForScore } from "./robust-normalization";
import { DEFAULT_FOUR_QUADRANTS_SETTINGS, type FourQuadrantsModelSettings } from "./settings";

export type QuadrantModelStatus = "OK" | "MISSING_SERIES" | "INVALID_VALUE" | "INSUFFICIENT_HISTORY";

/** Résultat du moteur pour UN mois clôturé. */
export interface QuadrantModelResult {
  date: string;
  countryCode: string;
  /** Ratios de marché bruts : R_A = actions_prix / pétrole ; R_M = or / oblig 10Y. */
  activityRatio: number;
  monetaryRatio: number;
  /** Écarts normalisés robustes (z) par axe. */
  activityScore: number;
  monetaryScore: number;
  /** Coordonnées bornées [-100, +100]. */
  x: number;
  y: number;
  quadrant: Quadrant;
  transitionState: TransitionState;
  regimeIntensity: number;
  velocity: Velocity | null;
  acceleration: Acceleration | null;
  radialVelocity: number | null;
  strategy: Strategy;
  /** Allocation cible des 4 poches (avant Énergie). */
  baseAllocation: CoreAllocation;
  /** Score Énergie injecté ce mois (null si absent — V1 désactivée). */
  energyScore: number | null;
  /** Allocation finale après overlay Énergie (5 poches, somme = 1). */
  finalAllocation: FinalAllocation;
  dataStatus: DataStatus;
}

/** Séries intermédiaires (pour graphes, exports, diagnostics, tests) — évite tout recalcul. */
export interface QuadrantModelSeries {
  activityRatio: TimeSeries;
  monetaryRatio: TimeSeries;
  activityScore: TimeSeries;
  monetaryScore: TimeSeries;
  x: TimeSeries;
  y: TimeSeries;
  regimeIntensity: TimeSeries;
  /** Norme de la vitesse (points/mois) — le vecteur complet est dans `monthlyResults`. */
  velocity: TimeSeries;
  /** Norme de l'accélération (points/mois²). */
  acceleration: TimeSeries;
}

export type QuadrantModel =
  | {
      status: "OK";
      countryCode: string;
      settings: FourQuadrantsModelSettings;
      monthlyResults: QuadrantModelResult[];
      /** Raccourci vers la dernière observation. */
      latest: QuadrantModelResult;
      series: QuadrantModelSeries;
    }
  | {
      status: Exclude<QuadrantModelStatus, "OK">;
      countryCode: string;
      settings: FourQuadrantsModelSettings;
    };

export interface BuildModelInput {
  countryCode: string;
  /** Actions PRIX (ty1), devise locale. */
  equityPrice: EconomicDataPoint[];
  /** Pétrole (WTI/Brent), devise locale. */
  oil: EconomicDataPoint[];
  /** Or, devise locale. */
  gold: EconomicDataPoint[];
  /** Obligations 10 ans (total-return), devise locale. */
  bond: EconomicDataPoint[];
  /** Score Énergie injecté (aligné par date), optionnel — absent en V1 (mode `disabled`). */
  energyScore?: EconomicDataPoint[];
}

// ─── Helpers d'alignement (locaux : pas de dépendance vers quadrant.ts) ──────

interface SignalPoint {
  date: string;
  equity: number;
  oil: number;
  gold: number;
  bond: number;
}

function toMonthly(data: EconomicDataPoint[]): EconomicDataPoint[] {
  const byMonth = new Map<string, EconomicDataPoint>();
  for (const p of data) byMonth.set(p.date.slice(0, 7), p);
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function alignSignal(input: BuildModelInput): SignalPoint[] {
  const key = (p: EconomicDataPoint) => p.date.slice(0, 7);
  const oM = new Map(toMonthly(input.oil).map((p) => [key(p), p.value]));
  const gM = new Map(toMonthly(input.gold).map((p) => [key(p), p.value]));
  const bM = new Map(toMonthly(input.bond).map((p) => [key(p), p.value]));
  const out: SignalPoint[] = [];
  for (const p of toMonthly(input.equityPrice)) {
    const o = oM.get(key(p));
    const g = gM.get(key(p));
    const b = bM.get(key(p));
    if (o !== undefined && g !== undefined && b !== undefined) {
      out.push({ date: p.date, equity: p.value, oil: o, gold: g, bond: b });
    }
  }
  return out;
}

// ─── Moteur ──────────────────────────────────────────────────────────────────

export function buildModel(
  input: BuildModelInput,
  settings: FourQuadrantsModelSettings = DEFAULT_FOUR_QUADRANTS_SETTINGS,
): QuadrantModel {
  const { countryCode } = input;
  const fail = (status: Exclude<QuadrantModelStatus, "OK">): QuadrantModel => ({
    status,
    countryCode,
    settings,
  });

  if (!input.equityPrice.length || !input.oil.length || !input.gold.length || !input.bond.length) {
    return fail("MISSING_SERIES");
  }

  const aligned = alignSignal(input);
  const valid = aligned.filter((p) => p.equity > 0 && p.oil > 0 && p.gold > 0 && p.bond > 0);
  if (valid.length === 0) return fail("INVALID_VALUE");
  if (valid.length < minMonthsForScore()) return fail("INSUFFICIENT_HISTORY");

  const activityLog = valid.map((p) => Math.log(p.equity / p.oil));
  const monetaryLog = valid.map((p) => Math.log(p.gold / p.bond));
  const coords = computeCoordinates(activityLog, monetaryLog);

  // Région où les coordonnées existent (contiguë : du 1er score valide à la fin).
  const defined: number[] = [];
  for (let i = 0; i < valid.length; i++) {
    if (coords.x[i] !== null && coords.y[i] !== null) defined.push(i);
  }
  if (defined.length === 0) return fail("INSUFFICIENT_HISTORY");

  const xCoords = defined.map((i) => coords.x[i] as number);
  const yCoords = defined.map((i) => coords.y[i] as number);
  // Vitesse = pente Theil–Sen des coords ; accélération = pente de la vitesse.
  const vx = rollingSlope(xCoords, settings.velocityWindowMonths);
  const vy = rollingSlope(yCoords, settings.velocityWindowMonths);
  const ax = rollingSlope(vx, settings.accelerationWindowMonths);
  const ay = rollingSlope(vy, settings.accelerationWindowMonths);

  const energyByMonth = new Map((input.energyScore ?? []).map((p) => [p.date.slice(0, 7), p.value]));
  const T = settings.transitionWidth;

  const monthlyResults: QuadrantModelResult[] = defined.map((vi, k) => {
    const p = valid[vi];
    const x = xCoords[k];
    const y = yCoords[k];

    const velocity: Velocity | null =
      vx[k] !== null && vy[k] !== null
        ? {
            x: vx[k] as number,
            y: vy[k] as number,
            magnitude: Math.hypot(vx[k] as number, vy[k] as number),
            angleDegrees: (Math.atan2(vy[k] as number, vx[k] as number) * 180) / Math.PI,
          }
        : null;
    const acceleration: Acceleration | null =
      ax[k] !== null && ay[k] !== null
        ? { x: ax[k] as number, y: ay[k] as number, magnitude: Math.hypot(ax[k] as number, ay[k] as number) }
        : null;
    const radial = velocity ? radialVelocity(x, y, velocity.x, velocity.y) : null;

    const baseAllocation: CoreAllocation =
      settings.strategy === "binary"
        ? computeBinaryAllocation(x, y, T)
        : computeDynamicAllocation(x, y, T);
    const energyScore = energyByMonth.get(p.date.slice(0, 7)) ?? null;
    const finalAllocation = computeEnergyOverlay(baseAllocation, resolveEnergyWeight(settings, energyScore));

    return {
      date: p.date,
      countryCode,
      activityRatio: p.equity / p.oil,
      monetaryRatio: p.gold / p.bond,
      activityScore: coords.activityScore[vi] as number,
      monetaryScore: coords.monetaryScore[vi] as number,
      x,
      y,
      quadrant: getQuadrant(x, y),
      transitionState: computeTransitionState(x, y, T),
      regimeIntensity: regimeIntensity(x, y),
      velocity,
      acceleration,
      radialVelocity: radial,
      strategy: settings.strategy,
      baseAllocation,
      energyScore,
      finalAllocation,
      dataStatus: velocity && acceleration ? "complete" : "partial",
    };
  });

  // Séries intermédiaires (toujours-présentes vs trouées pour vitesse/accél).
  const at = (get: (r: QuadrantModelResult) => number): TimeSeries =>
    monthlyResults.map((r) => ({ date: r.date, value: get(r) }));
  const atDefined = (get: (r: QuadrantModelResult) => number | null): TimeSeries =>
    monthlyResults.flatMap((r) => {
      const v = get(r);
      return v === null ? [] : [{ date: r.date, value: v }];
    });

  const series: QuadrantModelSeries = {
    activityRatio: at((r) => r.activityRatio),
    monetaryRatio: at((r) => r.monetaryRatio),
    activityScore: at((r) => r.activityScore),
    monetaryScore: at((r) => r.monetaryScore),
    x: at((r) => r.x),
    y: at((r) => r.y),
    regimeIntensity: at((r) => r.regimeIntensity),
    velocity: atDefined((r) => r.velocity?.magnitude ?? null),
    acceleration: atDefined((r) => r.acceleration?.magnitude ?? null),
  };

  return {
    status: "OK",
    countryCode,
    settings,
    monthlyResults,
    latest: monthlyResults[monthlyResults.length - 1],
    series,
  };
}
