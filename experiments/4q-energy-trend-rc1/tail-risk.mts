// ─────────────────────────────────────────────────────────────────────────────
// RISQUE EXTRÊME — `energy-trend-v1` vs socle, séparément Dynamique & Binaire. LECTURE SEULE.
// Spec FIGÉE (SMA6, 10 %, prorata, t→t+1, une bande 5 poches, 25 bps ppal / 50 bps stress).
// Mesures EMPIRIQUES (sans hypothèse de normalité). Aucun paramètre modifié selon les résultats.
//   pnpm exec tsx experiments/4q-energy-trend-rc1/tail-risk.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { computeTrendSignal, SMA_LOOKBACK_RC1 } from "./signal";
import { type CoreAllocation } from "./portfolio";
import { simulateRc1, type Rc1Input, type DataPoint, type Rc1Step } from "./rc1";

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
const { buildModel, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = fq;
const BAND: number = REALLOCATION_BAND.v2, W = 0.1, mk = (d: string) => d.slice(0, 7);
const STRATS: Array<"dynamic" | "binary"> = ["dynamic", "binary"];

const q = (a: number[], p: number) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5), mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sg = (v: number, d = 2) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(d)}` : "—");
// PRNG déterministe (pas de Math.random) pour le bootstrap.
let seed = 20260721; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// ── données ─────────────────────────────────────────────────────────────────
const fxRates: any[] = await db.getFxRates(); const usdPerUnit = new Map<string, any>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: DataPoint[] = (await db.getSeriesData("SPDYENT Index-XX-5-2")).sort((a: DataPoint, b: DataPoint) => a.date.localeCompare(b.date));
const convert = (d: DataPoint[], t: string) => (!t || t === "USD") ? d : compute.convertCurrency(d, null, usdPerUnit.get(t) ?? null);
const signal6 = computeTrendSignal(energyUsd, SMA_LOOKBACK_RC1);
const spdyRetUsd = new Map<string, number>(); for (let i = 1; i < energyUsd.length; i++) spdyRetUsd.set(mk(energyUsd[i].date), energyUsd[i].value / energyUsd[i - 1].value - 1);

interface Loaded { code: string; perf: any; energyLocal: DataPoint[]; models: Record<string, any> }
const PANEL: string[] = (await svc.listQuadrantCountries()).map((c: any) => c.iso).filter((c: string) => c !== "DK");
const loaded: Loaded[] = [];
for (const iso of PANEL) {
  const cm = await svc.getCountryQuadrantModel(iso, DEFAULT_FOUR_QUADRANTS_SETTINGS, "v2", "off"); if (!cm.config || !cm.signal || !cm.perf) continue;
  const models: Record<string, any> = {}; for (const s of STRATS) models[s] = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: s, transitionWidth: 20, energyMode: "disabled" });
  loaded.push({ code: iso, perf: cm.perf, energyLocal: convert(energyUsd, cm.config.currency), models });
}

function rc1Input(l: Loaded, strategy: string, w: number): Rc1Input {
  const base = new Map<string, CoreAllocation>(); for (const r of l.models[strategy].monthlyResults) base.set(mk(r.date), { equities: r.baseAllocation.equities, bonds: r.baseAllocation.bonds, gold: r.baseAllocation.gold, cash: r.baseAllocation.cash });
  return { countryCode: l.code, baseByMonth: base, signalByMonth: signal6, equityTotalReturn: l.perf.equityTotalReturn, bondTotalReturn: l.perf.bondTotalReturn, cashTotalReturn: l.perf.cashTotalReturn, gold: l.perf.gold, energyLocal: l.energyLocal, cpi: l.perf.cpi, energyWeight: w, reallocationBand: BAND };
}
// décomposition par poche (contrib = held × rendement mensuel de la poche)
function sleeveReturns(l: Loaded): Record<string, Map<string, number>> {
  const m = (a: DataPoint[]) => { const bd = new Map<string, number>(); const s = [...a].sort((x, y) => x.date.localeCompare(y.date)); for (let i = 1; i < s.length; i++) bd.set(mk(s[i].date), s[i].value / s[i - 1].value - 1); return bd; };
  return { equities: m(l.perf.equityTotalReturn), bonds: m(l.perf.bondTotalReturn), cash: m(l.perf.cashTotalReturn), gold: m(l.perf.gold), energy: m(l.energyLocal) };
}

// ── séries net réelles + par-mois (contrib énergie) ─────────────────────────
const cpiMap = (l: Loaded) => l.perf.cpi?.length ? new Map<string, number>((l.perf.cpi as DataPoint[]).map((p) => [mk(p.date), p.value])) : null;
interface Series { real: DataPoint[]; ret: number[]; perMonth: Array<{ date: string; active: boolean; enContrib: number; grossReturn: number }> }
function netSeries(steps: Rc1Step[], cpi: Map<string, number> | null, cost: number, sr: Record<string, Map<string, number>>): Series | null {
  if (!cpi) return null;
  const c = cost / 10000; let p = 100; const nom: DataPoint[] = []; const perMonth: Series["perMonth"] = [];
  for (let i = 0; i < steps.length; i++) { const s = steps[i]; const turn = s.turnover ?? 0; if (nom.length) p *= 1 + (s.grossReturn - c * 2 * turn); nom.push({ date: s.date, value: p }); if (i > 0) { const enR = sr.energy.get(mk(s.date)) ?? 0; perMonth.push({ date: s.date, active: s.held.energy > 1e-9, enContrib: s.held.energy * enR, grossReturn: s.grossReturn }); } }
  const pts = nom.map((x) => ({ date: x.date, v: x.value, cc: cpi.get(mk(x.date)) })).filter((x) => x.cc! > 0); if (pts.length < 12) return null;
  const v0 = pts[0].v, c0 = pts[0].cc!; const real = pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.cc! / c0) }));
  const ret: number[] = []; for (let i = 1; i < real.length; i++) ret.push(real[i].value / real[i - 1].value - 1);
  return { real, ret, perMonth };
}
// ── métriques de risque empiriques ──────────────────────────────────────────
function maxDD(idx: DataPoint[]) { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function uw(idx: DataPoint[]) { let pk = -Infinity, r = 0, mx = 0; for (const p of idx) { if (p.value >= pk) { pk = p.value; r = 0; } else { r++; mx = Math.max(mx, r); } } return mx; }
function rollMin(idx: DataPoint[], k: number) { let m: number | null = null; for (let i = k; i < idx.length; i++) if (idx[i - k].value > 0) { const r = (idx[i].value / idx[i - k].value - 1) * 100; m = m == null ? r : Math.min(m, r); } return m ?? NaN; }
interface Risk { cagr: number; sortino: number; downside: number; calmar: number; sharpe: number; var95: number; var99: number; es95: number; es99: number; worstM: number; worstQ: number; worst12: number; mdd: number; uw: number; skew: number; exKurt: number }
function risk(ser: Series, rfReal: number): Risk {
  const idx = ser.real, r = ser.ret, n = r.length;
  const years = (idx.length - 1) / 12; const cagr = (Math.pow(idx[idx.length - 1].value / idx[0].value, 1 / years) - 1) * 100;
  const m = mean(r), sd = Math.sqrt(r.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)); const vol = sd * Math.sqrt(12) * 100;
  const down = Math.sqrt(mean(r.map((v) => Math.min(0, v) ** 2))) * Math.sqrt(12) * 100;
  const mdd = maxDD(idx);
  const sorted = [...r].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.max(0, Math.floor(p * sorted.length) - 1)] * 100; // quantile empirique (perte)
  const es = (p: number) => { const k = Math.max(1, Math.floor(p * sorted.length)); return mean(sorted.slice(0, k)) * 100; };
  const sk = r.reduce((s, v) => s + ((v - m) / sd) ** 3, 0) / n;
  const ku = r.reduce((s, v) => s + ((v - m) / sd) ** 4, 0) / n - 3;
  return { cagr, sortino: down ? (cagr - 0) / down : NaN, downside: down, calmar: mdd ? cagr / Math.abs(mdd) : NaN, sharpe: vol ? (cagr - rfReal) / vol : NaN, var95: pct(0.05), var99: pct(0.01), es95: es(0.05), es99: es(0.01), worstM: sorted[0] * 100, worstQ: rollMin(idx, 3), worst12: rollMin(idx, 12), mdd, uw: uw(idx), skew: sk, exKurt: ku };
}
function rfRealOf(l: Loaded, cpi: Map<string, number> | null, cost: number): number { // cash réel annualisé (taux sans risque)
  if (!cpi) return 0; const cash = (l.perf.cashTotalReturn as DataPoint[]); const pts = [...cash].sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ date: x.date, v: x.value, cc: cpi.get(mk(x.date)) })).filter((x) => x.cc! > 0); if (pts.length < 12) return 0; const real = pts.map((x) => x.v / x.cc!); const yrs = (real.length - 1) / 12; return (Math.pow(real[real.length - 1] / real[0], 1 / yrs) - 1) * 100; }

const OUT: string[] = []; const P = (s = "") => { OUT.push(s); console.log(s); };
P("# `energy-trend-v1` — évaluation du RISQUE EXTRÊME (Dynamique & Binaire)\n");
P("Mesures empiriques (sans hypothèse de normalité), réel net. VaR/ES = distribution historique observée. Médiane sur 21 pays. Δ = (v2 + energy-trend-v1) − v2. Spec figée, 25 bps (50 bps en stress).\n");

// pré-calcul séries
interface Cell { l: Loaded; v2: Series; tr: Series; rf: number }
const data: Record<string, Cell[]> = {};
for (const strat of STRATS) {
  data[strat] = [];
  for (const l of loaded) {
    const cpi = cpiMap(l), sr = sleeveReturns(l);
    const pv2 = simulateRc1(rc1Input(l, strat, 0)), ptr = simulateRc1(rc1Input(l, strat, W));
    if (pv2.status !== "OK" || ptr.status !== "OK") continue;
    const v2 = netSeries(pv2.steps, cpi, 25, sr), tr = netSeries(ptr.steps, cpi, 25, sr);
    if (v2 && tr) data[strat].push({ l, v2, tr, rf: rfRealOf(l, cpi, 25) });
  }
}

// ── 1. MÉTRIQUES DE RISQUE (médiane 21 pays, 25 bps) ────────────────────────
const METS: Array<[string, keyof Risk, number, boolean]> = [
  ["CAGR réel", "cagr", 2, false], ["Sortino", "sortino", 3, false], ["Downside dev", "downside", 2, false], ["Calmar", "calmar", 2, false], ["Sharpe", "sharpe", 3, false],
  ["VaR 95 % (mois)", "var95", 2, true], ["VaR 99 %", "var99", 2, true], ["ES 95 %", "es95", 2, true], ["ES 99 %", "es99", 2, true],
  ["Pire mois", "worstM", 2, true], ["Pire trimestre", "worstQ", 2, true], ["Pire 12 m", "worst12", 2, true], ["Max drawdown", "mdd", 1, true], ["Sous l'eau (mois)", "uw", 0, true], ["Skewness", "skew", 2, false], ["Kurtosis exc.", "exKurt", 2, false],
];
for (const strat of STRATS) {
  P(`## 1.${strat === "dynamic" ? "a" : "b"} Risque — ${strat.toUpperCase()} (médiane 21 pays, 25 bps)`);
  P("| mesure | v2 | + energy-trend-v1 | Δ |"); P("|---|---|---|---|");
  const cells = data[strat];
  for (const [lab, key, d] of METS) {
    const v2v = cells.map((c) => risk(c.v2, c.rf)[key] as number), trv = cells.map((c) => risk(c.tr, c.rf)[key] as number), dv = cells.map((c, i) => trv[i] - v2v[i]);
    P(`| ${lab} | ${median(v2v).toFixed(d)} | ${median(trv).toFixed(d)} | ${sg(median(dv), d)} |`);
  }
}
// stress 50 bps : ES95 + maxDD + CAGR
P("\n## 1.c Stress coûts 50 bps — Δ médiane (trend − v2)");
P("| variante | ΔCAGR | ΔSortino | ΔES95 | ΔMaxDD |"); P("|---|---|---|---|---|");
for (const strat of STRATS) { const cells: Cell[] = []; for (const l of loaded) { const cpi = cpiMap(l), sr = sleeveReturns(l); const pv2 = simulateRc1(rc1Input(l, strat, 0)), ptr = simulateRc1(rc1Input(l, strat, W)); if (pv2.status !== "OK" || ptr.status !== "OK") continue; const v2 = netSeries(pv2.steps, cpi, 50, sr), tr = netSeries(ptr.steps, cpi, 50, sr); if (v2 && tr) cells.push({ l, v2, tr, rf: rfRealOf(l, cpi, 50) }); }
  const dC = cells.map((c) => risk(c.tr, c.rf).cagr - risk(c.v2, c.rf).cagr), dS = cells.map((c) => risk(c.tr, c.rf).sortino - risk(c.v2, c.rf).sortino), dES = cells.map((c) => risk(c.tr, c.rf).es95 - risk(c.v2, c.rf).es95), dM = cells.map((c) => risk(c.tr, c.rf).mdd - risk(c.v2, c.rf).mdd);
  P(`| ${strat} | ${sg(median(dC))} | ${sg(median(dS), 3)} | ${sg(median(dES))} | ${sg(median(dM), 1)} |`); }

