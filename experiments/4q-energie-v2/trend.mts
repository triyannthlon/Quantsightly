// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE ÉNERGIE v2 — DERNIER test : SUIVI DE TENDANCE sur SPDYENT. LECTURE SEULE.
//
// AUTRE FAMILLE de stratégie (pas une variante du quadrant Monde). Question unique :
// une exposition tactique à l'Énergie, détenue quand SA PROPRE tendance mensuelle est
// positive, améliore-t-elle robustement `4q-standard-v2` en évitant une partie des
// krachs énergétiques ?
//   signal MONDIAL (niveau USD, identique tous pays) : active_t = SPDYENT_t > SMA_L_t
//   (SMA inclut t ; décision appliquée à t+1 ; aucune donnée après t).
//   Poche financée prorata, convertie en devise locale ; UNE bande v2 sur 5 poches ; t→t+1.
//
// 3 PORTEFEUILLES : (1) v2 sans énergie ; (2) énergie TOUJOURS détenue à e ; (3) énergie
// à e SEULEMENT si tendance positive. (2) isole la valeur de l'actif ; (3)−(2) = valeur
// propre du filtre de tendance. e=0 = v2 bit à bit.
//
// Params préenregistrés : principal L=12, w=10 %. Robustesse L∈{6,9,12}, w∈{10,15,20}%.
// w=5 % = test technique de frontière (rotation 5 % = bande → activation bloquée).
//   pnpm exec tsx experiments/4q-energie-v2/trend.mts
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
const BAND: number = REALLOCATION_BAND.v2;
const COST = 25;
const LS = [6, 9, 12], W = [0.05, 0.1, 0.15, 0.2];

type Core = { equities: number; bonds: number; gold: number; cash: number };
type Alloc5 = Core & { energy: number };
type DP = { date: string; value: number };
const A5 = ["equities", "bonds", "gold", "cash", "energy"] as const;
const q = (a: number[], p: number) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const ym2i = (s: string) => Number(s.slice(0, 4)) * 12 + (Number(s.slice(5, 7)) - 1);

