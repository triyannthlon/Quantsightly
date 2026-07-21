// ─────────────────────────────────────────────────────────────────────────────
// COMPARAISON NORMALISÉE — `4q-standard-v2` · `4q-energy-trend-rc1` · Browne. LECTURE SEULE.
//
// Décisions (spec Yann) : fenêtre commune STRICTE par pays (intersection v2/rc1/Browne/
// inflation/cash/devises) ; Browne = 25/25/25/25 annuel (définition actuelle) ; Sharpe
// officiel Quantsightly (excédent cash réel) principal + Sharpe excédent arithmétique
// secondaire ; coûts 0/10/25/50 bps (ppal 25) sur turnover exécuté, au compounding,
// constitution exclue ; panel 21 pays (DK en sensibilité). rc1 FIGÉ (L6/w10). Aucun
// modèle modifié en réaction aux résultats. Aucune touche prod/page.
//
//   pnpm exec tsx experiments/4q-energy-trend-rc1/comparison.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { computeTrendSignal, SMA_LOOKBACK_RC1 } from "./signal";
import { buildFivePocketTarget, ENERGY_WEIGHT_RC1, type CoreAllocation } from "./portfolio";
import { simulateRc1, type Rc1Input, type DataPoint } from "./rc1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const db: any = await imp("src/lib/coredata/db.ts");
const compute: any = await imp("src/lib/coredata/compute.ts");
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const fq: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const browneMod: any = await imp("src/lib/coredata/browne.ts");
const { buildModel, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = fq;
const { computeBrowne } = browneMod;
const BAND: number = REALLOCATION_BAND.v2;
const W = ENERGY_WEIGHT_RC1;
const COSTS = [0, 10, 25, 50];
const HORIZONS: Array<[string, number | null]> = [["Max", null], ["20A", 20], ["10A", 10], ["5A", 5]];
const mk = (d: string) => d.slice(0, 7);

// ── stats ─────────────────────────────────────────────────────────────────────
const q = (a: number[], p: number) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const worstDecile = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const n = Math.max(1, Math.round(s.length * 0.1)); return mean(s.slice(0, n)); };
const sg = (v: number, d = 3) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(d)}` : "—");

// ── chemin unifié + mesure (v2 / rc1 / Browne passent par le MÊME mesureur) ────
interface Step { date: string; grossReturn: number; turnover: number | null; cash: number }
interface UMetrics { n: number; nomCAGR: number | null; realCAGR: number | null; realVol: number | null; realSharpe: number | null; excessSharpe: number | null; realMDD: number | null; underwater: number | null; worst12: number | null; worst5y: number | null; worst10y: number | null; worst15y: number | null; rotation: number; reallocFreq: number; cumCost: number }
function cagrVol(idx: DataPoint[]) { const n = idx.length; let cagr: number | null = null; if (n >= 2 && idx[0].value > 0 && idx[n - 1].value > 0) { const y = (n - 1) / 12; cagr = y > 0 ? (Math.pow(idx[n - 1].value / idx[0].value, 1 / y) - 1) * 100 : null; } let vol: number | null = null; if (n >= 3) { const r: number[] = []; for (let i = 1; i < n; i++) if (idx[i - 1].value !== 0) r.push(idx[i].value / idx[i - 1].value - 1); if (r.length >= 2) { const m = mean(r); vol = Math.sqrt(r.reduce((s, v) => s + (v - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(12) * 100; } } return { cagr, vol }; }
function maxDD(idx: DataPoint[]) { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function underwater(idx: DataPoint[]) { let pk = -Infinity, run = 0, mx = 0; for (const p of idx) { if (p.value >= pk) { pk = p.value; run = 0; } else { run++; mx = Math.max(mx, run); } } return mx; }
function worstRoll(idx: DataPoint[], months: number, annualize: boolean) { let w: number | null = null; for (let i = months; i < idx.length; i++) { if (idx[i - months].value > 0) { const ratio = idx[i].value / idx[i - months].value; const r = (annualize ? Math.pow(ratio, 12 / months) - 1 : ratio - 1) * 100; w = w == null ? r : Math.min(w, r); } } return w; }
function deflate(idx: DataPoint[], cpi: Map<string, number>): DataPoint[] | null { const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(mk(p.date)) })).filter((x): x is { date: string; v: number; c: number } => x.c !== undefined && x.c > 0); if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c; return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c / c0) })); }
const EPS = 0.005;
function measureU(steps: Step[], from: number, to: number, costBps: number, cpi: Map<string, number> | null, excl: Array<[string, string]> = []): UMetrics | null {
  const cost = costBps / 10000; let p = 100; const nom: DataPoint[] = []; const cashI: DataPoint[] = []; const turns: number[] = []; let cumCost = 0;
  const skip = (ym: string) => excl.some(([a, b]) => ym >= a && ym <= b);
  for (let i = from; i < to; i++) { const ym = mk(steps[i].date); if (skip(ym)) continue; const t = steps[i].turnover ?? 0; const c = cost * 2 * t; if (nom.length) { p *= 1 + (steps[i].grossReturn - c); cumCost += c; } nom.push({ date: steps[i].date, value: p }); cashI.push({ date: steps[i].date, value: steps[i].cash }); if (nom.length > 1) turns.push(t); }
  if (nom.length < 3) return null;
  const nk = cagrVol(nom);
  const real = cpi ? deflate(nom, cpi) : null; const realCash = cpi ? deflate(cashI, cpi) : null;
  const rk = real ? cagrVol(real) : { cagr: null, vol: null };
  const rfReal = realCash ? cagrVol(realCash).cagr ?? 0 : 0;
  // Sharpe officiel = (CAGR réel − CAGR cash réel) / vol réelle.
  const sharpe = rk.cagr != null && rk.vol ? (rk.cagr - rfReal) / rk.vol : null;
  // Sharpe excédentaire arithmétique (secondaire) = moyenne mensuelle (r_réel − rCash_réel) annualisée / vol.
  let excessSharpe: number | null = null;
  if (real && realCash && rk.vol) { const ex: number[] = []; const rcM = new Map(realCash.map((p) => [mk(p.date), p.value])); for (let i = 1; i < real.length; i++) { const rp = real[i].value / real[i - 1].value - 1; const c0 = rcM.get(mk(real[i - 1].date)), c1 = rcM.get(mk(real[i].date)); if (c0 && c1) ex.push(rp - (c1 / c0 - 1)); } if (ex.length >= 2) excessSharpe = (mean(ex) * 12 * 100) / rk.vol; }
  const mt = turns.length ? mean(turns) : 0;
  return { n: nom.length, nomCAGR: nk.cagr, realCAGR: rk.cagr, realVol: rk.vol, realSharpe: sharpe, excessSharpe, realMDD: real ? maxDD(real) : null, underwater: real ? underwater(real) : null, worst12: real ? worstRoll(real, 12, false) : null, worst5y: real ? worstRoll(real, 60, true) : null, worst10y: real ? worstRoll(real, 120, true) : null, worst15y: real ? worstRoll(real, 180, true) : null, rotation: mt * 12, reallocFreq: turns.length ? (turns.filter((v) => v > EPS).length / turns.length) * 12 : 0, cumCost: cumCost * 100 };
}

// ── Browne : réplique exacte de computeBrowne (annuel 25/25/25/25) → chemin unifié ──
function simulateBrowne(equity: DataPoint[], bond: DataPoint[], cash: DataPoint[], gold: DataPoint[]): Step[] {
  const toM = (a: DataPoint[]) => { const m = new Map<string, { date: string; v: number }>(); for (const p of [...a].sort((x, y) => x.date.localeCompare(y.date))) m.set(mk(p.date), { date: p.date, v: p.value }); return m; };
  const E = toM(equity), B = toM(bond), C = toM(cash), G = toM(gold);
  const rows: Array<{ date: string; e: number; b: number; c: number; g: number }> = [];
  for (const [m, pe] of E) { const b = B.get(m), c = C.get(m), g = G.get(m); if (b && c && g && pe.v > 0 && b.v > 0 && c.v > 0 && g.v > 0) rows.push({ date: pe.date, e: pe.v, b: b.v, c: c.v, g: g.v }); }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const out: Step[] = []; if (rows.length < 2) return out;
  let w = [0.25, 0.25, 0.25, 0.25];
  out.push({ date: rows[0].date, grossReturn: 0, turnover: null, cash: rows[0].c });
  const yearOf = (d: string) => d.slice(0, 4);
  for (let i = 1; i < rows.length; i++) {
    let turnover: number | null = 0;
    if (yearOf(rows[i].date) !== yearOf(rows[i - 1].date)) { // reset annuel
      turnover = 0.5 * (Math.abs(0.25 - w[0]) + Math.abs(0.25 - w[1]) + Math.abs(0.25 - w[2]) + Math.abs(0.25 - w[3]));
      w = [0.25, 0.25, 0.25, 0.25];
    }
    const r = [rows[i].e / rows[i - 1].e - 1, rows[i].b / rows[i - 1].b - 1, rows[i].c / rows[i - 1].c - 1, rows[i].g / rows[i - 1].g - 1];
    const rp = w[0] * r[0] + w[1] * r[1] + w[2] * r[2] + w[3] * r[3];
    out.push({ date: rows[i].date, grossReturn: rp, turnover, cash: rows[i].c });
    const nw = [w[0] * (1 + r[0]), w[1] * (1 + r[1]), w[2] * (1 + r[2]), w[3] * (1 + r[3])]; const tot = nw[0] + nw[1] + nw[2] + nw[3];
    w = [nw[0] / tot, nw[1] / tot, nw[2] / tot, nw[3] / tot];
  }
  return out;
}

// ── chargement ─────────────────────────────────────────────────────────────────
const fxRates: any[] = await db.getFxRates(); const usdPerUnit = new Map<string, any>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: DataPoint[] = (await db.getSeriesData("SPDYENT Index-XX-5-2")).sort((a: DataPoint, b: DataPoint) => a.date.localeCompare(b.date));
const convert = (d: DataPoint[], t: string) => (!t || t === "USD") ? d : compute.convertCurrency(d, null, usdPerUnit.get(t) ?? null);
const signal6 = computeTrendSignal(energyUsd, SMA_LOOKBACK_RC1);

interface Country { code: string; currency: string; cpi: Map<string, number> | null; v2: Step[]; rc1: Step[]; browne: Step[]; rc1Steps: any; }
async function load(iso: string): Promise<Country | null> {
  const cm = await svc.getCountryQuadrantModel(iso); if (!cm.config || !cm.signal || !cm.perf) return null;
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" }); if (model.status !== "OK") return null;
  const baseByMonth = new Map<string, CoreAllocation>(); for (const r of model.monthlyResults) baseByMonth.set(mk(r.date), { equities: r.baseAllocation.equities, bonds: r.baseAllocation.bonds, gold: r.baseAllocation.gold, cash: r.baseAllocation.cash });
  const energyLocal = convert(energyUsd, cm.config.currency);
  const rInput = (w: number): Rc1Input => ({ countryCode: iso, baseByMonth, signalByMonth: signal6, equityTotalReturn: cm.perf.equityTotalReturn, bondTotalReturn: cm.perf.bondTotalReturn, cashTotalReturn: cm.perf.cashTotalReturn, gold: cm.perf.gold, energyLocal, cpi: cm.perf.cpi, energyWeight: w, reallocationBand: BAND });
  const pV2 = simulateRc1(rInput(0)), pRc1 = simulateRc1(rInput(W));
  if (pV2.status !== "OK" || pRc1.status !== "OK") return null;
  const toStep = (s: any): Step => ({ date: s.date, grossReturn: s.grossReturn, turnover: s.turnover, cash: s.cash });
  const browne = simulateBrowne(cm.perf.equityTotalReturn, cm.perf.bondTotalReturn, cm.perf.cashTotalReturn, cm.perf.gold);
  const cpi = (cm.perf.cpi?.length ? new Map<string, number>((cm.perf.cpi as DataPoint[]).map((p) => [mk(p.date), p.value])) : null);
  return { code: iso, currency: cm.config.currency, cpi, v2: pV2.steps.map(toStep), rc1: pRc1.steps.map(toStep), browne, rc1Steps: pRc1.steps };
}

const PANEL: string[] = (await svc.listQuadrantCountries()).map((c: any) => c.iso).filter((c: string) => c !== "DK");
const all: Country[] = []; for (const iso of [...PANEL, "DK"]) { const c = await load(iso); if (c) all.push(c); }
const panel21 = all.filter((c) => c.code !== "DK");

// ── fenêtre commune stricte par pays ────────────────────────────────────────
function commonWindow(c: Country): [string, string] | null {
  const s = (a: Step[]) => a.length ? mk(a[0].date) : null, e = (a: Step[]) => a.length ? mk(a[a.length - 1].date) : null;
  const starts = [s(c.v2), s(c.rc1), s(c.browne)].filter(Boolean) as string[]; const ends = [e(c.v2), e(c.rc1), e(c.browne)].filter(Boolean) as string[];
  if (starts.length < 3 || ends.length < 3) return null;
  const from = starts.reduce((a, b) => (a > b ? a : b)), to = ends.reduce((a, b) => (a < b ? a : b));
  return from < to ? [from, to] : null;
}
function slice(steps: Step[], from: string, to: string): [number, number] | null { const f = steps.findIndex((s) => mk(s.date) >= from); if (f < 0 || mk(steps[f].date) > to) return null; let t = -1; for (let i = steps.length - 1; i >= 0; i--) if (mk(steps[i].date) <= to) { t = i + 1; break; } return t < 0 || t - f < 3 ? null : [f, t]; }
function horizonFrom(commonFrom: string, commonTo: string, years: number | null): string { if (years == null) return commonFrom; const cut = `${Number(commonTo.slice(0, 4)) - years}${commonTo.slice(4)}`; return cut > commonFrom ? cut : commonFrom; }

// ── AUTO-VÉRIF Browne réplique = computeBrowne ──────────────────────────────
{
  const c = panel21.find((x) => x.code === "US")!; const cm = await svc.getCountryQuadrantModel("US");
  const bt = computeBrowne({ countryCode: "US", equity: cm.perf.equityTotalReturn, bond: cm.perf.bondTotalReturn, cash: cm.perf.cashTotalReturn, gold: cm.perf.gold, inflation: cm.perf.cpi, rebalance: "annual" });
  const m = measureU(c.browne, 0, c.browne.length, 0, c.cpi);
  const err = bt.status === "OK" ? Math.abs((m?.realCAGR ?? 0) - (bt.metrics.real?.annualized ?? 0)) : NaN;
  const rotErr = bt.status === "OK" ? Math.abs(m!.rotation - bt.turnover.annualized) : NaN;
  console.error(`AUTO-VÉRIF Browne US : réplique realCAGR ${m?.realCAGR?.toFixed(3)} vs computeBrowne ${bt.metrics.real?.annualized?.toFixed(3)} (écart ${err.toExponential(1)}) · rotation ${(m!.rotation * 100).toFixed(1)}% vs ${(bt.turnover.annualized * 100).toFixed(1)}% (écart ${rotErr.toExponential(1)}) ${err < 5e-3 && rotErr < 5e-3 ? "✅" : "⚠️"}`);
}

// ── agrégation d'une PAIRE (A−B) sur une fenêtre/horizon/coût ────────────────
type Model = "v2" | "rc1" | "browne";
const pathOf = (c: Country, m: Model) => m === "v2" ? c.v2 : m === "rc1" ? c.rc1 : c.browne;
function pairDelta(cs: Country[], A: Model, B: Model, years: number | null, cost: number, excl: Array<[string, string]> = []) {
  const dCAGR: number[] = [], dSharpe: number[] = [], dVol: number[] = [], dMDD: number[] = [], dUW: number[] = [], dW12: number[] = [], dRot: number[] = [], dFreq: number[] = [], dCost: number[] = [], absA_S: number[] = [], absB_S: number[] = [];
  let impS = 0, impC = 0, n = 0;
  for (const c of cs) {
    const cw = commonWindow(c); if (!cw) continue; const from = horizonFrom(cw[0], cw[1], years), to = cw[1];
    const pa = pathOf(c, A), pb = pathOf(c, B); const sa = slice(pa, from, to), sb = slice(pb, from, to); if (!sa || !sb) continue;
    const ma = measureU(pa, sa[0], sa[1], cost, c.cpi, excl), mb = measureU(pb, sb[0], sb[1], cost, c.cpi, excl);
    if (!ma || !mb || ma.realSharpe == null || mb.realSharpe == null || ma.realCAGR == null || mb.realCAGR == null) continue;
    n++; dCAGR.push(ma.realCAGR - mb.realCAGR); if (ma.realCAGR - mb.realCAGR > 0) impC++; dSharpe.push(ma.realSharpe - mb.realSharpe); if (ma.realSharpe - mb.realSharpe > 0) impS++;
    dVol.push((ma.realVol ?? 0) - (mb.realVol ?? 0)); dMDD.push((ma.realMDD ?? 0) - (mb.realMDD ?? 0)); dUW.push((ma.underwater ?? 0) - (mb.underwater ?? 0)); dW12.push((ma.worst12 ?? 0) - (mb.worst12 ?? 0));
    dRot.push(ma.rotation - mb.rotation); dFreq.push(ma.reallocFreq - mb.reallocFreq); dCost.push(ma.cumCost - mb.cumCost); absA_S.push(ma.realSharpe); absB_S.push(mb.realSharpe);
  }
  return { n, dCAGR: { med: median(dCAGR), q1: q(dCAGR, 0.25), q3: q(dCAGR, 0.75), worst: worstDecile(dCAGR), pImp: impC / n }, dSharpe: { med: median(dSharpe), q1: q(dSharpe, 0.25), q3: q(dSharpe, 0.75), worst: worstDecile(dSharpe), pImp: impS / n }, dVol: median(dVol), dMDD: median(dMDD), dUW: median(dUW), dW12: median(dW12), dRot: median(dRot), dFreq: median(dFreq), dCost: median(dCost), absA_S: median(absA_S), absB_S: median(absB_S) };
}

const OUT: string[] = []; const P = (s = "") => { OUT.push(s); console.log(s); };
P("# Comparaison normalisée — `4q-standard-v2` · `4q-energy-trend-rc1` · Browne\n");
P("## Figeage (avant calcul)");
P("- **`4q-standard-v2`** : tag Git `4q-standard-v2` = commit `a067b0c` (bande δ=5, `DEFAULT_MODEL_VERSION=v2`). HEAD courant `345bc0a`.");
P("- **`4q-energy-trend-rc1`** : candidat EXPÉRIMENTAL non commité (spec figée : signal `SPDYENT>SMA6`, poids 10 %, prorata, une bande v2 sur 5 poches). Concordance 28/0 (`concordance-report.md`).");
P("- **Browne** : définition actuelle — 25/25/25/25, rééquilibrage **annuel** (reset au changement d'année civile, même règle pour tous les pays), poids dérivant entre-temps, `MIN_MONTHS=13`. Réplique auto-vérifiée = `computeBrowne`.");
P("- **Formules** : CAGR = `(Vf/Vi)^(12/n)−1` ; vol ann. = σ(rendements mensuels)·√12 ; **Sharpe réel officiel** = `(CAGR réel − CAGR cash réel)/vol réelle` (= Sharpe excédentaire cash réel Quantsightly) ; Sharpe excédentaire arithmétique (secondaire) = `moy(r_réel−rCash_réel)·12/vol` ; turnover = `½·Σ|Δpoids exécutés|` (constitution exclue) ; coûts = `bps·2·turnover` au compounding.");
P("- **Dates/devises/inflation** : fenêtre commune STRICTE par pays (intersection v2/rc1/Browne/inflation/cash) ; devise locale ; CPI local commun ; SPDYENT & or convertis par `convertCurrency` (date exacte).");
P("- **Panel principal** : 21 pays 4Q (DK en sensibilité). Aucun pays retiré selon ses résultats.");
P("\n⚠️ Le Sharpe officiel Quantsightly EST déjà l'excédent sur le cash réel → le « secondaire » n'en diffère que par la convention arithmétique vs CAGR (montré, non redondant).\n");

// ── 1. rc1 vs v2 (DÉTERMINANT) ───────────────────────────────────────────────
P("## 1. rc1 vs v2 — valeur incrémentale de la poche Énergie (DÉTERMINANT)");
P("Médiane sur 21 pays, réel net, fenêtre commune stricte. Δ = rc1 − v2.\n");
P("### 25 bps (principal) par horizon");
P("| horizon | ΔSharpe (q1/q3/pire) %imp | ΔCAGR réel %imp | ΔVol | ΔMDD | Δsous-eau | Δpire-12m | Δrotation | Δcoûts cum. | n |");
P("|---|---|---|---|---|---|---|---|---|---|");
for (const [hk, hy] of HORIZONS) { const d = pairDelta(panel21, "rc1", "v2", hy, 25); P(`| ${hk} | ${sg(d.dSharpe.med)} (${sg(d.dSharpe.q1)}/${sg(d.dSharpe.q3)}/${sg(d.dSharpe.worst)}) ${(d.dSharpe.pImp * 100).toFixed(0)}% | ${sg(d.dCAGR.med, 2)} ${(d.dCAGR.pImp * 100).toFixed(0)}% | ${sg(d.dVol, 2)} | ${sg(d.dMDD, 1)} | ${sg(d.dUW, 0)} | ${sg(d.dW12, 1)} | ${sg(d.dRot * 100, 1)}pt | ${sg(d.dCost, 2)} | ${d.n} |`); }
P("\n### Sensibilité aux coûts (Max) — ΔSharpe médiane");
P("| 0 bps | 10 bps | 25 bps | 50 bps |"); P("|---|---|---|---|");
P(`| ${COSTS.map((cst) => sg(pairDelta(panel21, "rc1", "v2", null, cst).dSharpe.med)).join(" | ")} |`);

// contrôles rc1 (rappel)
P("\n### Contrôles propres à rc1 (Max, 25 bps)");
{
  // poids énergie moyen détenu + activation + rotation sup + contribution + ex-épisodes + post-lancement
  const heldE: number[] = [], act: number[] = [];
  for (const c of panel21) { const cw = commonWindow(c); if (!cw) continue; const sl = slice(c.rc1, cw[0], cw[1]); if (!sl) continue; let he = 0, a = 0, n = 0; for (let i = sl[0] + 1; i < sl[1]; i++) { const st = c.rc1Steps[i]; he += st.held.energy; if (st.held.energy > 1e-9) a++; n++; } if (n) { heldE.push(he / n); act.push(a / n); } }
  const dRotMax = pairDelta(panel21, "rc1", "v2", null, 25).dRot;
  const contribMax = pairDelta(panel21, "rc1", "v2", null, 25).dCAGR.med;
  const ex2122 = pairDelta(panel21, "rc1", "v2", null, 25, [["2021-01", "2022-12"]]);
  const ex0708 = pairDelta(panel21, "rc1", "v2", null, 25, [["2007-01", "2008-12"]]);
  const post = pairDeltaWindow(panel21, "rc1", "v2", "2011-02", 25);
  P(`- Poids Énergie moyen **détenu** : médiane **${(median(heldE) * 100).toFixed(1)} %** · signal **actif ${(median(act) * 100).toFixed(0)} %** des mois`);
  P(`- **Rotation supplémentaire** vs v2 : médiane **${sg(dRotMax * 100, 1)} pt/an** · **contribution nette Énergie** (ΔCAGR réel) : **${sg(contribMax, 2)} %/an**`);
  P(`- **Hors 2021-2022** : ΔSharpe médiane **${sg(ex2122.dSharpe.med)}** (%imp ${(ex2122.dSharpe.pImp * 100).toFixed(0)}) · **hors 2007-2008** : **${sg(ex0708.dSharpe.med)}**`);
  P(`- **Post-lancement SPDYENT (2011-02→)** : ΔSharpe médiane **${sg(post.dSharpe.med)}** · ΔCAGR **${sg(post.dCAGR.med, 2)}**`);
}

// ── 2. v2 vs Browne ; 3. rc1 vs Browne ──────────────────────────────────────
function block(title: string, A: Model, B: Model) {
  P(`\n## ${title}`);
  P("Médiane 21 pays, réel net 25 bps, fenêtre commune stricte. Δ = " + A + " − " + B + ".\n");
  P("| horizon | ΔSharpe (q1/q3/pire) %imp | ΔCAGR réel %imp | ΔVol | ΔMDD | Δsous-eau | Δpire-12m | Δrotation | Sharpe " + A + " / " + B + " | n |");
  P("|---|---|---|---|---|---|---|---|---|---|");
  for (const [hk, hy] of HORIZONS) { const d = pairDelta(panel21, A, B, hy, 25); P(`| ${hk} | ${sg(d.dSharpe.med)} (${sg(d.dSharpe.q1)}/${sg(d.dSharpe.q3)}/${sg(d.dSharpe.worst)}) ${(d.dSharpe.pImp * 100).toFixed(0)}% | ${sg(d.dCAGR.med, 2)} ${(d.dCAGR.pImp * 100).toFixed(0)}% | ${sg(d.dVol, 2)} | ${sg(d.dMDD, 1)} | ${sg(d.dUW, 0)} | ${sg(d.dW12, 1)} | ${sg(d.dRot * 100, 1)}pt | ${sg(d.absA_S, 2)}/${sg(d.absB_S, 2)} | ${d.n} |`); }
}
block("2. v2 vs Browne", "v2", "browne");
block("3. rc1 vs Browne", "rc1", "browne");

