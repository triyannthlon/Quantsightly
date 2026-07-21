// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE ÉNERGIE v2 — 3 ARCHITECTURES de signal MONDE (préenregistré). LECTURE SEULE.
//
// La spec canonique n'a rejeté QUE `xWorld>T ∧ yWorld>T`. Or `xWorld=ln(Actions/Pétrole)`
// est à CONTRE-SENS des bulls énergie (pétrole domine → xWorld<0). On teste donc le signe
// correct, sur coords finales de `buildModel` :
//   A — inflation mondiale       : active = yWorld > Ty
//   B — domination pétrole       : active = xWorld < -Tx
//   C — domination inflationniste: active = xWorld < -Tx ET yWorld > Ty
//
// Grille : Tx,Ty ∈ {0,20,40} ; w ∈ {0,5,10,15,20}%. Reste STRICT : SPDYENT investi, CL1
// signal seul, t→t+1, prorata, UNE bande v2 sur 5 poches, mêmes coûts/devises/périodes,
// w=0 = v2 bit à bit. Analyse de ROBUSTESSE TEMPORELLE : sous-périodes, post-lancement,
// ÉPISODES d'activation (liste, contribution, leave-one-episode-out, retrait 21-22, part
// du meilleur épisode). Priorité A ; B/C disent si l'échec venait du signe de xWorld.
//   pnpm exec tsx experiments/4q-energie-v2/variants.mts
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

const TX = [0, 20, 40], TY = [0, 20, 40], W = [0, 0.05, 0.1, 0.15, 0.2];
const COST = 25;
type Core = { equities: number; bonds: number; gold: number; cash: number };
type Alloc5 = Core & { energy: number };
type DP = { date: string; value: number };
const A5 = ["equities", "bonds", "gold", "cash", "energy"] as const;
const q = (a: number[], p: number) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const worstDecile = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const n = Math.max(1, Math.round(s.length * 0.1)); return mean(s.slice(0, n)); };
const ym2i = (s: string) => Number(s.slice(0, 4)) * 12 + (Number(s.slice(5, 7)) - 1);

// gates (coords finales)
type Gate = (x: number, y: number, Tx: number, Ty: number) => boolean;
const GATES: Record<string, Gate> = {
  A: (x, y, Tx, Ty) => y > Ty,
  B: (x, y, Tx, Ty) => x < -Tx,
  C: (x, y, Tx, Ty) => x < -Tx && y > Ty,
};

// ── simulate 5 poches (identique canonical.mts) ──────────────────────────────
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
function maxDD(idx: DP[]): number { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null { const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(p.date.slice(0, 7)) })).filter((x) => x.c! > 0); if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c!; return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) })); }
interface Metrics { realCAGR: number | null; realSharpe: number | null; realMDD: number | null }
function measure(path: Step[], cpi: Map<string, number>, from: number, to: number, bps: number): Metrics | null {
  if (to - from < 3) return null;
  const cost = bps / 10000; let p = 100;
  const nom: DP[] = [{ date: path[from].date, value: 100 }]; const cashI: DP[] = [{ date: path[from].date, value: path[from].cash }];
  for (let i = from + 1; i < to; i++) { p *= 1 + (path[i].rp - cost * 2 * path[i].turn); nom.push({ date: path[i].date, value: p }); cashI.push({ date: path[i].date, value: path[i].cash }); }
  const real = deflate(nom, cpi); if (!real) return null;
  const rk = computeKpis(real); const cr = deflate(cashI, cpi); const rf = cr ? (computeKpis(cr).annualized ?? 0) : 0;
  return { realCAGR: rk.annualized ?? null, realSharpe: rk.annualized != null && rk.volatility ? (rk.annualized - rf) / rk.volatility : null, realMDD: maxDD(real) };
}
function winBounds(path: Step[], from: string, to: string): [number, number] | null {
  const f = path.findIndex((p) => p.date.slice(0, 7) >= from); if (f < 0 || path[f].date.slice(0, 7) > to) return null;
  let t = -1; for (let i = path.length - 1; i >= 0; i--) if (path[i].date.slice(0, 7) <= to) { t = i + 1; break; }
  return t < 0 || t - f < 3 ? null : [f, t];
}

