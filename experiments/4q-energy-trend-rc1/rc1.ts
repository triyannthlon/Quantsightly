// ─────────────────────────────────────────────────────────────────────────────
// `4q-energy-trend-rc1` — implémentation du CANDIDAT (PUR, from-scratch).
//
// Assemble : allocation nationale v2 (cible 4 poches, fournie) + signal de tendance
// SPDYENT (§signal.ts) → cible à 5 poches prorata (§portfolio.ts) → UNE bande v2 sur
// les 5 poches → rendements t+1. Coûts intégrés au compounding (hypothèse externe).
//
// ⚠️ Cette boucle réplique EXACTEMENT la sémantique de `backtestQuadrants` (moteur de
// production) : la concordance (§concordance.mts) le prouve au bit près. Elle expose EN
// PLUS les séries complètes de poids DÉTENUS et CIBLES + les épisodes d'activation, que
// le moteur n'expose que sur le dernier mois.
//
// Ordre des opérations (§6 de la spec) :
//   1. rendements t sur poids détenus → dérive ;  2. poids détenus dérivés (renormalisés) ;
//   3. cible nationale v2 (fournie) ;  4. signal tendance à t ;  5. actif ?  6. cible 5 poches ;
//   7. comparer à détenu ;  8. UNE bande v2 ;  9-10. conserver détenu / réallouer plein ;
//   11. appliquer à t+1.
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildFivePocketTarget,
  allocationSum,
  ENERGY_WEIGHT_RC1,
  type CoreAllocation,
  type FiveAllocation,
} from "./portfolio";

export interface DataPoint {
  date: string;
  value: number;
}

export interface Rc1Input {
  countryCode: string;
  /** Cible nationale v2 (4 poches, somme=1) par mois "YYYY-MM". */
  baseByMonth: Map<string, CoreAllocation>;
  /** Signal de tendance par mois "YYYY-MM" (absent = indisponible → Énergie 0). */
  signalByMonth: Map<string, boolean>;
  /** Séries de PERFORMANCE total-return, devise LOCALE. */
  equityTotalReturn: DataPoint[];
  bondTotalReturn: DataPoint[];
  cashTotalReturn: DataPoint[];
  gold: DataPoint[];
  /** SPDYENT converti en devise locale (perf de la poche Énergie). */
  energyLocal: DataPoint[];
  /** CPI local (métriques réelles). */
  cpi?: DataPoint[];
  /** Poids Énergie cible (défaut 0.10 = spec rc1). */
  energyWeight?: number;
  /** Bande de réallocation (défaut 0.05 = v2). `null` = pas de bande (v1). */
  reallocationBand?: number | null;
}

export interface Rc1Step {
  date: string;
  active: boolean;
  target: FiveAllocation;
  /** Poids RÉELLEMENT détenus qui gagnent le rendement de CE mois (figés à t-1). */
  held: FiveAllocation;
  /** Rendement BRUT du portefeuille ce mois (poids détenus × rendements). */
  grossReturn: number;
  /** Turnover unidirectionnel exécuté ce mois = ½·Σ|détenu-dérivé − exécuté| ; null = constitution. */
  turnover: number | null;
  /** Niveau du cash (pour le taux sans risque réel). */
  cash: number;
}

export type Rc1Status = "OK" | "MISSING_SERIES" | "INSUFFICIENT_HISTORY" | "NON_CONTIGUOUS_HISTORY";

export interface Rc1Path {
  status: Rc1Status;
  countryCode: string;
  start?: string;
  end?: string;
  steps: Rc1Step[];
  /** Position COURANTE (poids EXÉCUTÉS post-bande au dernier mois disposant d'une cible). */
  finalHeld?: FiveAllocation;
  /** Cible du dernier mois signalé (avant bande). */
  finalTarget?: FiveAllocation;
  firstInvalidMonth?: string | null;
}

const A5 = ["equities", "bonds", "gold", "cash", "energy"] as const;
const monthKey = (d: string): string => d.slice(0, 7);
const nextMonth = (ym: string): string => {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const half5 = (a: FiveAllocation, b: FiveAllocation): number =>
  0.5 * A5.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);

interface Row {
  m: string;
  date: string;
  eq: number;
  bd: number;
  ca: number;
  go: number;
  en: number;
}

