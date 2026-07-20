// Backtest du modèle 4 Quadrants — couche PURE. Applique les poids CIBLES figés
// à la fin du mois `t` aux rendements du mois `t+1` (ZÉRO look-ahead §17). Produit
// la courbe nominale (base 100) + la courbe RÉELLE (déflatée CPI) et leurs
// métriques. Pas de politique de transaction (§18 — reportée à une version
// ultérieure) : chaque mois, la cible du signal est détenue telle quelle.
//
// ⚠️ Le CPI n'intervient QUE pour les métriques réelles, jamais dans les signaux.
//
// GARDE-FOUS (2026-07-20) : le backtest ne TRONQUE ni n'ENJAMBE jamais en silence.
// Avant tout calcul, la plage réellement consommée par la fenêtre est validée
// (continuité mensuelle, poches valides > 0, présence des poids cibles) ; toute
// anomalie renvoie un statut structuré (`availability`). Une lacune ANTÉRIEURE à
// la fenêtre est ignorée (elle n'affecte ni les poids d'entrée ni les rendements).

import type { EconomicDataPoint } from "../types";
import type { FinalAllocation, TimeSeries } from "./types";
import type { QuadrantModel } from "./build-model";
import { computeKpis } from "../compute";

/** Poids cibles d'un mois (allocation finale, 5 poches). */
export interface WeightPoint {
  date: string;
  allocation: FinalAllocation;
}

export interface BacktestMetrics {
  months: number;
  /** Performance cumulée sur la fenêtre, en %. */
  cumulative: number | null;
  /** Rendement annualisé (CAGR), en %. */
  annualized: number | null;
  /** Volatilité annualisée, en %. */
  volatility: number | null;
  /** Pire drawdown, en % (≤ 0). */
  maxDrawdown: number | null;
  /** Recul depuis le pic historique à la dernière date, en % (≤ 0). */
  currentDrawdown: number | null;
  /** Sharpe = (annualisé − rendement du cash) / volatilité (excédent sur le cash). */
  sharpe: number | null;
  /** Meilleur rendement d'une année civile, en %. */
  bestYear: number | null;
  /** Pire rendement d'une année civile, en %. */
  worstYear: number | null;
  /** Plus longue durée passée sous le dernier sommet, en mois. */
  maxUnderwaterMonths: number | null;
}

/** Clés des poches (Énergie incluse pour plus tard). */
export type BacktestSleeve = "equities" | "bonds" | "gold" | "cash" | "energy";

/** Contribution cumulée arithmétique par poche (Σ wₜ·rₜ₊₁, en %) — somme ≈ perf cumulée. */
export type SleeveContributions = Record<BacktestSleeve, number>;

/** Rotation mensuelle (turnover unidirectionnel) — fractions [0,1]. */
export interface TurnoverPoint {
  date: string;
  /** Turnover unidirectionnel = ½·Σ|cible − poids dérivés| ; `null` = constitution initiale. */
  turnover: number | null;
  /** Volume brut échangé = 2·turnover (pour de futurs coûts de transaction). */
  grossTradedWeight: number | null;
}

export interface TurnoverResult {
  monthly: TurnoverPoint[];
  /** Moyenne des turnovers mensuels valides (hors 1er mois). */
  averageMonthly: number;
  /** Rotation annualisée = 12 × moyenne mensuelle (fraction, ×100 = % / an). */
  annualized: number;
  /** Somme des 12 derniers turnovers mensuels ; `null` si < 12 disponibles. */
  trailing12Months: number | null;
}

export type BacktestStatus =
  | "OK"
  | "MISSING_SERIES"
  | "INVALID_VALUE"
  | "INSUFFICIENT_HISTORY"
  | "MISSING_SIGNAL_WEIGHT"
  | "NON_CONTIGUOUS_HISTORY"
  | "INVALID_ASSET_VALUE";

/** Raison structurée (code technique) d'une indisponibilité — traduisible par l'UI. */
export type BacktestReason =
  | "missing_series"
  | "invalid_value"
  | "insufficient_history"
  | "missing_signal_weight"
  | "non_contiguous_history"
  | "invalid_asset_value";

