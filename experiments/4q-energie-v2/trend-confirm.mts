// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE ÉNERGIE v2 — CONFIRMATION préenregistrée du FILTRE RAPIDE. LECTURE SEULE.
//
// Grille EXCLUSIVE (aucune extension après lecture) : L ∈ {4,5,6,7,8}, w ∈ {10,15}%.
// Principale L=6/w=10. L=9 = contrôle négatif rappelé (pas ré-optimisé).
// Règle : active_t = SPDYENT_t > SMA_L (clôture t, données ≤ t), appliquée à t+1.
// Inchangé : prorata, SPDYENT→local, UNE bande v2 sur 5 poches, coûts au compounding,
// témoin v2, témoin toujours-investi, e=0 = v2 bit à bit.
//
// PLATEAU exigé sur L=5,6,7 (positif au seul L=6 + dégradation à 5/7 = artefact → clôture).
// Barres conjointes (autour de L=6, w 10-15, 25 bps ppal / 50 bps stress) :
//  ΔCAGR>0 · ΔSharpe≥0 · LOEO≥0 · sans-2021-22≥0 · sans-2007-08≥0 · meilleur-ép. non excessif
//  · ΔMDD non dégradé · post-lancement cohérent · stabilité pays/horizons/poids.
//   pnpm exec tsx experiments/4q-energie-v2/trend-confirm.mts
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
const { buildModel, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = fq;
const { computeKpis } = compute;
const BAND: number = REALLOCATION_BAND.v2;
const LS = [4, 5, 6, 7, 8], LCTRL = 9, WS = [0.1, 0.15];

type Core = { equities: number; bonds: number; gold: number; cash: number };
type Alloc5 = Core & { energy: number };
type DP = { date: string; value: number };
const A5 = ["equities", "bonds", "gold", "cash", "energy"] as const;
const q = (a: number[], p: number) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const ym2i = (s: string) => Number(s.slice(0, 4)) * 12 + (Number(s.slice(5, 7)) - 1);
const sg = (v: number, d = 3) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;

// ── simulate 5 poches (identique canonical/trend) ────────────────────────────
interface Row { m: string; date: string; eq: number; bd: number; ca: number; go: number; en: number }
interface Step { date: string; rp: number; turn: number; cash: number; heldEnergy: number }
const half5 = (a: Alloc5, b: Alloc5) => 0.5 * A5.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);
function simulate(targets: Map<string, Alloc5>, rows: Row[], band: number): Step[] {
  const start = rows.findIndex((r) => targets.has(r.m)); if (start < 0 || start >= rows.length - 1) return [];
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
interface M { cagr: number | null; vol: number | null; sharpe: number | null; mdd: number | null; uw: number | null; rot: number; freq: number }
const EPS = 0.005;
function measure(path: Step[], cpi: Map<string, number>, from: number, to: number, bps: number, excl: Array<[string, string]> = []): M | null {
  const cost = bps / 10000; let p = 100; const nom: DP[] = []; const cashI: DP[] = []; const turns: number[] = [];
  const skip = (ym: string) => excl.some(([a, b]) => ym >= a && ym <= b);
  for (let i = from; i < to; i++) { const ym = path[i].date.slice(0, 7); if (skip(ym)) continue; if (nom.length) p *= 1 + (path[i].rp - cost * 2 * path[i].turn); nom.push({ date: path[i].date, value: p }); cashI.push({ date: path[i].date, value: path[i].cash }); if (nom.length > 1) turns.push(path[i].turn); }
  if (nom.length < 3) return null;
  const real = deflate(nom, cpi); if (!real) return null;
  const rk = computeKpis(real); const cr = deflate(cashI, cpi); const rf = cr ? (computeKpis(cr).annualized ?? 0) : 0;
  const mt = turns.length ? mean(turns) : 0;
  return { cagr: rk.annualized ?? null, vol: rk.volatility ?? null, sharpe: rk.annualized != null && rk.volatility ? (rk.annualized - rf) / rk.volatility : null, mdd: maxDD(real), uw: underwater(real), rot: mt * 12, freq: turns.length ? (turns.filter((v) => v > EPS).length / turns.length) * 12 : 0 };
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
const usdRet = new Map<string, number>(); for (let i = 1; i < energyUsd.length; i++) usdRet.set(energyUsd[i].date.slice(0, 7), energyUsd[i].value / energyUsd[i - 1].value - 1);
function trendSignal(Lm: number): Map<string, boolean> { const m = new Map<string, boolean>(); for (let i = 0; i < energyUsd.length; i++) { if (i < Lm - 1) continue; let s = 0; for (let k = i - Lm + 1; k <= i; k++) s += energyUsd[k].value; m.set(energyUsd[i].date.slice(0, 7), energyUsd[i].value > s / Lm); } return m; }

const isoList: any[] = (await svc.listQuadrantCountries()).filter((c: any) => c.iso !== "DK");
interface Loaded { code: string; base: Map<string, Core>; rows: Row[]; cpi: Map<string, number> }
const loaded: Loaded[] = [];
for (const { iso } of isoList) {
  const cm = await svc.getCountryQuadrantModel(iso); if (!cm.config || !cm.signal || !cm.perf) continue;
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" }); if (model.status !== "OK") continue;
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
  for (const [m, b] of base) { let e = 0; if (mode === "always") e = w; else if (mode === "filtered") e = sig.get(m) ? w : 0; const k = 1 - e; out.set(m, { equities: b.equities * k, bonds: b.bonds * k, gold: b.gold * k, cash: b.cash * k, energy: e }); }
  return out;
}
const witness = new Map<string, Step[]>();
for (const l of loaded) { const p = simulate(targetsFor(l.base, new Map(), 0, "temoin"), l.rows, BAND); if (p.length > 3) witness.set(l.code, p); }

// ── métriques agrégées (filtré vs témoin) sur une fenêtre ────────────────────
function aggWin(Lm: number, w: number, cost: number, from: string, to: string, excl: Array<[string, string]> = []) {
  const sig = trendSignal(Lm); const dC: number[] = [], dS: number[] = [], dM: number[] = [], dU: number[] = [], dR: number[] = [], dF: number[] = []; let imp = 0, n = 0;
  for (const l of loaded) { const tem = witness.get(l.code); if (!tem) continue; const flt = simulate(targetsFor(l.base, sig, w, "filtered"), l.rows, BAND); const wb = winBounds(tem, from, to), cb = winBounds(flt, from, to); if (!wb || !cb) continue; const m0 = measure(tem, l.cpi, wb[0], wb[1], cost, excl), m1 = measure(flt, l.cpi, cb[0], cb[1], cost, excl); if (!m0 || !m1 || m0.sharpe == null || m1.sharpe == null) continue; n++; dC.push((m1.cagr ?? 0) - (m0.cagr ?? 0)); if ((m1.sharpe - m0.sharpe) > 0) imp++; dS.push(m1.sharpe - m0.sharpe); dM.push((m1.mdd ?? 0) - (m0.mdd ?? 0)); dU.push((m1.uw ?? 0) - (m0.uw ?? 0)); dR.push(m1.rot - m0.rot); dF.push(m1.freq - m0.freq); }
  return { dCAGR: median(dC), dSharpe: median(dS), dMDD: median(dM), dUW: median(dU), dRot: median(dR), dFreq: median(dF), pImp: n ? imp / n : NaN, n };
}
// ── analyse par épisodes (filtré vs témoin) ─────────────────────────────────
function epAnalysis(Lm: number, w: number, cost: number) {
  const sig = trendSignal(Lm); const months = [...sig.keys()].sort(); const act = months.filter((m) => sig.get(m)).map(ym2i);
  const eps: Array<{ fromI: number; toI: number }> = []; if (act.length) { let s = act[0], p = act[0]; for (let i = 1; i < act.length; i++) { if (act[i] - p <= 3) p = act[i]; else { eps.push({ fromI: s, toI: p }); s = act[i]; p = act[i]; } } eps.push({ fromI: s, toI: p }); }
  const epFrom = eps.map((e) => e.fromI); const owner = (ti: number) => { let b = -1; for (let k = 0; k < epFrom.length; k++) if (epFrom[k] <= ti) b = k; return b; };
  const is = (k: number, a: string, b: string) => eps[k].toI >= ym2i(a) && eps[k].fromI <= ym2i(b);
  const per: any[] = []; const c = cost / 10000;
  for (const l of loaded) { const tem = witness.get(l.code); if (!tem) continue; const flt = simulate(targetsFor(l.base, sig, w, "filtered"), l.rows, BAND); if (flt.length !== tem.length) continue; const epLog = new Array(eps.length).fill(0); let total = 0; for (let i = 1; i < flt.length; i++) { const d = Math.log(1 + (flt[i].rp - c * 2 * flt[i].turn)) - Math.log(1 + (tem[i].rp - c * 2 * tem[i].turn)); total += d; if (flt[i].heldEnergy > 1e-9) { const k = owner(ym2i(flt[i].date.slice(0, 7))); if (k >= 0) epLog[k] += d; } } const loeo = eps.length ? Math.min(...eps.map((_, k) => total - epLog[k])) : total; const ex07 = total - eps.reduce((s, _, k) => s + (is(k, "2007-01", "2008-12") ? epLog[k] : 0), 0); const ex21 = total - eps.reduce((s, _, k) => s + (is(k, "2021-01", "2022-12") ? epLog[k] : 0), 0); const best = eps.length ? Math.max(...epLog) : 0; per.push({ total, loeo, ex07, ex21, bestShare: total > 1e-9 ? best / total : NaN }); }
  return { nEps: eps.length, total: median(per.map((p) => p.total)) * 100, loeo: median(per.map((p) => p.loeo)) * 100, ex07: median(per.map((p) => p.ex07)) * 100, ex21: median(per.map((p) => p.ex21)) * 100, bestShare: median(per.map((p) => p.bestShare).filter(Number.isFinite)) * 100 };
}
// ── diagnostic du filtre (signal mondial) : lags, participation, pertes ──────
function zigzag(minSwing: number) { const v = energyUsd; const piv: Array<{ i: number; type: "peak" | "trough" }> = []; let ext = 0, dir = 0; for (let i = 1; i < v.length; i++) { if (dir <= 0 && v[i].value >= v[ext].value * (1 + minSwing)) { piv.push({ i: ext, type: "trough" }); dir = 1; ext = i; } else if (dir >= 0 && v[i].value <= v[ext].value * (1 - minSwing)) { piv.push({ i: ext, type: "peak" }); dir = -1; ext = i; } else if ((dir >= 0 && v[i].value > v[ext].value) || (dir <= 0 && v[i].value < v[ext].value)) ext = i; } return piv; }
const PIV = zigzag(0.2);
function filterDiag(Lm: number) {
  const sig = trendSignal(Lm); const months = [...sig.keys()].sort();
  let onRuns = 0, prev = false, runLen = 0; const runs: number[] = []; let onN = 0, totN = 0; const onRet: number[] = [], offRet: number[] = [];
  for (const m of months) { const on = sig.get(m)!; totN++; if (on) onN++; if (on && !prev) onRuns++; if (on) runLen++; else { if (runLen) runs.push(runLen); runLen = 0; } const r = usdRet.get(m); if (r !== undefined) (on ? onRet : offRet).push(r); prev = on; }
  if (runLen) runs.push(runLen);
  // lags via pivots
  const entryLags: number[] = [], exitLags: number[] = [];
  for (const p of PIV) { const pm = energyUsd[p.i].date.slice(0, 7); const pmI = ym2i(pm); for (let k = 0; k <= 18; k++) { const ym = `${Math.floor((pmI + k) / 12)}-${String((pmI + k) % 12 + 1).padStart(2, "0")}`; const s = sig.get(ym); if (s === undefined) continue; if (p.type === "trough" && s) { entryLags.push(k); break; } if (p.type === "peak" && !s) { exitLags.push(k); break; } } }
  // participation aux hausses / pertes dans les baisses (log-ret énergie USD par segment)
  let riseCap = 0, riseTot = 0, fallTaken = 0, fallTot = 0;
  for (let s = 0; s < PIV.length - 1; s++) { const a = PIV[s], b = PIV[s + 1]; const rising = a.type === "trough"; for (let i = a.i + 1; i <= b.i; i++) { const ym = energyUsd[i].date.slice(0, 7); const lr = Math.log(energyUsd[i].value / energyUsd[i - 1].value); const on = sig.get(ym) ?? false; if (rising) { riseTot += lr; if (on) riseCap += lr; } else { fallTot += lr; if (on) fallTaken += lr; } } }
  const crash = (from: string, to: string) => { let on = 0, tot = 0; for (const m of months) if (m >= from && m <= to) { tot++; if (sig.get(m)) on++; } return tot ? Math.round(on / tot * 100) : 0; };
  return { activePct: totN ? onN / totN * 100 : 0, onRuns, avgDur: mean(runs), onRet: mean(onRet) * 100, offRet: mean(offRet) * 100, entryLag: mean(entryLags), exitLag: mean(exitLags), participation: riseTot ? riseCap / riseTot * 100 : 0, fallTaken: fallTot ? fallTaken / fallTot * 100 : 0, crash08: crash("2008-06", "2008-12"), crash22: crash("2022-06", "2022-12") };
}

const OUT: string[] = []; const P = (s = "") => { OUT.push(s); console.log(s); };
P("# Étude Énergie v2 — CONFIRMATION du filtre rapide (préenregistré)\n");
P("Signal `SPDYENT>SMA_L`, prorata, bande unique 5 poches, t→t+1, 21 pays, réel, médianes. Principale L=6/w=10.\n");
{ const l = loaded.find((x) => x.code === "US")!; const m0 = measure(witness.get("US")!, l.cpi, 0, witness.get("US")!.length, 0); console.error(`AUTO-VÉRIF US témoin realCAGR ${m0?.cagr?.toFixed(3)} % (v2 = 6.447) ${Math.abs((m0?.cagr ?? 0) - 6.447) < 0.01 ? "✅" : "⚠️"}`); }

// 1. Diagnostic du filtre par L
P("## 1. Diagnostic du filtre de tendance (signal mondial USD, zigzag 20 %)");
P("| L | actif % | # épisodes | durée moy | retard entrée | retard sortie | particip. hausses | pertes prises baisses | rdt ON | OFF | krach08 %ON | krach22 %ON |");
P("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const Lm of [...LS, LCTRL]) { const d = filterDiag(Lm); P(`| ${Lm}${Lm === LCTRL ? " (ctrl)" : ""} | ${d.activePct.toFixed(0)}% | ${d.onRuns} | ${d.avgDur.toFixed(1)} | ${d.entryLag.toFixed(1)} | ${d.exitLag.toFixed(1)} | ${d.participation.toFixed(0)}% | ${d.fallTaken.toFixed(0)}% | ${sg(d.onRet, 2)}% | ${sg(d.offRet, 2)}% | ${d.crash08}% | ${d.crash22}% |`); }
P("\n→ Filtre efficace = retard sortie court, faible % pris dans les baisses, rdt ON ≫ OFF.");

// 2. TABLE PRINCIPALE de robustesse (25 bps), w=10 puis 15
for (const w of WS) {
  P(`\n## 2.${w === 0.1 ? "a" : "b"} Robustesse par L — w=${w * 100} %, **25 bps** (plateau exigé sur L=5,6,7)`);
  P("| L | ΔCAGR Max | ΔSharpe Max | ΔMDD | sans-07/08 | **sans-21/22** | LOEO | meilleur ép. | post-lanc ΔSh | %améliorés |");
  P("|---|---|---|---|---|---|---|---|---|---|");
  for (const Lm of [...LS, LCTRL]) {
    const a = aggWin(Lm, w, 25, "1900-01", "2100-12"); const e = epAnalysis(Lm, w, 25); const post = aggWin(Lm, w, 25, "2011-02", "2100-12");
    P(`| ${Lm}${Lm === LCTRL ? " (ctrl)" : ""} | ${sg(a.dCAGR, 2)} | ${sg(a.dSharpe)} | ${sg(a.dMDD, 1)} | ${sg(e.ex07, 2)} | ${sg(e.ex21, 2)} | ${sg(e.loeo, 2)} | ${e.bestShare.toFixed(0)}% | ${sg(post.dSharpe)} | ${(a.pImp * 100).toFixed(0)}% |`);
  }
}
// 3. Stress 50 bps (compact)
P("\n## 3. Stress **50 bps** — ΔSharpe Max / sans-21/22 (LOEO)");
P("| L | w=10 | w=15 |");
P("|---|---|---|");
for (const Lm of [...LS, LCTRL]) { const cells = WS.map((w) => { const a = aggWin(Lm, w, 50, "1900-01", "2100-12"); const e = epAnalysis(Lm, w, 50); return `${sg(a.dSharpe)} / ${sg(e.ex21, 2)} (${sg(e.loeo, 2)})`; }); P(`| ${Lm}${Lm === LCTRL ? " (ctrl)" : ""} | ${cells.join(" | ")} |`); }

// 4. Cellule principale L=6/w=10 : tranches temporelles + horizons + rotation
P("\n## 4. Cellule principale L=6 / w=10 — tranches temporelles (25 bps)");
const SLICES: Array<[string, string, string]> = [["95-00", "1995-01", "2000-12"], ["01-05", "2001-01", "2005-12"], ["06-10", "2006-01", "2010-12"], ["11-15", "2011-01", "2015-12"], ["16-20", "2016-01", "2020-12"], ["21-26", "2021-01", "2100-12"], ["pré-2021", "1900-01", "2020-12"], ["post-lanc", "2011-02", "2100-12"], ["Max", "1900-01", "2100-12"]];
P("| tranche | ΔCAGR | ΔSharpe | ΔMDD | Δsous-l'eau | Δrotation | Δfréq |");
P("|---|---|---|---|---|---|---|");
for (const [k, f, t] of SLICES) { const a = aggWin(6, 0.1, 25, f, t); P(`| ${k} | ${sg(a.dCAGR, 2)} | ${sg(a.dSharpe)} | ${sg(a.dMDD, 1)} | ${sg(a.dUW, 0)} | ${sg(a.dRot * 100, 1)}pt | ${sg(a.dFreq, 1)} |`); }
P("\nHorizons (Max/20A/10A/5A), ΔSharpe L=6/w=10 : " + [["Max", null], ["20A", 20], ["10A", 10], ["5A", 5]].map(([k, y]: any) => { const to = "2100-12"; let from = "1900-01"; if (y) { from = `${2026 - y}-06`; } const a = aggWin(6, 0.1, 25, from, to); return `${k} ${sg(a.dSharpe)}`; }).join(" · "));

// 5. VERDICT DE PLATEAU (barres conjointes autour de L=5,6,7 à w=10, 25 bps)
P("\n## 5. Verdict de plateau — barres conjointes (L=5,6,7 · w=10 · 25 bps)");
const crit = (Lm: number) => { const a = aggWin(Lm, 0.1, 25, "1900-01", "2100-12"); const e = epAnalysis(Lm, 0.1, 25); const post = aggWin(Lm, 0.1, 25, "2011-02", "2100-12"); return { dCAGR: a.dCAGR > 0, dSharpe: a.dSharpe >= 0, loeo: e.loeo >= 0, ex21: e.ex21 >= 0, ex07: e.ex07 >= 0, best: e.bestShare <= 60, mdd: a.dMDD >= -1.0, post: post.dSharpe >= 0 && post.dCAGR >= -0.1, vals: { a, e, post } }; };
const names = ["ΔCAGR>0", "ΔSharpe≥0", "LOEO≥0", "sans-21/22≥0", "sans-07/08≥0", "meilleur-ép≤60%", "MDD non dégradé", "post-lanc cohérent"];
P("| critère | L=5 | L=6 | L=7 |");
P("|---|---|---|---|");
const c5 = crit(5), c6 = crit(6), c7 = crit(7);
const keys = ["dCAGR", "dSharpe", "loeo", "ex21", "ex07", "best", "mdd", "post"] as const;
keys.forEach((kk, i) => P(`| ${names[i]} | ${(c5 as any)[kk] ? "✅" : "❌"} | ${(c6 as any)[kk] ? "✅" : "❌"} | ${(c7 as any)[kk] ? "✅" : "❌"} |`));
const allPass = (c: any) => keys.every((kk) => c[kk]);
const plateau = allPass(c5) && allPass(c6) && allPass(c7);
P(`\n**Plateau L=5,6,7 (toutes barres) : ${plateau ? "✅ PRÉSENT" : "❌ ABSENT"}** — L5 ${allPass(c5) ? "pass" : "fail"} · L6 ${allPass(c6) ? "pass" : "fail"} · L7 ${allPass(c7) ? "pass" : "fail"}.`);

writeFileSync(path.join(HERE, "trend-confirm-report.md"), OUT.join("\n"));
await db.coredataPool?.end?.();
console.error("\n✅ Terminé — trend-confirm-report.md");
