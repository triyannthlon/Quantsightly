// Moteur de comparaison — orchestration PURE. Il ne recalcule aucun signal ni
// aucune allocation : il assemble les chemins normalisés du registre, détermine la
// FENÊTRE COMMUNE STRICTE, puis mesure chaque stratégie avec des conventions
// IDENTIQUES (mêmes formules, mêmes coûts, même cash, même inflation).
//
// Convention de coûts RÉUTILISÉE des études validées (`measureRc1`, energy-trend-rc1) :
//   coût_t = (bps/10000)·2·turnover_t ;  net_t = brut_t − coût_t  (compounding, avant CPI).
// Les changements de CIBLE non exécutés (retenus par la bande v2) ne coûtent RIEN :
// on ne facture que la rotation RÉELLEMENT exécutée (`turnover` du chemin).

import type { EconomicDataPoint } from "../types";
import { computeKpis } from "../compute";
import {
  monthlyReturns,
  cumulativeReturnPct,
  annualizedPct,
  volatilityPct,
  maxDrawdownPct,
  currentDrawdownPct,
  maxUnderwaterMonths,
  drawdownSeries,
  downsideDeviationAnnualPct,
  sortino,
  sharpe,
  worstRollingPct,
  worstMonthPct,
  expectedShortfallPct,
  skewness,
  excessKurtosis,
  rollingAnnualizedReturns,
  median,
} from "./metrics";
import {
  COMPARISON_STRATEGIES,
  PUBLIC_STRATEGY_IDS,
  type SharedComparisonInput,
  type StrategyPath,
} from "./registry";
import {
  MIN_COMPARISON_MONTHS,
  EPS_REALLOC,
  ROLLING_WINDOWS_YEARS,
  DEFAULT_COST_BPS,
} from "./constants";
// Ré-exportés depuis les constantes PURES : le client les importe depuis `./constants`
// (sans tirer le moteur) ; le serveur peut continuer de les prendre ici ou au barrel.
export { MIN_COMPARISON_MONTHS, ROLLING_WINDOWS_YEARS, DEFAULT_COST_BPS, COST_BPS_OPTIONS } from "./constants";
import type {
  Allocation,
  ComparisonMetrics,
  ComparisonMode,
  ComparisonPeriodYears,
  ComparisonStrategyId,
  ComparisonStrategyResult,
  ComparisonUnavailableReason,
  ComparisonWindow,
  CumulativePoint,
  ModelComparisonResult,
  MonthlyReturn,
  RollingWindowStat,
} from "./types";

const monthKey = (d: string): string => d.slice(0, 7);

// ─── Fenêtre commune stricte ─────────────────────────────────────────────────

/** Map « YYYY-MM » → point, pour un accès aligné par mois. */
function toMonthMap(curve: EconomicDataPoint[]): Map<string, EconomicDataPoint> {
  const m = new Map<string, EconomicDataPoint>();
  for (const p of curve) m.set(monthKey(p.date), p);
  return m;
}

/** Mois présents dans TOUTES les courbes (intersection stricte), triés croissants. */
function strictCommonMonths(curves: EconomicDataPoint[][]): string[] {
  if (!curves.length) return [];
  let common = curves[0].map((p) => monthKey(p.date));
  for (let i = 1; i < curves.length; i++) {
    const set = new Set(curves[i].map((p) => monthKey(p.date)));
    common = common.filter((m) => set.has(m));
  }
  return common;
}

/** Restreint aux `years` dernières années de la fenêtre (Max = inchangé). */
function applyPeriod(months: string[], years: ComparisonPeriodYears): string[] {
  if (years == null || !months.length) return months;
  const end = months[months.length - 1];
  const cutoff = `${Number(end.slice(0, 4)) - years}-${end.slice(5, 7)}`;
  return months.filter((m) => m >= cutoff);
}

/** Points d'une courbe restreints aux mois `months` (dans l'ordre de `months`). */
function pickAligned(curve: EconomicDataPoint[], months: string[]): EconomicDataPoint[] {
  const map = toMonthMap(curve);
  const out: EconomicDataPoint[] = [];
  for (const m of months) {
    const p = map.get(m);
    if (p) out.push(p);
  }
  return out;
}

