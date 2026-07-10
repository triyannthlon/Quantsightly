// Portefeuille permanent de Browne (25 % actions / 25 % obligations 10 ans /
// 25 % or / 25 % cash) — couche PURE, testable, sans accès base. Le chargement
// des séries + la conversion de l'or en devise locale vivent dans
// `browne-service.ts` (côté serveur), sur le modèle de `quadrant-service.ts`.
//
// Entrées attendues : séries MENSUELLES, en TOTAL-RETURN, dans la DEVISE LOCALE
// du pays (on consomme partout le `type 2` de coredata ; l'or `XAU` en USD est
// déjà converti en devise locale par le service via `convertCurrency`).
//
// Principe : rendements mensuels de chaque poche → combinaison équipondérée avec
// des poids qui dérivent au fil des mois puis sont remis à l'équilibre selon la
// fréquence de rééquilibrage choisie. Sorties : index nominal (base 100), index
// réel (déflaté par l'inflation), benchmark actions, inflation cumulée et séries
// par poche — le tout avec leurs métriques.

import type { EconomicDataPoint } from "./types";
import { computeKpis } from "./compute";

/** Fréquence de rééquilibrage du portefeuille. */
export type RebalanceFrequency = "monthly" | "quarterly" | "annual" | "none";

/** Défaut produit : rééquilibrage annuel (les poids dérivent, reset en fin d'année). */
export const DEFAULT_REBALANCE: RebalanceFrequency = "annual";

/** Libellés FR pour le sélecteur de l'UI. */
export const REBALANCE_LABELS: Record<RebalanceFrequency, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  annual: "Annuel",
  none: "Aucun",
};

/** Poids cible de chaque poche (portefeuille équipondéré). */
export const SLEEVE_WEIGHT = 0.25;

/** Minimum de mois alignés pour produire un résultat exploitable (~1 an). */
export const MIN_MONTHS = 13;

/** Les 4 poches du portefeuille, dans l'ordre canonique. */
export type SleeveKey = "equity" | "bond" | "cash" | "gold";
export const SLEEVE_KEYS: readonly SleeveKey[] = ["equity", "bond", "cash", "gold"] as const;

export type BrowneStatus = "OK" | "MISSING_SERIES" | "INSUFFICIENT_HISTORY" | "INVALID_VALUE";

/** Métriques d'une courbe d'index (nominal, réel, benchmark…). */
export interface BrowneMetrics {
  /** Rendement total sur la période (`dernier/premier − 1`), en %. */
  cumulative: number | null;
  /** Rendement annualisé (CAGR), en %. */
  annualized: number | null;
  /** Volatilité annualisée (écart-type mensuel × √12), en %. */
  volatility: number | null;
  /** Pire creux pic-à-creux, en % (≤ 0). */
  maxDrawdown: number | null;
  /** Recul depuis le pic historique à la dernière date, en % (≤ 0). */
  currentDrawdown: number | null;
  /** Ratio de Sharpe (rf = 0) = annualisé / volatilité. */
  sharpe: number | null;
  /** Ratio de Sortino = annualisé / volatilité baissière (MAR = 0). */
  sortino: number | null;
  /** Ratio de Calmar = annualisé / |max drawdown|. */
  calmar: number | null;
  /** Pire rendement d'une année civile (fin d'année → fin d'année), en %. */
  worstYear: number | null;
  /** Meilleur rendement d'une année civile, en %. */
  bestYear: number | null;
  /** Plus longue durée passée sous le dernier sommet, en mois. */
  maxUnderwaterMonths: number | null;
  /** Variation % sur 1 / 12 / 36 / 60 mois. */
  lastMonth: number | null;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
}

/** Métriques d'une poche (pour la section « Contribution des poches »). */
export interface SleeveMetrics {
  /** Contribution arithmétique à la performance (Σ poids·rendement), en %. */
  contribution: number | null;
  /** Volatilité annualisée de la poche, en %. */
  volatility: number | null;
  /** Meilleur rendement mensuel, en %. */
  bestMonth: number | null;
  /** Pire rendement mensuel, en %. */
  worstMonth: number | null;
  /** Max drawdown de la poche, en % (≤ 0). */
  maxDrawdown: number | null;
}

