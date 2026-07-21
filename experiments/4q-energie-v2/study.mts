// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE ÉNERGIE v2 — poche SPDYENT pilotée par le QUADRANT MONDIAL (LECTURE SEULE).
//
// Hypothèse nouvelle vs étude v1 (close en non-intégration) :
//   • actif = S&P GSCI Energy Dynamic Roll TR (`SPDYENT`, VRAIE matière première roulée,
//     ≠ actions énergie MXWO0EN) ;
//   • activation MONDIALE : coords (x_w,y_w) = ln(MXWO/CL1), ln(XAU/GT10) en USD via le
//     MÊME buildModel que les pays. SPDYENT n'entre JAMAIS dans le signal.
//
// Témoin = 4q-standard-v2 (bande δ=5) SANS énergie, énergie passée à poids 0 → MÊME
// fenêtre que le traitement. Bande v2 appliquée à l'allocation COMPLÈTE (5 poches) après
// ajout de la cible Énergie. t→t+1. Coûts INTÉGRÉS au compounding (convention étude 2/v2).
//
//   pnpm exec tsx experiments/4q-energie-v2/study.mts          (complet)
//   CALIB=1 pnpm exec tsx experiments/4q-energie-v2/study.mts  (US, validation)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const db: any = await imp("src/lib/coredata/db.ts");
const compute: any = await imp("src/lib/coredata/compute.ts");
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const fq: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const { buildModel, backtestQuadrants, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = fq;
const { computeKpis } = compute;

const CALIB = process.env.CALIB === "1";
const BAND: number = REALLOCATION_BAND.v2; // 0.05 (δ=5 pts) — socle v2

// ─── Espace de paramètres ────────────────────────────────────────────────────
const W_MAX = [0.05, 0.1, 0.15, 0.2, 0.25]; // poids max Énergie (témoin = 0)
const T_E = [0, 10, 20, 30, 40]; // seuil d'activation sur coords MONDIALES
const SHAPES = ["step", "ramp"] as const; // fixe / progressive selon l'intensité mondiale
const FIN = ["prorata", "boombloc"] as const; // prorata 4 poches / bloc-boom (actions+or)
const STRATS = CALIB ? (["dynamic"] as const) : (["dynamic", "binary"] as const);
const T_MODEL = 20; // zone neutre (défaut production)
const HORIZONS: Array<{ key: string; years: number | null; fromDate?: string }> = [
  { key: "Max", years: null },
  { key: "20A", years: 20 },
  { key: "10A", years: 10 },
  { key: "5A", years: 5 },
  { key: "Live", years: null, fromDate: "2011-02" }, // post-lancement (inception 2011-01-27)
];
const COSTS = [0, 10, 25, 50];
const EPS = 0.005; // seuil « réallocation effective » (turnover mensuel > 0,5 %)

const WORLD = {
  equity: "MXWO Index-XX-1-1", // MSCI World PRIX (ty1)
  oil: "CL1 comdty-XX-5-1",
  gold: "XAU Comdty-XX-5-1",
  bond: "GT10 Govt-US-4-2", // US 10Y TR (proxy duration Monde)
};
const ENERGY_ID = "SPDYENT Index-XX-5-2";
const EXCLUDE = new Set(["DK"]); // signal ~21 mois → bruit

type Shape = (typeof SHAPES)[number];
type Fin = (typeof FIN)[number];
type Core = { equities: number; bonds: number; gold: number; cash: number };
type Final = Core & { energy: number };
type DP = { date: string; value: number };

// ─── Stats de robustesse ─────────────────────────────────────────────────────
function quantile(arr: number[], p: number): number {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo);
}
const median = (a: number[]) => quantile(a, 0.5);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
function worstDecile(a: number[]): number {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return NaN;
  const n = Math.max(1, Math.round(s.length * 0.1));
  return mean(s.slice(0, n));
}