// ── données ───────────────────────────────────────────────────────────────────
console.error("Chargement…");
const [wEq, wOil, wGold, wBond] = await Promise.all([db.getSeriesData("MXWO Index-XX-1-1"), db.getSeriesData("CL1 comdty-XX-5-1"), db.getSeriesData("XAU Comdty-XX-5-1"), db.getSeriesData("GT10 Govt-US-4-2")]);
const worldModel = buildModel({ countryCode: "WORLD", equityPrice: wEq, oil: wOil, gold: wGold, bond: wBond }, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
const worldXY = new Map<string, { x: number; y: number }>();
for (const r of (worldModel as any).monthlyResults) worldXY.set(r.date.slice(0, 7), { x: r.x, y: r.y });
const fxRates: any[] = await db.getFxRates(); const usdPerUnit = new Map<string, any>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: DP[] = await db.getSeriesData("SPDYENT Index-XX-5-2");
const toLocal = (d: DP[], t: string) => (!t || t === "USD") ? d : compute.convertCurrency(d, null, usdPerUnit.get(t) ?? null);
const isoList: any[] = (await svc.listQuadrantCountries()).filter((c: any) => c.iso !== "DK");
interface Loaded { code: string; base: Map<string, Core>; rows: Row[]; cpi: Map<string, number> }
const loaded: Loaded[] = [];
for (const { iso } of isoList) {
  const cm = await svc.getCountryQuadrantModel(iso); if (!cm.config || !cm.signal || !cm.perf) continue;
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  if (model.status !== "OK") continue;
  const base = new Map<string, Core>(); for (const r of model.monthlyResults) base.set(r.date.slice(0, 7), { equities: r.baseAllocation.equities, bonds: r.baseAllocation.bonds, gold: r.baseAllocation.gold, cash: r.baseAllocation.cash });
  const eL = toLocal(energyUsd, cm.config.currency);
  const byM = (a: DP[]) => { const m = new Map<string, number>(); for (const p of a) m.set(p.date.slice(0, 7), p.value); return m; };
  const bd = byM(cm.perf.bondTotalReturn), ca = byM(cm.perf.cashTotalReturn), go = byM(cm.perf.gold), en = byM(eL), eq = byM(cm.perf.equityTotalReturn);
  const rows: Row[] = []; const dbm = new Map<string, string>(); for (const p of cm.perf.equityTotalReturn as DP[]) dbm.set(p.date.slice(0, 7), p.date);
  for (const [m, date] of [...dbm.entries()].sort((a, b) => a[0].localeCompare(b[0]))) { const e = eq.get(m), b = bd.get(m), c = ca.get(m), g = go.get(m), n = en.get(m); if (e! > 0 && b! > 0 && c! > 0 && g! > 0 && n! > 0) rows.push({ m, date, eq: e!, bd: b!, ca: c!, go: g!, en: n! }); }
  const cpi = new Map<string, number>(); for (const p of (cm.perf.cpi ?? []) as DP[]) cpi.set(p.date.slice(0, 7), p.value);
  loaded.push({ code: iso, base, rows, cpi });
}
console.error(`  ${loaded.length} pays.`);

function targetsFor(base: Map<string, Core>, gate: Gate, Tx: number, Ty: number, w: number): Map<string, Alloc5> {
  const out = new Map<string, Alloc5>();
  for (const [m, b] of base) { const wc = worldXY.get(m); const e = w > 0 && wc && gate(wc.x, wc.y, Tx, Ty) ? w : 0; const k = 1 - e; out.set(m, { equities: b.equities * k, bonds: b.bonds * k, gold: b.gold * k, cash: b.cash * k, energy: e }); }
  return out;
}
// témoin par pays (w=0)
const witness = new Map<string, Step[]>();
for (const l of loaded) { const p = simulate(targetsFor(l.base, GATES.A, 0, 0, 0), l.rows, BAND); if (p.length > 3) witness.set(l.code, p); }

// ── activation des gates par tranche (mécanisme) ─────────────────────────────
const BUCKETS = [["95-00", "1995-01", "2000-12"], ["01-05", "2001-01", "2005-12"], ["06-10", "2006-01", "2010-12"], ["11-15", "2011-01", "2015-12"], ["16-20", "2016-01", "2020-12"], ["21-26", "2021-01", "2026-12"]];
function actByBucket(gate: Gate, Tx: number, Ty: number) {
  return BUCKETS.map(([, f, t]) => { let a = 0, n = 0; for (const [m, wc] of worldXY) if (m >= f && m <= t) { n++; if (gate(wc.x, wc.y, Tx, Ty)) a++; } return n ? Math.round(a / n * 100) : 0; });
}

// ── ÉPISODES d'activation (globaux) ──────────────────────────────────────────
function episodes(gate: Gate, Tx: number, Ty: number, gap = 6) {
  const months = [...worldXY.keys()].sort();
  const act = months.filter((m) => { const wc = worldXY.get(m)!; return gate(wc.x, wc.y, Tx, Ty); }).map(ym2i);
  if (!act.length) return [];
  const eps: Array<{ fromI: number; toI: number }> = []; let s = act[0], p = act[0];
  for (let i = 1; i < act.length; i++) { if (act[i] - p <= gap) p = act[i]; else { eps.push({ fromI: s, toI: p }); s = act[i]; p = act[i]; } }
  eps.push({ fromI: s, toI: p });
  const i2ym = (i: number) => `${Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`;
  return eps.map((e) => ({ ...e, from: i2ym(e.fromI), to: i2ym(e.toI) }));
}

// Analyse d'épisodes pour une cellule (gate,Tx,Ty,w) : décompose l'écart de log-perf réel.
function episodeAnalysis(gate: Gate, Tx: number, Ty: number, w: number) {
  const eps = episodes(gate, Tx, Ty);
  if (!eps.length) return { eps, per: [] as any[] };
  const epFrom = eps.map((e) => e.fromI);
  const ownerOf = (ti: number) => { let best = -1; for (let k = 0; k < epFrom.length; k++) if (epFrom[k] <= ti) best = k; return best; };
  const is2122 = (k: number) => eps[k].toI >= ym2i("2021-01") && eps[k].fromI <= ym2i("2022-12");
  const per: any[] = [];
  for (const l of loaded) {
    const tem = witness.get(l.code); if (!tem) continue;
    const vpath = simulate(targetsFor(l.base, gate, Tx, Ty, w), l.rows, BAND);
    if (vpath.length !== tem.length) continue; // mêmes rows/start → même longueur
    const cost = COST / 10000;
    const epLog = new Array(eps.length).fill(0); let total = 0;
    for (let i = 1; i < vpath.length; i++) {
      const nv = Math.log(1 + (vpath[i].rp - cost * 2 * vpath[i].turn));
      const nt = Math.log(1 + (tem[i].rp - cost * 2 * tem[i].turn));
      const d = nv - nt; total += d;
      if (vpath[i].heldEnergy > 1e-9) { const k = ownerOf(ym2i(vpath[i].date.slice(0, 7))); if (k >= 0) epLog[k] += d; }
    }
    const loeoMin = eps.length ? Math.min(...eps.map((_, k) => total - epLog[k])) : total; // pire retrait d'un épisode
    const ex2122 = total - eps.reduce((s, _, k) => s + (is2122(k) ? epLog[k] : 0), 0);
    const best = eps.length ? Math.max(...epLog) : 0;
    per.push({ code: l.code, total, epLog: epLog.slice(), loeoMin, ex2122, bestShare: total > 1e-9 ? best / total : NaN });
  }
  return { eps, per };
}

const L: string[] = []; const P = (s = "") => { L.push(s); console.log(s); };
P("# Étude Énergie v2 — 3 architectures de signal MONDE (préenregistré)\n");
P("Δ = variante Énergie − `4q-standard-v2` (w=0), 21 pays, dyn/T20, net 25 bps, prorata, bande unique sur 5 poches, SPDYENT investi, t→t+1.\n");

// ── 1. Activation par tranche (A/B/C à seuil 20) ─────────────────────────────
P("## 1. Fréquence d'activation du gate par tranche (seuils = 20)");
P("| architecture | 95-00 | 01-05 | 06-10 | 11-15 | 16-20 | 21-26 |");
P("|---|---|---|---|---|---|---|");
P(`| A (y>20 inflation) | ${actByBucket(GATES.A, 0, 20).map((v) => v + "%").join(" | ")} |`);
P(`| B (x<-20 pétrole) | ${actByBucket(GATES.B, 20, 0).map((v) => v + "%").join(" | ")} |`);
P(`| C (x<-20 ∧ y>20) | ${actByBucket(GATES.C, 20, 20).map((v) => v + "%").join(" | ")} |`);

// ── 2. Sous-périodes (le test décisif) pour chaque architecture ──────────────
const SUB = [["Max", "1900-01", "2100-12"], ["pré-2021", "1900-01", "2020-12"], ["Live11-20", "2011-01", "2020-12"], ["21-26", "2021-01", "2100-12"], ["Live11-26", "2011-01", "2100-12"]];
function subRow(gate: Gate, Tx: number, Ty: number, w: number) {
  return SUB.map(([, f, t]) => {
    const ds: number[] = [];
    for (const l of loaded) { const tem = witness.get(l.code); if (!tem) continue; const v = simulate(targetsFor(l.base, gate, Tx, Ty, w), l.rows, BAND); const wb = winBounds(tem, f, t), cb = winBounds(v, f, t); if (!wb || !cb) continue; const m0 = measure(tem, l.cpi, wb[0], wb[1], COST), m1 = measure(v, l.cpi, cb[0], cb[1], COST); if (m0?.realSharpe != null && m1?.realSharpe != null) ds.push(m1.realSharpe - m0.realSharpe); }
    return median(ds);
  });
}
const CELLS: Array<{ arch: string; gate: Gate; Tx: number; Ty: number; tag: string }> = [];
for (const Ty of TY) CELLS.push({ arch: "A", gate: GATES.A, Tx: 0, Ty, tag: `A·Ty${Ty}` });
for (const Tx of TX) CELLS.push({ arch: "B", gate: GATES.B, Tx, Ty: 0, tag: `B·Tx${Tx}` });
for (const Tx of TX) for (const Ty of TY) CELLS.push({ arch: "C", gate: GATES.C, Tx, Ty, tag: `C·Tx${Tx}·Ty${Ty}` });

P("\n## 2. Médiane ΔSharpe par sous-période (w=10 %) — le gain survit-il HORS 2021-2022 ?");
P("| cellule | Max | **pré-2021** | **Live11-20** | 21-26 | Live11-26 |");
P("|---|---|---|---|---|---|");
for (const c of CELLS) { const r = subRow(c.gate, c.Tx, c.Ty, 0.1); P(`| ${c.tag} | ${r.map((v, i) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}${i === 1 && v > 0 ? " ⬅" : ""}`).join(" | ")} |`); }

// ── 3. Balayage w + plateau ΔSharpe Max/pré-2021 par architecture ────────────
P("\n## 3. ΔSharpe médiane — Max / (pré-2021) — balayage w, seuil=20");
P("| cellule | w5 | w10 | w15 | w20 |");
P("|---|---|---|---|---|");
for (const c of [{ tag: "A·Ty20", gate: GATES.A, Tx: 0, Ty: 20 }, { tag: "B·Tx20", gate: GATES.B, Tx: 20, Ty: 0 }, { tag: "C·Tx20Ty20", gate: GATES.C, Tx: 20, Ty: 20 }]) {
  const cells = [0.05, 0.1, 0.15, 0.2].map((w) => {
    const dMax: number[] = [], dPre: number[] = [];
    for (const l of loaded) { const tem = witness.get(l.code); if (!tem) continue; const v = simulate(targetsFor(l.base, c.gate, c.Tx, c.Ty, w), l.rows, BAND); const m0 = measure(tem, l.cpi, 0, tem.length, COST), m1 = measure(v, l.cpi, 0, v.length, COST); if (m0?.realSharpe != null && m1?.realSharpe != null) dMax.push(m1.realSharpe - m0.realSharpe); const wb = winBounds(tem, "1900-01", "2020-12"), cb = winBounds(v, "1900-01", "2020-12"); if (wb && cb) { const p0 = measure(tem, l.cpi, wb[0], wb[1], COST), p1 = measure(v, l.cpi, cb[0], cb[1], COST); if (p0?.realSharpe != null && p1?.realSharpe != null) dPre.push(p1.realSharpe - p0.realSharpe); } }
    return `${median(dMax) >= 0 ? "+" : ""}${median(dMax).toFixed(3)} (${median(dPre) >= 0 ? "+" : ""}${median(dPre).toFixed(3)})`;
  });
  P(`| ${c.tag} | ${cells.join(" | ")} |`);
}

// ── 4. ANALYSE PAR ÉPISODES (décisive) pour la meilleure cellule de A/B/C ─────
P("\n## 4. Analyse par ÉPISODES (w=10 %, net 25 bps) — décomposition de l'écart de log-perf réel");
P("Écart de log-perf cumulé médian (×100). Robuste = positif APRÈS retrait du meilleur épisode ET de 2021-2022.\n");
for (const c of [{ tag: "A·Ty20", gate: GATES.A, Tx: 0, Ty: 20 }, { tag: "B·Tx20", gate: GATES.B, Tx: 20, Ty: 0 }, { tag: "C·Tx20Ty20", gate: GATES.C, Tx: 20, Ty: 20 }, { tag: "A·Ty0", gate: GATES.A, Tx: 0, Ty: 0 }, { tag: "B·Tx0", gate: GATES.B, Tx: 0, Ty: 0 }]) {
  const { eps, per } = episodeAnalysis(c.gate, c.Tx, c.Ty, 0.1);
  if (!per.length) { P(`\n### ${c.tag} — aucun épisode / données insuffisantes`); continue; }
  P(`\n### ${c.tag} — ${eps.length} épisode(s) : ${eps.map((e: any) => `${e.from}→${e.to}`).join(", ")}`);
  const medTotal = median(per.map((p: any) => p.total)) * 100;
  const medEx2122 = median(per.map((p: any) => p.ex2122)) * 100;
  const medLoeo = median(per.map((p: any) => p.loeoMin)) * 100;
  const medBestShare = median(per.map((p: any) => p.bestShare).filter(Number.isFinite)) * 100;
  P("| épisode | contribution médiane (×100) |");
  P("|---|---|");
  eps.forEach((e: any, k: number) => { const m = median(per.map((p: any) => p.epLog[k])) * 100; P(`| ${e.from}→${e.to} | ${m >= 0 ? "+" : ""}${m.toFixed(2)} |`); });
  P(`\n**${c.tag}** : écart total médian **${medTotal >= 0 ? "+" : ""}${medTotal.toFixed(2)}** · retrait meilleur épisode (leave-one-episode-out pire) **${medLoeo >= 0 ? "+" : ""}${medLoeo.toFixed(2)}** · **retrait 2021-2022 ${medEx2122 >= 0 ? "+" : ""}${medEx2122.toFixed(2)}** · part du meilleur épisode **${medBestShare.toFixed(0)} %**`);
}

writeFileSync(path.join(HERE, "variants-report.md"), L.join("\n"));
await db.coredataPool?.end?.();
console.error("\n✅ Terminé — variants-report.md");
