// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE ÉNERGIE v2 — SPÉCIFICATION CANONIQUE (Yann, exacte). LECTURE SEULE.
//
// Question UNIQUE : une poche Énergie FIXE, activée par le boom inflationniste du
// quadrant MONDE (strict : xWorld>T ET yWorld>T), financée AU PRORATA des 4 poches
// nationales, améliore-t-elle ROBUSTEMENT `4q-standard-v2` ?
//
// Contraintes verrouillées :
//  • allocation nationale = v2 (dynamique/binaire, T_national) — le quadrant Monde NE
//    remplace JAMAIS le quadrant national ; il ne pilote QUE l'activation Énergie ;
//  • quadrant Monde = buildModel({MXWO prix, CL1, XAU, GT10}, USD) — MÊME pipeline ;
//  • SPDYENT = actif investi (converti en devise locale, même méthode que l'or) ;
//    n'entre JAMAIS dans le signal ; jamais remplacé par CL1/MSCI World Energy ;
//  • cible 5 poches = [(1-e)A,(1-e)O,(1-e)G,(1-e)C, e] quand actif, sinon [A,O,G,C,0] ;
//  • bande v2 (δ=5) appliquée UNE SEULE FOIS sur les 5 poches ; t→t+1 ;
//  • coûts intégrés au compounding (convention étude 2) ; rotation = trades exécutés.
//  • PAS de : ramp, boombloc, hystérésis, signal SPDYENT, param par pays.
//
// Réf : T_world=20, w=10 %. Grille : T_world∈{0,10,20,30,40,50}, w∈{0,5,10,15,20,25}%.
// w=0 % reproduit EXACTEMENT v2 (auto-vérif). Principal : dynamique/T20/25 bps.
// Contrôles : binaire, T_national∈{0,50}, coûts {0,10,50}.
//   pnpm exec tsx experiments/4q-energie-v2/canonical.mts
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
const { buildModel, backtestQuadrants, weightsFromModel, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = fq;
const { computeKpis } = compute;
const BAND: number = REALLOCATION_BAND.v2; // 0.05

// ── Paramètres canoniques ────────────────────────────────────────────────────
const T_WORLD = [0, 10, 20, 30, 40, 50];
const W = [0, 0.05, 0.1, 0.15, 0.2, 0.25];
const COSTS = [0, 10, 25, 50];
const LAUNCH = "2011-02"; // inception S&P GSCI Dynamic Roll = 2011-01-27
const HORIZONS: Array<{ key: string; years: number | null; from?: string }> = [
  { key: "Max", years: null }, { key: "20A", years: 20 }, { key: "10A", years: 10 }, { key: "5A", years: 5 }, { key: "Live", years: null, from: LAUNCH },
];
const BUCKETS: Array<{ key: string; from: string; to: string }> = [
  { key: "95-00", from: "1995-01", to: "2000-12" }, { key: "01-05", from: "2001-01", to: "2005-12" }, { key: "06-10", from: "2006-01", to: "2010-12" },
  { key: "11-15", from: "2011-01", to: "2015-12" }, { key: "16-20", from: "2016-01", to: "2020-12" }, { key: "21-26", from: "2021-01", to: "2026-12" },
];
const ARMS = [
  { key: "dyn·T20", strategy: "dynamic", T: 20, main: true },
  { key: "bin·T20", strategy: "binary", T: 20, main: false },
  { key: "dyn·T0", strategy: "dynamic", T: 0, main: false },
  { key: "dyn·T50", strategy: "dynamic", T: 50, main: false },
];
const REF = { tW: 20, w: 0.1 };

type Core = { equities: number; bonds: number; gold: number; cash: number };
type Alloc5 = Core & { energy: number };
type DP = { date: string; value: number };
const A5 = ["equities", "bonds", "gold", "cash", "energy"] as const;

// ── Stats ────────────────────────────────────────────────────────────────────
const q = (arr: number[], p: number) => { const a = arr.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const worstDecile = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const n = Math.max(1, Math.round(s.length * 0.1)); return mean(s.slice(0, n)); };

// ── Gate MONDE (canonique, strict) ───────────────────────────────────────────
const worldActive = (x: number, y: number, tW: number) => x > tW && y > tW;

// ── Simulation 5 poches : bande UNE fois, coûts au compounding ────────────────
interface Row { m: string; date: string; eq: number; bd: number; ca: number; go: number; en: number }
interface Step { date: string; rp: number; turn: number; cash: number; heldEnergy: number; enContrib: number }
const half5 = (a: Alloc5, b: Alloc5) => 0.5 * A5.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);
function simulate(targets: Map<string, Alloc5>, rows: Row[], band: number): Step[] {
  const start = rows.findIndex((r) => targets.has(r.m));
  if (start < 0 || start >= rows.length - 1) return [];
  let held: Alloc5 = targets.get(rows[start].m)!;
  const out: Step[] = [{ date: rows[start].date, rp: 0, turn: 0, cash: rows[start].ca, heldEnergy: held.energy, enContrib: 0 }];
  for (let t = start + 1; t < rows.length; t++) {
    if (!targets.has(rows[t - 1].m)) continue;
    const p = rows[t - 1], c = rows[t];
    const rEq = c.eq / p.eq - 1, rBd = c.bd / p.bd - 1, rCa = c.ca / p.ca - 1, rGo = c.go / p.go - 1, rEn = c.en / p.en - 1;
    const rp = held.equities * rEq + held.bonds * rBd + held.cash * rCa + held.gold * rGo + held.energy * rEn;
    const enContrib = held.energy * rEn, heldEnergy = held.energy;
    const gv = { equities: held.equities * (1 + rEq), bonds: held.bonds * (1 + rBd), cash: held.cash * (1 + rCa), gold: held.gold * (1 + rGo), energy: held.energy * (1 + rEn) };
    const tot = gv.equities + gv.bonds + gv.cash + gv.gold + gv.energy;
    const drifted: Alloc5 = { equities: gv.equities / tot, bonds: gv.bonds / tot, cash: gv.cash / tot, gold: gv.gold / tot, energy: gv.energy / tot };
    const target = targets.get(rows[t].m) ?? drifted;
    const post: Alloc5 = band > 0 ? (half5(target, drifted) <= band ? drifted : target) : target;
    out.push({ date: c.date, rp, turn: half5(post, drifted), cash: c.ca, heldEnergy, enContrib });
    held = post;
  }
  return out;
}