// ── simulate 5 poches (identique canonical) ──────────────────────────────────
interface Row { m: string; date: string; eq: number; bd: number; ca: number; go: number; en: number }
interface Step { date: string; rp: number; turn: number; cash: number; heldEnergy: number }
const half5 = (a: Alloc5, b: Alloc5) => 0.5 * A5.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);
function simulate(targets: Map<string, Alloc5>, rows: Row[], band: number): Step[] {
  const start = rows.findIndex((r) => targets.has(r.m));
  if (start < 0 || start >= rows.length - 1) return [];
  let held: Alloc5 = targets.get(rows[start].m)!;
  const out: Step[] = [{ date: rows[start].date, rp: 0, turn: 0, cash: rows[start].ca, heldEnergy: held.energy }];
  for (let t = start + 1; t < rows.length; t++) {
    if (!targets.has(rows[t - 1].m)) continue;
    const p = rows[t - 1], c = rows[t];
    const rEq = c.eq / p.eq - 1, rBd = c.bd / p.bd - 1, rCa = c.ca / p.ca - 1, rGo = c.go / p.go - 1, rEn = c.en / p.en - 1;
    const rp = held.equities * rEq + held.bonds * rBd + held.cash * rCa + held.gold * rGo + held.energy * rEn;
    const heldEnergy = held.energy;
    const gv = { equities: held.equities * (1 + rEq), bonds: held.bonds * (1 + rBd), cash: held.cash * (1 + rCa), gold: held.gold * (1 + rGo), energy: held.energy * (1 + rEn) };
    const tot = gv.equities + gv.bonds + gv.cash + gv.gold + gv.energy;
    const drifted: Alloc5 = { equities: gv.equities / tot, bonds: gv.bonds / tot, cash: gv.cash / tot, gold: gv.gold / tot, energy: gv.energy / tot };
    const target = targets.get(rows[t].m) ?? drifted;
    const post: Alloc5 = band > 0 ? (half5(target, drifted) <= band ? drifted : target) : target;
    out.push({ date: c.date, rp, turn: half5(post, drifted), cash: c.ca, heldEnergy });
    held = post;
  }
  return out;
}
function maxDD(idx: DP[]): number { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function underwater(idx: DP[]): number { let pk = -Infinity, run = 0, mx = 0; for (const p of idx) { if (p.value >= pk) { pk = p.value; run = 0; } else { run++; if (run > mx) mx = run; } } return mx; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null { const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(p.date.slice(0, 7)) })).filter((x) => x.c! > 0); if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c!; return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) })); }
interface M { realCAGR: number | null; realVol: number | null; realSharpe: number | null; realMDD: number | null; uw: number | null }
/** Mesure net de coûts ; `excl` = plages [from,to] de mois à SAUTER (compounding continu). */
function measure(path: Step[], cpi: Map<string, number>, from: number, to: number, bps: number, excl: Array<[string, string]> = []): M | null {
  const cost = bps / 10000; let p = 100; const nom: DP[] = []; const cashI: DP[] = [];
  const skip = (ym: string) => excl.some(([a, b]) => ym >= a && ym <= b);
  for (let i = from; i < to; i++) {
    const ym = path[i].date.slice(0, 7);
    if (i > from && !skip(ym)) { p *= 1 + (path[i].rp - cost * 2 * path[i].turn); }
    if (!skip(ym)) { nom.push({ date: path[i].date, value: p }); cashI.push({ date: path[i].date, value: path[i].cash }); }
  }
  if (nom.length < 3) return null;
  const real = deflate(nom, cpi); if (!real) return null;
  const rk = computeKpis(real); const cr = deflate(cashI, cpi); const rf = cr ? (computeKpis(cr).annualized ?? 0) : 0;
  return { realCAGR: rk.annualized ?? null, realVol: rk.volatility ?? null, realSharpe: rk.annualized != null && rk.volatility ? (rk.annualized - rf) / rk.volatility : null, realMDD: maxDD(real), uw: underwater(real) };
}
function winBounds(path: Step[], from: string, to: string): [number, number] | null {
  const f = path.findIndex((p) => p.date.slice(0, 7) >= from); if (f < 0 || path[f].date.slice(0, 7) > to) return null;
  let t = -1; for (let i = path.length - 1; i >= 0; i--) if (path[i].date.slice(0, 7) <= to) { t = i + 1; break; }
  return t < 0 || t - f < 3 ? null : [f, t];
}

// ── données ───────────────────────────────────────────────────────────────────
console.error("Chargement…");
const fxRates: any[] = await db.getFxRates(); const usdPerUnit = new Map<string, any>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: DP[] = (await db.getSeriesData("SPDYENT Index-XX-5-2")).sort((a: DP, b: DP) => a.date.localeCompare(b.date));
const toLocal = (d: DP[], t: string) => (!t || t === "USD") ? d : compute.convertCurrency(d, null, usdPerUnit.get(t) ?? null);

// signal de tendance MONDIAL (USD) par L : active_t = SPDYENT_t > SMA_L (incluant t)
function trendSignal(L: number): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (let i = 0; i < energyUsd.length; i++) {
    if (i < L - 1) continue;
    let s = 0; for (let k = i - L + 1; k <= i; k++) s += energyUsd[k].value;
    m.set(energyUsd[i].date.slice(0, 7), energyUsd[i].value > s / L);
  }
  return m;
}

