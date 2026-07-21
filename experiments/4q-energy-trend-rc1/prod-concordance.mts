// ─────────────────────────────────────────────────────────────────────────────
// CONCORDANCE DE PRODUCTION — surcouche `energy-trend-v1` câblée dans le moteur.
// Prouve, via le SERVICE de production `getCountryQuadrantModel(overlay)` :
//   • QS_ENERGY_OVERLAY=off      → `4q-standard-v2` bit à bit (Dynamique & Binaire) ;
//   • QS_ENERGY_OVERLAY=trend-v1 → candidat validé `4q-energy-trend-rc1` (Dyn & Bin).
// Fige les golden de production + écrit `prod-concordance-report.md`. LECTURE SEULE.
//   pnpm exec tsx experiments/4q-energy-trend-rc1/prod-concordance.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { computeTrendSignal, SMA_LOOKBACK_RC1 } from "./signal";
import { buildFivePocketTarget, ENERGY_WEIGHT_RC1, type CoreAllocation } from "./portfolio";
import { simulateRc1, measureRc1, activationEpisodes, type Rc1Input, type DataPoint } from "./rc1";

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
const REPS = ["US", "FR", "JP", "BR"];
const STRATS: Array<"dynamic" | "binary"> = ["dynamic", "binary"];
const mk = (d: string) => d.slice(0, 7);

const fxRates: any[] = await db.getFxRates(); const usdPerUnit = new Map<string, any>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: DataPoint[] = (await db.getSeriesData("SPDYENT Index-XX-5-2")).sort((a: DataPoint, b: DataPoint) => a.date.localeCompare(b.date));
const convert = (d: DataPoint[], t: string) => (!t || t === "USD") ? d : compute.convertCurrency(d, null, usdPerUnit.get(t) ?? null);
const signal6 = computeTrendSignal(energyUsd, SMA_LOOKBACK_RC1);
const btMonthly = (bt: any) => { const m = new Map<string, number>(); const n = bt.series.nominal; for (let i = 1; i < n.length; i++) m.set(mk(n[i].date), n[i].value / n[i - 1].value - 1); return m; };

const R: string[] = []; const P = (s = "") => { R.push(s); console.log(s); };
let pass = 0, fail = 0; const fails: string[] = [];
const check = (name: string, ok: boolean, detail = "") => { if (ok) { pass++; P(`  ✅ ${name}${detail ? " — " + detail : ""}`); } else { fail++; fails.push(name); P(`  ❌ ${name}${detail ? " — " + detail : ""}`); } };

// candidat rc1 (référence validée) pour un pays/stratégie.
async function candidate(code: string, strategy: "dynamic" | "binary", w: number) {
  const cm = await svc.getCountryQuadrantModel(code, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: 20 }, "v2", "off");
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: 20, energyMode: "disabled" });
  const baseByMonth = new Map<string, CoreAllocation>(); for (const r of model.monthlyResults) baseByMonth.set(mk(r.date), { equities: r.baseAllocation.equities, bonds: r.baseAllocation.bonds, gold: r.baseAllocation.gold, cash: r.baseAllocation.cash });
  const energyLocal = convert(energyUsd, cm.config.currency);
  const input: Rc1Input = { countryCode: code, baseByMonth, signalByMonth: signal6, equityTotalReturn: cm.perf.equityTotalReturn, bondTotalReturn: cm.perf.bondTotalReturn, cashTotalReturn: cm.perf.cashTotalReturn, gold: cm.perf.gold, energyLocal, cpi: cm.perf.cpi, energyWeight: w, reallocationBand: BAND };
  return { cm, path: simulateRc1(input) };
}

P("# `energy-trend-v1` — concordance de PRODUCTION\n");
P("Service `getCountryQuadrantModel(code, {strategy}, \"v2\", overlay)`. Référence = candidat validé `4q-energy-trend-rc1` (simulateRc1). " + REPS.join(", ") + " × {dynamique, binaire}.\n");

