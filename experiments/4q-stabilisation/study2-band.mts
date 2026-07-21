// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE 2 — Bande de réallocation ÉLARGIE (recherche quantitative, hors socle v1).
// Réévalue la stabilisation par bande sous le NOUVEAU cadre (cf. étude 1 = ancien
// cadre « simplicité »). Question : existe-t-il un δ GLOBAL robuste qui améliore le
// rendement-risque NET de coûts, ou réduit fortement les coûts opérationnels sans
// dégrader le comportement économique ?
//
// Règle bande : garder les poids détenus (dérivés) si rotation-vers-cible
// ½·Σ|cible−détenu| ≤ δ pts ; sinon réallouer plein vers la cible. δ=0 ≡ Standard v1.
// Coûts appliqués DANS le compounding (net = rp − cost·2·turn), car le bénéfice de la
// bande est opérationnel. Moteur `four-quadrants/` NON modifié.
//
// pnpm exec tsx experiments/4q-stabilisation/study2-band.mts
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
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const eng: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const cmp: any = await imp("src/lib/coredata/compute.ts");
const db: any = await imp("src/lib/coredata/db.ts");
const { buildModel, backtestQuadrants, weightsFromModel, DEFAULT_FOUR_QUADRANTS_SETTINGS } = eng;
const { computeKpis } = cmp;

// ── Paramètres d'étude ────────────────────────────────────────────────────────
const DELTAS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20]; // 0 = témoin Standard
const STRATS = ["dynamic", "binary"] as const;
const T_MODEL = [0, 20, 50];
const HORIZONS: Array<{ key: string; years: number | null }> = [
  { key: "Max", years: null }, { key: "20A", years: 20 }, { key: "10A", years: 10 }, { key: "5A", years: 5 },
];
const COSTS = [0, 10, 25, 50]; // bps
const EPS = 0.005; // seuil « réallocation effective » = turnover mensuel > 0,5 %

type Alloc = { equities: number; bonds: number; gold: number; cash: number };
type DP = { date: string; value: number };
const KEYS: (keyof Alloc)[] = ["equities", "bonds", "gold", "cash"];
const mk = (d: string) => d.slice(0, 7);
const half = (a: Alloc, b: Alloc) => 0.5 * KEYS.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);

// ── Stats ──────────────────────────────────────────────────────────────────
const q = (arr: number[], p: number) => { const a = arr.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const worstDecile = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const n = Math.max(1, Math.round(s.length * 0.1)); return s.slice(0, n).reduce((x, y) => x + y, 0) / n; };

// ── Alignement perf + helpers courbe ─────────────────────────────────────────
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
function underwater(idx: DP[]): number { let pk = -Infinity, run = 0, mx = 0; for (const p of idx) { if (p.value >= pk) { pk = p.value; run = 0; } else { run++; if (run > mx) mx = run; } } return mx; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null {
  const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(mk(p.date)) })).filter((x) => x.c! > 0);
  if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c!;
  return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) }));
}

// ── Simulation bande : renvoie le CHEMIN mensuel complet (rp, turn, cash) ─────
interface MonthStep { date: string; rp: number; turn: number; cash: number }
function simulatePath(targets: Map<string, Alloc>, rows: Row[], band: number): MonthStep[] {
  const start = rows.findIndex((r) => targets.has(r.m));
  if (start < 0 || start >= rows.length - 1) return [];
  let held: Alloc = targets.get(rows[start].m)!;
  const out: MonthStep[] = [{ date: rows[start].date, rp: 0, turn: 0, cash: rows[start].ca }]; // entrée = base
  for (let t = start + 1; t < rows.length; t++) {
    const tgt = targets.get(rows[t - 1].m); if (!tgt) continue;
    const rEq = rows[t].eq / rows[t - 1].eq - 1, rBd = rows[t].bd / rows[t - 1].bd - 1, rCa = rows[t].ca / rows[t - 1].ca - 1, rGo = rows[t].go / rows[t - 1].go - 1;
    const rp = held.equities * rEq + held.bonds * rBd + held.cash * rCa + held.gold * rGo;
    const gv = { equities: held.equities * (1 + rEq), bonds: held.bonds * (1 + rBd), cash: held.cash * (1 + rCa), gold: held.gold * (1 + rGo) };
    const tot = gv.equities + gv.bonds + gv.cash + gv.gold;
    const drifted: Alloc = { equities: gv.equities / tot, bonds: gv.bonds / tot, cash: gv.cash / tot, gold: gv.gold / tot };
    const target = targets.get(rows[t].m) ?? drifted;
    const post: Alloc = band > 0 ? (half(target, drifted) <= band / 100 ? drifted : target) : target;
    out.push({ date: rows[t].date, rp, turn: half(post, drifted), cash: rows[t].ca });
    held = post;
  }
  return out;
}

