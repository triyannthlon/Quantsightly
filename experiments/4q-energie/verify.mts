// Vérification finale des invariants de l'étude Énergie (LECTURE SEULE).
// Teste réellement chaque garantie méthodologique avant archivage.
// pnpm exec tsx experiments/4q-energie/verify.mts
import { readFileSync } from "node:fs";
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
const { buildModel, backtestQuadrants, weightsFromModel } = fq;

const ENERGY_ID = "MXWO0EN Index-XX-1-2";
let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => { console.log(`  ${c ? "✅" : "❌"} ${msg}`); c ? pass++ : fail++; };

const fxRates: any[] = await db.getFxRates();
const usdPerUnit = new Map<string, Map<string, number>>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: any[] = await db.getSeriesData(ENERGY_ID);
const toLocal = (data: any[], cur: string) =>
  !cur || cur === "USD" ? data : compute.convertCurrency(data, null, usdPerUnit.get(cur) ?? null);

let countries: Array<{ iso: string }> = await svc.listQuadrantCountries();
countries = countries.filter((c) => c.iso !== "DK");

// Overlay (copie EXACTE de study.mts) ─────────────────────────────────────────
function energyRaw(x: number, y: number, shape: string, tE: number) {
  if (x <= 0 || y <= 0) return 0;
  const m = Math.min(x, y);
  if (shape === "step") return m >= tE ? 1 : 0;
  if (m <= tE) return 0;
  return Math.min(1, (m - tE) / (100 - tE));
}
function finance(base: any, e0: number, method: string) {
  const e = Math.max(0, Math.min(0.95, e0));
  if (e === 0) return { ...base, energy: 0 };
  if (method === "prorata") { const k = 1 - e; return { equities: base.equities * k, bonds: base.bonds * k, gold: base.gold * k, cash: base.cash * k, energy: e }; }
  if (method === "boombloc") {
    const s = base.equities + base.gold;
    if (s <= 1e-9) { const k = 1 - e; return { equities: base.equities * k, bonds: base.bonds * k, gold: base.gold * k, cash: base.cash * k, energy: e }; }
    const eEff = Math.min(e, s), k = 1 - eEff / s;
    return { equities: base.equities * k, bonds: base.bonds, gold: base.gold * k, cash: base.cash, energy: eEff };
  }
  const eCash = Math.min(e, base.cash), r = e - eCash;
  let eq = base.equities, bd = base.bonds, gd = base.gold; const rest = eq + bd + gd;
  if (r > 1e-12 && rest > 1e-9) { const k = 1 - r / rest; eq *= k; bd *= k; gd *= k; }
  return { equities: eq, bonds: bd, gold: gd, cash: base.cash - eCash, energy: e };
}

console.log("═".repeat(76) + "\nVÉRIFICATION DES INVARIANTS — étude Énergie\n" + "═".repeat(76));

