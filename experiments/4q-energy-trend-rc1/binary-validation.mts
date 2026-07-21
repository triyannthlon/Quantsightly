// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION BINAIRE — `4q-energy-trend-rc1` sur la variante BINAIRE. LECTURE SEULE.
//
// Déterminant marginal : Binaire+Énergie vs Binaire sans Énergie. Spec rc1 STRICTEMENT
// FIGÉE (aucune réoptimisation) : signal SPDYENT>SMA6, poids 10 %, prorata, t→t+1, UNE
// bande v2 sur 5 poches. Mêmes fenêtres communes (des deux bras), 21 pays (+DK sens.),
// devises/inflation, coûts 0/10/25/50 bps, métriques, exclusions 2007-08 & 2021-22.
//
// Règle : robuste sur Binaire → surcouche commune Dyn+Bin ; sinon → Dynamique seule
// (la Binaire reste inchangée). Un échec Binaire n'invalide PAS le résultat Dynamique.
//   pnpm exec tsx experiments/4q-energy-trend-rc1/binary-validation.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { computeTrendSignal, SMA_LOOKBACK_RC1 } from "./signal";
import { ENERGY_WEIGHT_RC1, type CoreAllocation } from "./portfolio";
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
const { buildModel, backtestQuadrants, weightsFromModel, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = fq;
const BAND: number = REALLOCATION_BAND.v2;
const W = ENERGY_WEIGHT_RC1;
const COSTS = [0, 10, 25, 50];
const HORIZONS: Array<[string, number | null]> = [["Max", null], ["20A", 20], ["10A", 10], ["5A", 5]];
const mk = (d: string) => d.slice(0, 7);
const q = (a: number[], p: number) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const worstDecile = (a: number[]) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const n = Math.max(1, Math.round(s.length * 0.1)); return mean(s.slice(0, n)); };
const sg = (v: number, d = 3) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(d)}` : "—");

interface Step { date: string; grossReturn: number; turnover: number | null; cash: number }
function cagrVol(idx: DataPoint[]) { const n = idx.length; let cagr: number | null = null; if (n >= 2 && idx[0].value > 0 && idx[n - 1].value > 0) { const y = (n - 1) / 12; cagr = y > 0 ? (Math.pow(idx[n - 1].value / idx[0].value, 1 / y) - 1) * 100 : null; } let vol: number | null = null; if (n >= 3) { const r: number[] = []; for (let i = 1; i < n; i++) if (idx[i - 1].value !== 0) r.push(idx[i].value / idx[i - 1].value - 1); if (r.length >= 2) { const m = mean(r); vol = Math.sqrt(r.reduce((s, v) => s + (v - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(12) * 100; } } return { cagr, vol }; }
function maxDD(idx: DataPoint[]) { let pk = -Infinity, d = 0; for (const p of idx) { if (p.value > pk) pk = p.value; if (pk > 0) d = Math.min(d, (p.value / pk - 1) * 100); } return d; }
function deflate(idx: DataPoint[], cpi: Map<string, number>): DataPoint[] | null { const pts = idx.map((p) => ({ date: p.date, v: p.value, c: cpi.get(mk(p.date)) })).filter((x): x is { date: string; v: number; c: number } => x.c !== undefined && x.c > 0); if (pts.length < 2) return null; const v0 = pts[0].v, c0 = pts[0].c; return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c / c0) })); }
const EPS = 0.005;
interface UM { realCAGR: number | null; realVol: number | null; realSharpe: number | null; realMDD: number | null; rotation: number; cumCost: number }
function measureU(steps: Step[], from: number, to: number, costBps: number, cpi: Map<string, number> | null, excl: Array<[string, string]> = []): UM | null {
  const cost = costBps / 10000; let p = 100; const nom: DataPoint[] = []; const cashI: DataPoint[] = []; const turns: number[] = []; let cumCost = 0;
  const skip = (ym: string) => excl.some(([a, b]) => ym >= a && ym <= b);
  for (let i = from; i < to; i++) { const ym = mk(steps[i].date); if (skip(ym)) continue; const t = steps[i].turnover ?? 0; const c = cost * 2 * t; if (nom.length) { p *= 1 + (steps[i].grossReturn - c); cumCost += c; } nom.push({ date: steps[i].date, value: p }); cashI.push({ date: steps[i].date, value: steps[i].cash }); if (nom.length > 1) turns.push(t); }
  if (nom.length < 3) return null;
  const real = cpi ? deflate(nom, cpi) : null; const realCash = cpi ? deflate(cashI, cpi) : null;
  const rk = real ? cagrVol(real) : { cagr: null, vol: null };
  const rf = realCash ? cagrVol(realCash).cagr ?? 0 : 0;
  return { realCAGR: rk.cagr, realVol: rk.vol, realSharpe: rk.cagr != null && rk.vol ? (rk.cagr - rf) / rk.vol : null, realMDD: real ? maxDD(real) : null, rotation: turns.length ? mean(turns) * 12 : 0, cumCost: cumCost * 100 };
}

// ── chargement (base BINAIRE) ───────────────────────────────────────────────
const fxRates: any[] = await db.getFxRates(); const usdPerUnit = new Map<string, any>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: DataPoint[] = (await db.getSeriesData("SPDYENT Index-XX-5-2")).sort((a: DataPoint, b: DataPoint) => a.date.localeCompare(b.date));
const convert = (d: DataPoint[], t: string) => (!t || t === "USD") ? d : compute.convertCurrency(d, null, usdPerUnit.get(t) ?? null);
const signal6 = computeTrendSignal(energyUsd, SMA_LOOKBACK_RC1);

interface Country { code: string; cpi: Map<string, number> | null; v2: Step[]; rc1: Step[]; rc1Steps: any[]; start: string; end: string }
async function load(iso: string): Promise<Country | null> {
  const cm = await svc.getCountryQuadrantModel(iso); if (!cm.config || !cm.signal || !cm.perf) return null;
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "binary", transitionWidth: 20, energyMode: "disabled" }); // BINAIRE
  if (model.status !== "OK") return null;
  const baseByMonth = new Map<string, CoreAllocation>(); for (const r of model.monthlyResults) baseByMonth.set(mk(r.date), { equities: r.baseAllocation.equities, bonds: r.baseAllocation.bonds, gold: r.baseAllocation.gold, cash: r.baseAllocation.cash });
  const energyLocal = convert(energyUsd, cm.config.currency);
  const rInput = (w: number): Rc1Input => ({ countryCode: iso, baseByMonth, signalByMonth: signal6, equityTotalReturn: cm.perf.equityTotalReturn, bondTotalReturn: cm.perf.bondTotalReturn, cashTotalReturn: cm.perf.cashTotalReturn, gold: cm.perf.gold, energyLocal, cpi: cm.perf.cpi, energyWeight: w, reallocationBand: BAND });
  const pV2 = simulateRc1(rInput(0)), pRc1 = simulateRc1(rInput(W));
  if (pV2.status !== "OK" || pRc1.status !== "OK") return null;
  const toStep = (s: any): Step => ({ date: s.date, grossReturn: s.grossReturn, turnover: s.turnover, cash: s.cash });
  const cpi = (cm.perf.cpi?.length ? new Map<string, number>((cm.perf.cpi as DataPoint[]).map((p) => [mk(p.date), p.value])) : null);
  return { code: iso, cpi, v2: pV2.steps.map(toStep), rc1: pRc1.steps.map(toStep), rc1Steps: pRc1.steps, start: pRc1.start!, end: pRc1.end! };
}
const PANEL: string[] = (await svc.listQuadrantCountries()).map((c: any) => c.iso).filter((c: string) => c !== "DK");
const all: Country[] = []; for (const iso of [...PANEL, "DK"]) { const c = await load(iso); if (c) all.push(c); }
const panel21 = all.filter((c) => c.code !== "DK");

// fenêtre = celle du bras (v2 et rc1 partagent la même : même base + énergie).
function slice(steps: Step[], from: string, to: string): [number, number] | null { const f = steps.findIndex((s) => mk(s.date) >= from); if (f < 0 || mk(steps[f].date) > to) return null; let t = -1; for (let i = steps.length - 1; i >= 0; i--) if (mk(steps[i].date) <= to) { t = i + 1; break; } return t < 0 || t - f < 3 ? null : [f, t]; }
function horizonFrom(from: string, to: string, years: number | null): string { if (years == null) return from; const cut = `${Number(to.slice(0, 4)) - years}${to.slice(4)}`; return cut > from ? cut : from; }

// AUTO-VÉRIF : Binaire w=0 = socle Binaire v2 (moteur), et rc1 = moteur.
{
  const cm = await svc.getCountryQuadrantModel("US");
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "binary", transitionWidth: 20, energyMode: "disabled" });
  const eL = convert(energyUsd, cm.config.currency);
  const bt0 = backtestQuadrants({ countryCode: "US", weights: weightsFromModel(model), ...cm.perf, energyTotalReturn: eL, windowYears: null, reallocationBand: BAND });
  const c = panel21.find((x) => x.code === "US")!; const m0 = measureU(c.v2, 0, c.v2.length, 0, c.cpi);
  console.error(`AUTO-VÉRIF US Binaire w=0 : réplique realCAGR ${m0?.realCAGR?.toFixed(3)} vs moteur ${bt0.metrics.real?.annualized?.toFixed(3)} ${Math.abs((m0?.realCAGR ?? 0) - (bt0.metrics.real?.annualized ?? 0)) < 5e-3 ? "✅" : "⚠️"}`);
}

// ── delta rc1 − v2 (BINAIRE), fenêtre du bras ───────────────────────────────
function delta(cs: Country[], years: number | null, cost: number, excl: Array<[string, string]> = [], fromAbs?: string) {
  const dC: number[] = [], dS: number[] = [], dV: number[] = [], dM: number[] = [], dRot: number[] = [], dCost: number[] = []; let impC = 0, impS = 0, n = 0;
  for (const c of cs) {
    const from = fromAbs ? (fromAbs > c.start ? fromAbs : c.start) : horizonFrom(c.start, c.end, years), to = c.end;
    const sa = slice(c.rc1, from, to), sb = slice(c.v2, from, to); if (!sa || !sb) continue;
    const ma = measureU(c.rc1, sa[0], sa[1], cost, c.cpi, excl), mb = measureU(c.v2, sb[0], sb[1], cost, c.cpi, excl);
    if (!ma || !mb || ma.realSharpe == null || mb.realSharpe == null || ma.realCAGR == null || mb.realCAGR == null) continue;
    n++; dC.push(ma.realCAGR - mb.realCAGR); if (ma.realCAGR - mb.realCAGR > 0) impC++; dS.push(ma.realSharpe - mb.realSharpe); if (ma.realSharpe - mb.realSharpe > 0) impS++;
    dV.push((ma.realVol ?? 0) - (mb.realVol ?? 0)); dM.push((ma.realMDD ?? 0) - (mb.realMDD ?? 0)); dRot.push(ma.rotation - mb.rotation); dCost.push(ma.cumCost - mb.cumCost);
  }
  return { n, dCAGR: { med: median(dC), pImp: impC / n }, dSharpe: { med: median(dS), q1: q(dS, 0.25), q3: q(dS, 0.75), worst: worstDecile(dS), pImp: impS / n }, dVol: median(dV), dMDD: median(dM), dRot: median(dRot), dCost: median(dCost) };
}

const OUT: string[] = []; const P = (s = "") => { OUT.push(s); console.log(s); };
P("# Validation BINAIRE — `4q-energy-trend-rc1`\n");
P("Déterminant marginal : **4Q Binaire v2 + Énergie** vs **4Q Binaire v2** (sans Énergie). Spec rc1 FIGÉE (SMA6, w=10 %, prorata, t→t+1, une bande sur 5 poches). 21 pays, réel net, fenêtre commune des deux bras. Δ = Binaire+Énergie − Binaire.\n");

P("## Par horizon (25 bps)");
P("| horizon | ΔSharpe (q1/q3/pire) %imp | ΔCAGR réel %imp | ΔVol | ΔMDD | rotation sup. | coûts cum. sup. | n |");
P("|---|---|---|---|---|---|---|---|");
for (const [hk, hy] of HORIZONS) { const d = delta(panel21, hy, 25); P(`| ${hk} | ${sg(d.dSharpe.med)} (${sg(d.dSharpe.q1)}/${sg(d.dSharpe.q3)}/${sg(d.dSharpe.worst)}) ${(d.dSharpe.pImp * 100).toFixed(0)}% | ${sg(d.dCAGR.med, 2)} ${(d.dCAGR.pImp * 100).toFixed(0)}% | ${sg(d.dVol, 2)} | ${sg(d.dMDD, 1)} | ${sg(d.dRot * 100, 1)}pt | ${sg(d.dCost, 2)} | ${d.n} |`); }

P("\n## Sensibilité aux coûts (Max) — ΔSharpe médiane");
P("| 0 bps | 10 bps | 25 bps | 50 bps |"); P("|---|---|---|---|");
P(`| ${COSTS.map((cst) => sg(delta(panel21, null, cst).dSharpe.med)).join(" | ")} |`);

P("\n## Contrôles temporels (Max, 25 bps) — médiane ΔSharpe");
const ex21 = delta(panel21, null, 25, [["2021-01", "2022-12"]]);
const ex07 = delta(panel21, null, 25, [["2007-01", "2008-12"]]);
const post = delta(panel21, null, 25, [], "2011-02");
P(`- **Hors 2021-2022** : ${sg(ex21.dSharpe.med)} (%imp ${(ex21.dSharpe.pImp * 100).toFixed(0)}, pire-décile ${sg(ex21.dSharpe.worst)})`);
P(`- **Hors 2007-2008** : ${sg(ex07.dSharpe.med)} (%imp ${(ex07.dSharpe.pImp * 100).toFixed(0)})`);
P(`- **Post-lancement SPDYENT (2011-02→)** : ${sg(post.dSharpe.med)} (%imp ${(post.dSharpe.pImp * 100).toFixed(0)})`);

// contrôles poche
{
  const heldE: number[] = [], act: number[] = [];
  for (const c of panel21) { const sl = slice(c.rc1, c.start, c.end); if (!sl) continue; let he = 0, a = 0, n = 0; for (let i = sl[0] + 1; i < sl[1]; i++) { const st = c.rc1Steps[i]; he += st.held.energy; if (st.held.energy > 1e-9) a++; n++; } if (n) { heldE.push(he / n); act.push(a / n); } }
  const d = delta(panel21, null, 25);
  P(`- Poids Énergie moyen **détenu** ${(median(heldE) * 100).toFixed(1)} % · signal actif ${(median(act) * 100).toFixed(0)} % · **rotation sup.** ${sg(d.dRot * 100, 1)} pt/an · **contribution nette** (ΔCAGR) ${sg(d.dCAGR.med, 2)} %/an`);
}

// DK sensibilité
P("\n## Sensibilité — panel + Danemark (Max, 25 bps)");
P(`- 21 pays : ΔSharpe ${sg(delta(panel21, null, 25).dSharpe.med)} · 21+DK : ${sg(delta(all, null, 25).dSharpe.med)}`);

// ── Verdict Binaire ─────────────────────────────────────────────────────────
const dMax = delta(panel21, null, 25);
const robustBin = dMax.dSharpe.med > 0.02 && dMax.dSharpe.worst >= 0 && dMax.dSharpe.pImp >= 0.9 && ex21.dSharpe.med >= 0;
P("\n## Verdict Binaire");
P(`| critère | valeur | seuil | ok |`);
P(`|---|---|---|---|`);
P(`| ΔSharpe Max | ${sg(dMax.dSharpe.med)} | > +0,02 | ${dMax.dSharpe.med > 0.02 ? "✅" : "❌"} |`);
P(`| % pays améliorés | ${(dMax.dSharpe.pImp * 100).toFixed(0)}% | ≥ 90 % | ${dMax.dSharpe.pImp >= 0.9 ? "✅" : "❌"} |`);
P(`| pire-décile | ${sg(dMax.dSharpe.worst)} | ≥ 0 | ${dMax.dSharpe.worst >= 0 ? "✅" : "❌"} |`);
P(`| hors 2021-2022 | ${sg(ex21.dSharpe.med)} | ≥ 0 | ${ex21.dSharpe.med >= 0 ? "✅" : "❌"} |`);
P(`\n**${robustBin ? "✅ L'Énergie améliore ROBUSTEMENT la Binaire" : "🟡 Amélioration Binaire NON robuste"}** → ${robustBin ? "la surcouche peut devenir une composante COMMUNE (Dynamique + Binaire)." : "candidate pour la Dynamique SEULE ; la Binaire reste inchangée."}`);
P("\n⚠️ Rappel : un résultat Binaire faible n'invalide PAS le résultat Dynamique (bases d'allocation différentes). rc1 FIGÉ (L6/w10/prorata). Aucune réoptimisation. `4q-standard-v2` reste la version publique et le rollback. Aucune modif moteur/interface.");

writeFileSync(path.join(HERE, "binary-validation-report.md"), OUT.join("\n"));
await db.coredataPool?.end?.();
console.error("\n✅ Validation Binaire terminée — binary-validation-report.md");