// ── Mesure des métriques sur un sous-intervalle [from,to] du chemin, net de coûts ─
interface Metrics { realCAGR: number | null; realVol: number | null; realSharpe: number | null; realMDD: number | null; underwater: number | null; rotation: number; reallocShare: number; months: number }
function measure(path: MonthStep[], cpi: Map<string, number>, from: number, to: number, bps: number): Metrics | null {
  if (to - from < 2) return null;
  const cost = bps / 10000;
  let p = 100; const nominal: DP[] = [{ date: path[from].date, value: 100 }];
  const cashIdx: DP[] = [{ date: path[from].date, value: path[from].cash }];
  const turns: number[] = [];
  for (let i = from + 1; i < to; i++) {
    const net = path[i].rp - cost * 2 * path[i].turn; // coût sur volume brut = 2·turnover
    p *= 1 + net; nominal.push({ date: path[i].date, value: p });
    cashIdx.push({ date: path[i].date, value: path[i].cash });
    turns.push(path[i].turn);
  }
  if (nominal.length < 2) return null;
  const real = deflate(nominal, cpi); const realK = real ? computeKpis(real) : null;
  const cashReal = deflate(cashIdx, cpi); const rfReal = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;
  const sharpe = realK && realK.annualized != null && realK.volatility ? (realK.annualized - rfReal) / realK.volatility : null;
  const meanTurn = turns.length ? turns.reduce((s, v) => s + v, 0) / turns.length : 0;
  return {
    realCAGR: realK?.annualized ?? null, realVol: realK?.volatility ?? null, realSharpe: sharpe,
    realMDD: real ? maxDD(real) : null, underwater: real ? underwater(real) : null,
    rotation: meanTurn * 12, reallocShare: turns.length ? turns.filter((v) => v > EPS).length / turns.length : 0, months: nominal.length,
  };
}
/** Fenêtre glissante : index de départ pour les N dernières années (null = tout). */
function fromIndex(path: MonthStep[], years: number | null): number {
  if (years == null) return 0;
  const last = path[path.length - 1].date;
  const cut = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`;
  for (let i = 0; i < path.length; i++) if (path[i].date >= cut) return i;
  return path.length - 1;
}

function standardTargets(model: any): Map<string, Alloc> {
  const m = new Map<string, Alloc>();
  for (const r of model.monthlyResults) m.set(mk(r.date), { equities: r.finalAllocation.equities, bonds: r.finalAllocation.bonds, gold: r.finalAllocation.gold, cash: r.finalAllocation.cash });
  return m;
}

// ── Chargement 22 pays ────────────────────────────────────────────────────────
console.error("Chargement…");
const CODES: string[] = (await svc.listQuadrantCountries()).map((c: any) => c.iso);
const cache: Record<string, any> = {};
for (let i = 0; i < CODES.length; i += 4) {
  const chunk = CODES.slice(i, i + 4);
  const got = await Promise.all(chunk.map((c: string) => svc.getCountryQuadrantModel(c)));
  chunk.forEach((c, j) => { if (got[j].signal && got[j].perf) cache[c] = got[j]; });
}
const LOADED = Object.keys(cache);
console.error(`  ${LOADED.length}/${CODES.length} pays.`);

// ── Pré-calcul : chemins mensuels par (pays, stratégie, T, δ) sur histo COMPLET ─
// mémoïsé ; sous-fenêtres/sous-périodes = tranches de ces chemins.
type PathKey = string;
const pathCache = new Map<PathKey, { path: MonthStep[]; cpi: Map<string, number> }>();
function getPath(code: string, strategy: string, T: number, band: number) {
  const key = `${code}|${strategy}|${T}|${band}`;
  let hit = pathCache.get(key);
  if (!hit) {
    const c = cache[code];
    const model = buildModel(c.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: T });
    if (model.status !== "OK") { hit = { path: [], cpi: new Map() }; }
    else { const { rows, cpi } = alignPerf(c.perf); hit = { path: simulatePath(standardTargets(model), rows, band), cpi }; }
    pathCache.set(key, hit);
  }
  return hit;
}

// ── Auto-vérif : δ=0 (bande off) ≈ moteur figé (US, 20A) ─────────────────────
{
  const c = cache.US; const model = buildModel(c.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
  const { path, cpi } = getPath("US", "dynamic", 20, 0);
  const m = measure(path, cpi, fromIndex(path, 20), path.length, 0);
  const bt = backtestQuadrants({ countryCode: "US", weights: weightsFromModel(model), ...c.perf, windowYears: 20 });
  const eRC = bt.status === "OK" ? bt.metrics.real?.annualized : null;
  const eRot = bt.status === "OK" ? bt.turnover.annualized * 100 : null;
  console.error(`AUTO-VÉRIF US 20A δ=0 — realCAGR sim ${m?.realCAGR?.toFixed(3)} vs moteur ${eRC?.toFixed(3)} | rotation sim ${(m!.rotation * 100).toFixed(1)}% vs moteur ${eRot?.toFixed(1)}%`);
}

// ── Agrégation par (strategy, T, horizon, δ, cost) vs δ=0 ─────────────────────
interface Agg {
  strategy: string; T: number; horizon: string; delta: number; cost: number; n: number;
  dNetCAGR: { med: number; q1: number; q3: number; worst: number; pImp: number };
  dSharpe: { med: number; q1: number; q3: number; worst: number; pImp: number };
  dMDD: { med: number; worst: number }; // |MDD_band|-|MDD_std| : + = pire
  rotRedPct: number; reallocRedPct: number; // médianes (négatif = réduction)
  reallocFreqStd: number; reallocFreqBand: number; // /an, médianes
  absNetCAGR: number; absSharpe: number;
}
const aggs: Agg[] = [];
const t0 = Date.now();
for (const strategy of STRATS) {
  for (const T of T_MODEL) {
    for (const horizon of HORIZONS) {
      // Standard (δ=0) par pays et par coût, mémoïsé.
      const stdByCost: Record<number, Record<string, Metrics | null>> = {};
      for (const cost of COSTS) {
        stdByCost[cost] = {};
        for (const code of LOADED) {
          const { path, cpi } = getPath(code, strategy, T, 0);
          stdByCost[cost][code] = path.length ? measure(path, cpi, fromIndex(path, horizon.years), path.length, cost) : null;
        }
      }
      for (const delta of DELTAS) {
        if (delta === 0) continue;
        for (const cost of COSTS) {
          const dC: number[] = [], dS: number[] = [], dM: number[] = [], rot: number[] = [], real: number[] = [], rfStd: number[] = [], rfBand: number[] = [], absC: number[] = [], absS: number[] = [];
          let impC = 0, impS = 0, n = 0;
          for (const code of LOADED) {
            const s = stdByCost[cost][code]; if (!s || s.realCAGR == null) continue;
            const { path, cpi } = getPath(code, strategy, T, delta);
            const r = path.length ? measure(path, cpi, fromIndex(path, horizon.years), path.length, cost) : null;
            if (!r || r.realCAGR == null) continue;
            n++;
            dC.push(r.realCAGR - s.realCAGR); if (r.realCAGR - s.realCAGR > 0) impC++;
            if (r.realSharpe != null && s.realSharpe != null) { dS.push(r.realSharpe - s.realSharpe); if (r.realSharpe - s.realSharpe > 0) impS++; }
            dM.push(Math.abs(r.realMDD ?? 0) - Math.abs(s.realMDD ?? 0));
            if (s.rotation > 0) rot.push(((r.rotation - s.rotation) / s.rotation) * 100);
            if (s.reallocShare > 0) real.push(((r.reallocShare - s.reallocShare) / s.reallocShare) * 100);
            rfStd.push(s.reallocShare * 12); rfBand.push(r.reallocShare * 12);
            absC.push(r.realCAGR); if (r.realSharpe != null) absS.push(r.realSharpe);
          }
          if (!n) continue;
          aggs.push({
            strategy, T, horizon: horizon.key, delta, cost, n,
            dNetCAGR: { med: median(dC), q1: q(dC, 0.25), q3: q(dC, 0.75), worst: worstDecile(dC), pImp: impC / n },
            dSharpe: { med: median(dS), q1: q(dS, 0.25), q3: q(dS, 0.75), worst: worstDecile(dS), pImp: dS.length ? impS / dS.length : NaN },
            dMDD: { med: median(dM), worst: q(dM, 0.9) },
            rotRedPct: median(rot), reallocRedPct: median(real),
            reallocFreqStd: median(rfStd), reallocFreqBand: median(rfBand),
            absNetCAGR: median(absC), absSharpe: median(absS),
          });
        }
      }
    }
  }
  console.error(`  ${strategy} — ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.error(`Terminé : ${aggs.length} agrégats, ${((Date.now() - t0) / 1000).toFixed(0)}s.`);
writeFileSync(path.join(HERE, "study2-results.json"), JSON.stringify(aggs, null, 0));

// ── Table console : dynamique T=20, par horizon, δ × (net 25 bps) ────────────
function showSlice(strategy: string, T: number, cost: number) {
  console.log(`\n═══ ${strategy} · T=${T} · net ${cost} bps ═══`);
  for (const h of HORIZONS.map((x) => x.key)) {
    console.log(`\n  ── ${h} ──`);
    console.log("  δ   | rot%  | fréq réalloc/an (std→band) | ΔnetCAGR méd [q1/q3/pire] %imp | ΔSharpe méd | ΔMDD+ méd/p90 | %imp CAGR");
    for (const delta of DELTAS) {
      if (delta === 0) continue;
      const a = aggs.find((x) => x.strategy === strategy && x.T === T && x.horizon === h && x.delta === delta && x.cost === cost);
      if (!a) continue;
      console.log(`  ${String(delta).padStart(2)}  | ${a.rotRedPct.toFixed(0).padStart(4)}% | ${a.reallocFreqStd.toFixed(1).padStart(4)}→${a.reallocFreqBand.toFixed(1).padEnd(4)} (${a.reallocRedPct.toFixed(0)}%) | ${a.dNetCAGR.med.toFixed(2).padStart(5)} [${a.dNetCAGR.q1.toFixed(2)}/${a.dNetCAGR.q3.toFixed(2)}/${a.dNetCAGR.worst.toFixed(2)}] ${(a.dNetCAGR.pImp * 100).toFixed(0)}% | ${a.dSharpe.med.toFixed(3).padStart(6)} | ${a.dMDD.med.toFixed(1)}/${a.dMDD.worst.toFixed(1)} | ${(a.dNetCAGR.pImp * 100).toFixed(0)}%`);
    }
  }
}
showSlice("dynamic", 20, 0);
showSlice("dynamic", 20, 25);
showSlice("dynamic", 20, 50);

console.log("\n\n════════ CONTRÔLE Binaire · T=20 · net 25 bps ════════");
showSlice("binary", 20, 25);
console.log("\n════════ SENSIBILITÉ T · net 25 bps ════════");
showSlice("dynamic", 0, 25);
showSlice("dynamic", 50, 25);

await db.coredataPool?.end?.();
console.error("\n✅ Étude 2 (bande élargie) terminée.");
