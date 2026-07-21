// ÉTUDE 2 — Phase 3 : validation HORS ÉCHANTILLON de la bande candidate.
// Sous-périodes (stabilité temporelle) + leave-one-country-out (indépendance aux
// pays) + sensibilité fine autour du candidat. LECTURE SEULE, moteur non modifié.
// pnpm exec tsx experiments/4q-stabilisation/study2-oos.mts
import { readFileSync } from "node:fs";
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
const { buildModel, DEFAULT_FOUR_QUADRANTS_SETTINGS } = eng;
const { computeKpis } = cmp;

type Alloc = { equities: number; bonds: number; gold: number; cash: number };
type DP = { date: string; value: number };
const KEYS: (keyof Alloc)[] = ["equities", "bonds", "gold", "cash"];
const mk = (d: string) => d.slice(0, 7);
const half = (a: Alloc, b: Alloc) => 0.5 * KEYS.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);
const q = (arr: number[], p: number) => { const a = arr.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const worstDecile = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const n = Math.max(1, Math.round(s.length * 0.1)); return s.slice(0, n).reduce((x, y) => x + y, 0) / n; };
const EPS = 0.005;

interface Row { m: string; date: string; eq: number; bd: number; ca: number; go: number }
function alignPerf(perf: any): { rows: Row[]; cpi: Map<string, number> } {
  const toMap = (a: DP[]) => new Map(a.map((p) => [mk(p.date), p.value]));
  const bd = toMap(perf.bondTotalReturn), ca = toMap(perf.cashTotalReturn), go = toMap(perf.gold);
  const rows: Row[] = [];
  for (const p of perf.equityTotalReturn as DP[]) { const m = mk(p.date); const b = bd.get(m), c = ca.get(m), g = go.get(m); if (b! > 0 && c! > 0 && g! > 0 && p.value > 0) rows.push({ m, date: p.date, eq: p.value, bd: b!, ca: c!, go: g! }); }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const cpi = new Map<string, number>(); for (const p of (perf.cpi ?? []) as DP[]) cpi.set(mk(p.date), p.value);
  return { rows, cpi };
}
function maxDD(idx: DP[]): number { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null { const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(mk(p.date)) })).filter((x) => x.c! > 0); if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c!; return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) })); }
interface MonthStep { date: string; rp: number; turn: number; cash: number }
function simulatePath(targets: Map<string, Alloc>, rows: Row[], band: number): MonthStep[] {
  const start = rows.findIndex((r) => targets.has(r.m)); if (start < 0 || start >= rows.length - 1) return [];
  let held: Alloc = targets.get(rows[start].m)!;
  const out: MonthStep[] = [{ date: rows[start].date, rp: 0, turn: 0, cash: rows[start].ca }];
  for (let t = start + 1; t < rows.length; t++) {
    const tgt = targets.get(rows[t - 1].m); if (!tgt) continue;
    const rEq = rows[t].eq / rows[t - 1].eq - 1, rBd = rows[t].bd / rows[t - 1].bd - 1, rCa = rows[t].ca / rows[t - 1].ca - 1, rGo = rows[t].go / rows[t - 1].go - 1;
    const rp = held.equities * rEq + held.bonds * rBd + held.cash * rCa + held.gold * rGo;
    const gv = { equities: held.equities * (1 + rEq), bonds: held.bonds * (1 + rBd), cash: held.cash * (1 + rCa), gold: held.gold * (1 + rGo) };
    const tot = gv.equities + gv.bonds + gv.cash + gv.gold;
    const drifted: Alloc = { equities: gv.equities / tot, bonds: gv.bonds / tot, cash: gv.cash / tot, gold: gv.gold / tot };
    const target = targets.get(rows[t].m) ?? drifted;
    const post: Alloc = band > 0 ? (half(target, drifted) <= band / 100 ? drifted : target) : target;
    out.push({ date: rows[t].date, rp, turn: half(post, drifted), cash: rows[t].ca }); held = post;
  }
  return out;
}
interface M { realCAGR: number | null; realMDD: number | null; sharpe: number | null; reallocShare: number }
function measure(pth: MonthStep[], cpi: Map<string, number>, from: number, to: number, bps: number): M | null {
  if (to - from < 2) return null; const cost = bps / 10000;
  let p = 100; const nominal: DP[] = [{ date: pth[from].date, value: 100 }]; const cashIdx: DP[] = [{ date: pth[from].date, value: pth[from].cash }]; const turns: number[] = [];
  for (let i = from + 1; i < to; i++) { const net = pth[i].rp - cost * 2 * pth[i].turn; p *= 1 + net; nominal.push({ date: pth[i].date, value: p }); cashIdx.push({ date: pth[i].date, value: pth[i].cash }); turns.push(pth[i].turn); }
  if (nominal.length < 2) return null;
  const real = deflate(nominal, cpi); const realK = real ? computeKpis(real) : null;
  const cashReal = deflate(cashIdx, cpi); const rf = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;
  const sharpe = realK && realK.annualized != null && realK.volatility ? (realK.annualized - rf) / realK.volatility : null;
  return { realCAGR: realK?.annualized ?? null, realMDD: real ? maxDD(real) : null, sharpe, reallocShare: turns.length ? turns.filter((v) => v > EPS).length / turns.length : 0 };
}
function fromIndex(pth: MonthStep[], years: number | null): number { if (years == null) return 0; const last = pth[pth.length - 1].date; const cut = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`; for (let i = 0; i < pth.length; i++) if (pth[i].date >= cut) return i; return pth.length - 1; }
function stdTargets(model: any): Map<string, Alloc> { const m = new Map<string, Alloc>(); for (const r of model.monthlyResults) m.set(mk(r.date), { equities: r.finalAllocation.equities, bonds: r.finalAllocation.bonds, gold: r.finalAllocation.gold, cash: r.finalAllocation.cash }); return m; }

// ── Chargement + chemins (dynamique, T=20) ────────────────────────────────────
const CODES: string[] = (await svc.listQuadrantCountries()).map((c: any) => c.iso);
const cache: Record<string, any> = {};
for (let i = 0; i < CODES.length; i += 4) { const chunk = CODES.slice(i, i + 4); const got = await Promise.all(chunk.map((c: string) => svc.getCountryQuadrantModel(c))); chunk.forEach((c, j) => { if (got[j].signal && got[j].perf) cache[c] = got[j]; }); }
const LOADED = Object.keys(cache);
const paths: Record<string, Record<number, { p: MonthStep[]; cpi: Map<string, number> }>> = {};
const DELTAS = [0, 3, 4, 5, 6, 8];
for (const code of LOADED) {
  const model = buildModel(cache[code].signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
  const { rows, cpi } = alignPerf(cache[code].perf); paths[code] = {};
  for (const d of DELTAS) paths[code][d] = { p: simulatePath(stdTargets(model), rows, d), cpi };
}
console.log(`Chargé ${LOADED.length} pays (dynamique, T=20).\n`);

// ── A. Plateau : δ candidat × horizon (net 25) — confirmation contiguïté ─────
console.log("═".repeat(72) + "\nA. PLATEAU (dynamique T=20, net 25 bps) — médiane ΔnetCAGR [%imp | pire décile]\n" + "═".repeat(72));
const HZ: [string, number | null][] = [["Max", null], ["20A", 20], ["10A", 10], ["5A", 5]];
console.log("δ  |    Max     |    20A     |    10A     |    5A");
for (const d of DELTAS) { if (!d) continue;
  const cells = HZ.map(([, y]) => { const ds: number[] = []; let imp = 0, n = 0; for (const c of LOADED) { const s = measure(paths[c][0].p, paths[c][0].cpi, fromIndex(paths[c][0].p, y), paths[c][0].p.length, 25); const r = measure(paths[c][d].p, paths[c][d].cpi, fromIndex(paths[c][d].p, y), paths[c][d].p.length, 25); if (!s || !r || s.realCAGR == null || r.realCAGR == null) continue; const dd = r.realCAGR - s.realCAGR; ds.push(dd); if (dd > 0) imp++; n++; } return `${median(ds).toFixed(2).padStart(5)} [${((imp / n) * 100).toFixed(0)}%|${worstDecile(ds).toFixed(2)}]`; });
  console.log(`${String(d).padStart(2)} | ${cells.join(" | ")}`);
}

// ── B. Sous-périodes : 1ʳᵉ vs 2ᵉ moitié de chaque pays (net 25) ──────────────
console.log("\n" + "═".repeat(72) + "\nB. STABILITÉ TEMPORELLE — 1ʳᵉ vs 2ᵉ moitié du parcours de chaque pays (net 25)\n" + "═".repeat(72));
console.log("δ  | H1 médiane [%imp] | H2 médiane [%imp]  (les deux doivent rester positives)");
for (const d of DELTAS) { if (!d) continue;
  const h1: number[] = [], h2: number[] = []; let i1 = 0, i2 = 0, n1 = 0, n2 = 0;
  for (const c of LOADED) {
    const p0 = paths[c][0].p, pd = paths[c][d].p, cpi = paths[c][0].cpi; const mid = Math.floor(p0.length / 2);
    const s1 = measure(p0, cpi, 0, mid, 25), r1 = measure(pd, cpi, 0, mid, 25);
    const s2 = measure(p0, cpi, mid, p0.length, 25), r2 = measure(pd, cpi, mid, p0.length, 25);
    if (s1 && r1 && s1.realCAGR != null && r1.realCAGR != null) { const dd = r1.realCAGR - s1.realCAGR; h1.push(dd); if (dd > 0) i1++; n1++; }
    if (s2 && r2 && s2.realCAGR != null && r2.realCAGR != null) { const dd = r2.realCAGR - s2.realCAGR; h2.push(dd); if (dd > 0) i2++; n2++; }
  }
  console.log(`${String(d).padStart(2)} | ${median(h1).toFixed(2).padStart(5)} [${((i1 / n1) * 100).toFixed(0)}%]        | ${median(h2).toFixed(2).padStart(5)} [${((i2 / n2) * 100).toFixed(0)}%]`);
}

// ── C. Leave-one-country-out sur δ=5 (Max, net 25) ───────────────────────────
console.log("\n" + "═".repeat(72) + "\nC. LEAVE-ONE-COUNTRY-OUT — δ=5, Max, net 25 : la médiane panel tient-elle sans chaque pays ?\n" + "═".repeat(72));
const perCountry: { code: string; d: number }[] = [];
for (const c of LOADED) { const s = measure(paths[c][0].p, paths[c][0].cpi, 0, paths[c][0].p.length, 25); const r = measure(paths[c][5].p, paths[c][5].cpi, 0, paths[c][5].p.length, 25); if (s && r && s.realCAGR != null && r.realCAGR != null) perCountry.push({ code: c, d: r.realCAGR - s.realCAGR }); }
const allD = perCountry.map((x) => x.d);
const looMedians = perCountry.map((_, i) => median(allD.filter((__, j) => j !== i)));
console.log(`  médiane panel complète : ${median(allD).toFixed(3)}`);
console.log(`  médianes leave-one-out : min ${Math.min(...looMedians).toFixed(3)} / max ${Math.max(...looMedians).toFixed(3)} (aucun pays ne renverse le signe si min>0)`);
console.log(`  % pays améliorés : ${((perCountry.filter((x) => x.d > 0).length / perCountry.length) * 100).toFixed(0)}%`);
const sorted = [...perCountry].sort((a, b) => b.d - a.d);
console.log(`  meilleurs : ${sorted.slice(0, 3).map((x) => `${x.code}+${x.d.toFixed(2)}`).join(" ")}`);
console.log(`  pires     : ${sorted.slice(-3).map((x) => `${x.code}${x.d.toFixed(2)}`).join(" ")}`);

// ── D. Sensibilité aux coûts pour δ=5 (le gain vient-il des coûts ?) ──────────
console.log("\n" + "═".repeat(72) + "\nD. GAIN = FONCTION DES COÛTS — δ=5, médiane ΔnetCAGR par horizon × coût\n" + "═".repeat(72));
console.log("coût |    Max  |   20A  |   10A  |   5A");
for (const bps of [0, 10, 25, 50]) {
  const cells = HZ.map(([, y]) => { const ds: number[] = []; for (const c of LOADED) { const s = measure(paths[c][0].p, paths[c][0].cpi, fromIndex(paths[c][0].p, y), paths[c][0].p.length, bps); const r = measure(paths[c][5].p, paths[c][5].cpi, fromIndex(paths[c][5].p, y), paths[c][5].p.length, bps); if (s && r && s.realCAGR != null && r.realCAGR != null) ds.push(r.realCAGR - s.realCAGR); } return median(ds).toFixed(2).padStart(5); });
  console.log(`${String(bps).padStart(3)}  | ${cells.join("  | ")}`);
}

await db.coredataPool?.end?.();
console.log("\n✅ Phase 3 (hors-échantillon) terminée.");
