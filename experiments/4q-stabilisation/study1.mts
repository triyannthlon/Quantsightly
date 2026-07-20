// ÉTUDE 1 — Stabilisation 4Q (EXPÉRIMENTAL, hors socle v1). Compare, vs Standard v1 :
//  - bande minimale de réallocation δ ∈ {1,2,3,5} pts ;
//  - hystérésis h ∈ {5,10,20} pts de coordonnée.
// Standard & hystérésis = rééquilibrage plein (réutilisent le moteur figé). Bande =
// exécution custom (conserver les poids détenus si rotation-vers-cible ≤ δ). Panel =
// 22 pays. Horizon principal 20A / dynamique / T=20 ; robustesse Max/10A/5A ; sensibilité
// T=0/50 ; contrôle Binaire. Ne modifie RIEN du moteur ; lit signal+perf via le service.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

try {
  const env = readFileSync(path.resolve("./.env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const svc = await import(pathToFileURL(path.resolve("./src/lib/coredata/four-quadrants-service.ts")).href);
const eng = await import(pathToFileURL(path.resolve("./src/lib/coredata/four-quadrants/index.ts")).href);
const cmp = await import(pathToFileURL(path.resolve("./src/lib/coredata/compute.ts")).href);
const { buildModel, backtestQuadrants, weightsFromModel, applyTransitionDeadZone, DEFAULT_FOUR_QUADRANTS_SETTINGS } = eng;
const { computeKpis } = cmp;

type Alloc = { equities: number; bonds: number; gold: number; cash: number };
type DP = { date: string; value: number };
const KEYS: (keyof Alloc)[] = ["equities", "bonds", "gold", "cash"];
const EPS = 0.005; // seuil « réallocation effective » = turnover mensuel > 0,5 %
const mk = (d: string) => d.slice(0, 7);
const half = (a: Alloc, b: Alloc) => 0.5 * KEYS.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);

// ── Hystérésis : état par axe + allocation ───────────────────────────────────
function hystState(coord: number, prev: string, T: number, h: number): string {
  const hi = T + h;
  if (coord >= hi) return "POS";
  if (coord <= -hi) return "NEG";
  if (prev === "POS" && coord >= T) return "POS";
  if (prev === "NEG" && coord <= -T) return "NEG";
  return "NEUTRAL";
}
function hystAlloc(x: number, y: number, sx: string, sy: string, T: number, strategy: string): Alloc {
  if (strategy === "binary") {
    const a: Alloc = { equities: 0, bonds: 0, gold: 0, cash: 0 };
    if (sx === "POS") a.equities = 0.5; else if (sx === "NEG") a.cash = 0.5; else { a.equities = 0.25; a.cash = 0.25; }
    if (sy === "POS") a.gold = 0.5; else if (sy === "NEG") a.bonds = 0.5; else { a.gold = 0.25; a.bonds = 0.25; }
    return a;
  }
  const ux = sx === "NEUTRAL" ? 0 : applyTransitionDeadZone(x, T);
  const uy = sy === "NEUTRAL" ? 0 : applyTransitionDeadZone(y, T);
  return { equities: 0.25 * (1 + ux / 100), cash: 0.25 * (1 - ux / 100), gold: 0.25 * (1 + uy / 100), bonds: 0.25 * (1 - uy / 100) };
}

// ── Simulation générique (Standard / bande / hystérésis) ─────────────────────
interface Row { m: string; date: string; eq: number; bd: number; ca: number; go: number }
function alignPerf(perf: any): { rows: Row[]; cpi: Map<string, number> } {
  const toMap = (a: DP[]) => new Map(a.map((p) => [mk(p.date), p.value]));
  const bd = toMap(perf.bondTotalReturn), ca = toMap(perf.cashTotalReturn), go = toMap(perf.gold);
  const rows: Row[] = [];
  for (const p of perf.equityTotalReturn as DP[]) {
    const m = mk(p.date); const b = bd.get(m), c = ca.get(m), g = go.get(m);
    if (b! > 0 && c! > 0 && g! > 0 && p.value > 0) rows.push({ m, date: p.date, eq: p.value, bd: b!, ca: c!, go: g! });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const cpi = new Map<string, number>();
  for (const p of (perf.cpi ?? []) as DP[]) cpi.set(mk(p.date), p.value);
  return { rows, cpi };
}
function maxDD(idx: DP[]): number { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null {
  const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(mk(p.date)) })).filter((x) => x.c! > 0);
  if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c!;
  return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) }));
}

