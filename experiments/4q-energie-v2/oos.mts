// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE ÉNERGIE v2 — robustesse HORS-ÉCHANTILLON : sous-périodes, leave-one-country-out,
// dispersion par pays, contribution propre Énergie, extension w. (LECTURE SEULE.)
//   pnpm exec tsx experiments/4q-energie-v2/oos.mts
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
const { buildModel, backtestQuadrants, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = fq;
const { computeKpis } = compute;
const BAND: number = REALLOCATION_BAND.v2;
const T_MODEL = 20, COST = 25;

type Core = { equities: number; bonds: number; gold: number; cash: number };
type DP = { date: string; value: number };
const q = (arr: number[], p: number) => { const a = arr.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const worstDecile = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const n = Math.max(1, Math.round(s.length * 0.1)); return mean(s.slice(0, n)); };

function energyRaw(xw: number, yw: number, shape: string, tE: number): number {
  if (xw <= 0 || yw <= 0) return 0;
  const m = Math.min(xw, yw);
  if (shape === "step") return m >= tE ? 1 : 0;
  if (m <= tE) return 0;
  return Math.min(1, (m - tE) / (100 - tE));
}
function finance(base: Core, e0: number, method: string) {
  const e = Math.max(0, Math.min(0.95, e0));
  if (e === 0) return { ...base, energy: 0 };
  if (method === "prorata") { const k = 1 - e; return { equities: base.equities * k, bonds: base.bonds * k, gold: base.gold * k, cash: base.cash * k, energy: e }; }
  const s = base.equities + base.gold;
  if (s <= 1e-9) { const k = 1 - e; return { equities: base.equities * k, bonds: base.bonds * k, gold: base.gold * k, cash: base.cash * k, energy: e }; }
  const eEff = Math.min(e, s), k = 1 - eEff / s;
  return { equities: base.equities * k, bonds: base.bonds, gold: base.gold * k, cash: base.cash, energy: eEff };
}
interface MonthStep { date: string; rp: number; turn: number; cash: number }
function reconstructPath(bt: any): MonthStep[] {
  const nom: DP[] = bt.series.nominal;
  const tByD = new Map<string, number>(bt.turnover.monthly.map((t: any) => [t.date, t.turnover ?? 0]));
  const cByD = new Map<string, number>(bt.series.sleeves.cash.map((p: any) => [p.date, p.value]));
  return nom.map((p, i) => ({ date: p.date, rp: i === 0 ? 0 : p.value / nom[i - 1].value - 1, turn: tByD.get(p.date) ?? 0, cash: cByD.get(p.date) ?? NaN }));
}
function maxDD(idx: DP[]): number { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function deflate(idx: DP[], cpi: Map<string, number>): DP[] | null { const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(p.date.slice(0, 7)) })).filter((x) => x.c! > 0); if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c!; return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c! / c0) })); }
interface M { realCAGR: number | null; realSharpe: number | null; realMDD: number | null; months: number }
/** Mesure net de coûts sur [fromYm,toYm] (bornes mois inclusives). */
function measureWin(pathArr: MonthStep[], cpi: Map<string, number>, fromYm: string, toYm: string, bps: number): M | null {
  const from = pathArr.findIndex((p) => p.date.slice(0, 7) >= fromYm);
  if (from < 0 || pathArr[from].date.slice(0, 7) > toYm) return null; // fenêtre hors plage
  let to = -1; for (let i = pathArr.length - 1; i >= 0; i--) { if (pathArr[i].date.slice(0, 7) <= toYm) { to = i + 1; break; } }
  if (to < 0 || to - from < 3) return null;
  const cost = bps / 10000; let p = 100;
  const nominal: DP[] = [{ date: pathArr[from].date, value: 100 }];
  const cashIdx: DP[] = [{ date: pathArr[from].date, value: pathArr[from].cash }];
  for (let i = from + 1; i < to; i++) { const net = pathArr[i].rp - cost * 2 * pathArr[i].turn; p *= 1 + net; nominal.push({ date: pathArr[i].date, value: p }); cashIdx.push({ date: pathArr[i].date, value: pathArr[i].cash }); }
  const real = deflate(nominal, cpi); if (!real) return { realCAGR: null, realSharpe: null, realMDD: null, months: nominal.length };
  const realK = computeKpis(real); const cashReal = deflate(cashIdx, cpi); const rf = cashReal ? (computeKpis(cashReal).annualized ?? 0) : 0;
  const sharpe = realK.annualized != null && realK.volatility ? (realK.annualized - rf) / realK.volatility : null;
  return { realCAGR: realK.annualized ?? null, realSharpe: sharpe, realMDD: maxDD(real), months: nominal.length };
}