const isoList: any[] = (await svc.listQuadrantCountries()).filter((c: any) => c.iso !== "DK");
interface Loaded { code: string; base: Map<string, Core>; rows: Row[]; cpi: Map<string, number> }
const loaded: Loaded[] = [];
for (const { iso } of isoList) {
  const cm = await svc.getCountryQuadrantModel(iso); if (!cm.config || !cm.signal || !cm.perf) continue;
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  if (model.status !== "OK") continue;
  const base = new Map<string, Core>(); for (const r of model.monthlyResults) base.set(r.date.slice(0, 7), { equities: r.baseAllocation.equities, bonds: r.baseAllocation.bonds, gold: r.baseAllocation.gold, cash: r.baseAllocation.cash });
  const eL = toLocal(energyUsd, cm.config.currency);
  const byM = (a: DP[]) => { const mm = new Map<string, number>(); for (const p of a) mm.set(p.date.slice(0, 7), p.value); return mm; };
  const bd = byM(cm.perf.bondTotalReturn), ca = byM(cm.perf.cashTotalReturn), go = byM(cm.perf.gold), en = byM(eL), eq = byM(cm.perf.equityTotalReturn);
  const rows: Row[] = []; const dbm = new Map<string, string>(); for (const p of cm.perf.equityTotalReturn as DP[]) dbm.set(p.date.slice(0, 7), p.date);
  for (const [mm, date] of [...dbm.entries()].sort((a, b) => a[0].localeCompare(b[0]))) { const e = eq.get(mm), b = bd.get(mm), c = ca.get(mm), g = go.get(mm), n = en.get(mm); if (e! > 0 && b! > 0 && c! > 0 && g! > 0 && n! > 0) rows.push({ m: mm, date, eq: e!, bd: b!, ca: c!, go: g!, en: n! }); }
  const cpi = new Map<string, number>(); for (const p of (cm.perf.cpi ?? []) as DP[]) cpi.set(p.date.slice(0, 7), p.value);
  loaded.push({ code: iso, base, rows, cpi });
}
console.error(`  ${loaded.length} pays.`);

type Mode = "temoin" | "always" | "filtered";
function targetsFor(base: Map<string, Core>, sig: Map<string, boolean>, w: number, mode: Mode): Map<string, Alloc5> {
  const out = new Map<string, Alloc5>();
  for (const [m, b] of base) {
    let e = 0;
    if (mode === "always") e = w; else if (mode === "filtered") e = sig.get(m) ? w : 0;
    const k = 1 - e; out.set(m, { equities: b.equities * k, bonds: b.bonds * k, gold: b.gold * k, cash: b.cash * k, energy: e });
  }
  return out;
}
const witness = new Map<string, Step[]>();
for (const l of loaded) { const p = simulate(targetsFor(l.base, new Map(), 0, "temoin"), l.rows, BAND); if (p.length > 3) witness.set(l.code, p); }

const L: string[] = []; const P = (s = "") => { L.push(s); console.log(s); };
P("# Étude Énergie v2 — SUIVI DE TENDANCE sur SPDYENT (dernier test)\n");
P("Signal mondial `SPDYENT_t > SMA_L`, poche prorata, bande unique 5 poches, t→t+1. Δ = médiane sur 21 pays, net 25 bps, réel.\n");

// ── AUTO-VÉRIF e=0 = v2 (US) : simulate témoin doit redonner le socle v2 validé ─
{
  const l = loaded.find((x) => x.code === "US")!;
  const m0 = measure(witness.get("US")!, l.cpi, 0, witness.get("US")!.length, 0);
  const ok = Math.abs((m0?.realCAGR ?? 0) - 6.447) < 0.01;
  console.error(`AUTO-VÉRIF US témoin (e=0) : realCAGR ${m0?.realCAGR?.toFixed(3)} % (socle v2 = 6.447 %) ${ok ? "✅" : "⚠️"}`);
}

// ── 1. Diagnostic du filtre (signal mondial, L=12) ──────────────────────────
P("## 1. Diagnostic du filtre de tendance (signal mondial USD)");
P("| L | # signaux (on) | durée moy. position | rendement moy. SPDYENT ON | OFF | krach 2008 (juin→déc) filtre | krach 2022 (juin→déc) filtre |");
P("|---|---|---|---|---|---|---|");
const usdRet = new Map<string, number>();
for (let i = 1; i < energyUsd.length; i++) usdRet.set(energyUsd[i].date.slice(0, 7), energyUsd[i].value / energyUsd[i - 1].value - 1);
for (const Lm of LS) {
  const sig = trendSignal(Lm);
  const months = [...sig.keys()].sort();
  let onRuns = 0, prev = false, runLen = 0; const runs: number[] = [];
  let onRet: number[] = [], offRet: number[] = [];
  for (const m of months) { const on = sig.get(m)!; if (on && !prev) onRuns++; if (on) runLen++; else { if (runLen) runs.push(runLen); runLen = 0; } const r = usdRet.get(m); if (r !== undefined) (on ? onRet : offRet).push(r); prev = on; }
  if (runLen) runs.push(runLen);
  const crash = (from: string, to: string) => { let on = 0, tot = 0; for (const m of months) if (m >= from && m <= to) { tot++; if (sig.get(m)) on++; } return tot ? `${Math.round(on / tot * 100)}% ON` : "—"; };
  P(`| ${Lm} | ${onRuns} | ${mean(runs).toFixed(1)} mois | ${(mean(onRet) * 100).toFixed(2)}% | ${(mean(offRet) * 100).toFixed(2)}% | ${crash("2008-06", "2008-12")} | ${crash("2022-06", "2022-12")} |`);
}
P("\n→ Le filtre ajoute de la valeur si le rendement moyen ON ≫ OFF (il sort des mois perdants).");

