// ÉTUDE 2 — génère le MANIFESTE de reproductibilité : empreintes des données +
// agrégats PAR PAYS (horizon × stratégie × seuil × coût) en CSV compact.
// LECTURE SEULE. pnpm exec tsx experiments/4q-stabilisation/study2-manifest.mts
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
const { buildModel, DEFAULT_FOUR_QUADRANTS_SETTINGS } = eng;
const { computeKpis } = cmp;

type Alloc = { equities: number; bonds: number; gold: number; cash: number };
type DP = { date: string; value: number };
const KEYS: (keyof Alloc)[] = ["equities", "bonds", "gold", "cash"];
const mk = (d: string) => d.slice(0, 7);
const half = (a: Alloc, b: Alloc) => 0.5 * KEYS.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);
const EPS = 0.005;

// FNV-1a 32 bits (empreinte déterministe d'une série).
function fnv1a(s: string): string { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, "0"); }
function seriesFingerprint(data: DP[]): { first: string; last: string; n: number; hash: string } {
  if (!data?.length) return { first: "—", last: "—", n: 0, hash: "00000000" };
  const s = data.map((p) => `${p.date}:${p.value.toPrecision(12)}`).join("|");
  return { first: data[0].date, last: data[data.length - 1].date, n: data.length, hash: fnv1a(s) };
}