// ── Signal MONDE ──────────────────────────────────────────────────────────────
const [wEq, wOil, wGold, wBond] = await Promise.all([db.getSeriesData("MXWO Index-XX-1-1"), db.getSeriesData("CL1 comdty-XX-5-1"), db.getSeriesData("XAU Comdty-XX-5-1"), db.getSeriesData("GT10 Govt-US-4-2")]);
const worldModel = buildModel({ countryCode: "WORLD", equityPrice: wEq, oil: wOil, gold: wGold, bond: wBond }, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: T_MODEL });
const worldCoords = new Map<string, { x: number; y: number }>();
for (const r of (worldModel as any).monthlyResults) worldCoords.set(r.date.slice(0, 7), { x: r.x, y: r.y });

// ── FX par mois + énergie locale ────────────────────────────────────────────
const fxRates: any[] = await db.getFxRates();
const fxByMonth = new Map<string, Map<string, number>>();
for (const fx of fxRates) { const pd = compute.usdPerUnitMap(fx.data, fx.reverse); const m = new Map<string, number>(); for (const [d, v] of [...pd.entries()].sort((a, b) => a[0].localeCompare(b[0]))) m.set(d.slice(0, 7), v); fxByMonth.set(fx.currency, m); }
const energyUsd: DP[] = await db.getSeriesData("SPDYENT Index-XX-5-2");
const toLocal = (data: DP[], t: string) => { if (!t || t === "USD") return data; const fx = fxByMonth.get(t); if (!fx) return data; const o: DP[] = []; for (const p of data) { const r = fx.get(p.date.slice(0, 7)); if (r) o.push({ date: p.date, value: p.value / r }); } return o; };

// ── Pays ────────────────────────────────────────────────────────────────────
const isoList: any[] = (await svc.listQuadrantCountries()).filter((c: any) => c.iso !== "DK");
interface Loaded { code: string; model: any; perf: any; energyLocal: DP[]; cpi: Map<string, number> }
const loaded: Loaded[] = [];
for (const { iso } of isoList) {
  const cm = await svc.getCountryQuadrantModel(iso);
  if (!cm.config || !cm.signal || !cm.perf) continue;
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: T_MODEL, energyMode: "disabled" });
  if (model.status !== "OK") continue;
  const cpi = new Map<string, number>(); for (const p of (cm.perf.cpi ?? []) as DP[]) cpi.set(p.date.slice(0, 7), p.value);
  loaded.push({ code: iso, model, perf: cm.perf, energyLocal: toLocal(energyUsd, cm.config.currency), cpi });
}

function btCell(l: Loaded, shape: string | null, tE: number, wMax: number, fin: string): any {
  const weights = l.model.monthlyResults.map((r: any) => {
    const wc = worldCoords.get(r.date.slice(0, 7));
    const e = wMax === 0 || shape === null || !wc ? 0 : wMax * energyRaw(wc.x, wc.y, shape, tE);
    return { date: r.date, allocation: finance(r.baseAllocation, e, fin) };
  });
  return backtestQuadrants({ countryCode: l.code, weights, equityTotalReturn: l.perf.equityTotalReturn, bondTotalReturn: l.perf.bondTotalReturn, cashTotalReturn: l.perf.cashTotalReturn, gold: l.perf.gold, energyTotalReturn: l.energyLocal, cpi: l.perf.cpi, windowYears: null, reallocationBand: BAND });
}

const out: string[] = ["# Étude Énergie v2 — robustesse hors-échantillon\n"];
const L = (s = "") => { out.push(s); console.log(s); };

// Témoin (chemin par pays) + contribution Énergie brute par cellule.
const witPath = new Map<string, { path: MonthStep[]; cpi: Map<string, number> }>();
for (const l of loaded) { const bt = btCell(l, null, 0, 0, "prorata"); if (bt.status === "OK") witPath.set(l.code, { path: reconstructPath(bt), cpi: l.cpi }); }

// ── Sous-périodes (fenêtres calendaires) ─────────────────────────────────────
const WINDOWS: Array<{ key: string; from: string; to: string }> = [
  { key: "Max", from: "1900-01", to: "2100-12" },
  { key: "backfill 95-10", from: "1995-01", to: "2010-12" },
  { key: "live 11-20", from: "2011-01", to: "2020-12" }, // live METHODO, AVANT le choc 21-22
  { key: "pré-2021", from: "1900-01", to: "2020-12" }, // tout sauf le choc récent
  { key: "live 11-26", from: "2011-01", to: "2100-12" },
  { key: "choc 21-26", from: "2021-01", to: "2100-12" },
];

