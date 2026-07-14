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
}

export type BacktestStatus = "OK" | "MISSING_SERIES" | "INVALID_VALUE" | "INSUFFICIENT_HISTORY";

export type BacktestResult =
  | {
      status: "OK";
      countryCode: string;
      series: { nominal: TimeSeries; real: TimeSeries | null };
      metrics: { nominal: BacktestMetrics; real: BacktestMetrics | null };
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

function metricsOf(index: EconomicDataPoint[]): BacktestMetrics {
  const k = computeKpis(index);
  const cumulative =
    index.length >= 2 && index[0].value > 0 ? (index[index.length - 1].value / index[0].value - 1) * 100 : null;
  return {
    months: index.length,
    cumulative,
    annualized: k.annualized,
    volatility: k.volatility,
    maxDrawdown: maxDrawdownPct(index),
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
  for (let j = start + 1; j < rows.length; j++) {
    // Poids figés à la clôture du mois j-1 → appliqués au rendement du mois j.
    const w = wByMonth.get(rows[j - 1].date.slice(0, 7));
    if (!w) break;
    const prev = rows[j - 1];
    const cur = rows[j];
    let rp =
      w.equities * (cur.equity / prev.equity - 1) +
      w.bonds * (cur.bond / prev.bond - 1) +
      w.cash * (cur.cash / prev.cash - 1) +
      w.gold * (cur.gold / prev.gold - 1);
    if (hasEnergy && prev.energy !== null && cur.energy !== null) {
      rp += w.energy * (cur.energy / prev.energy - 1);
    }
    p *= 1 + rp;
    nominal.push({ date: cur.date, value: p });
  }
  if (nominal.length < 2) return fail("INSUFFICIENT_HISTORY");

  let real: EconomicDataPoint[] | null = null;
  if (input.cpi?.length) {
    const cpiByMonth = new Map(toMonthly(input.cpi).map((c) => [c.date.slice(0, 7), c.value]));
    real = deflateByCpi(nominal, cpiByMonth);
  }

  return {
    status: "OK",
    countryCode,
    series: { nominal, real },
    metrics: { nominal: metricsOf(nominal), real: real ? metricsOf(real) : null },
  };
}