/** Déflate une courbe par le CPI (base 100 rebasée à la 1ʳᵉ date où le CPI existe). */
function deflate(
  curve: EconomicDataPoint[],
  cpiMap: Map<string, number>,
): EconomicDataPoint[] | null {
  const pts = curve
    .map((p) => ({ date: p.date, v: p.value, c: cpiMap.get(monthKey(p.date)) }))
    .filter((x): x is { date: string; v: number; c: number } => x.c !== undefined && x.c > 0);
  if (pts.length < 2) return null;
  const v0 = pts[0].v;
  const c0 = pts[0].c;
  return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c / c0) }));
}

// ─── Mesure d'un chemin sur la fenêtre ───────────────────────────────────────

interface MeasuredPath {
  /** Courbe NETTE mesurée (nominale ou réelle selon le mode), base 100. */
  measured: EconomicDataPoint[];
  /** Chemin mensuel net (rendement brut/net, turnover, coût). */
  monthly: MonthlyReturn[];
  /** Taux sans risque annualisé (cash local, même mode). */
  riskFree: number;
}

/**
 * Applique la fenêtre + les coûts à un chemin brut, et déflate en réel si demandé.
 * `null` si la fenêtre est trop courte ou si le réel est demandé sans CPI.
 */
function measurePath(
  path: Extract<StrategyPath, { status: "OK" }>,
  months: string[],
  cashNominal: EconomicDataPoint[],
  cpiMap: Map<string, number> | null,
  mode: ComparisonMode,
  costBps: number,
): MeasuredPath | null {
  const gross = pickAligned(path.nominalGross, months);
  if (gross.length < 2) return null;

  const cost = costBps / 10000;
  let value = 100;
  const netNominal: EconomicDataPoint[] = [{ date: gross[0].date, value: 100 }];
  const monthly: MonthlyReturn[] = [];
  for (let i = 1; i < gross.length; i++) {
    const grossReturn = gross[i].value / gross[i - 1].value - 1;
    // Turnover exécuté du mois (null = constitution → 0). Le 1er mois (i=0) est la
    // base : sa transaction éventuelle n'est jamais facturée (fenêtre = position déjà tenue).
    const turnover = path.turnoverByMonth.get(monthKey(gross[i].date)) ?? 0;
    const c = cost * 2 * turnover;
    const net = grossReturn - c;
    value *= 1 + net;
    netNominal.push({ date: gross[i].date, value });
    monthly.push({ date: gross[i].date, gross: grossReturn, net, turnover, cost: c });
  }

  const cashWin = pickAligned(cashNominal, months);
  if (mode === "real") {
    if (!cpiMap) return null;
    const netReal = deflate(netNominal, cpiMap);
    if (!netReal) return null;
    const cashReal = deflate(cashWin, cpiMap);
    const riskFree = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;
    return { measured: netReal, monthly, riskFree };
  }
  const riskFree = computeKpis(cashWin).annualized ?? 0;
  return { measured: netNominal, monthly, riskFree };
}

// ─── Métriques comparables ───────────────────────────────────────────────────

/**
 * Construit le jeu de métriques comparables à partir d'une courbe mesurée + de son
 * chemin mensuel. `browneRolling` (par fenêtre) sert au « % de fenêtres devant
 * Browne » ; `null` quand Browne est absent ou quand la stratégie EST Browne.
 */
