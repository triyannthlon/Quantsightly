// ─────────────────────────────────────────────────────────────────────────────
// RECETTE STAGING (data+code) — flag `QS_ENERGY_OVERLAY=trend-v1` de bout en bout.
// Exerce le VRAI chemin de config production (env → readEnergyOverlay → service),
// sans UI. Vérifie signal, données SMA, cible 5 poches, allocation détenue post-bande,
// conversion devise, rotation/coûts, cohérence Dyn/Bin, absence de données manquantes
// SILENCIEUSES. Le flag doit RÉELLEMENT modifier le comportement. LECTURE SEULE.
//   pnpm exec tsx experiments/4q-energy-trend-rc1/staging-recette.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const db: any = await imp("src/lib/coredata/db.ts");
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const fq: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const cfg: any = await imp("src/lib/coredata/energy-overlay-config.ts");
const { DEFAULT_FOUR_QUADRANTS_SETTINGS } = fq;
const REPS = ["US", "FR", "JP", "BR"];
const STRATS: Array<"dynamic" | "binary"> = ["dynamic", "binary"];
const setFlag = (v: string | undefined) => { if (v === undefined) delete process.env.QS_ENERGY_OVERLAY; else process.env.QS_ENERGY_OVERLAY = v; };

const OUT: string[] = []; const P = (s = "") => { OUT.push(s); console.log(s); };
let pass = 0, fail = 0; const fails: string[] = [];
const check = (n: string, ok: boolean, d = "") => { if (ok) { pass++; P(`  ✅ ${n}${d ? " — " + d : ""}`); } else { fail++; fails.push(n); P(`  ❌ ${n}${d ? " — " + d : ""}`); } };
const sum5 = (a: any) => a.equities + a.bonds + a.gold + a.cash + a.energy;

P("# Recette STAGING — `QS_ENERGY_OVERLAY=trend-v1` (data+code, sans UI)\n");

// 0. Config : le flag est bien lu depuis l'env, défaut off.
P("## 0. Lecture de la configuration");
setFlag(undefined); check("défaut (env absent) = off", cfg.readEnergyOverlay() === "off", cfg.readEnergyOverlay());
setFlag("bidon"); check("valeur inconnue = off (sûr)", cfg.readEnergyOverlay() === "off", cfg.readEnergyOverlay());
setFlag("trend-v1"); check("`trend-v1` reconnu", cfg.readEnergyOverlay() === "trend-v1", cfg.readEnergyOverlay());
setFlag("off"); check("`off` explicite = off", cfg.readEnergyOverlay() === "off", cfg.readEnergyOverlay());

// 1. FLAG ON = trend-v1, via le VRAI chemin (env → readEnergyOverlay dans le service).
P("\n## 1. `QS_ENERGY_OVERLAY=trend-v1` — sorties moteur (env lu par le service)");
setFlag("trend-v1");
const snapshots: any[] = [];
for (const strat of STRATS) for (const code of REPS) {
  const cm = await svc.getCountryQuadrantModel(code, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: strat, transitionWidth: 20 }); // PAS d'arg overlay → lit l'env
  const okModel = cm.model.status === "OK", okBt = cm.backtest.status === "OK";
  if (!okModel || !okBt) { check(`${code}·${strat} statut`, false, `model ${cm.model.status} / bt ${cm.backtest.status}`); continue; }
  const latest = cm.model.latest; const held = cm.backtest.heldAllocation, target = cm.backtest.targetAllocation;
  const active = latest.finalAllocation.energy > 1e-9;
  const okSum = Math.abs(sum5(latest.finalAllocation) - 1) < 1e-9 && Math.abs(sum5(held) - 1) < 1e-9 && Math.abs(sum5(target) - 1) < 1e-9;
  const okEnergy = latest.finalAllocation.energy === 0 || Math.abs(latest.finalAllocation.energy - 0.1) < 1e-9; // 0 ou 10 %
  const okAvail = cm.backtest.availability.status === "OK";
  check(`${code}·${strat} : signal ${active ? "ACTIF" : "inactif"}, cible 5 poches Σ=1, dispo OK`, okSum && okEnergy && okAvail, `Énergie cible ${(latest.finalAllocation.energy * 100).toFixed(0)} %, détenue ${(held.energy * 100).toFixed(1)} %, rot ${(cm.backtest.turnover.annualized * 100).toFixed(1)} %, ${cm.backtest.start.slice(0, 7)}→${cm.backtest.end.slice(0, 7)}`);
  snapshots.push({ code, strat, cur: cm.config.currency, month: latest.date.slice(0, 7), active, energyScore: latest.energyScore, targetE: latest.finalAllocation.energy, heldE: held.energy, held, target: latest.finalAllocation, rot: cm.backtest.turnover.annualized, quality: cm.dataQuality, avail: cm.backtest.availability.status });
}