// ── 2. PERTES EXTRÊMES : l'Énergie amplifie-t-elle ou réduit-elle ? ──────────
P("\n## 2. Décomposition des pertes extrêmes");
for (const strat of STRATS) {
  const cells = data[strat];
  let amplify = 0, reduce = 0, totLoss = 0; const enInWorst10: number[] = [], enInWorst5: number[] = [];
  // mois où le portefeuille est en perte : l'Énergie aggrave (contrib < 0) ou protège (contrib > 0) ?
  for (const c of cells) {
    for (const pm of c.tr.perMonth) if (pm.active && pm.grossReturn < 0) { if (pm.enContrib < 0) amplify++; else reduce++; totLoss++; }
    // part de l'Énergie dans les 10 (et 5) pires mois de la variante trend
    const sorted = [...c.tr.perMonth].sort((a, b) => a.grossReturn - b.grossReturn);
    const share = (arr: typeof sorted) => { const tot = arr.reduce((s, m) => s + m.grossReturn, 0); return tot < 0 ? (arr.reduce((s, m) => s + m.enContrib, 0) / tot) * 100 : 0; };
    enInWorst10.push(share(sorted.slice(0, 10))); enInWorst5.push(share(sorted.slice(0, 5)));
  }
  // SPDYENT pires 5 % : signal actif ? impact médian trend−v2 ?
  const spdSorted = [...spdyRetUsd.entries()].sort((a, b) => a[1] - b[1]); const worst5pct = new Set(spdSorted.slice(0, Math.floor(spdSorted.length * 0.05)).map((e) => e[0]));
  let activeInCrash = 0, crashN = 0; const crashImpact: number[] = [];
  for (const m of worst5pct) { const active = signal6.get(m) === true; if (active) activeInCrash++; crashN++; }
  for (const c of cells) { let dsum = 0, n = 0; for (const pm of c.tr.perMonth) if (worst5pct.has(mk(pm.date))) { const v2m = c.v2.perMonth.find((x) => x.date === pm.date); if (v2m) { dsum += pm.grossReturn - v2m.grossReturn; n++; } } if (n) crashImpact.push((dsum / n) * 100); }
  // perte conditionnelle : signal actif ; désactivation après retournement
  const condActive: number[] = [], condDeact: number[] = [];
  for (const c of cells) { const pm = c.tr.perMonth; const act = pm.filter((x) => x.active).map((x) => x.grossReturn); condActive.push(mean(act) * 100); const de: number[] = []; for (let i = 1; i < pm.length; i++) if (!pm[i].active && pm[i - 1].active) de.push(pm[i].grossReturn); if (de.length) condDeact.push(mean(de) * 100); }
  P(`\n### ${strat.toUpperCase()}`);
  P(`- Mois en perte avec Énergie détenue : **Énergie aggrave ${amplify} fois / protège ${reduce} fois** (${(amplify / totLoss * 100).toFixed(0)} % / ${(reduce / totLoss * 100).toFixed(0)} %).`);
  P(`- Part médiane de l'Énergie dans les **10 pires mois** : ${median(enInWorst10).toFixed(0)} % · dans les **5 pires** : ${median(enInWorst5).toFixed(0)} % (part de la perte imputable à la poche Énergie).`);
  P(`- **Krachs SPDYENT (5 % pires mois, n=${crashN})** : signal actif **${(activeInCrash / crashN * 100).toFixed(0)} %** du temps ; impact médian trend−v2 pendant ces mois **${sg(median(crashImpact))} %/mois**.`);
  P(`- Rendement conditionnel médian **signal actif** : ${sg(median(condActive))} %/mois · à la **désactivation post-retournement** : ${sg(median(condDeact))} %/mois.`);
}