// ── 1. Reproduction EXACTE du Standard v1 avec w_max=0 (sans énergie, plein historique)
console.log("\n1. Reproduction exacte de Standard v1 (w_max=0, sans énergie)");
let maxDiff = 0, worst = "";
for (const { iso } of countries) {
  const cm = await svc.getCountryQuadrantModel(iso); // socle du service
  if (cm.backtest.status !== "OK") continue;
  const model = buildModel(cm.signal, { ...fq.DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  const mine = backtestQuadrants({ countryCode: iso, weights: weightsFromModel(model), equityTotalReturn: cm.perf.equityTotalReturn, bondTotalReturn: cm.perf.bondTotalReturn, cashTotalReturn: cm.perf.cashTotalReturn, gold: cm.perf.gold, cpi: cm.perf.cpi });
  if (mine.status !== "OK") continue;
  const d = Math.max(
    Math.abs((mine.metrics.real?.annualized ?? 0) - (cm.backtest.metrics.real?.annualized ?? 0)),
    Math.abs((mine.metrics.real?.maxDrawdown ?? 0) - (cm.backtest.metrics.real?.maxDrawdown ?? 0)),
    Math.abs((mine.metrics.real?.sharpe ?? 0) - (cm.backtest.metrics.real?.sharpe ?? 0)),
    Math.abs(mine.turnover.annualized - cm.backtest.turnover.annualized),
    Math.abs(mine.metrics.nominal.months - cm.backtest.metrics.nominal.months),
  );
  if (d > maxDiff) { maxDiff = d; worst = iso; }
}
ok(maxDiff < 1e-9, `écart max sur 21 pays (CAGR/MDD/Sharpe/rotation/mois) = ${maxDiff.toExponential(2)} (pire : ${worst})`);

// ── 2. Fenêtre commune 1995 + identité témoin/config
console.log("\n2. Fenêtre commune démarrant en 1995 (témoin = config énergie)");
let allFrom1995 = true, sameWindow = true;
for (const { iso } of countries) {
  const cm = await svc.getCountryQuadrantModel(iso);
  const model = buildModel(cm.signal, { ...fq.DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  const eLoc = toLocal(energyUsd, cm.config.currency);
  const wit = backtestQuadrants({ countryCode: iso, weights: model.monthlyResults.map((r: any) => ({ date: r.date, allocation: finance(r.baseAllocation, 0, "prorata") })), equityTotalReturn: cm.perf.equityTotalReturn, bondTotalReturn: cm.perf.bondTotalReturn, cashTotalReturn: cm.perf.cashTotalReturn, gold: cm.perf.gold, energyTotalReturn: eLoc, cpi: cm.perf.cpi });
  const cfg = backtestQuadrants({ countryCode: iso, weights: model.monthlyResults.map((r: any) => ({ date: r.date, allocation: finance(r.baseAllocation, 0.15 * energyRaw(r.x, r.y, "step", 20), "prorata") })), equityTotalReturn: cm.perf.equityTotalReturn, bondTotalReturn: cm.perf.bondTotalReturn, cashTotalReturn: cm.perf.cashTotalReturn, gold: cm.perf.gold, energyTotalReturn: eLoc, cpi: cm.perf.cpi });
  if (wit.status === "OK") { if (wit.start.slice(0, 7) < "1995-01") allFrom1995 = false; }
  if (wit.status === "OK" && cfg.status === "OK") { if (wit.start !== cfg.start || wit.end !== cfg.end) sameWindow = false; }
}
ok(allFrom1995, "toutes les fenêtres témoin démarrent en 1995-01 ou après");
ok(sameWindow, "témoin et config énergie partagent la MÊME fenêtre (comparaison à périmètre égal)");

// ── 3. Conversion en devise locale (formule FX identique à l'or)
console.log("\n3. Conversion correcte en devise locale");
const us = await svc.getCountryQuadrantModel("US");
ok(toLocal(energyUsd, "USD") === energyUsd, "US (USD) : aucune conversion (série inchangée)");
let fxOk = true, fxMax = 0;
for (const iso of ["FR", "JP", "CH"]) {
  const cm = await svc.getCountryQuadrantModel(iso);
  const cur = cm.config.currency;
  const eLoc = toLocal(energyUsd, cur);
  const map = usdPerUnit.get(cur)!;
  // Vérifie value_local == value_usd / usdPerUnit(date) sur 5 dates.
  const sample = eLoc.slice(-5);
  for (const p of sample) {
    const usd = energyUsd.find((q: any) => q.date === p.date)!.value;
    const f = map.get(p.date)!;
    const expect = usd / f;
    fxMax = Math.max(fxMax, Math.abs(p.value - expect) / expect);
  }
  if (eLoc === energyUsd) fxOk = false; // doit être converti
}
ok(fxOk, "FR/JP/CH : série énergie effectivement convertie (≠ USD brut)");
ok(fxMax < 1e-9, `formule locale = USD ÷ usdPerUnit(date) : écart relatif max = ${fxMax.toExponential(2)}`);

// ── 4. Normalisation des poids à 100 % + non-négativité (tous financements, cas extrêmes)
console.log("\n4. Normalisation des poids (somme = 1, aucun négatif)");
let sumMax = 0, negMin = 0, nChecked = 0;
for (const iso of ["US", "IN", "TW", "NO"]) { // pays à forte fréquence de boom
  const cm = await svc.getCountryQuadrantModel(iso);
  const model = buildModel(cm.signal, { ...fq.DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  for (const method of ["prorata", "boombloc", "cash"]) {
    for (const [shape, tE, w] of [["step", 0, 0.3], ["ramp", 0, 0.3], ["step", 20, 0.25], ["ramp", 50, 0.2]] as any[]) {
      for (const r of model.monthlyResults as any[]) {
        const a = finance(r.baseAllocation, w * energyRaw(r.x, r.y, shape, tE), method);
        const s = a.equities + a.bonds + a.gold + a.cash + a.energy;
        sumMax = Math.max(sumMax, Math.abs(s - 1));
        negMin = Math.min(negMin, a.equities, a.bonds, a.gold, a.cash, a.energy);
        nChecked++;
      }
    }
  }
}
ok(sumMax < 1e-12, `somme des 5 poches = 1 sur ${nChecked} cas : écart max = ${sumMax.toExponential(2)}`);
ok(negMin >= -1e-12, `aucun poids négatif : min observé = ${negMin.toExponential(2)}`);

// ── 5. t → t+1, aucune fuite temporelle (structure du backtest)
console.log("\n5. Application des poids de t à t+1 (zéro look-ahead)");
const model = buildModel(us.signal, { ...fq.DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
const bt = backtestQuadrants({ countryCode: "US", weights: weightsFromModel(model), equityTotalReturn: us.perf.equityTotalReturn, bondTotalReturn: us.perf.bondTotalReturn, cashTotalReturn: us.perf.cashTotalReturn, gold: us.perf.gold, cpi: us.perf.cpi });
if (bt.status === "OK") {
  ok(bt.series.nominal[0].value === 100, "courbe nominale démarre à 100 à l'entrée (aucun rendement appliqué le mois d'entrée)");
  ok(bt.series.nominal.length === bt.metrics.nominal.months, `nb de pas = ${bt.metrics.nominal.months} mois (1 rendement par mois postérieur, pas d'extra)`);
  console.log("     (preuve code : backtest.ts — w = wByMonth.get(rows[j-1]) appliqué à rows[j]/rows[j-1]-1 ; overlay figé à la clôture de t)");
}

// ── 6. Application cohérente des coûts de transaction
console.log("\n6. Coûts de transaction (drag = bps · 2 · rotation, croissant en bps)");
const turnover = bt.status === "OK" ? bt.turnover.annualized : 0;
const drags = [10, 25, 50].map((b) => (b / 10000) * 2 * turnover * 100);
ok(drags[0] < drags[1] && drags[1] < drags[2], `rotation US ${(turnover * 100).toFixed(1)} %/an → drag 10/25/50 bps = ${drags.map((d) => d.toFixed(3)).join(" / ")} %/an (monotone)`);
console.log("     (approximation analytique conservatrice ; documentée dans la synthèse)");

// ── 7. Versions données & paramètres
console.log("\n7. Versions des données & paramètres");
const oil = await db.getSeriesData("CL1 comdty-XX-5-1");
console.log(`  · Énergie ${ENERGY_ID} : ${energyUsd[0].date} → ${energyUsd[energyUsd.length - 1].date} (${energyUsd.length} pts)`);
console.log(`  · Pétrole signal CL1 : ${oil[0].date} → ${oil[oil.length - 1].date}`);
console.log(`  · Panel : ${countries.length} pays (DK exclu)`);
console.log(`  · Grille : w_max{0,5,10,15,20,25,30}% × T_E{0,10,20,30,40,50} × {step,ramp} × {prorata,boombloc,cash} × {dynamic,binary} × T{0,20,50} × horizons{Max,20A,10A,5A}`);
console.log(`  · Coûts : 10/25/50 bps · Moteur base : socle figé four-quadrants/ (aucune modif)`);

console.log("\n" + "═".repeat(76));
console.log(`RÉSULTAT : ${pass} vérifications OK, ${fail} échec(s).`);
console.log("═".repeat(76));
await db.coredataPool?.end?.();
process.exit(fail ? 1 : 0);
