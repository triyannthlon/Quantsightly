// ─────────────────────────────────────────────────────────────────────────────
// SOUS-PÉRIODES DU LABORATOIRE ÉNERGIE — vérifie le paramètre optionnel `windowYears`
// de `computeEnergyLabComparison(country, strategy, version, windowYears?)`.
//
//   • Rétro-compat : l'appel 2 args ≡ windowYears=null (signature bit à bit identique)
//     → concordance/fixtures inchangées.
//   • Fenêtre STRICTEMENT commune : une sous-période aligne les DEUX variantes sur les
//     mêmes dates (socle.start == énergie.start), contrairement au full (socle plus long).
//   • La sous-période change réellement les métriques (perf/maxDD) sans toucher le signal
//     courant (état détenu/cible = position actuelle, calculée sur tout l'historique).
//   pnpm exec tsx experiments/4q-energy-lab/lab-subperiod.mts
// LECTURE DB seule ; n'écrit rien.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env
  .split(/\r?\n/)
  .find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length)
  .trim()
  .replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const lab: any = await imp("src/lib/coredata/four-quadrants/energy-trend-v1/lab.ts");

const J = (x: unknown) => JSON.stringify(x);
const mk = (d: string) => d.slice(0, 7);
let pass = 0,
  fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

// `undefined` pour `version` ⇒ défaut du service (comme l'action passe ACTIVE_MODEL_VERSION).
const DEFAULT_VERSION = undefined;

const CODES = ["US", "JP", "FR", "BR"];
const STRATS: Array<"dynamic" | "binary"> = ["dynamic", "binary"];

for (const code of CODES) {
  for (const strat of STRATS) {
    const full = await svc.computeEnergyLabComparison(code, strat); // 2 args = null
    const fullExplicitNull = await svc.computeEnergyLabComparison(
      code,
      strat,
      DEFAULT_VERSION,
      null,
    );
    if (!full || !fullExplicitNull) {
      check(`${code}:${strat} full non nul`, false);
      continue;
    }

    // 1) Rétro-compat : 2 args ≡ windowYears=null (signature identique).
    check(
      `${code}:${strat} rétro-compat (2 args ≡ windowYears null)`,
      J(lab.energyLabSignature(full)) === J(lab.energyLabSignature(fullExplicitNull)),
    );

    // 2) Sous-période 10 ans : les deux variantes partagent la MÊME fenêtre.
    const w10 = await svc.computeEnergyLabComparison(code, strat, DEFAULT_VERSION, 10);
    if (!w10) {
      check(`${code}:${strat} sous-période 10a non nul`, false);
      continue;
    }
    const sStd = mk(w10.standard.backtest.start);
    const sEn = mk(w10.energy.backtest.start);
    const eStd = mk(w10.standard.backtest.end);
    const eEn = mk(w10.energy.backtest.end);
    check(
      `${code}:${strat} 10a — socle & énergie MÊME fenêtre`,
      sStd === sEn && eStd === eEn,
      `${sStd}→${eStd} vs ${sEn}→${eEn}`,
    );

    // 3) La sous-période démarre APRÈS le full énergie (sauf si historique trop court → clampé).
    const fullEnStart = mk(full.energy.backtest.start);
    check(
      `${code}:${strat} 10a — fenêtre incluse dans le full commun`,
      sEn >= fullEnStart,
      `10a start ${sEn} ≥ full énergie start ${fullEnStart}`,
    );

    // 4) La sous-période change réellement les métriques (perf annualisée du socle).
    const aFull = full.standard.backtest.metrics.nominal.annualized;
    const a10 = w10.standard.backtest.metrics.nominal.annualized;
    const differs = aFull === null || a10 === null ? false : Math.abs(aFull - a10) > 1e-9;
    // (Pour US/JP l'historique diffère nettement ; pour FR/BR la fenêtre 10a est incluse ⇒ diffère aussi.)
    check(
      `${code}:${strat} 10a — métriques socle recalculées`,
      differs,
      `full ${aFull?.toFixed(2)} vs 10a ${a10?.toFixed(2)}`,
    );

    // 5) Le SIGNAL courant (état, détenu, cible) NE dépend PAS de la sous-période
    //    (position actuelle, calculée sur tout l'historique).
    check(
      `${code}:${strat} 10a — signal courant inchangé (calculé sur tout l'historique)`,
      w10.signal.status === full.signal.status &&
        Math.abs(w10.signal.heldWeight - full.signal.heldWeight) < 1e-12 &&
        Math.abs(w10.signal.targetWeight - full.signal.targetWeight) < 1e-12,
    );

    // 6) Cohérence 5 ans : fenêtre ⊆ fenêtre 10 ans.
    const w5 = await svc.computeEnergyLabComparison(code, strat, DEFAULT_VERSION, 5);
    if (w5) {
      check(
        `${code}:${strat} 5a ⊆ 10a`,
        mk(w5.energy.backtest.start) >= sEn &&
          mk(w5.standard.backtest.start) === mk(w5.energy.backtest.start),
        `5a ${mk(w5.energy.backtest.start)} ≥ 10a ${sEn}`,
      );
    }
  }
}

console.log(`\n${fail === 0 ? "✅ SOUS-PÉRIODES OK" : "❌ ÉCHEC"} — ${pass} ok / ${fail} ko`);
process.exit(fail === 0 ? 0 : 1);