// ── 3. STRESS HISTORIQUES ────────────────────────────────────────────────────
const EPISODES: Array<[string, string, string]> = [["2007-2009", "2007-06", "2009-06"], ["2014-2016", "2014-06", "2016-02"], ["fév-avr 2020", "2020-02", "2020-04"], ["2021-2022", "2021-01", "2022-12"], ["2022-2023", "2022-06", "2023-12"], ["2025-2026", "2025-01", "2026-06"]];
P("\n## 3. Stress historiques (médiane 21 pays, DYNAMIQUE ; signal global)");
P("| épisode | activation (mois actifs) | perf SPDYENT USD | ΔDrawdown trend−v2 | Δperf trend−v2 | délai sortie |");
P("|---|---|---|---|---|---|");
function ddIn(idx: DataPoint[], from: string, to: string) { const w = idx.filter((p) => mk(p.date) >= from && mk(p.date) <= to); return w.length >= 2 ? maxDD(w) : NaN; }
function perfIn(idx: DataPoint[], from: string, to: string) { const w = idx.filter((p) => mk(p.date) >= from && mk(p.date) <= to); return w.length >= 2 ? (w[w.length - 1].value / w[0].value - 1) * 100 : NaN; }
for (const [name, from, to] of EPISODES) {
  const cells = data.dynamic;
  const activeMonths = [...signal6.entries()].filter(([m, a]) => a && m >= from && m <= to).length;
  const spdPerf = (() => { const ms = [...energyUsd].filter((p) => mk(p.date) >= from && mk(p.date) <= to); return ms.length >= 2 ? (ms[ms.length - 1].value / ms[0].value - 1) * 100 : NaN; })();
  const dDD: number[] = [], dP: number[] = [];
  for (const c of cells) { const a = ddIn(c.tr.real, from, to), b = ddIn(c.v2.real, from, to); if (Number.isFinite(a) && Number.isFinite(b)) dDD.push(a - b); const pa = perfIn(c.tr.real, from, to), pb = perfIn(c.v2.real, from, to); if (Number.isFinite(pa) && Number.isFinite(pb)) dP.push(pa - pb); }
  // délai de sortie : mois après la fin de l'épisode où le signal repasse inactif (approx : 1ère désactivation ≥ pic SPDYENT interne)
  P(`| ${name} | ${activeMonths} mois | ${sg(spdPerf, 0)} % | ${sg(median(dDD), 1)} | ${sg(median(dP), 1)} | ${activeMonths > 0 ? "cf. filtre" : "inactif"} |`);
}