/**
 * Champ de disponibilité commun. `firstInvalidMonth` (clé « YYYY-MM ») localise la
 * PREMIÈRE anomalie rencontrée dans la plage utile, pour le diagnostic ; `null`
 * quand la série est saine.
 */
export interface Availability {
  status: "OK" | "UNAVAILABLE";
  reason: BacktestReason | null;
  firstInvalidMonth: string | null;
}

const STATUS_REASON: Record<Exclude<BacktestStatus, "OK">, BacktestReason> = {
  MISSING_SERIES: "missing_series",
  INVALID_VALUE: "invalid_value",
  INSUFFICIENT_HISTORY: "insufficient_history",
  MISSING_SIGNAL_WEIGHT: "missing_signal_weight",
  NON_CONTIGUOUS_HISTORY: "non_contiguous_history",
  INVALID_ASSET_VALUE: "invalid_asset_value",
};

/** Construit le champ `availability` d'un statut non-OK. */
export function availabilityOf(
  status: Exclude<BacktestStatus, "OK">,
  firstInvalidMonth: string | null = null,
): Availability {
  return { status: "UNAVAILABLE", reason: STATUS_REASON[status], firstInvalidMonth };
}

const AVAILABLE: Availability = { status: "OK", reason: null, firstInvalidMonth: null };

export type BacktestResult =
  | {
      status: "OK";
      countryCode: string;
      availability: Availability;
      /** Période effective du backtest (fenêtre commune). */
      start: string;
      end: string;
      series: {
        nominal: TimeSeries;
        real: TimeSeries | null;
        /** Indice actions rebasé 100 sur la même fenêtre (référence interne). */
        equityBenchmark: TimeSeries;
        /** Indice actions RÉEL (déflaté), base 100 — `null` sans CPI. */
        equityReal: TimeSeries | null;
        /** Inflation cumulée base 100 (mode Nominal vs Inflation) — `null` sans CPI. */
        inflationIndex: TimeSeries | null;
        /** Chaque poche rebasée 100 sur la fenêtre (courbes du mode nominal). */
        sleeves: { equities: TimeSeries; bonds: TimeSeries; cash: TimeSeries; gold: TimeSeries };
      };
      metrics: {
        nominal: BacktestMetrics;
        real: BacktestMetrics | null;
        /** Métriques de l'indice actions (référence interne, comme Browne vs Actions). */
        equity: BacktestMetrics;
        equityReal: BacktestMetrics | null;
      };
      /** Contributions cumulées par poche (rendements NOMINAUX, sans look-ahead). */
      contributions: SleeveContributions;
      /** Rotation du portefeuille (indépendante du mode nominal/réel). */
      turnover: TurnoverResult;
    }
  | {
      status: Exclude<BacktestStatus, "OK">;
      countryCode: string;
      availability: Availability;
    };

export interface BacktestInput {
  countryCode: string;
  /** Poids cibles mensuels (issus de `buildModel`, cf. `weightsFromModel`). */
  weights: WeightPoint[];
  /** Séries de PERFORMANCE total-return, devise locale. */
  equityTotalReturn: EconomicDataPoint[];
  bondTotalReturn: EconomicDataPoint[];
  cashTotalReturn: EconomicDataPoint[];
  gold: EconomicDataPoint[];
  /** Énergie (total-return) — requise seulement si un poids Énergie > 0. */
  energyTotalReturn?: EconomicDataPoint[];
  /** CPI local — pour les métriques réelles uniquement. */
  cpi?: EconomicDataPoint[];
  /**
   * Fenêtre d'analyse en années. Le backtest tourne TOUJOURS sur l'historique
   * complet (poids détenus corrects à l'entrée) ; `windowYears` ne restreint que
   * les sorties (perf, risque, rotation). `null`/absent = tout l'historique.
   */
  windowYears?: number | null;
}

/** Extrait les poids cibles mensuels (finalAllocation) d'un modèle calculé. */
export function weightsFromModel(model: QuadrantModel): WeightPoint[] {
  if (model.status !== "OK") return [];
  return model.monthlyResults.map((r) => ({ date: r.date, allocation: r.finalAllocation }));
}

// ─── Rotation du portefeuille (turnover) ─────────────────────────────────────

const TURNOVER_ASSETS = ["equities", "bonds", "gold", "cash", "energy"] as const;