// ── 2. TROIS portefeuilles — médiane ΔSharpe par sous-période (L=12, w=10) ───
const SUB: Array<[string, string, string]> = [["95-00", "1995-01", "2000-12"], ["01-05", "2001-01", "2005-12"], ["06-10", "2006-01", "2010-12"], ["11-15", "2011-01", "2015-12"], ["16-20", "2016-01", "2020-12"], ["21-26", "2021-01", "2100-12"], ["pré-2021", "1900-01", "2020-12"], ["Live11-26", "2011-01", "2100-12"], ["Max", "1900-01", "2100-12"]];
function threeWay(Lm: number, w: number) {
  const sig = trendSignal(Lm);
  const rows: any = { filtered: {}, always: {}, fVsA: {} };
  for (const [key, f, t] of SUB) {
    const dF: number[] = [], dA: number[] = [], dFA: number[] = [];
    for (const l of loaded) {
      const tem = witness.get(l.code); if (!tem) continue;
      const flt = simulate(targetsFor(l.base, sig, w, "filtered"), l.rows, BAND);
      const alw = simulate(targetsFor(l.base, sig, w, "always"), l.rows, BAND);
      const wb = winBounds(tem, f, t); if (!wb) continue;
      const cb = winBounds(flt, f, t), ab = winBounds(alw, f, t); if (!cb || !ab) continue;
      const m0 = measure(tem, l.cpi, wb[0], wb[1], COST), mF = measure(flt, l.cpi, cb[0], cb[1], COST), mA = measure(alw, l.cpi, ab[0], ab[1], COST);
      if (m0?.realSharpe != null && mF?.realSharpe != null) dF.push(mF.realSharpe - m0.realSharpe);
      if (m0?.realSharpe != null && mA?.realSharpe != null) dA.push(mA.realSharpe - m0.realSharpe);
      if (mF?.realSharpe != null && mA?.realSharpe != null) dFA.push(mF.realSharpe - mA.realSharpe);
    }
    rows.filtered[key] = median(dF); rows.always[key] = median(dA); rows.fVsA[key] = median(dFA);
  }
  return rows;
}
P("\n## 2. Trois portefeuilles — médiane ΔSharpe par sous-période (L=12, w=10 %)");
const tw = threeWay(12, 0.1);
P("| vs témoin v2 | " + SUB.map(([k]) => k).join(" | ") + " |");
P("|---|" + SUB.map(() => "---|").join(""));
const fmt = (o: any) => SUB.map(([k]) => `${o[k] >= 0 ? "+" : ""}${o[k].toFixed(3)}`).join(" | ");
P(`| **filtré** (tendance) | ${fmt(tw.filtered)} |`);
P(`| **toujours investi** | ${fmt(tw.always)} |`);
P(`| **filtré − toujours** (valeur du filtre) | ${fmt(tw.fVsA)} |`);