// ── Simulateur bande (identique à study2-band.mts) ───────────────────────────
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
function underwater(idx: DP[]): number { let pk = -Infinity, run = 0, mx = 0; for (const p of idx) { if (p.value >= pk) { pk = p.value; run = 0; } else { run++; if (run > mx) mx = run; } } return mx; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null { const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(mk(p.date)) })).filter((x) => x.c! > 0); if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c!; return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) })); }
interface MonthStep { date: string; rp: number; turn: number; cash: number }
function simulatePath(targets: Map<string, Alloc>, rows: Row[], band: number): MonthStep[] {
  const start = rows.findIndex((r) => targets.has(r.m)); if (start < 0 || start >= rows.length - 1) return [];
  let held: Alloc = targets.get(rows[start].m)!; const out: MonthStep[] = [{ date: rows[start].date, rp: 0, turn: 0, cash: rows[start].ca }];
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
interface M { realCAGR: number | null; realVol: number | null; realSharpe: number | null; realMDD: number | null; underwater: number | null; rotation: number; reallocFreq: number; months: number }
function measure(pth: MonthStep[], cpi: Map<string, number>, from: number, bps: number): M | null {
  if (pth.length - from < 2) return null; const cost = bps / 10000;
  let p = 100; const nominal: DP[] = [{ date: pth[from].date, value: 100 }]; const cashIdx: DP[] = [{ date: pth[from].date, value: pth[from].cash }]; const turns: number[] = [];
  for (let i = from + 1; i < pth.length; i++) { const net = pth[i].rp - cost * 2 * pth[i].turn; p *= 1 + net; nominal.push({ date: pth[i].date, value: p }); cashIdx.push({ date: pth[i].date, value: pth[i].cash }); turns.push(pth[i].turn); }
  if (nominal.length < 2) return null;
  const real = deflate(nominal, cpi); const realK = real ? computeKpis(real) : null;
  const cashReal = deflate(cashIdx, cpi); const rf = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;
  const sharpe = realK && realK.annualized != null && realK.volatility ? (realK.annualized - rf) / realK.volatility : null;
  const meanTurn = turns.length ? turns.reduce((s, v) => s + v, 0) / turns.length : 0;
  return { realCAGR: realK?.annualized ?? null, realVol: realK?.volatility ?? null, realSharpe: sharpe, realMDD: real ? maxDD(real) : null, underwater: real ? underwater(real) : null, rotation: meanTurn * 12, reallocFreq: (turns.length ? turns.filter((v) => v > EPS).length / turns.length : 0) * 12, months: nominal.length };
}
function fromIndex(pth: MonthStep[], years: number | null): number { if (years == null) return 0; const last = pth[pth.length - 1].date; const cut = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`; for (let i = 0; i < pth.length; i++) if (pth[i].date >= cut) return i; return pth.length - 1; }
function stdTargets(model: any): Map<string, Alloc> { const m = new Map<string, Alloc>(); for (const r of model.monthlyResults) m.set(mk(r.date), { equities: r.finalAllocation.equities, bonds: r.finalAllocation.bonds, gold: r.finalAllocation.gold, cash: r.finalAllocation.cash }); return m; }

// ── Chargement ────────────────────────────────────────────────────────────────
const CODES: string[] = (await svc.listQuadrantCountries()).map((c: any) => c.iso);
const cache: Record<string, any> = {};
for (let i = 0; i < CODES.length; i += 4) { const chunk = CODES.slice(i, i + 4); const got = await Promise.all(chunk.map((c: string) => svc.getCountryQuadrantModel(c))); chunk.forEach((c, j) => { if (got[j].config && got[j].perf) cache[c] = got[j]; }); }
const LOADED = Object.keys(cache).sort();

// ── 1. Empreintes des données ─────────────────────────────────────────────────
const fpLines: string[] = ["country,currency,equityTR_range,n,cpi_range,combinedHash"];
for (const code of LOADED) {
  const c = cache[code]; const perf = c.perf;
  const parts = ["equityTotalReturn", "bondTotalReturn", "cashTotalReturn", "gold", "cpi"].map((k) => seriesFingerprint(perf[k] ?? []));
  const combined = fnv1a(parts.map((p) => p.hash).join(""));
  const eq = parts[0], cpi = parts[4];
  fpLines.push(`${code},${c.config.currency},${eq.first}→${eq.last},${eq.n},${cpi.first}→${cpi.last},${combined}`);
}
writeFileSync(path.join(HERE, "study2-fingerprints.csv"), fpLines.join("\n"));

// ── 2. Agrégats PAR PAYS (δ × stratégie × T × horizon × coût) ─────────────────
const DELTAS = [0, 3, 4, 5, 6, 8];
const HZ: [string, number | null][] = [["Max", null], ["20A", 20], ["10A", 10], ["5A", 5]];
const COSTS = [0, 25, 50];
const rows: string[] = ["country,strategy,T,delta,horizon,cost_bps,realCAGR,realVol,realSharpe,realMDD,underwater_m,rotation_pct_yr,realloc_per_yr,months"];
const configs: [string, number][] = [["dynamic", 20], ["binary", 20], ["dynamic", 0], ["dynamic", 50]];
for (const code of LOADED) {
  for (const [strategy, T] of configs) {
    const model = buildModel(cache[code].signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: T });
    if (model.status !== "OK") continue;
    const { rows: prows, cpi } = alignPerf(cache[code].perf);
    for (const d of DELTAS) {
      const path_ = simulatePath(stdTargets(model), prows, d);
      for (const [hkey, years] of HZ) {
        const from = fromIndex(path_, years);
        for (const cost of COSTS) {
          const m = measure(path_, cpi, from, cost);
          if (!m) continue;
          const f = (v: number | null, dp = 3) => (v == null ? "" : v.toFixed(dp));
          rows.push(`${code},${strategy},${T},${d},${hkey},${cost},${f(m.realCAGR)},${f(m.realVol)},${f(m.realSharpe)},${f(m.realMDD)},${m.underwater ?? ""},${f(m.rotation * 100, 1)},${f(m.reallocFreq, 2)},${m.months}`);
        }
      }
    }
  }
}
writeFileSync(path.join(HERE, "study2-percountry.csv"), rows.join("\n"));

console.log(`✅ Écrit : study2-fingerprints.csv (${LOADED.length} pays) + study2-percountry.csv (${rows.length - 1} lignes).`);
console.log("\nEmpreintes (aperçu) :");
console.log(fpLines.slice(0, 6).join("\n"));
await db.coredataPool?.end?.();