/** Courbes produites (base 100 à leur première date respective). */
export interface BrowneSeriesSet {
  /** Portefeuille de Browne nominal, base 100. */
  nominal: EconomicDataPoint[];
  /** Portefeuille réel (déflaté par le CPI), base 100 — `null` sans inflation. */
  real: EconomicDataPoint[] | null;
  /** Indice actions national rebasé 100 sur la même fenêtre (« vs marché »). */
  equityBenchmark: EconomicDataPoint[];
  /** Indice actions RÉEL (déflaté par le CPI), base 100 — `null` sans inflation. */
  equityReal: EconomicDataPoint[] | null;
  /** Inflation cumulée base 100 (mode « Nominal vs Inflation ») — `null` sans CPI. */
  inflationIndex: EconomicDataPoint[] | null;
  /** Chaque poche rebasée 100 sur la fenêtre. */
  sleeves: Record<SleeveKey, EconomicDataPoint[]>;
}

export type BrowneResult =
  | {
      status: "OK";
      countryCode: string;
      rebalance: RebalanceFrequency;
      /** Première / dernière date `YYYY-MM-DD` de la fenêtre commune aux 4 poches. */
      start: string;
      end: string;
      months: number;
      series: BrowneSeriesSet;
      metrics: {
        nominal: BrowneMetrics;
        real: BrowneMetrics | null;
        equity: BrowneMetrics;
        equityReal: BrowneMetrics | null;
        sleeves: Record<SleeveKey, SleeveMetrics>;
      };
    }
  | {
      status: Exclude<BrowneStatus, "OK">;
      countryCode: string;
      rebalance: RebalanceFrequency;
    };

