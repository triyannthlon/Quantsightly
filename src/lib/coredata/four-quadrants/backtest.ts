// Backtest du modèle 4 Quadrants — couche PURE. Applique les poids CIBLES figés
// à la fin du mois `t` aux rendements du mois `t+1` (ZÉRO look-ahead §17). Produit
// la courbe nominale (base 100) + la courbe RÉELLE (déflatée CPI) et leurs
// métriques. Pas de politique de transaction (§18 — reportée à une version
// ultérieure) : chaque mois, la cible du signal est détenue telle quelle.
//
// ⚠️ Le CPI n'intervient QUE pour les métriques réelles, jamais dans les signaux.

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

export type BacktestStatus = "OK" | "MISSING_SERIES" | "INVALID_VALUE" | "INSUFFICIENT_HISTORY";

export type BacktestResult =
  | {
      status: "OK";
      countryCode: string;
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
  | { status: Exclude<BacktestStatus, "OK">; countryCode: string };

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
  if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid portfolio value before rebalancing.");
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

/** Intersection des séries de perf sur leurs mois communs (énergie optionnelle). */
function alignSleeves(input: BacktestInput): SleeveRow[] {
  const key = (p: EconomicDataPoint) => p.date.slice(0, 7);
  const bond = new Map(toMonthly(input.bondTotalReturn).map((p) => [key(p), p.value]));
  const cash = new Map(toMonthly(input.cashTotalReturn).map((p) => [key(p), p.value]));
  const gold = new Map(toMonthly(input.gold).map((p) => [key(p), p.value]));
  const energy = input.energyTotalReturn
    ? new Map(toMonthly(input.energyTotalReturn).map((p) => [key(p), p.value]))
    : null;
  const out: SleeveRow[] = [];
  for (const p of toMonthly(input.equityTotalReturn)) {
    const m = key(p);
    const b = bond.get(m);
    const c = cash.get(m);
    const g = gold.get(m);
    const e = energy ? energy.get(m) : null;
    if (b === undefined || c === undefined || g === undefined) continue;
    if (energy && e === undefined) continue; // énergie demandée mais absente ce mois
    out.push({ date: p.date, equity: p.value, bond: b, cash: c, gold: g, energy: e ?? null });
  }
  return out;
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
function deflateByCpi(index: EconomicDataPoint[], cpiByMonth: Map<string, number>): EconomicDataPoint[] | null {
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
function cumulativeInflation(index: EconomicDataPoint[], cpiByMonth: Map<string, number>): EconomicDataPoint[] | null {
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
  const currentDrawdown = index.length >= 2 && peak > 0 && last > 0 ? (last / peak - 1) * 100 : null;
  const sharpe =
    k.annualized !== null && k.volatility !== null && k.volatility > 0 ? (k.annualized - riskFree) / k.volatility : null;
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
  const fail = (status: Exclude<BacktestStatus, "OK">): BacktestResult => ({ status, countryCode });

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

  const rows = alignSleeves(input).filter(
    (r) => r.equity > 0 && r.bond > 0 && r.cash > 0 && r.gold > 0 && (r.energy === null || r.energy > 0),
  );
  if (rows.length < 2) return fail("INVALID_VALUE");

  const wByMonth = new Map(input.weights.map((w) => [w.date.slice(0, 7), w.allocation]));
  const hasEnergy = Boolean(input.energyTotalReturn);

  // Premier mois disposant d'un poids cible (= début du portefeuille).
  let start = -1;
  for (let i = 0; i < rows.length; i++) {
    if (wByMonth.has(rows[i].date.slice(0, 7))) {
      start = i;
      break;
    }
  }
  if (start < 0 || start >= rows.length - 1) return fail("INSUFFICIENT_HISTORY");

  let p = 100;
  const nominal: EconomicDataPoint[] = [{ date: rows[start].date, value: 100 }];
  const contrib: SleeveContributions = { equities: 0, bonds: 0, gold: 0, cash: 0, energy: 0 };
  // Rotation : la constitution initiale (1er mois) n'est PAS un rééquilibrage.
  const turnoverMonthly: TurnoverPoint[] = [{ date: rows[start].date, turnover: null, grossTradedWeight: null }];
  for (let j = start + 1; j < rows.length; j++) {
    // Poids figés à la clôture du mois j-1 → appliqués au rendement du mois j (t → t+1).
    const w = wByMonth.get(rows[j - 1].date.slice(0, 7));
    if (!w) break;
    const prev = rows[j - 1];
    const cur = rows[j];
    const rEq = cur.equity / prev.equity - 1;
    const rBd = cur.bond / prev.bond - 1;
    const rCa = cur.cash / prev.cash - 1;
    const rGo = cur.gold / prev.gold - 1;
    const rEn = hasEnergy && prev.energy !== null && cur.energy !== null ? cur.energy / prev.energy - 1 : 0;
    contrib.equities += w.equities * rEq;
    contrib.bonds += w.bonds * rBd;
    contrib.cash += w.cash * rCa;
    contrib.gold += w.gold * rGo;
    let rp = w.equities * rEq + w.bonds * rBd + w.cash * rCa + w.gold * rGo;
    if (hasEnergy && prev.energy !== null && cur.energy !== null) {
      contrib.energy += w.energy * rEn;
      rp += w.energy * rEn;
    }
    p *= 1 + rp;
    nominal.push({ date: cur.date, value: p });

    // Turnover : poids détenus (dérivés par les rendements) → nouvelle cible du mois j.
    const target = wByMonth.get(cur.date.slice(0, 7));
    if (target) {
      const pre = computePreRebalanceWeights(w, { equities: rEq, bonds: rBd, gold: rGo, cash: rCa, energy: rEn });
      const to = computeMonthlyTurnover(pre, target);
      turnoverMonthly.push({ date: cur.date, turnover: to, grossTradedWeight: 2 * to });
    }
  }
  if (nominal.length < 2) return fail("INSUFFICIENT_HISTORY");

  const toValid = turnoverMonthly.filter((t) => t.turnover !== null).map((t) => t.turnover as number);
  const averageMonthly = toValid.length ? toValid.reduce((s, v) => s + v, 0) / toValid.length : 0;
  const last12 = toValid.slice(-12);
  const turnover: TurnoverResult = {
    monthly: turnoverMonthly,
    averageMonthly,
    annualized: averageMonthly * 12,
    trailing12Months: last12.length === 12 ? last12.reduce((s, v) => s + v, 0) : null,
  };

  // Référence interne = indice ACTIONS, rebasé 100 sur la MÊME fenêtre.
  const eq0 = rows[start].equity;
  const equityBenchmark = rows.slice(start).map((r) => ({ date: r.date, value: (100 * r.equity) / eq0 }));

  // Taux sans risque = rendement annualisé du cash sur la MÊME période (Sharpe = excédent).
  const cashSeries = rows.slice(start).map((r) => ({ date: r.date, value: r.cash }));
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
    start: nominal[0].date,
    end: nominal[nominal.length - 1].date,
    series: { nominal, real, equityBenchmark, equityReal, inflationIndex },
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