const SHORTLIST: Array<{ shape: string; fin: string; tE: number; w: number; label: string }> = [
  { shape: "ramp", fin: "prorata", tE: 20, w: 0.15, label: "ramp/prorata T_E20 w15 (centre plateau)" },
  { shape: "ramp", fin: "prorata", tE: 20, w: 0.2, label: "ramp/prorata T_E20 w20" },
  { shape: "ramp", fin: "prorata", tE: 20, w: 0.25, label: "ramp/prorata T_E20 w25" },
  { shape: "ramp", fin: "prorata", tE: 20, w: 0.3, label: "ramp/prorata T_E20 w30 (ext.)" },
  { shape: "ramp", fin: "prorata", tE: 20, w: 0.35, label: "ramp/prorata T_E20 w35 (ext.)" },
  { shape: "ramp", fin: "prorata", tE: 0, w: 0.2, label: "ramp/prorata T_E0 w20" },
  { shape: "ramp", fin: "boombloc", tE: 20, w: 0.2, label: "ramp/boombloc T_E20 w20" },
  { shape: "step", fin: "prorata", tE: 40, w: 0.15, label: "step/prorata T_E40 w15 (coin)" },
];

L("## 1. Sous-périodes — médiane ΔSharpe réel net 25 bps (n pays)");
L("La question clé : le gain survit-il HORS du choc 2021-2022 ? (colonnes « live 11-20 » et « pré-2021 »)\n");
L("| config | " + WINDOWS.map((w) => w.key).join(" | ") + " |");
L("|---|" + WINDOWS.map(() => "---|").join(""));
for (const cfg of SHORTLIST) {
  const paths = new Map<string, MonthStep[]>();
  for (const l of loaded) { const bt = btCell(l, cfg.shape, cfg.tE, cfg.w, cfg.fin); if (bt.status === "OK") paths.set(l.code, reconstructPath(bt)); }
  const cells = WINDOWS.map((win) => {
    const ds: number[] = [];
    for (const l of loaded) {
      const wp = witPath.get(l.code), cp = paths.get(l.code); if (!wp || !cp) continue;
      const m0 = measureWin(wp.path, l.cpi, win.from, win.to, COST), m1 = measureWin(cp, l.cpi, win.from, win.to, COST);
      if (m0?.realSharpe != null && m1?.realSharpe != null) ds.push(m1.realSharpe - m0.realSharpe);
    }
    return `${median(ds) >= 0 ? "+" : ""}${median(ds).toFixed(3)} (${ds.length})`;
  });
  L(`| ${cfg.label} | ${cells.join(" | ")} |`);
}

// ── 1bis. Décomposition temporelle FINE (concentration du gain) ──────────────
const BUCKETS: Array<{ key: string; from: string; to: string }> = [
  { key: "95-00", from: "1995-01", to: "2000-12" }, { key: "01-05", from: "2001-01", to: "2005-12" },
  { key: "06-10", from: "2006-01", to: "2010-12" }, { key: "11-15", from: "2011-01", to: "2015-12" },
  { key: "16-20", from: "2016-01", to: "2020-12" }, { key: "21-26", from: "2021-01", to: "2026-06" },
];
L("\n## 1bis. Décomposition temporelle fine — ramp/prorata T_E20 w20 (net 25 bps)");
L("Part du MONDE en boom inflationniste (gate) + médiane ΔSharpe par tranche : où l'énergie paie-t-elle ?\n");
const boomByBucket = BUCKETS.map((b) => { let boom = 0, tot = 0; for (const [ym, wc] of worldCoords) { if (ym >= b.from && ym <= b.to) { tot++; if (wc.x > 0 && wc.y > 0) boom++; } } return tot ? boom / tot : 0; });
const refCfg = { shape: "ramp", fin: "prorata", tE: 20, w: 0.2 };
const refPaths = new Map<string, MonthStep[]>();
for (const l of loaded) { const bt = btCell(l, refCfg.shape, refCfg.tE, refCfg.w, refCfg.fin); if (bt.status === "OK") refPaths.set(l.code, reconstructPath(bt)); }
L("| tranche | " + BUCKETS.map((b) => b.key).join(" | ") + " |");
L("|---|" + BUCKETS.map(() => "---|").join(""));
L("| MONDE boom (gate actif) | " + boomByBucket.map((v) => `${(v * 100).toFixed(0)}%`).join(" | ") + " |");
const dsByBucket = BUCKETS.map((b) => {
  const ds: number[] = [];
  for (const l of loaded) { const wp = witPath.get(l.code), cp = refPaths.get(l.code); if (!wp || !cp) continue; const m0 = measureWin(wp.path, l.cpi, b.from, b.to, COST), m1 = measureWin(cp, l.cpi, b.from, b.to, COST); if (m0?.realSharpe != null && m1?.realSharpe != null) ds.push(m1.realSharpe - m0.realSharpe); }
  return { med: median(ds), n: ds.length };
});
L("| médiane ΔSharpe (n) | " + dsByBucket.map((d) => `${d.med >= 0 ? "+" : ""}${d.med.toFixed(3)} (${d.n})`).join(" | ") + " |");