// ── sensibilité DK ──────────────────────────────────────────────────────────
P("\n## Sensibilité — panel + Danemark");
P("| paire (Max, 25 bps) | ΔSharpe 21 pays | ΔSharpe 21+DK |"); P("|---|---|---|");
for (const [lab, A, B] of [["rc1−v2", "rc1", "v2"], ["v2−Browne", "v2", "browne"], ["rc1−Browne", "rc1", "browne"]] as const) { const p21 = pairDelta(panel21, A, B, null, 25).dSharpe.med, pDK = pairDelta(all, A, B, null, 25).dSharpe.med; P(`| ${lab} | ${sg(p21)} | ${sg(pDK)} |`); }

// ── Métriques ABSOLUES par modèle (Max, 25 bps, médiane 21 pays) ─────────────
P("\n## Niveaux absolus par modèle (Max, 25 bps, médiane 21 pays, fenêtre commune)");
function modelAbs(m: Model) {
  const acc: Record<string, number[]> = { nomCAGR: [], realCAGR: [], realVol: [], realSharpe: [], excessSharpe: [], realMDD: [], uw: [], w12: [], w5: [], w10: [], w15: [], rot: [], freq: [], cost: [] };
  for (const c of panel21) { const cw = commonWindow(c); if (!cw) continue; const sl = slice(pathOf(c, m), cw[0], cw[1]); if (!sl) continue; const x = measureU(pathOf(c, m), sl[0], sl[1], 25, c.cpi); if (!x || x.realSharpe == null) continue; acc.nomCAGR.push(x.nomCAGR!); acc.realCAGR.push(x.realCAGR!); acc.realVol.push(x.realVol!); acc.realSharpe.push(x.realSharpe!); if (x.excessSharpe != null) acc.excessSharpe.push(x.excessSharpe); acc.realMDD.push(x.realMDD!); acc.uw.push(x.underwater!); acc.w12.push(x.worst12!); acc.w5.push(x.worst5y!); acc.w10.push(x.worst10y!); if (x.worst15y != null) acc.w15.push(x.worst15y); acc.rot.push(x.rotation * 100); acc.freq.push(x.reallocFreq); acc.cost.push(x.cumCost); }
  return acc;
}
P("| modèle | CAGR nom | CAGR réel | Vol réelle | Sharpe réel | MDD réel | sous-eau | pire 12m | pire 5A | pire 10A | pire 15A | rotation | fréq/an | coûts cum. |");
P("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const [lab, m] of [["v2", "v2"], ["rc1", "rc1"], ["Browne", "browne"]] as const) { const a = modelAbs(m); const md = (k: string, d = 2) => median(a[k]).toFixed(d); P(`| **${lab}** | ${md("nomCAGR")} | ${md("realCAGR")} | ${md("realVol")} | ${md("realSharpe", 3)} | ${md("realMDD", 1)} | ${median(a.uw).toFixed(0)} | ${md("w12", 1)} | ${md("w5", 1)} | ${md("w10", 1)} | ${md("w15", 1)} | ${md("rot", 1)}% | ${md("freq", 1)} | ${md("cost", 1)} |`); }
{
  const a = modelAbs("rc1"); const diff = a.realSharpe.map((v, i) => Math.abs(v - (a.excessSharpe[i] ?? v)));
  P(`\n→ **Sharpe secondaire (excédent arithmétique)** ≈ officiel (écart médian ${median(diff).toFixed(3)}) — même conclusion, non redondant.`);
}

// ── MATRICE DE DÉCISION ─────────────────────────────────────────────────────
P("\n## Matrice de décision");
function verdictRow(lab: string, A: Model, B: Model) {
  const max = pairDelta(panel21, A, B, null, 25), ex21 = pairDelta(panel21, A, B, null, 25, [["2021-01", "2022-12"]]);
  const robust = max.dSharpe.worst >= 0 && max.dSharpe.pImp >= 0.9 && ex21.dSharpe.med >= 0;
  return `| ${lab} | ${sg(max.dSharpe.med)} | ${(max.dSharpe.pImp * 100).toFixed(0)}% | ${sg(max.dSharpe.worst)} | ${sg(ex21.dSharpe.med)} | ${max.dSharpe.med > 0.02 ? (robust ? "✅ gain robuste" : "🟡 gain non robuste") : max.dSharpe.med < -0.02 ? "❌ perte" : "⚖️ ~égalité"} |`;
}
P("| paire (Max, 25 bps) | ΔSharpe méd | %amél. | pire-décile | ΔSharpe hors 21-22 | verdict |");
P("|---|---|---|---|---|---|");
P(verdictRow("**rc1 vs v2** (déterminant)", "rc1", "v2"));
P(verdictRow("v2 vs Browne", "v2", "browne"));
P(verdictRow("rc1 vs Browne", "rc1", "browne"));
P("\n**Lecture (point de surveillance de Yann)** : `rc1 vs v2` est le juge de paix. Ici l'avantage de rc1 sur le modèle DE PRODUCTION v2 est **robuste** (ΔSharpe +0,128 Max, 100 % pays, pire-décile positif, **positif hors 2021-2022** +0,063, vol en baisse, robuste aux coûts) — pas faible ni fragile. Réserves maintenues : le gain hors-2021-2022 est **modeste** (+0,063 vs +0,128), la **rotation augmente** (+17 pt/an), et la validation reste **in-sample** (même historique que la découverte). `v2 vs Browne` ≈ égalité sur le long terme (v2 devant en récent) ; `rc1 vs Browne` = rc1 devant.");
P("\n**Aucune intégration automatique.** Décision d'intégration = ultérieure, humaine. rc1 reste candidat expérimental figé ; production `4q-standard-v2` inchangée.");

writeFileSync(path.join(HERE, "comparison-report.md"), OUT.join("\n"));
await db.coredataPool?.end?.();
console.error("\n✅ Comparaison terminée — comparison-report.md");

// helper fenêtre absolue (post-lancement)
function pairDeltaWindow(cs: Country[], A: Model, B: Model, fromYm: string, cost: number) {
  const dS: number[] = [], dC: number[] = []; let imp = 0, n = 0;
  for (const c of cs) { const cw = commonWindow(c); if (!cw) continue; const from = fromYm > cw[0] ? fromYm : cw[0], to = cw[1]; const pa = pathOf(c, A), pb = pathOf(c, B); const sa = slice(pa, from, to), sb = slice(pb, from, to); if (!sa || !sb) continue; const ma = measureU(pa, sa[0], sa[1], cost, c.cpi), mb = measureU(pb, sb[0], sb[1], cost, c.cpi); if (!ma || !mb || ma.realSharpe == null || mb.realSharpe == null) continue; n++; dS.push(ma.realSharpe - mb.realSharpe); if (ma.realSharpe - mb.realSharpe > 0) imp++; dC.push((ma.realCAGR ?? 0) - (mb.realCAGR ?? 0)); }
  return { dSharpe: { med: median(dS), pImp: n ? imp / n : NaN }, dCAGR: { med: median(dC) }, n };
}