function buildMetrics(
  measured: EconomicDataPoint[],
  monthly: MonthlyReturn[],
  riskFree: number,
  browneRolling: Map<number, number[]> | null,
): ComparisonMetrics {
  const rets = monthlyReturns(measured);
  const ann = annualizedPct(measured);
  const vol = volatilityPct(measured);
  const down = downsideDeviationAnnualPct(rets);

  const turnovers = monthly.map((m) => m.turnover);
  const meanTurn = turnovers.length ? turnovers.reduce((s, v) => s + v, 0) / turnovers.length : 0;
  const reallocCount = turnovers.filter((v) => v > EPS_REALLOC).length;
  const meanCost = monthly.length ? monthly.reduce((s, m) => s + m.cost, 0) / monthly.length : 0;

  const rolling: RollingWindowStat[] = ROLLING_WINDOWS_YEARS.map((years) => {
    const win = years * 12;
    const self = rollingAnnualizedReturns(measured, win);
    let shareBeatingBrowne: number | null = null;
    if (browneRolling) {
      const other = browneRolling.get(years) ?? [];
      const n = Math.min(self.length, other.length);
      if (n > 0) {
        let wins = 0;
        for (let i = 0; i < n; i++) if (self[i] > other[i]) wins += 1;
        shareBeatingBrowne = wins / n;
      }
    }
    return {
      windowYears: years,
      count: self.length,
      median: median(self),
      best: self.length ? Math.max(...self) : null,
      worst: self.length ? Math.min(...self) : null,
      shareBeatingBrowne,
    };
  });

  return {
    months: measured.length,
    start: measured[0].date,
    end: measured[measured.length - 1].date,
    cumulative: cumulativeReturnPct(measured),
    annualized: ann,
    volatility: vol,
    sharpe: sharpe(ann, riskFree, vol),
    sortino: sortino(ann, down),
    maxDrawdown: maxDrawdownPct(measured),
    currentDrawdown: currentDrawdownPct(measured),
    maxUnderwaterMonths: maxUnderwaterMonths(measured),
    worstRolling12m: worstRollingPct(measured, 12),
    worstMonth: worstMonthPct(rets),
    worstQuarter: worstRollingPct(measured, 3),
    expectedShortfall95: expectedShortfallPct(rets, 0.05),
    expectedShortfall99: expectedShortfallPct(rets, 0.01),
    downsideDeviation: down,
    skewness: skewness(rets),
    excessKurtosis: excessKurtosis(rets),
    annualizedTurnover: meanTurn * 12,
    reallocationsPerYear: turnovers.length ? (reallocCount / turnovers.length) * 12 : 0,
    annualCostEstimate: meanCost * 12 * 100,
    cumulativeCost: monthly.reduce((s, m) => s + m.cost, 0) * 100,
    rolling,
  };
}

// ─── Allocation détenue / cible ──────────────────────────────────────────────

const CORE_KEYS: (keyof Allocation)[] = ["equities", "bonds", "gold", "cash"];

/** Divergence VISIBLE (au % arrondi) entre poids détenus et cibles. */
function allocDiverges(held: Allocation, target: Allocation): boolean {
  return CORE_KEYS.some(
    (k) => Math.round((held[k] ?? 0) * 100) !== Math.round((target[k] ?? 0) * 100),
  );
}

// ─── API publique ────────────────────────────────────────────────────────────

export interface ComputeComparisonOptions {
  /** Stratégies à comparer (ordre d'affichage). Défaut = les 3 publiques. */
  strategyIds?: ComparisonStrategyId[];
  /** Fenêtre en années (`null` = Max). */
  period?: ComparisonPeriodYears;
  mode?: ComparisonMode;
  /** Coûts (bps sur la rotation exécutée). Défaut 25. */
  costBps?: number;
}

const emptyStrategy = (
  id: ComparisonStrategyId,
  reason: ComparisonUnavailableReason,
  firstInvalidMonth: string | null,
): ComparisonStrategyResult => ({
  id,
  label: COMPARISON_STRATEGIES[id].label,
  description: COMPARISON_STRATEGIES[id].description,
  availability: { status: "unavailable", reason, firstInvalidMonth },
  monthlyReturns: [],
  cumulativeSeries: [],
  drawdownSeries: [],
  currentAllocation: null,
  metrics: null,
});

/**
 * Compare plusieurs stratégies d'allocation sur une FENÊTRE COMMUNE STRICTE. Toutes
 * les stratégies disponibles partagent exactement les mêmes dates, le même cash, la
 * même inflation et les mêmes conventions de coûts. Les stratégies indisponibles
 * portent une raison explicite ; la fenêtre est recalculée sur les seules stratégies
 * disponibles (jamais d'interpolation ni de dernier signal connu).
 */