function toMonthly(d: DataPoint[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of [...d].sort((a, b) => a.date.localeCompare(b.date))) map.set(monthKey(p.date), p.value);
  return map;
}

/** Lignes valides (5 séries présentes, finies, > 0) sur les mois de la série actions (spine). */
function buildRows(input: Rc1Input): { rows: Row[]; gap: string | null } {
  const eq = toMonthly(input.equityTotalReturn);
  const bd = toMonthly(input.bondTotalReturn);
  const ca = toMonthly(input.cashTotalReturn);
  const go = toMonthly(input.gold);
  const en = toMonthly(input.energyLocal);
  const dateByMonth = new Map<string, string>();
  for (const p of [...input.equityTotalReturn].sort((a, b) => a.date.localeCompare(b.date)))
    dateByMonth.set(monthKey(p.date), p.date);

  const rows: Row[] = [];
  for (const [m, date] of [...dateByMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const e = eq.get(m), b = bd.get(m), c = ca.get(m), g = go.get(m), n = en.get(m);
    const ok = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v) && v > 0;
    if (ok(e) && ok(b) && ok(c) && ok(g) && ok(n)) rows.push({ m, date, eq: e, bd: b, ca: c, go: g, en: n });
  }
  return { rows, gap: null };
}

/** Poids dérivés (détenus après rendements du mois), renormalisés à 1. */
function drift(held: FiveAllocation, r: FiveAllocation): FiveAllocation {
  const gv = {
    equities: held.equities * (1 + r.equities),
    bonds: held.bonds * (1 + r.bonds),
    gold: held.gold * (1 + r.gold),
    cash: held.cash * (1 + r.cash),
    energy: held.energy * (1 + r.energy),
  };
  const tot = gv.equities + gv.bonds + gv.gold + gv.cash + gv.energy;
  if (!Number.isFinite(tot) || tot <= 0) throw new Error("Invalid portfolio value before rebalancing.");
  return {
    equities: gv.equities / tot,
    bonds: gv.bonds / tot,
    gold: gv.gold / tot,
    cash: gv.cash / tot,
    energy: gv.energy / tot,
  };
}

/**
 * Simule le portefeuille rc1 (chemin BRUT, indépendant des coûts : la bande décide sur
 * la rotation, pas sur le net). Renvoie les poids détenus/cibles + rendements bruts + turnover.
 */