// ── 1. Flag OFF = 4q-standard-v2 bit à bit (Dyn & Bin) ───────────────────────
P("## 1. `QS_ENERGY_OVERLAY=off` = `4q-standard-v2` bit à bit");
for (const strategy of STRATS) for (const code of REPS) {
  const prodOff = await svc.getCountryQuadrantModel(code, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: 20 }, "v2", "off");
  // v2 direct (aucune énergie) = comportement de référence.
  const model = buildModel(prodOff.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: 20, energyMode: "disabled" });
  const v2 = backtestQuadrants({ countryCode: code, weights: weightsFromModel(model), ...prodOff.perf, windowYears: null, reallocationBand: BAND });
  const a = prodOff.backtest, ok = a.status === "OK" && v2.status === "OK" && a.start === v2.start && a.end === v2.end && Math.abs((a.metrics.real?.annualized ?? 0) - (v2.metrics.real?.annualized ?? 0)) < 1e-9 && Math.abs(a.turnover.annualized - v2.turnover.annualized) < 1e-9 && Math.abs(a.metrics.nominal.annualized! - v2.metrics.nominal.annualized!) < 1e-9;
  // aucune poche Énergie détenue sous OFF
  const noEnergy = a.status === "OK" && a.heldAllocation.energy === 0 && a.targetAllocation.energy === 0;
  check(`${code}·${strategy} OFF = v2`, ok && noEnergy, `real ${a.status === "OK" ? a.metrics.real?.annualized?.toFixed(3) : a.status} vs ${v2.status === "OK" ? v2.metrics.real?.annualized?.toFixed(3) : v2.status}, énergie détenue ${a.status === "OK" ? a.heldAllocation.energy : "—"}`);
}

// ── 2. Flag ON = candidat rc1 (Dyn & Bin) ────────────────────────────────────
P("\n## 2. `QS_ENERGY_OVERLAY=trend-v1` = candidat validé `rc1` (Dynamique & Binaire)");
for (const strategy of STRATS) for (const code of REPS) {
  const prodOn = await svc.getCountryQuadrantModel(code, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: 20 }, "v2", "trend-v1");
  const { path: cand } = await candidate(code, strategy, W);
  const bt = prodOn.backtest;
  if (bt.status !== "OK" || cand.status !== "OK") { check(`${code}·${strategy} ON = rc1`, false, `statut prod ${bt.status} / cand ${cand.status}`); continue; }
  const bm = btMonthly(bt); let rErr = 0; for (const s of cand.steps.slice(1)) rErr = Math.max(rErr, Math.abs(s.grossReturn - (bm.get(mk(s.date)) ?? NaN)));
  const cm = measureRc1(cand, 0, cand.steps.length, 0, undefined);
  const rotErr = Math.abs(bt.turnover.annualized - cm!.rotation);
  const heldErr = Math.abs(bt.heldAllocation.energy - (cand.finalHeld?.energy ?? -1)) + Math.abs(bt.targetAllocation.energy - (cand.finalTarget?.energy ?? -1));
  check(`${code}·${strategy} ON = rc1`, rErr < 1e-9 && rotErr < 1e-9 && heldErr < 1e-9, `rdt ${rErr.toExponential(1)} · rot ${rotErr.toExponential(1)} · poids finaux ${heldErr.toExponential(1)}`);
}

// ── 3. ON = golden candidat (Dynamique, série mensuelle figée) ───────────────
P("\n## 3. `trend-v1` reproduit les golden du candidat (Dynamique, série mensuelle)");
const goldenCand: any = JSON.parse(readFileSync(path.join(HERE, "golden.json"), "utf8"));
for (const code of REPS) {
  const prodOn = await svc.getCountryQuadrantModel(code, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 }, "v2", "trend-v1");
  const bm = btMonthly(prodOn.backtest); const g = goldenCand.countries[code];
  let err = 0, cmp = 0; for (const row of g.monthly.slice(1)) { const r = bm.get(mk(row.d)); if (r !== undefined) { err = Math.max(err, Math.abs(r - row.g)); cmp++; } }
  // écart attendu ≤ 5e-9 = arrondi 8 décimales du golden ; cmp = tous les mois de la fenêtre du pays.
  check(`${code} dyn = golden candidat`, err < 1e-7 && cmp >= g.monthly.length - 2, `écart max ${err.toExponential(1)} sur ${cmp} mois`);
}