// ─── Overlay Énergie piloté par le MONDE ─────────────────────────────────────
/** Fraction Énergie ∈ [0,1] : gate boom inflationniste mondial (x_w>0 ∧ y_w>0). */
function energyRaw(xw: number, yw: number, shape: Shape, tE: number): number {
  if (xw <= 0 || yw <= 0) return 0;
  const m = Math.min(xw, yw); // les DEUX axes mondiaux requis
  if (shape === "step") return m >= tE ? 1 : 0;
  if (m <= tE) return 0;
  return Math.min(1, (m - tE) / (100 - tE)); // ramp linéaire tE→100
}

/** Finance le poids Énergie `e` ; somme des 5 poches = 1, jamais négatif. */
function finance(base: Core, e0: number, method: Fin): Final {
  const e = Math.max(0, Math.min(0.95, e0));
  if (e === 0) return { ...base, energy: 0 };
  if (method === "prorata") {
    const k = 1 - e;
    return { equities: base.equities * k, bonds: base.bonds * k, gold: base.gold * k, cash: base.cash * k, energy: e };
  }
  // boombloc : prélève sur actions+or (poches du boom inflationniste) ; repli prorata si vide.
  const s = base.equities + base.gold;
  if (s <= 1e-9) {
    const k = 1 - e;
    return { equities: base.equities * k, bonds: base.bonds * k, gold: base.gold * k, cash: base.cash * k, energy: e };
  }
  const eEff = Math.min(e, s);
  const k = 1 - eEff / s;
  return { equities: base.equities * k, bonds: base.bonds, gold: base.gold * k, cash: base.cash, energy: eEff };
}

// ─── Reconstruction du chemin net (coûts au compounding) depuis le backtest ──
interface MonthStep { date: string; rp: number; turn: number; cash: number }
/** Chemin mensuel (rendement brut, turnover, niveau cash) depuis un BacktestResult OK. */
function reconstructPath(bt: any): MonthStep[] {
  const nom: DP[] = bt.series.nominal;
  const turnByDate = new Map<string, number>(bt.turnover.monthly.map((t: any) => [t.date, t.turnover ?? 0]));
  const cashByDate = new Map<string, number>(bt.series.sleeves.cash.map((p: any) => [p.date, p.value]));
  return nom.map((p, i) => ({
    date: p.date,
    rp: i === 0 ? 0 : p.value / nom[i - 1].value - 1,
    turn: turnByDate.get(p.date) ?? 0,
    cash: cashByDate.get(p.date) ?? NaN,
  }));
}

function maxDD(idx: DP[]): number { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function underwater(idx: DP[]): number { let pk = -Infinity, run = 0, mx = 0; for (const p of idx) { if (p.value >= pk) { pk = p.value; run = 0; } else { run++; if (run > mx) mx = run; } } return mx; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null {
  const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(p.date.slice(0, 7)) })).filter((x) => x.c! > 0);
  if (pts.length < 2) return null;
  const v0 = pts[0].v, c0 = pts[0].c!;
  return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) }));
}