// ── 3. Grille L×w : ΔSharpe Max / pré-2021 (filtré vs témoin) ────────────────
P("\n## 3. Grille L×w — médiane ΔSharpe **Max** / (**pré-2021**) — filtré vs témoin");
P("| L \\ w | " + W.map((w) => `${w * 100}%`).join(" | ") + " |");
P("|" + "---|".repeat(W.length + 1));
for (const Lm of LS) {
  const sig = trendSignal(Lm);
  const cells = W.map((w) => {
    const dMax: number[] = [], dPre: number[] = [];
    for (const l of loaded) { const tem = witness.get(l.code); if (!tem) continue; const flt = simulate(targetsFor(l.base, sig, w, "filtered"), l.rows, BAND); const m0 = measure(tem, l.cpi, 0, tem.length, COST), m1 = measure(flt, l.cpi, 0, flt.length, COST); if (m0?.realSharpe != null && m1?.realSharpe != null) dMax.push(m1.realSharpe - m0.realSharpe); const wb = winBounds(tem, "1900-01", "2020-12"), cb = winBounds(flt, "1900-01", "2020-12"); if (wb && cb) { const p0 = measure(tem, l.cpi, wb[0], wb[1], COST), p1 = measure(flt, l.cpi, cb[0], cb[1], COST); if (p0?.realSharpe != null && p1?.realSharpe != null) dPre.push(p1.realSharpe - p0.realSharpe); } }
    return `${median(dMax) >= 0 ? "+" : ""}${median(dMax).toFixed(3)} (${median(dPre) >= 0 ? "+" : ""}${median(dPre).toFixed(3)})`;
  });
  P(`| **${Lm}** | ${cells.join(" | ")} |`);
}

// ── 4. Métriques complètes + sans 2007-2008 / sans 2021-2022 (L=12, w=10) ───
P("\n## 4. Métriques réelles nettes — filtré vs témoin (L=12, w=10 %), médianes");
const sig12 = trendSignal(12);
function metricsRow(from: string, to: string, excl: Array<[string, string]> = []) {
  const dC: number[] = [], dS: number[] = [], dM: number[] = [], dU: number[] = [];
  for (const l of loaded) { const tem = witness.get(l.code); if (!tem) continue; const flt = simulate(targetsFor(l.base, sig12, 0.1, "filtered"), l.rows, BAND); const wb = winBounds(tem, from, to), cb = winBounds(flt, from, to); if (!wb || !cb) continue; const m0 = measure(tem, l.cpi, wb[0], wb[1], COST, excl), m1 = measure(flt, l.cpi, cb[0], cb[1], COST, excl); if (!m0 || !m1 || m0.realSharpe == null || m1.realSharpe == null) continue; dC.push((m1.realCAGR ?? 0) - (m0.realCAGR ?? 0)); dS.push(m1.realSharpe - m0.realSharpe); dM.push((m1.realMDD ?? 0) - (m0.realMDD ?? 0)); dU.push((m1.uw ?? 0) - (m0.uw ?? 0)); }
  return `${median(dC) >= 0 ? "+" : ""}${median(dC).toFixed(2)} | ${median(dS) >= 0 ? "+" : ""}${median(dS).toFixed(3)} | ${median(dM) >= 0 ? "+" : ""}${median(dM).toFixed(1)} | ${median(dU) >= 0 ? "+" : ""}${median(dU).toFixed(0)}`;
}
P("| période | ΔCAGR | ΔSharpe | ΔMDD | Δsous-l'eau |");
P("|---|---|---|---|---|");
P(`| Max | ${metricsRow("1900-01", "2100-12")} |`);
P(`| pré-2021 | ${metricsRow("1900-01", "2020-12")} |`);
P(`| post-lancement (2011→) | ${metricsRow("2011-02", "2100-12")} |`);
P(`| sans 2007-2008 | ${metricsRow("1900-01", "2100-12", [["2007-01", "2008-12"]])} |`);
P(`| sans 2021-2022 | ${metricsRow("1900-01", "2100-12", [["2021-01", "2022-12"]])} |`);
P(`| sans 07-08 ET 21-22 | ${metricsRow("1900-01", "2100-12", [["2007-01", "2008-12"], ["2021-01", "2022-12"]])} |`);