interface Res { realCAGR: number | null; nomCAGR: number | null; realVol: number | null; realMDD: number | null; sharpeReal: number | null; rotation: number; reallocShare: number; months: number }

function simulate(targetsByMonth: Map<string, Alloc>, perf: any, windowYears: number | null, exec: { band?: number }): Res | null {
  const { rows, cpi } = alignPerf(perf);
  let start = rows.findIndex((r) => targetsByMonth.has(r.m));
  if (start < 0 || start >= rows.length - 1) return null;
  // Fenêtre = mois retenus (span calendaire), même logique que le moteur figé.
  const lastDate = rows[rows.length - 1].date;
  let winStart = start;
  if (windowYears != null) {
    const cut = `${Number(lastDate.slice(0, 4)) - windowYears}${lastDate.slice(4)}`;
    for (let i = start; i < rows.length; i++) if (rows[i].date >= cut) { winStart = i; break; }
  }
  // Boucle complète (état bande/held dérive depuis le début) ; sorties sur la fenêtre.
  let held: Alloc = targetsByMonth.get(rows[start].m)!;
  let p = 100; const nominal: DP[] = []; const turns: number[] = [];
  const cashIdx: DP[] = [];
  for (let t = start + 1; t < rows.length; t++) {
    const tgt = targetsByMonth.get(rows[t - 1].m); if (!tgt) continue; // (données propres : pas de trou)
    const rEq = rows[t].eq / rows[t - 1].eq - 1, rBd = rows[t].bd / rows[t - 1].bd - 1, rCa = rows[t].ca / rows[t - 1].ca - 1, rGo = rows[t].go / rows[t - 1].go - 1;
    const rp = held.equities * rEq + held.bonds * rBd + held.cash * rCa + held.gold * rGo;
    // Poids dérivés (avant décision) au mois t.
    const gv = { equities: held.equities * (1 + rEq), bonds: held.bonds * (1 + rBd), cash: held.cash * (1 + rCa), gold: held.gold * (1 + rGo) };
    const tot = gv.equities + gv.bonds + gv.cash + gv.gold;
    const drifted: Alloc = { equities: gv.equities / tot, bonds: gv.bonds / tot, cash: gv.cash / tot, gold: gv.gold / tot };
    const target = targetsByMonth.get(rows[t].m) ?? drifted;
    let post: Alloc;
    if (exec.band != null) { post = half(target, drifted) <= exec.band / 100 ? drifted : target; }
    else post = target; // Standard / hystérésis : rééquilibrage plein
    const turn = half(post, drifted);
    if (t > winStart) {
      p *= 1 + rp; nominal.push({ date: rows[t].date, value: p });
      cashIdx.push({ date: rows[t].date, value: rows[t].ca });
      // turnover du mois (transaction d'entrée incluse si fenêtre restreinte) :
      turns.push(turn);
    } else if (t === winStart) { p = 100; nominal.push({ date: rows[t].date, value: 100 }); cashIdx.push({ date: rows[t].date, value: rows[t].ca }); }
    held = post;
  }
  if (nominal.length < 2) return null;
  const nomK = computeKpis(nominal);
  const real = deflate(nominal, cpi); const realK = real ? computeKpis(real) : null;
  const cashReal = deflate(cashIdx, cpi); const rfReal = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;
  const sharpeReal = realK && realK.annualized != null && realK.volatility ? (realK.annualized - rfReal) / realK.volatility : null;
  const meanTurn = turns.length ? turns.reduce((s, v) => s + v, 0) / turns.length : 0;
  const reallocShare = turns.length ? turns.filter((v) => v > EPS).length / turns.length : 0;
  return { realCAGR: realK?.annualized ?? null, nomCAGR: nomK.annualized, realVol: realK?.volatility ?? null, realMDD: real ? maxDD(real) : null, sharpeReal, rotation: meanTurn * 12, reallocShare, months: nominal.length };
}