export function computeModelComparison(
  shared: SharedComparisonInput,
  options: ComputeComparisonOptions = {},
): ModelComparisonResult {
  const strategyIds = options.strategyIds ?? PUBLIC_STRATEGY_IDS;
  const period = options.period ?? null;
  const mode: ComparisonMode = options.mode ?? "nominal";
  const costBps = options.costBps ?? DEFAULT_COST_BPS;

  const base = { countryCode: shared.countryCode, mode, costBps };

  // Précondition globale du mode réel : pas de CPI ⇒ aucune comparaison réelle possible.
  const cpiSeries = shared.perf.cpi ?? [];
  if (mode === "real" && cpiSeries.length < 2) {
    return {
      ...base,
      window: null,
      strategies: strategyIds.map((id) => emptyStrategy(id, "inflation_unavailable", null)),
      disabledReason: "inflation_unavailable",
    };
  }

  // Préconditions de séries partagées (raisons explicites plus précises).
  const sharedReason: ComparisonUnavailableReason | null =
    shared.perf.bondTotalReturn.length < 2
      ? "bond_series_unavailable"
      : shared.perf.cashTotalReturn.length < 2
        ? "cash_unavailable"
        : shared.perf.equityTotalReturn.length < 2 || shared.perf.gold.length < 2
          ? "missing_series"
          : null;
  if (sharedReason) {
    return {
      ...base,
      window: null,
      strategies: strategyIds.map((id) => emptyStrategy(id, sharedReason, null)),
      disabledReason: sharedReason,
    };
  }

  // 1. Construire les chemins normalisés.
  const built = strategyIds.map((id) => ({ id, path: COMPARISON_STRATEGIES[id].build(shared) }));
  const okBuilt = built.filter(
    (b): b is { id: ComparisonStrategyId; path: Extract<StrategyPath, { status: "OK" }> } =>
      b.path.status === "OK",
  );

  // 2. Fenêtre commune STRICTE parmi les seules stratégies disponibles.
  const commonMonths = applyPeriod(
    strictCommonMonths(okBuilt.map((b) => b.path.nominalGross)),
    period,
  );

  if (okBuilt.length < 1 || commonMonths.length < MIN_COMPARISON_MONTHS) {
    return {
      ...base,
      window: null,
      strategies: built.map((b) =>
        b.path.status === "OK"
          ? emptyStrategy(b.id, "insufficient_history", null)
          : emptyStrategy(b.id, b.path.reason, b.path.firstInvalidMonth),
      ),
      disabledReason: "insufficient_history",
    };
  }

  const cpiMap = cpiSeries.length ? new Map(cpiSeries.map((p) => [monthKey(p.date), p.value])) : null;

  // 3. Mesurer chaque chemin disponible sur la fenêtre commune.
  const measuredById = new Map<ComparisonStrategyId, MeasuredPath>();
  for (const b of okBuilt) {
    const m = measurePath(b.path, commonMonths, shared.perf.cashTotalReturn, cpiMap, mode, costBps);
    if (m) measuredById.set(b.id, m);
  }

  // 4. Fenêtres glissantes de Browne (référence du « % de fenêtres devant Browne »).
  const browneMeasured = measuredById.get("browne");
  const browneRolling: Map<number, number[]> | null = browneMeasured
    ? new Map(ROLLING_WINDOWS_YEARS.map((y) => [y, rollingAnnualizedReturns(browneMeasured.measured, y * 12)]))
    : null;

  // 5. Assembler les résultats dans l'ordre demandé.
  const strategies: ComparisonStrategyResult[] = built.map((b) => {
    if (b.path.status !== "OK") {
      return emptyStrategy(b.id, b.path.reason, b.path.firstInvalidMonth);
    }
    const measured = measuredById.get(b.id);
    if (!measured) {
      // Chemin OK mais non mesurable sur la fenêtre (ex. réel sans CPI aligné).
      return emptyStrategy(b.id, mode === "real" ? "inflation_unavailable" : "insufficient_history", null);
    }
    const def = COMPARISON_STRATEGIES[b.id];
    const held = b.path.held;
    const target = b.path.target;
    return {
      id: b.id,
      label: def.label,
      description: def.description,
      availability: { status: "ok" },
      monthlyReturns: measured.monthly,
      cumulativeSeries: measured.measured.map((p): CumulativePoint => ({ date: p.date, value: p.value })),
      drawdownSeries: drawdownSeries(measured.measured),
      currentAllocation: held,
      targetAllocation: allocDiverges(held, target) ? target : undefined,
      metrics: buildMetrics(
        measured.measured,
        measured.monthly,
        measured.riskFree,
        b.id === "browne" ? null : browneRolling,
      ),
    };
  });

  const commonWindow: ComparisonWindow = {
    start: commonMonths[0],
    end: commonMonths[commonMonths.length - 1],
    months: commonMonths.length,
  };

  return { ...base, window: commonWindow, strategies, disabledReason: null };
}