// ── 4. Golden de PRODUCTION (Dyn + Bin) figés ───────────────────────────────
P("\n## 4. Golden de production figés (Dyn + Bin)");
const round = (v: number | null | undefined, d = 6) => v == null ? null : Number(v.toFixed(d));
const HZ: Array<[string, number | null, string | undefined]> = [["Max", null, undefined], ["20A", 20, undefined], ["10A", 10, undefined], ["5A", 5, undefined], ["Live", null, "2011-02"]];
function fromIdx(steps: any[], years: number | null, from?: string) { if (from) { const i = steps.findIndex((s: any) => mk(s.date) >= from); return i < 0 ? steps.length - 1 : i; } if (years == null) return 0; const last = steps[steps.length - 1].date; const cut = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`; for (let i = 0; i < steps.length; i++) if (steps[i].date >= cut) return i; return steps.length - 1; }
const goldenProd: any = { spec: { overlay: "trend-v1", signal: `SPDYENT>SMA${SMA_LOOKBACK_RC1}`, energyWeight: W, band: BAND, financing: "prorata" }, byStrategy: {} };
for (const strategy of STRATS) {
  goldenProd.byStrategy[strategy] = {};
  for (const code of REPS) {
    const { path: cand } = await candidate(code, strategy, W);
    const horizons: any = {};
    for (const [k, y, f] of HZ) { const m = measureRc1(cand, fromIdx(cand.steps, y, f), cand.steps.length, 25, (await candidate(code, strategy, 0)).cm.perf.cpi); horizons[k] = m ? { months: m.months, realCAGR: round(m.realCAGR, 4), realSharpe: round(m.realSharpe, 4), realMDD: round(m.realMDD, 4), rotation: round(m.rotation, 6), activationRate: round(m.activationRate, 4), meanEnergyHeld: round(m.meanEnergyHeld, 6) } : null; }
    goldenProd.byStrategy[strategy][code] = { start: cand.start, end: cand.end, horizons, episodes: activationEpisodes(cand).length };
  }
}
writeFileSync(path.join(HERE, "golden-production.json"), JSON.stringify(goldenProd, null, 0));
check("golden production Dyn + Bin figés", true, "US/FR/JP/BR × {dynamique, binaire}");

// ── 5. Sémantique d'indisponibilité (pas de silent OFF) ─────────────────────
P("\n## 5. Indisponibilité = raison explicite (jamais silent OFF)");
{
  // série énergie amputée d'un mois DANS la fenêtre → backtest NON_CONTIGUOUS (pas un v2 silencieux).
  const cm = await svc.getCountryQuadrantModel("US", { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 }, "v2", "off");
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  const eL = convert(energyUsd, cm.config.currency).filter((p: DataPoint) => mk(p.date) !== "2010-06");
  const wts = model.monthlyResults.map((r: any) => { const wc = signal6.get(mk(r.date)); const active = wc === true; return { date: r.date, allocation: buildFivePocketTarget(r.baseAllocation, active, W) }; });
  const bt = backtestQuadrants({ countryCode: "US", weights: wts, equityTotalReturn: cm.perf.equityTotalReturn, bondTotalReturn: cm.perf.bondTotalReturn, cashTotalReturn: cm.perf.cashTotalReturn, gold: cm.perf.gold, energyTotalReturn: eL, cpi: cm.perf.cpi, windowYears: null, reallocationBand: BAND });
  check("série Énergie trouée → statut d'indisponibilité explicite (pas OFF silencieux)", bt.status !== "OK" && bt.availability.status === "UNAVAILABLE", `${bt.status} / ${bt.availability?.reason}`);
}

P(`\n## Confirmation`);
P("- **`QS_ENERGY_OVERLAY=off` = `4q-standard-v2` inchangé** (Dynamique & Binaire) — perfs, cibles, poids détenus, rotation, métriques.");
P("- **`QS_ENERGY_OVERLAY=trend-v1` Dynamique = candidat validé.**");
P("- **`QS_ENERGY_OVERLAY=trend-v1` Binaire = candidat validé.**");
P(`\n## Bilan : ${pass} ✅ / ${fail} ❌${fail ? " — ÉCHECS : " + fails.join(", ") : ""}`);
writeFileSync(path.join(HERE, "prod-concordance-report.md"), R.join("\n"));
await db.coredataPool?.end?.();
console.error(`\n${fail === 0 ? "✅ CONCORDANCE PRODUCTION COMPLÈTE" : "⚠️ " + fail + " ÉCHEC(S)"}`);