export interface ComputeBrowneInput {
  countryCode: string;
  /** Actions locales (total-return), devise locale. */
  equity: EconomicDataPoint[];
  /** Obligations souveraines 10 ans (total-return), devise locale. */
  bond: EconomicDataPoint[];
  /** Cash (indice total-return), devise locale. */
  cash: EconomicDataPoint[];
  /** Or (`XAU`) DÉJÀ converti en devise locale. */
  gold: EconomicDataPoint[];
  /** CPI local (indice de prix) pour la courbe réelle — optionnel. */
  inflation?: EconomicDataPoint[];
  rebalance?: RebalanceFrequency;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Un point par mois = dernière valeur du mois. Dates `YYYY-MM-DD` en sortie triées. */
function toMonthly(data: EconomicDataPoint[]): EconomicDataPoint[] {
  const byMonth = new Map<string, EconomicDataPoint>();
  for (const p of data) byMonth.set(p.date.slice(0, 7), p);
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Clé de période de rééquilibrage : un changement de clé ⇒ on remet les poids à l'équilibre. */
function periodKey(date: string, freq: RebalanceFrequency): string {
  if (freq === "none") return "ALL";
  if (freq === "monthly") return date.slice(0, 7);
  const year = date.slice(0, 4);
  if (freq === "annual") return year;
  const month = Number(date.slice(5, 7));
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

interface SleevePoint {
  date: string;
  equity: number;
  bond: number;
  cash: number;
  gold: number;
}

/** Intersection des 4 poches sur leurs mois communs (valeurs = niveaux d'indice). */
function alignSleeves(
  equity: EconomicDataPoint[],
  bond: EconomicDataPoint[],
  cash: EconomicDataPoint[],
  gold: EconomicDataPoint[],
): SleevePoint[] {
  const key = (p: EconomicDataPoint) => p.date.slice(0, 7);
  const bM = new Map(bond.map((p) => [key(p), p.value]));
  const cM = new Map(cash.map((p) => [key(p), p.value]));
  const gM = new Map(gold.map((p) => [key(p), p.value]));
  const out: SleevePoint[] = [];
  for (const p of equity) {
    const b = bM.get(key(p));
    const c = cM.get(key(p));
    const g = gM.get(key(p));
    if (b !== undefined && c !== undefined && g !== undefined) {
      out.push({ date: p.date, equity: p.value, bond: b, cash: c, gold: g });
    }
  }
  return out;
}

/** Rendements mensuels simples d'une courbe d'index (`vₜ/vₜ₋₁ − 1`). */
function monthlyReturns(index: EconomicDataPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < index.length; i++) {
    const prev = index[i - 1].value;
    if (prev !== 0) {
      const r = index[i].value / prev - 1;
      if (Number.isFinite(r)) out.push(r);
    }
  }
  return out;
}

/** Pire drawdown d'une courbe d'index, en % (≤ 0). `null` si trop courte. */
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

/** Rendements par année civile (valeur fin d'année Y / fin d'année Y−1), en %. */
function calendarYearReturns(index: EconomicDataPoint[]): number[] {
  const byYear = new Map<string, number>(); // année → dernière valeur (l'ordre écrase)
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

/** Métriques complètes d'une courbe d'index (réutilise `computeKpis` + drawdown). */
function indexMetrics(index: EconomicDataPoint[]): BrowneMetrics {
  const k = computeKpis(index);
  const first = index[0]?.value;
  const last = index[index.length - 1]?.value;
  const cumulative =
    index.length >= 2 && first > 0 && last > 0 ? (last / first - 1) * 100 : null;
  const maxDrawdown = maxDrawdownPct(index);
  const peak = index.length ? index.reduce((mx, p) => (p.value > mx ? p.value : mx), -Infinity) : 0;
  const currentDrawdown =
    index.length >= 2 && peak > 0 && last > 0 ? (last / peak - 1) * 100 : null;
  const sharpe =
    k.annualized !== null && k.volatility !== null && k.volatility > 0
      ? k.annualized / k.volatility
      : null;

  // Sortino : volatilité baissière annualisée (rendements < MAR = 0).
  const rets = monthlyReturns(index);
  let sortino: number | null = null;
  if (rets.length >= 2 && k.annualized !== null) {
    const negSq = rets.reduce((s, r) => s + (r < 0 ? r * r : 0), 0);
    const downside = Math.sqrt(negSq / rets.length) * Math.sqrt(12) * 100;
    sortino = downside > 0 ? k.annualized / downside : null;
  }

  const calmar =
    k.annualized !== null && maxDrawdown !== null && maxDrawdown < 0
      ? k.annualized / Math.abs(maxDrawdown)
      : null;

  const yearly = calendarYearReturns(index);

  return {
    cumulative,
    annualized: k.annualized,
    volatility: k.volatility,
    maxDrawdown,
    currentDrawdown,
    sharpe,
    sortino,
    calmar,
    worstYear: yearly.length ? Math.min(...yearly) : null,
    bestYear: yearly.length ? Math.max(...yearly) : null,
    maxUnderwaterMonths: maxUnderwaterMonths(index),
    lastMonth: k.lastMonth,
    oneYear: k.oneYear,
    threeYear: k.threeYear,
    fiveYear: k.fiveYear,
  };
}

/** Métriques d'une poche (contribution passée par l'appelant). */
function sleeveMetrics(index: EconomicDataPoint[], contribution: number | null): SleeveMetrics {
  const rets = monthlyReturns(index);
  return {
    contribution,
    volatility: computeKpis(index).volatility,
    bestMonth: rets.length ? Math.max(...rets) * 100 : null,
    worstMonth: rets.length ? Math.min(...rets) * 100 : null,
    maxDrawdown: maxDrawdownPct(index),
  };
}

// ─── Moteur ──────────────────────────────────────────────────────────────────

/**
 * Construit le portefeuille de Browne d'un pays et ses métriques.
 *
 * Rendement mensuel du portefeuille = Σ poidsₖ · rendementₖ, où les poids
 * dérivent d'un mois sur l'autre — `wₖ ← wₖ·(1+rₖ)` renormalisé — et sont remis à
 * `SLEEVE_WEIGHT` (25 %) à chaque frontière de rééquilibrage. `none` = jamais
 * (buy & hold), `monthly` = à chaque mois (⇒ moyenne équipondérée des poches).
 * La contribution d'une poche est la somme de ses rendements pondérés `Σ wₖ·rₖ`.
 */
export function computeBrowne(input: ComputeBrowneInput): BrowneResult {
  const { countryCode } = input;
  const rebalance = input.rebalance ?? DEFAULT_REBALANCE;
  const fail = (status: Exclude<BrowneStatus, "OK">): BrowneResult => ({
    status,
    countryCode,
    rebalance,
  });

  if (!input.equity.length || !input.bond.length || !input.cash.length || !input.gold.length) {
    return fail("MISSING_SERIES");
  }

  const valid = alignSleeves(
    toMonthly(input.equity),
    toMonthly(input.bond),
    toMonthly(input.cash),
    toMonthly(input.gold),
  ).filter((p) => p.equity > 0 && p.bond > 0 && p.cash > 0 && p.gold > 0);

  if (valid.length === 0) return fail("INVALID_VALUE");
  if (valid.length < MIN_MONTHS) return fail("INSUFFICIENT_HISTORY");

  const level = (pt: SleevePoint, k: SleeveKey) => pt[k];

  // Portefeuille nominal : poids qui dérivent, reset aux frontières de rééquilibrage.
  let w = [SLEEVE_WEIGHT, SLEEVE_WEIGHT, SLEEVE_WEIGHT, SLEEVE_WEIGHT];
  const contrib = [0, 0, 0, 0]; // Σ wₖ·rₖ par poche
  let p = 100;
  const nominal: EconomicDataPoint[] = [{ date: valid[0].date, value: 100 }];

  for (let i = 1; i < valid.length; i++) {
    if (periodKey(valid[i].date, rebalance) !== periodKey(valid[i - 1].date, rebalance)) {
      w = [SLEEVE_WEIGHT, SLEEVE_WEIGHT, SLEEVE_WEIGHT, SLEEVE_WEIGHT];
    }
    const r = SLEEVE_KEYS.map((k) => level(valid[i], k) / level(valid[i - 1], k) - 1);
    const rp = w[0] * r[0] + w[1] * r[1] + w[2] * r[2] + w[3] * r[3];
    for (let j = 0; j < 4; j++) contrib[j] += w[j] * r[j];
    p *= 1 + rp;
    nominal.push({ date: valid[i].date, value: p });

    // Dérive des poids pour le mois suivant (renormalisés à 1).
    const nw = [w[0] * (1 + r[0]), w[1] * (1 + r[1]), w[2] * (1 + r[2]), w[3] * (1 + r[3])];
    const tot = nw[0] + nw[1] + nw[2] + nw[3];
    w = [nw[0] / tot, nw[1] / tot, nw[2] / tot, nw[3] / tot];
  }

  // Séries par poche, rebasées 100 sur la fenêtre.
  const rebase = (k: SleeveKey): EconomicDataPoint[] => {
    const base = level(valid[0], k);
    return valid.map((pt) => ({ date: pt.date, value: (100 * level(pt, k)) / base }));
  };
  const sleeves: Record<SleeveKey, EconomicDataPoint[]> = {
    equity: rebase("equity"),
    bond: rebase("bond"),
    cash: rebase("cash"),
    gold: rebase("gold"),
  };

  // Benchmark actions : indice actions rebasé 100 sur la même fenêtre.
  const equityBenchmark = sleeves.equity;

  // Courbes réelles (Browne + actions) + inflation cumulée : déflate par le CPI.
  let real: EconomicDataPoint[] | null = null;
  let equityReal: EconomicDataPoint[] | null = null;
  let inflationIndex: EconomicDataPoint[] | null = null;
  if (input.inflation?.length) {
    const cpiByMonth = new Map(toMonthly(input.inflation).map((pt) => [pt.date.slice(0, 7), pt.value]));
    real = deflateByCpi(nominal, cpiByMonth);
    equityReal = deflateByCpi(equityBenchmark, cpiByMonth);
    inflationIndex = cumulativeInflation(nominal, cpiByMonth);
  }

  return {
    status: "OK",
    countryCode,
    rebalance,
    start: valid[0].date,
    end: valid[valid.length - 1].date,
    months: valid.length,
    series: { nominal, real, equityBenchmark, equityReal, inflationIndex, sleeves },
    metrics: {
      nominal: indexMetrics(nominal),
      real: real ? indexMetrics(real) : null,
      equity: indexMetrics(equityBenchmark),
      equityReal: equityReal ? indexMetrics(equityReal) : null,
      sleeves: {
        equity: sleeveMetrics(sleeves.equity, contrib[0] * 100),
        bond: sleeveMetrics(sleeves.bond, contrib[1] * 100),
        cash: sleeveMetrics(sleeves.cash, contrib[2] * 100),
        gold: sleeveMetrics(sleeves.gold, contrib[3] * 100),
      },
    },
  };
}