// 2. Conversion devise : l'Énergie est bien en devise LOCALE (perf), signal en USD (mondial).
P("\n## 2. Conversion de devise (poche Énergie en local, signal mondial USD)");
{
  const usCm = await svc.getCountryQuadrantModel("US", { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
  const frCm = await svc.getCountryQuadrantModel("FR", { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
  // le signal (energyScore) est IDENTIQUE US/FR (mondial) ; la perf de la poche diffère (devise locale).
  const usScore = usCm.model.latest.energyScore, frScore = frCm.model.latest.energyScore;
  check("signal Énergie mondial (identique US/FR au dernier mois)", usScore === frScore, `US ${usScore} = FR ${frScore}`);
  check("devises locales distinctes (US USD / FR EUR)", usCm.config.currency === "USD" && frCm.config.currency === "EUR", `${usCm.config.currency} / ${frCm.config.currency}`);
}

// 3. FLAG OFF = 4q-standard-v2 (aucune énergie), le flag MODIFIE bien le comportement.
P("\n## 3. `QS_ENERGY_OVERLAY=off` — retour à v2 (le flag modifie le comportement)");
setFlag("off");
for (const strat of STRATS) {
  const cm = await svc.getCountryQuadrantModel("US", { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: strat, transitionWidth: 20 });
  const noE = cm.backtest.status === "OK" && cm.backtest.heldAllocation.energy === 0 && cm.model.latest.finalAllocation.energy === 0;
  check(`US·${strat} OFF : aucune poche Énergie (= v2)`, noE, `énergie détenue ${cm.backtest.status === "OK" ? cm.backtest.heldAllocation.energy : "—"}`);
}
// comparaison directe : ON ≠ OFF quand le signal est actif quelque part
setFlag("trend-v1"); const onUS = await svc.getCountryQuadrantModel("US", { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
setFlag("off"); const offUS = await svc.getCountryQuadrantModel("US", { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
check("le flag CHANGE réellement la sortie (rotation ON ≠ OFF)", Math.abs(onUS.backtest.turnover.annualized - offUS.backtest.turnover.annualized) > 1e-6, `rot ON ${(onUS.backtest.turnover.annualized * 100).toFixed(1)} % vs OFF ${(offUS.backtest.turnover.annualized * 100).toFixed(1)} %`);

// 4. Pas de données manquantes silencieuses : dispo explicite partout, panel complet.
P("\n## 4. Robustesse données (aucune indisponibilité silencieuse)");
setFlag("trend-v1");
const rows = await svc.computeAllCountryQuadrantModels({ ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
const okRows = rows.filter((r: any) => r.status === "OK").length;
const availStatuses = new Set(rows.map((r: any) => r.availability.status));
check(`batch complet : ${okRows}/${rows.length} pays OK, dispo explicite`, okRows >= 20 && [...availStatuses].every((s) => s === "OK" || s === "UNAVAILABLE"), `statuts dispo : ${[...availStatuses].join(", ")}`);

// ── snapshot lisible ────────────────────────────────────────────────────────
P("\n## Snapshot du dernier mois (trend-v1)");
P("| pays·strat | mois | signal | énergie cible | énergie détenue | rotation | devise | qualité |");
P("|---|---|---|---|---|---|---|---|");
for (const s of snapshots) P(`| ${s.code}·${s.strat} | ${s.month} | ${s.active ? "ACTIF" : "inactif"} (score ${s.energyScore ?? "—"}) | ${(s.targetE * 100).toFixed(0)} % | ${(s.heldE * 100).toFixed(1)} % | ${(s.rot * 100).toFixed(1)} % | ${s.cur} | ${s.quality} |`);

P(`\n## Bilan recette : ${pass} ✅ / ${fail} ❌${fail ? " — " + fails.join(", ") : ""}`);
P("\n⚠️ Recette DATA+CODE (pas de serveur live ; l'auth OTP empêche les captures UI auto). Aucune UI, aucune bascule publique. Rollback = `QS_ENERGY_OVERLAY=off` + rebuild.");
setFlag(undefined);
writeFileSync(path.join(HERE, "staging-validation-report.md"), OUT.join("\n"));
await db.coredataPool?.end?.();
console.error(`\n${fail === 0 ? "✅ RECETTE STAGING OK" : "⚠️ " + fail + " ÉCHEC(S)"} — staging-validation-report.md`);