/**
 * Poids RÉELLEMENT détenus juste avant rééquilibrage : les poids post-rééquilibrage
 * du mois précédent DÉRIVÉS par les rendements du mois, renormalisés à 1. C'est la
 * base du turnover (jamais la simple différence entre deux cibles successives).
 */
export function computePreRebalanceWeights(
  previousPostRebalanceWeights: Partial<FinalAllocation>,
  assetReturns: Partial<FinalAllocation>,
): FinalAllocation {
  const values: Record<string, number> = {};
  for (const a of TURNOVER_ASSETS) {
    values[a] = (previousPostRebalanceWeights[a] ?? 0) * (1 + (assetReturns[a] ?? 0));
  }
  const total = TURNOVER_ASSETS.reduce((s, a) => s + values[a], 0);
  if (!Number.isFinite(total) || total <= 0)
    throw new Error("Invalid portfolio value before rebalancing.");
  return {
    equities: values.equities / total,
    bonds: values.bonds / total,
    gold: values.gold / total,
    cash: values.cash / total,
    energy: values.energy / total,
  };
}

/** Turnover mensuel unidirectionnel = ½·Σ|cible − poids dérivés| ∈ [0,1]. */
export function computeMonthlyTurnover(
  preRebalanceWeights: Partial<FinalAllocation>,
  targetWeights: Partial<FinalAllocation>,
): number {
  const sum = TURNOVER_ASSETS.reduce(
    (s, a) => s + Math.abs((targetWeights[a] ?? 0) - (preRebalanceWeights[a] ?? 0)),
    0,
  );
  return 0.5 * sum;
}

// ─── Helpers mois (clés « YYYY-MM », comparables lexicographiquement) ─────────

const monthKey = (date: string): string => date.slice(0, 7);