// Cibles Standard (finalAllocation) et cibles hystérésis (recalculées des coords).
function standardTargets(model: any): Map<string, Alloc> {
  const m = new Map<string, Alloc>();
  for (const r of model.monthlyResults) m.set(mk(r.date), { equities: r.finalAllocation.equities, bonds: r.finalAllocation.bonds, gold: r.finalAllocation.gold, cash: r.finalAllocation.cash });
  return m;
}
function hysteresisTargets(model: any, T: number, h: number, strategy: string): Map<string, Alloc> {
  const m = new Map<string, Alloc>(); let sx = "NEUTRAL", sy = "NEUTRAL";
  for (const r of model.monthlyResults) { sx = hystState(r.x, sx, T, h); sy = hystState(r.y, sy, T, h); m.set(mk(r.date), hystAlloc(r.x, r.y, sx, sy, T, strategy)); }
  return m;
}

// ── Chargement des 22 pays ────────────────────────────────────────────────────
const countriesList = await svc.listQuadrantCountries();
const CODES = countriesList.map((c: any) => c.iso);
const cache: Record<string, any> = {};
for (let i = 0; i < CODES.length; i += 4) {
  const chunk = CODES.slice(i, i + 4);
  const got = await Promise.all(chunk.map((c: string) => svc.getCountryQuadrantModel(c)));
  chunk.forEach((c: string, j: number) => { if (got[j].signal && got[j].perf) cache[c] = got[j]; });
}
console.log(`Chargé ${Object.keys(cache).length}/${CODES.length} pays.`);

// ── Auto-vérif : simulate(Standard) ≈ moteur figé (US 20A) ───────────────────
{
  const c = cache.US; const model = buildModel(c.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
  const mine = simulate(standardTargets(model), c.perf, 20, {});
  const bt = backtestQuadrants({ countryCode: "US", weights: weightsFromModel(model), ...c.perf, windowYears: 20 });
  const eRC = bt.status === "OK" ? bt.metrics.real?.annualized : null;
  const eRot = bt.status === "OK" ? bt.turnover.annualized * 100 : null;
  console.log(`AUTO-VÉRIF US 20A — realCAGR: sim ${mine?.realCAGR?.toFixed(3)} vs moteur ${eRC?.toFixed(3)} | rotation: sim ${(mine!.rotation * 100).toFixed(1)}% vs moteur ${eRot?.toFixed(1)}%`);
}

// ── Matrice ───────────────────────────────────────────────────────────────────
const VARIANTS: { key: string; band?: number; h?: number }[] = [
  { key: "standard" },
  { key: "band δ1", band: 1 }, { key: "band δ2", band: 2 }, { key: "band δ3", band: 3 }, { key: "band δ5", band: 5 },
  { key: "hyst h5", h: 5 }, { key: "hyst h10", h: 10 }, { key: "hyst h20", h: 20 },
];
function runVariant(code: string, v: any, strategy: string, T: number, years: number | null): Res | null {
  const c = cache[code]; if (!c) return null;
  const model = buildModel(c.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: T });
  if (model.status !== "OK") return null;
  const targets = v.h != null ? hysteresisTargets(model, T, v.h, strategy) : standardTargets(model);
  return simulate(targets, c.perf, years, { band: v.band });
}