interface Metrics { realCAGR: number | null; realVol: number | null; realSharpe: number | null; realMDD: number | null; underwater: number | null; rotation: number; reallocFreq: number; months: number }
/** Mesure NET de coûts sur [from,to[ du chemin (coûts dans le compounding). */
function measure(pathArr: MonthStep[], cpi: Map<string, number>, from: number, to: number, bps: number): Metrics | null {
  if (to - from < 2) return null;
  const cost = bps / 10000;
  let p = 100;
  const nominal: DP[] = [{ date: pathArr[from].date, value: 100 }];
  const cashIdx: DP[] = [{ date: pathArr[from].date, value: pathArr[from].cash }];
  const turns: number[] = [];
  for (let i = from + 1; i < to; i++) {
    const net = pathArr[i].rp - cost * 2 * pathArr[i].turn; // coût sur volume brut = 2·turnover
    p *= 1 + net;
    nominal.push({ date: pathArr[i].date, value: p });
    cashIdx.push({ date: pathArr[i].date, value: pathArr[i].cash });
    turns.push(pathArr[i].turn);
  }
  if (nominal.length < 2) return null;
  const real = deflate(nominal, cpi);
  const realK = real ? computeKpis(real) : null;
  const cashReal = deflate(cashIdx, cpi);
  const rfReal = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;
  const sharpe = realK && realK.annualized != null && realK.volatility ? (realK.annualized - rfReal) / realK.volatility : null;
  const meanTurn = turns.length ? turns.reduce((s, v) => s + v, 0) / turns.length : 0;
  return {
    realCAGR: realK?.annualized ?? null,
    realVol: realK?.volatility ?? null,
    realSharpe: sharpe,
    realMDD: real ? maxDD(real) : null,
    underwater: real ? underwater(real) : null,
    rotation: meanTurn * 12,
    reallocFreq: turns.length ? (turns.filter((v) => v > EPS).length / turns.length) * 12 : 0,
    months: nominal.length,
  };
}
function fromIndex(pathArr: MonthStep[], years: number | null): number {
  if (years == null) return 0;
  const last = pathArr[pathArr.length - 1].date;
  const cut = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`;
  for (let i = 0; i < pathArr.length; i++) if (pathArr[i].date >= cut) return i;
  return pathArr.length - 1;
}
function fromDateIdx(pathArr: MonthStep[], ym: string): number {
  for (let i = 0; i < pathArr.length; i++) if (pathArr[i].date.slice(0, 7) >= ym) return i;
  return pathArr.length - 1;
}
function windowStart(pathArr: MonthStep[], h: { years: number | null; fromDate?: string }): number {
  return h.fromDate ? fromDateIdx(pathArr, h.fromDate) : fromIndex(pathArr, h.years);
}

// ─── Chargement MONDE (coords partagées) ─────────────────────────────────────
console.error("Chargement du signal MONDE…");
const [wEq, wOil, wGold, wBond] = await Promise.all([
  db.getSeriesData(WORLD.equity), db.getSeriesData(WORLD.oil), db.getSeriesData(WORLD.gold), db.getSeriesData(WORLD.bond),
]);
const worldModel = buildModel(
  { countryCode: "WORLD", equityPrice: wEq, oil: wOil, gold: wGold, bond: wBond },
  { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: T_MODEL, energyMode: "disabled" },
);
if (worldModel.status !== "OK") { console.error("❌ Modèle MONDE:", worldModel.status); await db.coredataPool?.end?.(); process.exit(1); }
const worldCoords = new Map<string, { x: number; y: number }>();
for (const r of worldModel.monthlyResults) worldCoords.set(r.date.slice(0, 7), { x: r.x, y: r.y });

// ─── Chargement pays + Énergie locale ────────────────────────────────────────
console.error("Chargement des pays…");
const fxRates: any[] = await db.getFxRates();
// FX par clé de MOIS (dernière valeur du mois) → usdPerUnit. ⚠️ Conversion par MOIS
// (et non par date exacte comme `convertCurrency`) : les dates fin-de-mois de SPDYENT
// ne coïncident pas toujours avec celles des tables FX (l'or/pétrole, oui) — une
// jointure par date exacte jetterait ~109 mois et rendrait la série non contiguë.
const fxByMonth = new Map<string, Map<string, number>>();
for (const fx of fxRates) {
  const perDate = compute.usdPerUnitMap(fx.data, fx.reverse); // Map<date, usdPerUnit>
  const m = new Map<string, number>();
  for (const [date, v] of [...perDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) m.set(date.slice(0, 7), v);
  fxByMonth.set(fx.currency, m);
}
const energyUsd: DP[] = await db.getSeriesData(ENERGY_ID);
function toLocal(data: DP[], target: string): DP[] {
  if (!target || target === "USD") return data;
  const fx = fxByMonth.get(target);
  if (!fx) return data;
  const out: DP[] = [];
  for (const p of data) {
    const rate = fx.get(p.date.slice(0, 7)); // usdPerUnit du mois
    if (rate === undefined || rate === 0) continue;
    out.push({ date: p.date, value: p.value / rate }); // USD → devise locale
  }
  return out;
}

let isoList: Array<{ iso: string }> = await svc.listQuadrantCountries();
isoList = isoList.filter((c) => !EXCLUDE.has(c.iso));
if (CALIB) isoList = isoList.filter((c) => c.iso === "US");

interface Loaded { code: string; currency: string; signal: any; perf: any; energyLocal: DP[]; cpi: Map<string, number> }
const loaded: Loaded[] = [];
for (const { iso } of isoList) {
  const cm = await svc.getCountryQuadrantModel(iso);
  if (!cm.config || !cm.signal || !cm.perf) continue;
  const cpi = new Map<string, number>();
  for (const p of (cm.perf.cpi ?? []) as DP[]) cpi.set(p.date.slice(0, 7), p.value);
  loaded.push({ code: iso, currency: cm.config.currency, signal: cm.signal, perf: cm.perf, energyLocal: toLocal(energyUsd, cm.config.currency), cpi });
}
console.error(`  ${loaded.length} pays chargés.`);

// ─── Backtest d'une cellule (bt brut + chemin) ───────────────────────────────
function cellBacktest(l: Loaded, model: any, shape: Shape | null, tE: number, wMax: number, method: Fin): any {
  const weights = model.monthlyResults.map((r: any) => {
    const wc = worldCoords.get(r.date.slice(0, 7));
    const e = wMax === 0 || shape === null || !wc ? 0 : wMax * energyRaw(wc.x, wc.y, shape, tE);
    return { date: r.date, allocation: finance(r.baseAllocation, e, method) };
  });
  return backtestQuadrants({
    countryCode: l.code,
    weights,
    equityTotalReturn: l.perf.equityTotalReturn,
    bondTotalReturn: l.perf.bondTotalReturn,
    cashTotalReturn: l.perf.cashTotalReturn,
    gold: l.perf.gold,
    energyTotalReturn: l.energyLocal, // toujours passé → fenêtre commune témoin/traitement
    cpi: l.perf.cpi,
    windowYears: null, // Max ; les sous-fenêtres sont des tranches du chemin
    reallocationBand: BAND, // bande v2 sur l'allocation complète (5 poches)
  });
}
/** Part de mois actifs + bascules/an de l'Énergie sur [from,to[. */
function energyActivity(weights: any[], pathArr: MonthStep[], from: number, to: number): { share: number; switches: number } {
  const wByM = new Map<string, number>(weights.map((w: any) => [w.date.slice(0, 7), w.allocation.energy]));
  let active = 0, total = 0, sw = 0; let prev: boolean | null = null;
  for (let i = from; i < to; i++) {
    const on = (wByM.get(pathArr[i].date.slice(0, 7)) ?? 0) > 1e-9;
    total++; if (on) active++;
    if (prev !== null && on !== prev) sw++;
    prev = on;
  }
  return { share: total ? active / total : 0, switches: total > 1 ? sw / (total / 12) : 0 };
}

// ─── CALIBRATION ─────────────────────────────────────────────────────────────
if (CALIB) {
  console.error("\n══════════ CALIBRATION ══════════");
  // (a) MONDE : régime boom inflationniste
  let boom = 0, boomStrong = 0, n = 0;
  const recent: string[] = [];
  for (const r of worldModel.monthlyResults) {
    n++;
    if (r.x > 0 && r.y > 0) boom++;
    if (r.x > 20 && r.y > 20) boomStrong++;
  }
  for (const r of worldModel.monthlyResults.slice(-6)) recent.push(`${r.date.slice(0, 7)}(x${r.x.toFixed(0)},y${r.y.toFixed(0)})`);
  console.error(`MONDE : ${n} mois scorés ${worldModel.monthlyResults[0].date.slice(0, 7)}→${worldModel.latest.date.slice(0, 7)}`);
  console.error(`  boom inflationniste (x>0∧y>0) : ${(boom / n * 100).toFixed(1)} %  |  fort (>20,>20) : ${(boomStrong / n * 100).toFixed(1)} %`);
  console.error(`  6 derniers mois : ${recent.join(" ")}`);

  const l = loaded[0];
  const model = buildModel(l.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: T_MODEL, energyMode: "disabled" });

  // (b) témoin (énergie@0, bande v2) : reconstruction vs moteur (0 bps ⇒ net=brut)
  const btW = cellBacktest(l, model, null, 0, 0, "prorata");
  const pathW = reconstructPath(btW);
  const mW = measure(pathW, l.cpi, 0, pathW.length, 0);
  console.error(`\nTÉMOIN US (énergie@0, bande v2, ${btW.start}→${btW.end}, ${btW.metrics.nominal.months} mois) :`);
  console.error(`  realCAGR : reconstruction ${mW?.realCAGR?.toFixed(3)} % vs moteur ${btW.metrics.real?.annualized?.toFixed(3)} %  → ${Math.abs((mW!.realCAGR ?? 0) - (btW.metrics.real?.annualized ?? 0)) < 1e-6 ? "✅ identique" : "⚠️ écart"}`);
  console.error(`  rotation : reconstruction ${(mW!.rotation * 100).toFixed(2)} % vs moteur ${(btW.turnover.annualized * 100).toFixed(2)} %`);

  // (c) effet bande : v2 vs v1 (sans énergie)
  const weightsNoE = model.monthlyResults.map((r: any) => ({ date: r.date, allocation: finance(r.baseAllocation, 0, "prorata") }));
  const btV1 = backtestQuadrants({ countryCode: l.code, weights: weightsNoE, ...l.perf, energyTotalReturn: l.energyLocal, windowYears: null, reallocationBand: null });
  console.error(`  bande v2 rotation ${(btW.turnover.annualized * 100).toFixed(1)} % vs v1 ${(btV1.turnover.annualized * 100).toFixed(1)} % → effet bande ${((btW.turnover.annualized / btV1.turnover.annualized - 1) * 100).toFixed(0)} %`);

  // (d) socle production (getCountryQuadrantModel = v2, sans énergie, fenêtre complète)
  const prod = await svc.getCountryQuadrantModel("US");
  console.error(`\nSOCLE PROD US v2 (sans énergie, ${prod.backtest.start}→${prod.backtest.end}, ${prod.backtest.metrics.nominal.months} mois) : realCAGR ${prod.backtest.metrics.real?.annualized?.toFixed(2)} %, rotation ${(prod.backtest.turnover.annualized * 100).toFixed(1)} %`);
  console.error("  (fenêtre plus longue que le témoin car sans contrainte Énergie 1995→ — normal)");

  // (e) échantillon Énergie
  const btE = cellBacktest(l, model, "step", 20, 0.15, "prorata");
  const pathE = reconstructPath(btE);
  const mE = measure(pathE, l.cpi, 0, pathE.length, 25);
  const wE = btE.status === "OK" ? cellBacktest(l, model, "step", 20, 0.15, "prorata") : null;
  const act = energyActivity(wE.status === "OK" ? (model.monthlyResults.map((r: any) => { const wc = worldCoords.get(r.date.slice(0, 7)); const e = wc ? 0.15 * energyRaw(wc.x, wc.y, "step", 20) : 0; return { date: r.date, allocation: finance(r.baseAllocation, e, "prorata") }; })) : [], pathE, 0, pathE.length);
  console.error(`\nÉCHANTILLON US dyn step T_E=20 w=15% prorata (net 25 bps, Max) :`);
  console.error(`  realCAGR ${mE?.realCAGR?.toFixed(2)} % (témoin ${measure(pathW, l.cpi, 0, pathW.length, 25)?.realCAGR?.toFixed(2)} %), Sharpe ${mE?.realSharpe?.toFixed(3)}, MDD ${mE?.realMDD?.toFixed(1)} %`);
  console.error(`  contrib Énergie (Max, brut) ${btE.contributions?.energy?.toFixed(1)} %, part active ${(act.share * 100).toFixed(0)} %, bascules ${act.switches.toFixed(1)}/an, rotation ${(mE!.rotation * 100).toFixed(0)} %/an`);

  await db.coredataPool?.end?.();
  console.error("\n✅ Calibration terminée.");
  process.exit(0);
}

// ─── BALAYAGE COMPLET ────────────────────────────────────────────────────────
interface AggKey { strategy: string; horizon: string; cost: number; shape: Shape; fin: Fin; wMax: number; tE: number }
interface AggRow extends AggKey {
  n: number;
  dCAGR: { med: number; q1: number; q3: number; worst: number; pImp: number };
  dSharpe: { med: number; q1: number; q3: number; worst: number; pImp: number };
  dMDD: { med: number; worst: number }; // signé : + = MDD moins profond (meilleur)
  dRot: { med: number }; // pts (fraction)
  absCAGR: number; absSharpe: number;
  energyShare: number; energySwitches: number; energyContrib: number;
  reallocFreq: number; // du traitement (médiane, /an)
}
const rows: AggRow[] = [];
const t0 = Date.now();
let btCount = 0;

for (const strategy of STRATS) {
  const models = loaded.map((l) => ({ l, model: buildModel(l.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: T_MODEL, energyMode: "disabled" }) }))
    .filter((m) => m.model.status === "OK");

  // 1) Chemins : témoin + chaque cellule (backtest une fois, mesuré sur tous horizons/coûts).
  interface CellPaths { path: MonthStep[]; weights: any[] }
  const witness = new Map<string, CellPaths>();
  const cells = new Map<string, Map<string, CellPaths>>(); // cellKey → (country → paths)
  for (const { l, model } of models) {
    const btW = cellBacktest(l, model, null, 0, 0, "prorata"); btCount++;
    if (btW.status === "OK") witness.set(l.code, { path: reconstructPath(btW), weights: [] });
    for (const shape of SHAPES) for (const fin of FIN) for (const wMax of W_MAX) for (const tE of T_E) {
      const key = `${shape}|${fin}|${wMax}|${tE}`;
      const weights = model.monthlyResults.map((r: any) => {
        const wc = worldCoords.get(r.date.slice(0, 7));
        const e = wc ? wMax * energyRaw(wc.x, wc.y, shape, tE) : 0;
        return { date: r.date, allocation: finance(r.baseAllocation, e, fin) };
      });
      const bt = backtestQuadrants({ countryCode: l.code, weights, equityTotalReturn: l.perf.equityTotalReturn, bondTotalReturn: l.perf.bondTotalReturn, cashTotalReturn: l.perf.cashTotalReturn, gold: l.perf.gold, energyTotalReturn: l.energyLocal, cpi: l.perf.cpi, windowYears: null, reallocationBand: BAND });
      btCount++;
      if (bt.status !== "OK") continue;
      if (!cells.has(key)) cells.set(key, new Map());
      cells.get(key)!.set(l.code, { path: reconstructPath(bt), weights });
    }
  }

  // 2) Agrégation par horizon × coût × cellule.
  for (const horizon of HORIZONS) {
    for (const cost of COSTS) {
      // témoin par pays
      const refByCode = new Map<string, Metrics>();
      for (const [code, cp] of witness) {
        const from = windowStart(cp.path, horizon);
        const m = measure(cp.path, loaded.find((l) => l.code === code)!.cpi, from, cp.path.length, cost);
        if (m && m.realCAGR != null) refByCode.set(code, m);
      }
      for (const shape of SHAPES) for (const fin of FIN) for (const wMax of W_MAX) for (const tE of T_E) {
        const key = `${shape}|${fin}|${wMax}|${tE}`;
        const cellMap = cells.get(key);
        if (!cellMap) continue;
        const dC: number[] = [], dS: number[] = [], dM: number[] = [], dR: number[] = [], absC: number[] = [], absS: number[] = [];
        const shareA: number[] = [], swA: number[] = [], contribA: number[] = [], freqA: number[] = [];
        let impC = 0, impS = 0, nS = 0, n = 0;
        for (const [code, cp] of cellMap) {
          const r0 = refByCode.get(code);
          if (!r0) continue;
          const l = loaded.find((x) => x.code === code)!;
          const from = windowStart(cp.path, horizon);
          const c = measure(cp.path, l.cpi, from, cp.path.length, cost);
          if (!c || c.realCAGR == null) continue;
          n++;
          dC.push(c.realCAGR - r0.realCAGR!); if (c.realCAGR - r0.realCAGR! > 0) impC++;
          if (c.realSharpe != null && r0.realSharpe != null) { nS++; dS.push(c.realSharpe - r0.realSharpe); if (c.realSharpe - r0.realSharpe > 0) impS++; }
          dM.push((c.realMDD ?? 0) - (r0.realMDD ?? 0));
          dR.push(c.rotation - r0.rotation);
          absC.push(c.realCAGR); if (c.realSharpe != null) absS.push(c.realSharpe);
          freqA.push(c.reallocFreq);
          const act = energyActivity(cp.weights, cp.path, from, cp.path.length);
          shareA.push(act.share); swA.push(act.switches);
          contribA.push(horizon.key === "Max" ? (0) : 0); // contrib détaillée = Max only (ci-dessous)
        }
        if (!n) continue;
        rows.push({
          strategy, horizon: horizon.key, cost, shape, fin, wMax, tE, n,
          dCAGR: { med: median(dC), q1: quantile(dC, 0.25), q3: quantile(dC, 0.75), worst: worstDecile(dC), pImp: impC / n },
          dSharpe: { med: median(dS), q1: quantile(dS, 0.25), q3: quantile(dS, 0.75), worst: worstDecile(dS), pImp: nS ? impS / nS : NaN },
          dMDD: { med: median(dM), worst: quantile(dM, 0.1) },
          dRot: { med: median(dR) },
          absCAGR: median(absC), absSharpe: median(absS),
          energyShare: median(shareA), energySwitches: median(swA), energyContrib: 0,
          reallocFreq: median(freqA),
        });
      }
    }
  }
  console.error(`  ${strategy} — ${btCount} backtests, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

console.error(`\nTerminé : ${btCount} backtests, ${rows.length} cellules agrégées, ${((Date.now() - t0) / 1000).toFixed(0)}s.`);
writeFileSync(path.join(HERE, "results.json"), JSON.stringify(rows, null, 0));
console.error("Écrit : results.json");

// ─── Top cellules (dynamique, net 25 bps) : Max ET Live ──────────────────────
function topSlice(strategy: string, horizon: string, cost: number, label: string) {
  const s = rows.filter((r) => r.strategy === strategy && r.horizon === horizon && r.cost === cost)
    .sort((a, b) => b.dSharpe.med - a.dSharpe.med).slice(0, 10);
  console.error(`\n── TOP ΔSharpe — ${label} (${strategy}, net ${cost} bps) ──`);
  console.error("  shape/fin  T_E  w%  | ΔSharpe méd [q1/q3/pire] %imp | ΔCAGR méd %imp | ΔMDD méd | partÉ | fréq/an");
  for (const r of s) {
    console.error(`  ${(r.shape + "/" + r.fin).padEnd(14)} ${String(r.tE).padStart(2)} ${(r.wMax * 100).toFixed(0).padStart(2)} | ${r.dSharpe.med >= 0 ? "+" : ""}${r.dSharpe.med.toFixed(3)} [${r.dSharpe.q1.toFixed(3)}/${r.dSharpe.q3.toFixed(3)}/${r.dSharpe.worst.toFixed(3)}] ${(r.dSharpe.pImp * 100).toFixed(0)}% | ${r.dCAGR.med >= 0 ? "+" : ""}${r.dCAGR.med.toFixed(3)} ${(r.dCAGR.pImp * 100).toFixed(0)}% | ${r.dMDD.med >= 0 ? "+" : ""}${r.dMDD.med.toFixed(1)} | ${(r.energyShare * 100).toFixed(0)}% | ${r.reallocFreq.toFixed(1)}`);
  }
}
topSlice("dynamic", "Max", 25, "HISTORIQUE COMPLET (Max)");
topSlice("dynamic", "Live", 25, "POST-LANCEMENT (2011→)");
topSlice("binary", "Max", 25, "CONTRÔLE binaire — Max");

await db.coredataPool?.end?.();
console.error("\n✅ Étude terminée.");