// ── Mesures net de coûts sur une fenêtre ─────────────────────────────────────
function maxDD(idx: DP[]): number { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function underwater(idx: DP[]): number { let pk = -Infinity, run = 0, mx = 0; for (const p of idx) { if (p.value >= pk) { pk = p.value; run = 0; } else { run++; if (run > mx) mx = run; } } return mx; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null { const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(p.date.slice(0, 7)) })).filter((x) => x.c! > 0); if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c!; return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) })); }
const EPS = 0.005;
interface Metrics { realCAGR: number | null; realVol: number | null; realSharpe: number | null; realMDD: number | null; underwater: number | null; rotation: number; reallocFreq: number; meanEnergy: number; activation: number; energyContrib: number; months: number }
function measure(path: Step[], cpi: Map<string, number>, from: number, to: number, bps: number): Metrics | null {
  if (to - from < 3) return null;
  const cost = bps / 10000; let p = 100;
  const nominal: DP[] = [{ date: path[from].date, value: 100 }];
  const cashIdx: DP[] = [{ date: path[from].date, value: path[from].cash }];
  const turns: number[] = []; let enC = 0, enHeldSum = 0, act = 0, cnt = 0;
  for (let i = from + 1; i < to; i++) {
    const net = path[i].rp - cost * 2 * path[i].turn;
    p *= 1 + net; nominal.push({ date: path[i].date, value: p }); cashIdx.push({ date: path[i].date, value: path[i].cash });
    turns.push(path[i].turn); enC += path[i].enContrib; enHeldSum += path[i].heldEnergy; if (path[i].heldEnergy > 1e-9) act++; cnt++;
  }
  const real = deflate(nominal, cpi); if (!real) return null;
  const realK = computeKpis(real);
  const cashReal = deflate(cashIdx, cpi); const rf = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;
  const sharpe = realK.annualized != null && realK.volatility ? (realK.annualized - rf) / realK.volatility : null;
  const meanTurn = turns.length ? mean(turns) : 0;
  return {
    realCAGR: realK.annualized ?? null, realVol: realK.volatility ?? null, realSharpe: sharpe,
    realMDD: maxDD(real), underwater: underwater(real), rotation: meanTurn * 12,
    reallocFreq: turns.length ? (turns.filter((v) => v > EPS).length / turns.length) * 12 : 0,
    meanEnergy: cnt ? enHeldSum / cnt : 0, activation: cnt ? act / cnt : 0, energyContrib: enC * 100, months: nominal.length,
  };
}
function fromIdx(path: Step[], years: number | null, fromYm?: string): number {
  if (fromYm) { const i = path.findIndex((p) => p.date.slice(0, 7) >= fromYm); return i < 0 ? path.length - 1 : i; }
  if (years == null) return 0;
  const last = path[path.length - 1].date; const cut = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`;
  for (let i = 0; i < path.length; i++) if (path[i].date >= cut) return i; return path.length - 1;
}
function winBounds(path: Step[], from: string, to: string): [number, number] | null {
  const f = path.findIndex((p) => p.date.slice(0, 7) >= from);
  if (f < 0 || path[f].date.slice(0, 7) > to) return null;
  let t = -1; for (let i = path.length - 1; i >= 0; i--) if (path[i].date.slice(0, 7) <= to) { t = i + 1; break; }
  return t < 0 || t - f < 3 ? null : [f, t];
}

// ── Données ───────────────────────────────────────────────────────────────────
console.error("Chargement MONDE + pays…");
const [wEq, wOil, wGold, wBond] = await Promise.all([db.getSeriesData("MXWO Index-XX-1-1"), db.getSeriesData("CL1 comdty-XX-5-1"), db.getSeriesData("XAU Comdty-XX-5-1"), db.getSeriesData("GT10 Govt-US-4-2")]);
const worldModel = buildModel({ countryCode: "WORLD", equityPrice: wEq, oil: wOil, gold: wGold, bond: wBond }, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
if ((worldModel as any).status !== "OK") { console.error("MONDE KO"); process.exit(1); }
const worldXY = new Map<string, { x: number; y: number }>();
for (const r of (worldModel as any).monthlyResults) worldXY.set(r.date.slice(0, 7), { x: r.x, y: r.y });

const fxRates: any[] = await db.getFxRates();
const usdPerUnit = new Map<string, any>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: DP[] = await db.getSeriesData("SPDYENT Index-XX-5-2");
const toLocal = (data: DP[], t: string) => (!t || t === "USD") ? data : compute.convertCurrency(data, null, usdPerUnit.get(t) ?? null); // date exacte = même méthode que l'or/pétrole

const isoList: any[] = (await svc.listQuadrantCountries()).filter((c: any) => c.iso !== "DK");
interface Loaded { code: string; signal: any; perf: any; energyLocal: DP[]; cpi: Map<string, number> }
const loaded: Loaded[] = [];
for (const { iso } of isoList) {
  const cm = await svc.getCountryQuadrantModel(iso);
  if (!cm.config || !cm.signal || !cm.perf) continue;
  const cpi = new Map<string, number>(); for (const p of (cm.perf.cpi ?? []) as DP[]) cpi.set(p.date.slice(0, 7), p.value);
  loaded.push({ code: iso, signal: cm.signal, perf: cm.perf, energyLocal: toLocal(energyUsd, cm.config.currency), cpi });
}
console.error(`  ${loaded.length} pays.`);

// rows communs (5 séries > 0) par pays.
function buildRows(l: Loaded): Row[] {
  const byM = (a: DP[]) => { const m = new Map<string, number>(); for (const p of a) m.set(p.date.slice(0, 7), p.value); return m; };
  const bd = byM(l.perf.bondTotalReturn), ca = byM(l.perf.cashTotalReturn), go = byM(l.perf.gold), en = byM(l.energyLocal);
  const dateByM = new Map<string, string>(); for (const p of l.perf.equityTotalReturn as DP[]) dateByM.set(p.date.slice(0, 7), p.date);
  const eq = byM(l.perf.equityTotalReturn);
  const rows: Row[] = [];
  for (const [m, date] of [...dateByM.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const e = eq.get(m), b = bd.get(m), c = ca.get(m), g = go.get(m), n = en.get(m);
    if (e! > 0 && b! > 0 && c! > 0 && g! > 0 && n! > 0) rows.push({ m, date, eq: e!, bd: b!, ca: c!, go: g!, en: n! });
  }
  return rows;
}
const rowsByCode = new Map<string, Row[]>(); for (const l of loaded) rowsByCode.set(l.code, buildRows(l));

// baseAllocation par (arm) par pays : Map<month, Core>
function baseAllocs(l: Loaded, strategy: string, T: number): Map<string, Core> | null {
  const model = buildModel(l.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: T, energyMode: "disabled" });
  if (model.status !== "OK") return null;
  const m = new Map<string, Core>();
  for (const r of model.monthlyResults) m.set(r.date.slice(0, 7), { equities: r.baseAllocation.equities, bonds: r.baseAllocation.bonds, gold: r.baseAllocation.gold, cash: r.baseAllocation.cash });
  return m;
}
// cible 5 poches (prorata) par (base, Tworld, w).
function targets(base: Map<string, Core>, tW: number, w: number): Map<string, Alloc5> {
  const out = new Map<string, Alloc5>();
  for (const [m, b] of base) {
    const wc = worldXY.get(m);
    const e = w > 0 && wc && worldActive(wc.x, wc.y, tW) ? w : 0;
    const k = 1 - e;
    out.set(m, { equities: b.equities * k, bonds: b.bonds * k, gold: b.gold * k, cash: b.cash * k, energy: e });
  }
  return out;
}

// ── AUTO-VÉRIF : simulate(w=0, band) == backtestQuadrants v2 (US) ─────────────
{
  const l = loaded.find((x) => x.code === "US")!;
  const base = baseAllocs(l, "dynamic", 20)!;
  const rows = rowsByCode.get("US")!;
  const path0 = simulate(targets(base, 20, 0), rows, BAND);
  const m0 = measure(path0, l.cpi, 0, path0.length, 0);
  const model = buildModel(l.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  const bt = backtestQuadrants({ countryCode: "US", weights: weightsFromModel(model), ...l.perf, energyTotalReturn: l.energyLocal, windowYears: null, reallocationBand: BAND });
  // réf cellule (T20,w10) : simulate vs backtestQuadrants avec cible énergie.
  const wRef = model.monthlyResults.map((r: any) => { const wc = worldXY.get(r.date.slice(0, 7)); const e = wc && worldActive(wc.x, wc.y, 20) ? 0.1 : 0; const k = 1 - e; return { date: r.date, allocation: { equities: r.baseAllocation.equities * k, bonds: r.baseAllocation.bonds * k, gold: r.baseAllocation.gold * k, cash: r.baseAllocation.cash * k, energy: e } }; });
  const btRef = backtestQuadrants({ countryCode: "US", weights: wRef, ...l.perf, energyTotalReturn: l.energyLocal, windowYears: null, reallocationBand: BAND });
  const pathRef = simulate(targets(base, 20, 0.1), rows, BAND);
  const mRef = measure(pathRef, l.cpi, 0, pathRef.length, 0);
  console.error("── AUTO-VÉRIF US (dyn/T20) ──");
  console.error(`  w=0  : simulate realCAGR ${m0?.realCAGR?.toFixed(3)} vs moteur v2 ${bt.metrics.real?.annualized?.toFixed(3)} | rot ${(m0!.rotation * 100).toFixed(2)} vs ${(bt.turnover.annualized * 100).toFixed(2)} ${Math.abs((m0!.realCAGR ?? 0) - (bt.metrics.real?.annualized ?? 0)) < 5e-3 ? "✅" : "⚠️"}`);
  console.error(`  réf  : simulate realCAGR ${mRef?.realCAGR?.toFixed(3)} vs moteur ${btRef.metrics.real?.annualized?.toFixed(3)} | rot ${(mRef!.rotation * 100).toFixed(2)} vs ${(btRef.turnover.annualized * 100).toFixed(2)} ${Math.abs((mRef!.realCAGR ?? 0) - (btRef.metrics.real?.annualized ?? 0)) < 5e-3 ? "✅" : "⚠️"}`);
}

// ── MONDE : fréquence du gate par tranche (mécanisme) ────────────────────────
console.error("\n── MONDE : boom inflationniste (x>0∧y>0) par tranche ──");
for (const b of BUCKETS) { let boom = 0, tot = 0; for (const [m, wc] of worldXY) if (m >= b.from && m <= b.to) { tot++; if (wc.x > 0 && wc.y > 0) boom++; } console.error(`  ${b.key}: ${tot ? (boom / tot * 100).toFixed(0) : "-"}% (${tot} mois)`); }

// ── BALAYAGE ──────────────────────────────────────────────────────────────────
interface Agg { arm: string; horizon: string; cost: number; tW: number; w: number; n: number;
  dCAGR: any; dSharpe: any; dVol: number; dMDD: number; dUW: number; dRot: number; dFreq: number;
  activation: number; meanEnergy: number; energyContrib: number; absCAGR: number; absSharpe: number; }
const aggs: Agg[] = [];
const t0 = Date.now();
for (const arm of ARMS) {
  // chemins par pays : témoin (w=0) + cellules.
  const witness = new Map<string, { path: Step[]; cpi: Map<string, number> }>();
  const cellPaths = new Map<string, Map<string, Step[]>>(); // key(tW,w) → code → path
  for (const l of loaded) {
    const base = baseAllocs(l, arm.strategy, arm.T); if (!base) continue;
    const rows = rowsByCode.get(l.code)!;
    const p0 = simulate(targets(base, 0, 0), rows, BAND);
    if (p0.length > 3) witness.set(l.code, { path: p0, cpi: l.cpi });
    for (const tW of T_WORLD) for (const w of W) {
      if (w === 0) continue;
      const key = `${tW}|${w}`; const p = simulate(targets(base, tW, w), rows, BAND);
      if (p.length <= 3) continue;
      if (!cellPaths.has(key)) cellPaths.set(key, new Map());
      cellPaths.get(key)!.set(l.code, p);
    }
  }
  for (const horizon of HORIZONS) for (const cost of COSTS) {
    const ref = new Map<string, Metrics>();
    for (const [code, wt] of witness) { const from = fromIdx(wt.path, horizon.years, horizon.from); const m = measure(wt.path, wt.cpi, from, wt.path.length, cost); if (m?.realCAGR != null) ref.set(code, m); }
    for (const tW of T_WORLD) for (const w of W) {
      if (w === 0) continue;
      const cm = cellPaths.get(`${tW}|${w}`); if (!cm) continue;
      const dC: number[] = [], dS: number[] = [], dV: number[] = [], dM: number[] = [], dU: number[] = [], dR: number[] = [], dF: number[] = [], actA: number[] = [], enA: number[] = [], ecA: number[] = [], aC: number[] = [], aS: number[] = [];
      let impC = 0, impS = 0, nS = 0, n = 0;
      for (const [code, path] of cm) {
        const r0 = ref.get(code); if (!r0) continue; const l = loaded.find((x) => x.code === code)!;
        const from = fromIdx(path, horizon.years, horizon.from); const c = measure(path, l.cpi, from, path.length, cost);
        if (!c || c.realCAGR == null) continue; n++;
        dC.push(c.realCAGR - r0.realCAGR!); if (c.realCAGR - r0.realCAGR! > 0) impC++;
        if (c.realSharpe != null && r0.realSharpe != null) { nS++; dS.push(c.realSharpe - r0.realSharpe); if (c.realSharpe - r0.realSharpe > 0) impS++; }
        dV.push((c.realVol ?? 0) - (r0.realVol ?? 0)); dM.push((c.realMDD ?? 0) - (r0.realMDD ?? 0)); dU.push((c.underwater ?? 0) - (r0.underwater ?? 0));
        dR.push(c.rotation - r0.rotation); dF.push(c.reallocFreq - r0.reallocFreq);
        actA.push(c.activation); enA.push(c.meanEnergy); ecA.push(c.energyContrib); aC.push(c.realCAGR); if (c.realSharpe != null) aS.push(c.realSharpe);
      }
      if (!n) continue;
      aggs.push({ arm: arm.key, horizon: horizon.key, cost, tW, w, n,
        dCAGR: { med: median(dC), q1: q(dC, 0.25), q3: q(dC, 0.75), worst: worstDecile(dC), pImp: impC / n },
        dSharpe: { med: median(dS), q1: q(dS, 0.25), q3: q(dS, 0.75), worst: worstDecile(dS), pImp: nS ? impS / nS : NaN },
        dVol: median(dV), dMDD: median(dM), dUW: median(dU), dRot: median(dR), dFreq: median(dF),
        activation: median(actA), meanEnergy: median(enA), energyContrib: median(ecA), absCAGR: median(aC), absSharpe: median(aS) });
    }
  }
  console.error(`  ${arm.key} — ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
writeFileSync(path.join(HERE, "canonical-results.json"), JSON.stringify(aggs, null, 0));
console.error(`Écrit : canonical-results.json (${aggs.length} agrégats)`);

// ── SOUS-PÉRIODES fines + LOCO (arm principal, réf + plateau) ─────────────────
const mainArm = ARMS[0];
const subAgg: any[] = [];
{
  const witness = new Map<string, { path: Step[]; cpi: Map<string, number> }>();
  const cellByW: Record<string, Map<string, Step[]>> = {};
  for (const l of loaded) {
    const base = baseAllocs(l, mainArm.strategy, mainArm.T)!; const rows = rowsByCode.get(l.code)!;
    const p0 = simulate(targets(base, 0, 0), rows, BAND); if (p0.length > 3) witness.set(l.code, { path: p0, cpi: l.cpi });
    for (const w of W) { if (w === 0) continue; const key = `${REF.tW}|${w}`; (cellByW[key] ??= new Map()).set(l.code, simulate(targets(base, REF.tW, w), rows, BAND)); }
  }
  // sous-périodes pour w∈{10,15,20,25} à T_world=20 (net 25 bps)
  for (const w of [0.1, 0.15, 0.2, 0.25]) {
    const cm = cellByW[`${REF.tW}|${w}`];
    const row: any = { w };
    for (const b of BUCKETS.concat([{ key: "Max", from: "1900-01", to: "2100-12" }, { key: "pré-2021", from: "1900-01", to: "2020-12" }, { key: "Live11-20", from: "2011-01", to: "2020-12" }])) {
      const ds: number[] = [];
      for (const [code, path] of cm) { const wt = witness.get(code); if (!wt) continue; const l = loaded.find((x) => x.code === code)!; const wb = winBounds(wt.path, b.from, b.to), cb = winBounds(path, b.from, b.to); if (!wb || !cb) continue; const m0 = measure(wt.path, l.cpi, wb[0], wb[1], 25), m1 = measure(path, l.cpi, cb[0], cb[1], 25); if (m0?.realSharpe != null && m1?.realSharpe != null) ds.push(m1.realSharpe - m0.realSharpe); }
      row[b.key] = { med: median(ds), n: ds.length };
    }
    subAgg.push(row);
  }
  // LOCO Max (net 25) pour réf w=10 et w=20
  const loco: any = {};
  for (const w of [0.1, 0.2]) {
    const cm = cellByW[`${REF.tW}|${w}`]; const per: Array<{ code: string; d: number }> = [];
    for (const [code, path] of cm) { const wt = witness.get(code); if (!wt) continue; const l = loaded.find((x) => x.code === code)!; const m0 = measure(wt.path, l.cpi, 0, wt.path.length, 25), m1 = measure(path, l.cpi, 0, path.length, 25); if (m0?.realSharpe != null && m1?.realSharpe != null) per.push({ code, d: m1.realSharpe - m0.realSharpe }); }
    const all = per.map((p) => p.d); const full = median(all);
    const loos = per.map((p) => median(all.filter((_, i) => per[i].code !== p.code)));
    loco[w] = { full, min: Math.min(...loos), max: Math.max(...loos), worst: per.slice().sort((a, b) => a.d - b.d).slice(0, 3).map((p) => `${p.code} ${p.d.toFixed(3)}`) };
  }
  writeFileSync(path.join(HERE, "canonical-oos.json"), JSON.stringify({ subAgg, loco }, null, 1));
}
console.error("Écrit : canonical-oos.json");
await db.coredataPool?.end?.();
console.error("✅ Terminé.");