export function simulateRc1(input: Rc1Input): Rc1Path {
  const { countryCode } = input;
  const w = input.energyWeight ?? ENERGY_WEIGHT_RC1;
  const band = input.reallocationBand ?? null;

  if (
    !input.equityTotalReturn.length || !input.bondTotalReturn.length ||
    !input.cashTotalReturn.length || !input.gold.length || !input.energyLocal.length
  )
    return { status: "MISSING_SERIES", countryCode, steps: [] };

  const { rows } = buildRows(input);
  if (rows.length < 2) return { status: "INSUFFICIENT_HISTORY", countryCode, steps: [] };

  // Cibles 5 poches par mois (base v2 + signal). Invariant : somme = 1.
  const targetByMonth = new Map<string, FiveAllocation>();
  for (const [m, base] of input.baseByMonth) {
    const active = input.signalByMonth.get(m) ?? false; // indisponible → inactif (Énergie 0)
    const t = buildFivePocketTarget(base, active, w);
    if (Math.abs(allocationSum(t) - 1) > 1e-9) throw new Error(`target sum ≠ 1 at ${m}`);
    targetByMonth.set(m, t);
  }

  // Premier mois disposant d'une cible.
  const start = rows.findIndex((r) => targetByMonth.has(r.m));
  if (start < 0 || start >= rows.length - 1) return { status: "INSUFFICIENT_HISTORY", countryCode, steps: [] };

  // Garde-fou contiguïté sur la plage consommée [start … dernière cible+1].
  const lastTargetMonth = [...targetByMonth.keys()].reduce((a, b) => (a > b ? a : b));
  const lastRowMonth = rows[rows.length - 1].m;
  const endMonth = lastRowMonth < nextMonth(lastTargetMonth) ? lastRowMonth : nextMonth(lastTargetMonth);
  const present = new Set(rows.map((r) => r.m));
  for (let m = rows[start].m; ; m = nextMonth(m)) {
    if (!present.has(m)) return { status: "NON_CONTIGUOUS_HISTORY", countryCode, steps: [], firstInvalidMonth: m };
    if (m === endMonth) break;
  }

  const steps: Rc1Step[] = [];
  let held: FiveAllocation = targetByMonth.get(rows[start].m)!;
  // Position courante exposée : poids EXÉCUTÉS + cible du dernier mois signalé (comme le moteur).
  let latestHeld: FiveAllocation = held;
  let latestTarget: FiveAllocation = held;
  steps.push({
    date: rows[start].date,
    active: held.energy > 0,
    target: held,
    held,
    grossReturn: 0,
    turnover: null, // constitution initiale
    cash: rows[start].ca,
  });

  for (let j = start + 1; j < rows.length; j++) {
    if (!targetByMonth.has(rows[j - 1].m)) continue;
    const p = rows[j - 1], c = rows[j];
    const r: FiveAllocation = {
      equities: c.eq / p.eq - 1,
      bonds: c.bd / p.bd - 1,
      gold: c.go / p.go - 1,
      cash: c.ca / p.ca - 1,
      energy: c.en / p.en - 1,
    };
    const grossReturn =
      held.equities * r.equities + held.bonds * r.bonds + held.gold * r.gold + held.cash * r.cash + held.energy * r.energy;
    const heldThisMonth = held; // poids qui ont gagné le rendement de ce mois
    const drifted = drift(held, r);
    const target = targetByMonth.get(c.m);
    let turnover: number | null = null;
    let executed: FiveAllocation = drifted;
    if (target) {
      if (band !== null && half5(target, drifted) <= band) {
        executed = drifted; // conservé (aucune transaction)
        turnover = 0;
      } else {
        turnover = half5(target, drifted);
        executed = target; // réallocation pleine
      }
      latestHeld = executed; // position exécutée au dernier mois signalé
      latestTarget = target;
    }
    steps.push({
      date: c.date,
      active: (target ?? heldThisMonth).energy > 0,
      target: target ?? drifted,
      held: heldThisMonth,
      grossReturn,
      turnover,
      cash: c.ca,
    });
    held = executed;
  }

  return { status: "OK", countryCode, start: rows[start].date, end: rows[rows.length - 1].date, steps, finalHeld: latestHeld, finalTarget: latestTarget };
}

// ─── Mesures NET de coûts sur une fenêtre ────────────────────────────────────

export interface Rc1Metrics {
  months: number;
  realCAGR: number | null;
  realVol: number | null;
  realSharpe: number | null;
  realMDD: number | null;
  underwater: number | null;
  /** Rotation annualisée (turnover unidirectionnel × 12). */
  rotation: number;
  /** Fréquence de réallocation (part des mois avec turnover > 0,5 %) × 12. */
  reallocFreq: number;
  /** Part des mois où l'Énergie est activement détenue. */
  activationRate: number;
  /** Poids Énergie moyen effectivement DÉTENU. */
  meanEnergyHeld: number;
  /** Coût cumulé payé (fraction, ×100 = %). */
  totalCost: number;
}

const EPS_REALLOC = 0.005;

function computeCagrVol(index: DataPoint[]): { cagr: number | null; vol: number | null } {
  const n = index.length;
  let cagr: number | null = null;
  if (n >= 2 && index[0].value > 0 && index[n - 1].value > 0) {
    const years = (n - 1) / 12;
    cagr = years > 0 ? (Math.pow(index[n - 1].value / index[0].value, 1 / years) - 1) * 100 : null;
  }
  let vol: number | null = null;
  if (n >= 3) {
    const rets: number[] = [];
    for (let i = 1; i < n; i++) if (index[i - 1].value !== 0) rets.push(index[i].value / index[i - 1].value - 1);
    if (rets.length >= 2) {
      const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
      const variance = rets.reduce((s, v) => s + (v - mean) ** 2, 0) / (rets.length - 1);
      vol = Math.sqrt(variance) * Math.sqrt(12) * 100;
    }
  }
  return { cagr, vol };
}
function maxDrawdown(index: DataPoint[]): number | null {
  if (index.length < 2) return null;
  let peak = -Infinity, mdd = 0;
  for (const p of index) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) mdd = Math.min(mdd, (p.value / peak - 1) * 100);
  }
  return mdd;
}
function maxUnderwater(index: DataPoint[]): number | null {
  if (index.length < 2) return null;
  let peak = -Infinity, run = 0, mx = 0;
  for (const p of index) {
    if (p.value >= peak) { peak = p.value; run = 0; } else { run += 1; mx = Math.max(mx, run); }
  }
  return mx;
}
function deflate(index: DataPoint[], cpi: Map<string, number>): DataPoint[] | null {
  const pts = index
    .map((p) => ({ date: p.date, v: p.value, c: cpi.get(monthKey(p.date)) }))
    .filter((x): x is { date: string; v: number; c: number } => x.c !== undefined && x.c > 0);
  if (pts.length < 2) return null;
  const v0 = pts[0].v, c0 = pts[0].c;
  return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c / c0) }));
}