// ── 2. Leave-one-country-out (Max, net 25 bps) sur les candidats retenus ─────
L("\n## 2. Leave-one-country-out — médiane ΔSharpe Max (net 25 bps)");
L("Chaque pays retiré tour à tour ; on reporte la médiane MIN et MAX sur les 21 retraits (robuste si MIN > 0).\n");
L("| config | médiane pleine | LOO min | LOO max | pays le plus influent |");
L("|---|---|---|---|---|");
for (const cfg of SHORTLIST.slice(0, 6)) {
  const per: Array<{ code: string; d: number }> = [];
  for (const l of loaded) {
    const wp = witPath.get(l.code); if (!wp) continue;
    const bt = btCell(l, cfg.shape, cfg.tE, cfg.w, cfg.fin); if (bt.status !== "OK") continue;
    const m0 = measureWin(wp.path, l.cpi, "1900-01", "2100-12", COST), m1 = measureWin(reconstructPath(bt), l.cpi, "1900-01", "2100-12", COST);
    if (m0?.realSharpe != null && m1?.realSharpe != null) per.push({ code: l.code, d: m1.realSharpe - m0.realSharpe });
  }
  const all = per.map((p) => p.d); const full = median(all);
  const loo = per.map((p) => median(all.filter((_, i) => per[i].code !== p.code)));
  const looMin = Math.min(...loo), looMax = Math.max(...loo);
  const infl = per.slice().sort((a, b) => a.d - b.d)[0];
  L(`| ${cfg.label} | +${full.toFixed(3)} | ${looMin >= 0 ? "+" : ""}${looMin.toFixed(3)} | +${looMax.toFixed(3)} | ${infl.code} (${infl.d >= 0 ? "+" : ""}${infl.d.toFixed(3)}) |`);
}

// ── 3. Dispersion par pays + contribution Énergie (config centrale) ──────────
const REF = SHORTLIST[1]; // ramp/prorata T_E20 w20
L(`\n## 3. Dispersion par pays — ${REF.label} (Max, net 25 bps)`);
L("| pays | ΔSharpe | ΔCAGR | ΔMDD | contrib Énergie (brut, Max) | part active |");
L("|---|---|---|---|---|---|");
const perCountry: Array<{ code: string; dS: number; dC: number }> = [];
for (const l of loaded) {
  const wp = witPath.get(l.code); if (!wp) continue;
  const bt = btCell(l, REF.shape, REF.tE, REF.w, REF.fin); if (bt.status !== "OK") continue;
  const m0 = measureWin(wp.path, l.cpi, "1900-01", "2100-12", COST), m1 = measureWin(reconstructPath(bt), l.cpi, "1900-01", "2100-12", COST);
  if (m0?.realSharpe == null || m1?.realSharpe == null) continue;
  const wByM = new Map<string, number>(l.model.monthlyResults.map((r: any) => { const wc = worldCoords.get(r.date.slice(0, 7)); return [r.date.slice(0, 7), wc ? REF.w * energyRaw(wc.x, wc.y, REF.shape, REF.tE) : 0]; }));
  let act = 0, tot = 0; for (const p of reconstructPath(bt)) { tot++; if ((wByM.get(p.date.slice(0, 7)) ?? 0) > 1e-9) act++; }
  perCountry.push({ code: l.code, dS: m1.realSharpe - m0.realSharpe, dC: (m1.realCAGR ?? 0) - (m0.realCAGR ?? 0) });
  L(`| ${l.code} | ${m1.realSharpe - m0.realSharpe >= 0 ? "+" : ""}${(m1.realSharpe - m0.realSharpe).toFixed(3)} | ${(m1.realCAGR! - m0.realCAGR!) >= 0 ? "+" : ""}${(m1.realCAGR! - m0.realCAGR!).toFixed(2)} | ${(m1.realMDD! - m0.realMDD!) >= 0 ? "+" : ""}${(m1.realMDD! - m0.realMDD!).toFixed(1)} | ${bt.contributions.energy.toFixed(1)}% | ${(act / tot * 100).toFixed(0)}% |`);
}
const dsAll = perCountry.map((p) => p.dS);
L(`\n**${REF.label}** : médiane ΔSharpe +${median(dsAll).toFixed(3)}, pire-décile ${worstDecile(dsAll).toFixed(3)}, % améliorés ${(dsAll.filter((d) => d > 0).length / dsAll.length * 100).toFixed(0)} %, pires pays ${perCountry.slice().sort((a, b) => a.dS - b.dS).slice(0, 3).map((p) => `${p.code} ${p.dS.toFixed(3)}`).join(", ")}`);

writeFileSync(path.join(HERE, "oos-results.md"), out.join("\n"));
await db.coredataPool?.end?.();
console.log("\nÉcrit : oos-results.md");