function nextMonthKey(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function prevMonthKey(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m <= 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const isPositive = (v: number | undefined): v is number =>
  v !== undefined && Number.isFinite(v) && v > 0;

// ─── Helpers locaux ──────────────────────────────────────────────────────────

function toMonthly(data: EconomicDataPoint[]): EconomicDataPoint[] {
  const byMonth = new Map<string, EconomicDataPoint>();
  for (const p of data) byMonth.set(p.date.slice(0, 7), p);
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

interface SleeveRow {
  date: string;
  equity: number;
  bond: number;
  cash: number;
  gold: number;
  energy: number | null;
}

/** Maps mensuelles par poche + date complète par mois (spine = série actions). */
interface SleeveMaps {
  equity: Map<string, number>;
  bond: Map<string, number>;
  cash: Map<string, number>;
  gold: Map<string, number>;
  energy: Map<string, number> | null;
  dateByMonth: Map<string, string>;
}

function buildSleeveMaps(input: BacktestInput): SleeveMaps {
  const toMap = (d: EconomicDataPoint[]) =>
    new Map(toMonthly(d).map((p) => [monthKey(p.date), p.value] as const));
  return {
    equity: toMap(input.equityTotalReturn),
    bond: toMap(input.bondTotalReturn),
    cash: toMap(input.cashTotalReturn),
    gold: toMap(input.gold),
    energy: input.energyTotalReturn ? toMap(input.energyTotalReturn) : null,
    dateByMonth: new Map(
      toMonthly(input.equityTotalReturn).map((p) => [monthKey(p.date), p.date] as const),
    ),
  };
}

/**
 * Lignes VALIDES (toutes poches présentes, finies, > 0) sur les mois communs.
 * ⚠️ Comme avant, un mois invalide est simplement absent de la sortie — la
 * validation (`validateWindowRange`) détecte séparément si cette absence tombe
 * dans la plage utile, pour ne jamais enjamber en silence.
 */
function rowsFromMaps(maps: SleeveMaps): SleeveRow[] {
  const out: SleeveRow[] = [];
  for (const [m, date] of maps.dateByMonth) {
    const eq = maps.equity.get(m);
    const b = maps.bond.get(m);
    const c = maps.cash.get(m);
    const g = maps.gold.get(m);
    const e = maps.energy ? maps.energy.get(m) : null;
    if (!isPositive(eq) || !isPositive(b) || !isPositive(c) || !isPositive(g)) continue;
    if (maps.energy && !isPositive(e ?? undefined)) continue;
    out.push({ date, equity: eq, bond: b, cash: c, gold: g, energy: maps.energy ? (e as number) : null });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

interface WindowAnomaly {
  reason: Extract<
    BacktestReason,
    "non_contiguous_history" | "invalid_asset_value" | "missing_signal_weight"
  >;
  firstInvalidMonth: string;
}

/**
 * Valide la plage `[usedStartMonth … endMonth]` (mois inclus) effectivement
 * consommée par la fenêtre : continuité mensuelle (aucun trou), poches présentes
 * et > 0, et présence du poids cible pour chaque mois DÉTENU (tous sauf `endMonth`,
 * qui n'est jamais réalloué). Retourne la PREMIÈRE anomalie, ou `null` si la plage
 * est saine. Les mois antérieurs à `usedStartMonth` ne sont pas examinés.
 */
function validateWindowRange(
  maps: SleeveMaps,
  wByMonth: Map<string, FinalAllocation>,
  usedStartMonth: string,
  endMonth: string,
): WindowAnomaly | null {
  for (let m = usedStartMonth; ; m = nextMonthKey(m)) {
    const eq = maps.equity.get(m);
    const b = maps.bond.get(m);
    const c = maps.cash.get(m);
    const g = maps.gold.get(m);
    const e = maps.energy ? maps.energy.get(m) : undefined;

    // Continuité : un mois entièrement absent d'une poche = trou de calendrier.
    const monthPresent =
      eq !== undefined &&
      b !== undefined &&
      c !== undefined &&
      g !== undefined &&
      (!maps.energy || e !== undefined);
    if (!monthPresent) return { reason: "non_contiguous_history", firstInvalidMonth: m };

    // Validité : une valeur présente mais ≤ 0 ou non finie = valeur d'actif invalide.
    const valid =
      isPositive(eq) && isPositive(b) && isPositive(c) && isPositive(g) && (!maps.energy || isPositive(e));
    if (!valid) return { reason: "invalid_asset_value", firstInvalidMonth: m };

    // Poids cible requis pour tout mois DÉTENU (appliqué au mois suivant).
    if (m !== endMonth && !wByMonth.has(m)) {
      return { reason: "missing_signal_weight", firstInvalidMonth: m };
    }
    if (m === endMonth) break;
  }
  return null;
}

/** Pire drawdown d'une courbe d'index, en % (≤ 0). */
function maxDrawdownPct(index: EconomicDataPoint[]): number | null {
  if (index.length < 2) return null;
  let peak = -Infinity;
  let mdd = 0;
  for (const p of index) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) {
      const dd = (p.value / peak - 1) * 100;
      if (dd < mdd) mdd = dd;
    }
  }
  return mdd;
}

/** Plus longue série de mois consécutifs sous le dernier sommet. */
function maxUnderwaterMonths(index: EconomicDataPoint[]): number | null {
  if (index.length < 2) return null;
  let peak = -Infinity;
  let run = 0;
  let maxRun = 0;
  for (const p of index) {
    if (p.value >= peak) {
      peak = p.value;
      run = 0;
    } else {
      run += 1;
      if (run > maxRun) maxRun = run;
    }
  }
  return maxRun;
}

/** Déflate une courbe par le CPI (base 100, rebasée à la 1ʳᵉ date où le CPI existe). */
function deflateByCpi(
  index: EconomicDataPoint[],
  cpiByMonth: Map<string, number>,
): EconomicDataPoint[] | null {
  const pts = index
    .map((n) => ({ date: n.date, v: n.value, c: cpiByMonth.get(n.date.slice(0, 7)) }))
    .filter((x): x is { date: string; v: number; c: number } => x.c !== undefined && x.c > 0);
  if (pts.length < 2) return null;
  const v0 = pts[0].v;
  const c0 = pts[0].c;
  return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c / c0) }));
}

/** Rendements par année civile (valeur fin d'année Y / fin d'année Y−1), en %. */
function calendarYearReturns(index: EconomicDataPoint[]): number[] {
  const byYear = new Map<string, number>();
  for (const p of index) byYear.set(p.date.slice(0, 4), p.value);
  const years = [...byYear.keys()].sort();
  const out: number[] = [];
  for (let i = 1; i < years.length; i++) {
    const prev = byYear.get(years[i - 1])!;
    const cur = byYear.get(years[i])!;
    if (prev > 0) out.push((cur / prev - 1) * 100);
  }
  return out;
}