/**
 * Mesure NET de coûts sur la sous-fenêtre `[fromIdx, toIdx)` du chemin. Coûts au
 * compounding (net = brut − coût·2·turnover). Sharpe réel = excédent sur le cash réel.
 */
export function measureRc1(
  path: Rc1Path,
  from: number,
  to: number,
  costBps: number,
  cpi?: DataPoint[],
): Rc1Metrics | null {
  if (path.status !== "OK" || to - from < 3) return null;
  const steps = path.steps;
  const cost = costBps / 10000;
  let p = 100;
  const nominal: DataPoint[] = [{ date: steps[from].date, value: 100 }];
  const cashIdx: DataPoint[] = [{ date: steps[from].date, value: steps[from].cash }];
  const turns: number[] = [];
  let energyHeldSum = 0, activeMonths = 0, count = 0, totalCost = 0;
  for (let i = from + 1; i < to; i++) {
    const turn = steps[i].turnover ?? 0;
    const c = cost * 2 * turn;
    p *= 1 + (steps[i].grossReturn - c);
    totalCost += c;
    nominal.push({ date: steps[i].date, value: p });
    cashIdx.push({ date: steps[i].date, value: steps[i].cash });
    turns.push(turn);
    energyHeldSum += steps[i].held.energy;
    if (steps[i].held.energy > 1e-9) activeMonths += 1;
    count += 1;
  }
  if (nominal.length < 2) return null;
  const cpiMap = cpi?.length ? new Map(toMonthly(cpi)) : null;
  const real = cpiMap ? deflate(nominal, cpiMap) : null;
  const cashReal = cpiMap ? deflate(cashIdx, cpiMap) : null;
  const rk = real ? computeCagrVol(real) : { cagr: null, vol: null };
  const rf = cashReal ? computeCagrVol(cashReal).cagr ?? 0 : 0;
  const meanTurn = turns.length ? turns.reduce((s, v) => s + v, 0) / turns.length : 0;
  return {
    months: nominal.length,
    realCAGR: rk.cagr,
    realVol: rk.vol,
    realSharpe: rk.cagr != null && rk.vol ? (rk.cagr - rf) / rk.vol : null,
    realMDD: real ? maxDrawdown(real) : null,
    underwater: real ? maxUnderwater(real) : null,
    rotation: meanTurn * 12,
    reallocFreq: turns.length ? (turns.filter((v) => v > EPS_REALLOC).length / turns.length) * 12 : 0,
    activationRate: count ? activeMonths / count : 0,
    meanEnergyHeld: count ? energyHeldSum / count : 0,
    totalCost: totalCost * 100,
  };
}

/** Épisodes d'activation (mois où la CIBLE Énergie > 0), fusion des trous ≤ `gap`. */
export function activationEpisodes(path: Rc1Path, gap = 1): Array<{ from: string; to: string; months: number }> {
  const active = path.steps.filter((s) => s.target.energy > 1e-9).map((s) => monthKey(s.date));
  if (!active.length) return [];
  const idx = (ym: string) => Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1);
  const eps: Array<{ from: string; to: string; months: number }> = [];
  let s = active[0], prev = active[0], n = 1;
  for (let i = 1; i < active.length; i++) {
    if (idx(active[i]) - idx(prev) <= gap) { prev = active[i]; n += 1; }
    else { eps.push({ from: s, to: prev, months: n }); s = active[i]; prev = active[i]; n = 1; }
  }
  eps.push({ from: s, to: prev, months: n });
  return eps;
}