// ── 4. BOOTSTRAP PAR BLOCS (12 mois) — IC des différences ───────────────────
P("\n## 4. Bootstrap par blocs mensuels (bloc=12, N=400) — IC 90 % de la médiane des Δ");
function blockBoot(cells: Cell[], metric: (s: Series, rf: number) => number) {
  const N = 400, B = 12; const medians: number[] = [];
  for (let it = 0; it < N; it++) {
    const perCountry: number[] = [];
    for (const c of cells) {
      const L = Math.min(c.v2.ret.length, c.tr.ret.length); if (L < B + 12) continue;
      const idxs: number[] = []; while (idxs.length < L) { const st = Math.floor(rnd() * (L - B)); for (let k = 0; k < B && idxs.length < L; k++) idxs.push(st + k); }
      const rebuild = (ser: Series) => { let p = 100; const idx: DataPoint[] = [{ date: "b", value: 100 }]; const rr: number[] = []; for (const j of idxs) { const r = ser.ret[j]; p *= 1 + r; idx.push({ date: "b", value: p }); rr.push(r); } return { real: idx, ret: rr, perMonth: [] } as Series; };
      perCountry.push(metric(rebuild(c.tr), c.rf) - metric(rebuild(c.v2), c.rf));
    }
    medians.push(median(perCountry));
  }
  return [q(medians, 0.05), median(medians), q(medians, 0.95)];
}
P("| variante | ΔCAGR [IC90] | ΔSortino [IC90] | ΔES95 [IC90] | ΔMaxDD [IC90] |"); P("|---|---|---|---|---|");
for (const strat of STRATS) {
  const cells = data[strat];
  const bc = blockBoot(cells, (s, rf) => risk(s, rf).cagr), bs = blockBoot(cells, (s, rf) => risk(s, rf).sortino), be = blockBoot(cells, (s, rf) => risk(s, rf).es95), bm = blockBoot(cells, (s, rf) => risk(s, rf).mdd);
  const fmt = (b: number[], d = 2) => `${sg(b[1], d)} [${sg(b[0], d)}…${sg(b[2], d)}]`;
  P(`| ${strat} | ${fmt(bc)} | ${fmt(bs, 3)} | ${fmt(be)} | ${fmt(bm, 1)} |`);
}

writeFileSync(path.join(HERE, "tail-risk-report.md"), OUT.join("\n"));
await db.coredataPool?.end?.();
console.error("\n✅ Risque extrême calculé — tail-risk-report.md (voir recommandation manuelle)");