/** Inflation cumulée (base 100) sur les dates de `index` où le CPI existe. */
function cumulativeInflation(
  index: EconomicDataPoint[],
  cpiByMonth: Map<string, number>,
): EconomicDataPoint[] | null {
  const pts = index
    .map((n) => ({ date: n.date, c: cpiByMonth.get(n.date.slice(0, 7)) }))
    .filter((x): x is { date: string; c: number } => x.c !== undefined && x.c > 0);
  if (pts.length < 2) return null;
  const c0 = pts[0].c;
  return pts.map((x) => ({ date: x.date, value: (100 * x.c) / c0 }));
}

/** Métriques d'une courbe. `riskFree` = rendement annualisé du cash (excédent → Sharpe). */
function metricsOf(index: EconomicDataPoint[], riskFree: number): BacktestMetrics {
  const k = computeKpis(index);
  const first = index[0]?.value;
  const last = index[index.length - 1]?.value;
  const cumulative = index.length >= 2 && first > 0 && last > 0 ? (last / first - 1) * 100 : null;
  const maxDrawdown = maxDrawdownPct(index);
  const peak = index.length ? index.reduce((mx, p) => (p.value > mx ? p.value : mx), -Infinity) : 0;
  const currentDrawdown =
    index.length >= 2 && peak > 0 && last > 0 ? (last / peak - 1) * 100 : null;
  const sharpe =
    k.annualized !== null && k.volatility !== null && k.volatility > 0
      ? (k.annualized - riskFree) / k.volatility
      : null;
  const yearly = calendarYearReturns(index);
  return {
    months: index.length,
    cumulative,
    annualized: k.annualized,
    volatility: k.volatility,
    maxDrawdown,
    currentDrawdown,
    sharpe,
    bestYear: yearly.length ? Math.max(...yearly) : null,
    worstYear: yearly.length ? Math.min(...yearly) : null,
    maxUnderwaterMonths: maxUnderwaterMonths(index),
  };
}

// ─── Backtest ──────────────────────────────────────────────────────────────