// ── 5. ÉPISODES (filtré vs témoin, L=12 w=10) ────────────────────────────────
P("\n## 5. Analyse par ÉPISODES — filtré vs témoin (L=12, w=10 %)");
function epAnalysis(Lm: number, w: number) {
  const sig = trendSignal(Lm);
  const months = [...sig.keys()].sort(); const act = months.filter((m) => sig.get(m)).map(ym2i);
  const eps: Array<{ fromI: number; toI: number }> = []; if (act.length) { let s = act[0], p = act[0]; for (let i = 1; i < act.length; i++) { if (act[i] - p <= 3) p = act[i]; else { eps.push({ fromI: s, toI: p }); s = act[i]; p = act[i]; } } eps.push({ fromI: s, toI: p }); }
  const i2ym = (i: number) => `${Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`;
  const epFrom = eps.map((e) => e.fromI);
  const owner = (ti: number) => { let b = -1; for (let k = 0; k < epFrom.length; k++) if (epFrom[k] <= ti) b = k; return b; };
  const is = (k: number, a: string, b: string) => eps[k].toI >= ym2i(a) && eps[k].fromI <= ym2i(b);
  const per: any[] = [];
  for (const l of loaded) {
    const tem = witness.get(l.code); if (!tem) continue; const flt = simulate(targetsFor(l.base, sig, w, "filtered"), l.rows, BAND); if (flt.length !== tem.length) continue;
    const c = COST / 10000; const epLog = new Array(eps.length).fill(0); let total = 0;
    for (let i = 1; i < flt.length; i++) { const d = Math.log(1 + (flt[i].rp - c * 2 * flt[i].turn)) - Math.log(1 + (tem[i].rp - c * 2 * tem[i].turn)); total += d; if (flt[i].heldEnergy > 1e-9) { const k = owner(ym2i(flt[i].date.slice(0, 7))); if (k >= 0) epLog[k] += d; } }
    const loeo = eps.length ? Math.min(...eps.map((_, k) => total - epLog[k])) : total;
    const ex0708 = total - eps.reduce((s, _, k) => s + (is(k, "2007-01", "2008-12") ? epLog[k] : 0), 0);
    const ex2122 = total - eps.reduce((s, _, k) => s + (is(k, "2021-01", "2022-12") ? epLog[k] : 0), 0);
    const best = eps.length ? Math.max(...epLog) : 0;
    per.push({ total, epLog, loeo, ex0708, ex2122, bestShare: total > 1e-9 ? best / total : NaN });
  }
  return { eps: eps.map((e) => ({ from: i2ym(e.fromI), to: i2ym(e.toI) })), per };
}
// Résumé robustesse par épisode pour tous les L (w=10) — le juge de paix.
P("Écart de log-perf réel cumulé médian (×100). Robuste = positif APRÈS retrait du meilleur épisode ET de 2021-2022.\n");
P("| L (w=10 %) | # épisodes | total | leave-one-episode-out (pire) | sans 2007-08 | **sans 2021-22** | part meilleur épisode |");
P("|---|---|---|---|---|---|---|");
for (const Lm of LS) {
  const e = epAnalysis(Lm, 0.1);
  const T = median(e.per.map((p: any) => p.total)) * 100, lo = median(e.per.map((p: any) => p.loeo)) * 100, e07 = median(e.per.map((p: any) => p.ex0708)) * 100, e21 = median(e.per.map((p: any) => p.ex2122)) * 100, bs = median(e.per.map((p: any) => p.bestShare).filter(Number.isFinite)) * 100;
  P(`| ${Lm} | ${e.eps.length} | ${T >= 0 ? "+" : ""}${T.toFixed(2)} | ${lo >= 0 ? "+" : ""}${lo.toFixed(2)} | ${e07 >= 0 ? "+" : ""}${e07.toFixed(2)} | ${e21 >= 0 ? "+" : ""}${e21.toFixed(2)} | ${bs.toFixed(0)}% |`);
}
// Détail des épisodes pour L=12 (principal).
const ep = epAnalysis(12, 0.1);
P(`\nDétail L=12 — ${ep.eps.length} épisodes : ${ep.eps.map((e: any) => `${e.from}→${e.to}`).join(", ")}`);
P("\n| épisode (L=12) | contribution médiane (×100) |");
P("|---|---|");
ep.eps.forEach((e: any, k: number) => P(`| ${e.from}→${e.to} | ${median(ep.per.map((p: any) => p.epLog[k])) * 100 >= 0 ? "+" : ""}${(median(ep.per.map((p: any) => p.epLog[k])) * 100).toFixed(2)} |`));

writeFileSync(path.join(HERE, "trend-report.md"), L.join("\n"));
await db.coredataPool?.end?.();
console.error("\n✅ Terminé — trend-report.md");