// Stats d'agrégation vs Standard, par variante, sur un slice (strategy, T, years).
const q = (arr: number[], p: number) => { const a = [...arr].sort((x, y) => x - y); const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
function aggregate(strategy: string, T: number, years: number | null) {
  const std: Record<string, Res | null> = {};
  for (const code of Object.keys(cache)) std[code] = runVariant(code, { key: "standard" }, strategy, T, years);
  const out: any[] = [];
  for (const v of VARIANTS) {
    if (v.key === "standard") continue;
    const dRot: number[] = [], dReal: number[] = [], dSharpe: number[] = [], dMdd: number[] = [], dReal_ = [], dRealloc: number[] = [];
    const extremes: string[] = [];
    let improvedRot = 0, degradedReal = 0, n = 0;
    for (const code of Object.keys(cache)) {
      const s = std[code], r = runVariant(code, v, strategy, T, years);
      if (!s || !r || s.realCAGR == null || r.realCAGR == null || s.rotation === 0) continue;
      n++;
      const rotRed = ((r.rotation - s.rotation) / s.rotation) * 100;
      const reallocRed = s.reallocShare > 0 ? ((r.reallocShare - s.reallocShare) / s.reallocShare) * 100 : 0;
      const dRealV = r.realCAGR - s.realCAGR;
      const dMddV = Math.abs(r.realMDD ?? 0) - Math.abs(s.realMDD ?? 0);
      dRot.push(rotRed); dRealloc.push(reallocRed); dReal.push(dRealV); dMdd.push(dMddV);
      if (r.sharpeReal != null && s.sharpeReal != null) dSharpe.push(r.sharpeReal - s.sharpeReal);
      if (rotRed < 0) improvedRot++;
      if (dRealV < -0.3) degradedReal++;
      if (dRealV < -1 || dMddV > 5) extremes.push(`${code}(ΔCAGR ${dRealV.toFixed(1)}, ΔMDD ${dMddV.toFixed(1)})`);
    }
    const medRot = q(dRot, 0.5), medRealloc = q(dRealloc, 0.5), medReal = q(dReal, 0.5), medSharpe = dSharpe.length ? q(dSharpe, 0.5) : NaN, medMdd = q(dMdd, 0.5);
    const admissible = medRot <= -30 && medRealloc <= -30 && medReal >= -0.3 && (isNaN(medSharpe) || medSharpe >= -0.05) && medMdd <= 2;
    out.push({ variant: v.key, medRot, worstDecileRot: q(dRot, 0.9), medRealloc, medReal, q1Real: q(dReal, 0.25), worstDecileReal: q(dReal, 0.1), medSharpe, medMdd, improvedRotPct: (improvedRot / n) * 100, degradedRealCnt: degradedReal, admissible, extremes });
  }
  return out;
}

function printTable(title: string, rows: any[]) {
  console.log(`\n### ${title}`);
  console.log("variante   | rot méd | rot p90 | réalloc méd | CAGR méd | CAGR q1 | CAGR p10 | Sharpe méd | MDD+ méd | %améliorés | dégr>0,3 | admis");
  for (const r of rows) {
    console.log(
      `${r.variant.padEnd(10)} | ${r.medRot.toFixed(0).padStart(6)}% | ${r.worstDecileRot.toFixed(0).padStart(6)}% | ${r.medRealloc.toFixed(0).padStart(9)}% | ${r.medReal.toFixed(2).padStart(7)} | ${r.q1Real.toFixed(2).padStart(6)} | ${r.worstDecileReal.toFixed(2).padStart(7)} | ${(isNaN(r.medSharpe) ? "—" : r.medSharpe.toFixed(3)).padStart(9)} | ${r.medMdd.toFixed(1).padStart(7)} | ${r.improvedRotPct.toFixed(0).padStart(9)}% | ${String(r.degradedRealCnt).padStart(7)} | ${r.admissible ? "OUI" : "non"}`,
    );
  }
  const ex = rows.flatMap((r) => r.extremes.length ? [`${r.variant}: ${r.extremes.join(", ")}`] : []);
  if (ex.length) { console.log("  ⚠ dégradations extrêmes (ΔCAGR<−1 ou ΔMDD>5):"); for (const e of ex) console.log("     " + e); }
}

console.log("\n================ PRINCIPAL — Dynamique · T=20 · 20A ================");
printTable("Dynamique · T=20 · 20A", aggregate("dynamic", 20, 20));
console.log("\n================ ROBUSTESSE (Dynamique · T=20) ================");
printTable("Dynamique · T=20 · Max", aggregate("dynamic", 20, null));
printTable("Dynamique · T=20 · 10A", aggregate("dynamic", 20, 10));
printTable("Dynamique · T=20 · 5A", aggregate("dynamic", 20, 5));
console.log("\n================ SENSIBILITÉ ZONE NEUTRE (Dynamique · 20A) ================");
printTable("Dynamique · T=0 · 20A", aggregate("dynamic", 0, 20));
printTable("Dynamique · T=50 · 20A", aggregate("dynamic", 50, 20));
console.log("\n================ CONTRÔLE — Binaire · T=20 · 20A ================");
printTable("Binaire · T=20 · 20A", aggregate("binary", 20, 20));
process.exit(0);