export function backtestQuadrants(input: BacktestInput): BacktestResult {
  const { countryCode } = input;
  const fail = (
    status: Exclude<BacktestStatus, "OK">,
    firstInvalidMonth: string | null = null,
  ): BacktestResult => ({
    status,
    countryCode,
    availability: availabilityOf(status, firstInvalidMonth),
  });

  if (
    !input.weights.length ||
    !input.equityTotalReturn.length ||
    !input.bondTotalReturn.length ||
    !input.cashTotalReturn.length ||
    !input.gold.length
  ) {
    return fail("MISSING_SERIES");
  }

  const needsEnergy = input.weights.some((w) => w.allocation.energy > 1e-9);
  if (needsEnergy && !input.energyTotalReturn?.length) return fail("MISSING_SERIES");

  const maps = buildSleeveMaps(input);
  const rows = rowsFromMaps(maps);
  if (rows.length < 2) return fail("INVALID_VALUE");

  const wByMonth = new Map(input.weights.map((w) => [monthKey(w.date), w.allocation]));
  const hasEnergy = Boolean(input.energyTotalReturn);

  // Premier mois disposant d'un poids cible (= début du portefeuille).
  let start = -1;
  for (let i = 0; i < rows.length; i++) {
    if (wByMonth.has(monthKey(rows[i].date))) {
      start = i;
      break;
    }
  }
  if (start < 0 || start >= rows.length - 1) return fail("INSUFFICIENT_HISTORY");

  // ── Fenêtre : 1er mois retenu (l'historique complet le précède → poids détenus corrects).
  const windowYears = input.windowYears ?? null;
  let winStart = start;
  if (windowYears != null) {
    const lastDate = rows[rows.length - 1].date;
    const cutoff = `${Number(lastDate.slice(0, 4)) - windowYears}${lastDate.slice(4)}`;
    for (let i = start; i < rows.length; i++) {
      if (rows[i].date >= cutoff) {
        winStart = i;
        break;
      }
    }
  }
  if (winStart >= rows.length - 1) return fail("INSUFFICIENT_HISTORY");

  // ── GARDE-FOUS : valider la plage RÉELLEMENT consommée par la fenêtre. Le
  // dernier mois atteignable = min(dernier mois de perf, mois suivant le dernier
  // poids) — au-delà, les poids manquent (fin naturelle, pas une anomalie). Le 1er
  // mois utile inclut le mois d'ENTRÉE (winStart−1) quand la fenêtre débute après
  // le modèle (transaction d'entrée). Toute lacune ANTÉRIEURE est ignorée.
  const lastWeightMonth = [...wByMonth.keys()].reduce((a, b) => (a > b ? a : b));
  const lastRowMonth = monthKey(rows[rows.length - 1].date);
  const nextAfterWeights = nextMonthKey(lastWeightMonth);
  const computedEndMonth = lastRowMonth < nextAfterWeights ? lastRowMonth : nextAfterWeights;
  const winStartMonth = monthKey(rows[winStart].date);
  const usedStartMonth = winStart === start ? monthKey(rows[start].date) : prevMonthKey(winStartMonth);
  const anomaly = validateWindowRange(maps, wByMonth, usedStartMonth, computedEndMonth);
  if (anomaly) return fail(reasonToStatus(anomaly.reason), anomaly.firstInvalidMonth);

  // ── Phase 1 — boucle COMPLÈTE : rendement, contributions et rotation par mois.
  // Les poids dérivent sur tout l'historique → poids détenus corrects à l'entrée
  // d'une fenêtre restreinte (t → t+1 : poids figés à la clôture de j-1). Un mois
  // sans poids cible est SAUTÉ (jamais un `break` qui tronquerait la suite) : la
  // plage utile est déjà validée, donc seuls des mois hors fenêtre peuvent l'être.
  interface Step {
    idx: number;
    date: string;
    rp: number;
    c: SleeveContributions;
    turnover: number | null;
  }
  const steps: Step[] = [];
  for (let j = start + 1; j < rows.length; j++) {
    const w = wByMonth.get(monthKey(rows[j - 1].date));
    if (!w) continue;
    const prev = rows[j - 1];
    const cur = rows[j];
    const rEq = cur.equity / prev.equity - 1;
    const rBd = cur.bond / prev.bond - 1;
    const rCa = cur.cash / prev.cash - 1;
    const rGo = cur.gold / prev.gold - 1;
    const useEn = hasEnergy && prev.energy !== null && cur.energy !== null;
    const rEn = useEn ? cur.energy! / prev.energy! - 1 : 0;
    const c: SleeveContributions = {
      equities: w.equities * rEq,
      bonds: w.bonds * rBd,
      cash: w.cash * rCa,
      gold: w.gold * rGo,
      energy: useEn ? w.energy * rEn : 0,
    };
    const rp = c.equities + c.bonds + c.cash + c.gold + c.energy;
    const target = wByMonth.get(monthKey(cur.date));
    const turnover = target
      ? computeMonthlyTurnover(
          computePreRebalanceWeights(w, {
            equities: rEq,
            bonds: rBd,
            gold: rGo,
            cash: rCa,
            energy: rEn,
          }),
          target,
        )
      : null;
    steps.push({ idx: j, date: cur.date, rp, c, turnover });
  }
  if (!steps.length) return fail("INSUFFICIENT_HISTORY");

  // ── Phase 2 — sorties sur la fenêtre. nominal base 100 à winStart ; les rendements
  // des mois strictement postérieurs le font évoluer. La rotation inclut le mois
  // winStart (transaction d'ENTRÉE réelle si la fenêtre débute après le modèle) ;
  // au tout début du modèle, ce 1er mois est la constitution initiale (rotation nulle).
  let p = 100;
  const nominal: EconomicDataPoint[] = [{ date: rows[winStart].date, value: 100 }];
  const contrib: SleeveContributions = { equities: 0, bonds: 0, gold: 0, cash: 0, energy: 0 };
  const turnoverMonthly: TurnoverPoint[] = [];
  if (winStart === start) {
    turnoverMonthly.push({ date: rows[start].date, turnover: null, grossTradedWeight: null });
  }
  const firstTurnoverIdx = winStart === start ? start + 1 : winStart;
  for (const s of steps) {
    if (s.idx >= firstTurnoverIdx) {
      turnoverMonthly.push({
        date: s.date,
        turnover: s.turnover,
        grossTradedWeight: s.turnover === null ? null : 2 * s.turnover,
      });
    }
    if (s.idx > winStart) {
      p *= 1 + s.rp;
      nominal.push({ date: s.date, value: p });
      contrib.equities += s.c.equities;
      contrib.bonds += s.c.bonds;
      contrib.cash += s.c.cash;
      contrib.gold += s.c.gold;
      contrib.energy += s.c.energy;
    }
  }
  if (nominal.length < 2) return fail("INSUFFICIENT_HISTORY");

  const toValid = turnoverMonthly
    .filter((t) => t.turnover !== null)
    .map((t) => t.turnover as number);
  const averageMonthly = toValid.length ? toValid.reduce((s, v) => s + v, 0) / toValid.length : 0;
  const last12 = toValid.slice(-12);
  const turnover: TurnoverResult = {
    monthly: turnoverMonthly,
    averageMonthly,
    annualized: averageMonthly * 12,
    trailing12Months: last12.length === 12 ? last12.reduce((s, v) => s + v, 0) : null,
  };

  // Référence interne = indice ACTIONS + poches, rebasés 100 sur la FENÊTRE.
  const winRows = rows.slice(winStart);
  const eq0 = winRows[0].equity;
  const equityBenchmark = winRows.map((r) => ({ date: r.date, value: (100 * r.equity) / eq0 }));

  const rebaseSleeve = (pick: (r: SleeveRow) => number): EconomicDataPoint[] => {
    const v0 = pick(winRows[0]);
    return winRows.map((r) => ({ date: r.date, value: (100 * pick(r)) / v0 }));
  };
  const sleeves = {
    equities: equityBenchmark,
    bonds: rebaseSleeve((r) => r.bond),
    cash: rebaseSleeve((r) => r.cash),
    gold: rebaseSleeve((r) => r.gold),
  };

  // Taux sans risque = rendement annualisé du cash sur la FENÊTRE (Sharpe = excédent).
  const cashSeries = winRows.map((r) => ({ date: r.date, value: r.cash }));
  const riskFreeNominal = computeKpis(cashSeries).annualized ?? 0;

  const cpiByMonth = input.cpi?.length
    ? new Map(toMonthly(input.cpi).map((c) => [c.date.slice(0, 7), c.value]))
    : null;
  const real = cpiByMonth ? deflateByCpi(nominal, cpiByMonth) : null;
  const equityReal = cpiByMonth ? deflateByCpi(equityBenchmark, cpiByMonth) : null;
  const inflationIndex = cpiByMonth ? cumulativeInflation(nominal, cpiByMonth) : null;
  const cashReal = cpiByMonth ? deflateByCpi(cashSeries, cpiByMonth) : null;
  const riskFreeReal = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;

  // Contributions cumulées en % (× 100).
  const contributions: SleeveContributions = {
    equities: contrib.equities * 100,
    bonds: contrib.bonds * 100,
    gold: contrib.gold * 100,
    cash: contrib.cash * 100,
    energy: contrib.energy * 100,
  };

  return {
    status: "OK",
    countryCode,
    availability: AVAILABLE,
    start: nominal[0].date,
    end: nominal[nominal.length - 1].date,
    series: { nominal, real, equityBenchmark, equityReal, inflationIndex, sleeves },
    metrics: {
      nominal: metricsOf(nominal, riskFreeNominal),
      real: real ? metricsOf(real, riskFreeReal) : null,
      equity: metricsOf(equityBenchmark, riskFreeNominal),
      equityReal: equityReal ? metricsOf(equityReal, riskFreeReal) : null,
    },
    contributions,
    turnover,
  };
}

/** Statut correspondant à une raison d'anomalie de fenêtre. */
function reasonToStatus(reason: WindowAnomaly["reason"]): Exclude<BacktestStatus, "OK"> {
  switch (reason) {
    case "non_contiguous_history":
      return "NON_CONTIGUOUS_HISTORY";
    case "invalid_asset_value":
      return "INVALID_ASSET_VALUE";
    case "missing_signal_weight":
      return "MISSING_SIGNAL_WEIGHT";
  }
}
