// ─────────────────────────────────────────────────────────────────────────────
// NON-FUITE — le flag `QS_ENERGY_OVERLAY` ne modifie PLUS les pages publiques.
// Depuis le refactoring de séparation (2026-07-24) : les services produit défaultent
// `overlay="off"` et NE lisent plus l'env ; les pages publiques passent "off" explicite.
// Ce script le PROUVE empiriquement (DB) : chaque sortie produit est IDENTIQUE que
// l'env soit `off` ou `trend-v1`. Vérifie aussi que la capacité reste intacte quand
// `overlay="trend-v1"` est demandé EXPLICITEMENT (chemin laboratoire).
//   pnpm exec tsx experiments/4q-energy-lab/non-leak.mts
// LECTURE SEULE (aucune écriture DB). Ce script IMPORTE le produit ; le produit
// n'importe JAMAIS `experiments/`.
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
const fq: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const { DEFAULT_FOUR_QUADRANTS_SETTINGS } = fq;

const STRATS: Array<"dynamic" | "binary"> = ["dynamic", "binary"];
const CODES = ["US", "FR", "JP", "BR"];
const VERSION = "v2";
const J = (x: unknown) => JSON.stringify(x);
let pass = 0,
  fail = 0;
const check = (name: string, ok: boolean) => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}`);
};

/** Exécute `fn` avec `QS_ENERGY_OVERLAY=v`, puis restaure. */
async function underEnv(v: string, fn: () => Promise<any>): Promise<any> {
  const saved = process.env.QS_ENERGY_OVERLAY;
  process.env.QS_ENERGY_OVERLAY = v;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.QS_ENERGY_OVERLAY;
    else process.env.QS_ENERGY_OVERLAY = saved;
  }
}

console.log("# Non-fuite — QS_ENERGY_OVERLAY n'affecte pas les pages publiques\n");

for (const strategy of STRATS) {
  const settings = { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: 20 };

  // 1. Comparaison pays (action publique = overlay "off" explicite) : identique off vs trend-v1.
  const cmpOff = await underEnv("off", () =>
    svc.computeAllCountryQuadrantModels(settings, null, VERSION, "off"),
  );
  const cmpOn = await underEnv("trend-v1", () =>
    svc.computeAllCountryQuadrantModels(settings, null, VERSION, "off"),
  );
  check(
    `Comparaison pays [${strategy}] : identique off vs trend-v1 (overlay "off" explicite)`,
    J(cmpOff) === J(cmpOn),
  );

  // 2. Même appel SANS l'argument overlay → le défaut vaut "off" (jamais l'env).
  const cmpDefaultUnderOn = await underEnv("trend-v1", () =>
    svc.computeAllCountryQuadrantModels(settings, null, VERSION),
  );
  check(
    `Comparaison pays [${strategy}] : défaut (sans arg) = "off" même sous env trend-v1`,
    J(cmpDefaultUnderOn) === J(cmpOff),
  );

  // 3. vs Actions (séries réelles) : identique off vs trend-v1.
  const raOff = await underEnv("off", () =>
    svc.computeQuadrantsRealSeries(CODES, settings, null, VERSION, "off"),
  );
  const raOn = await underEnv("trend-v1", () =>
    svc.computeQuadrantsRealSeries(CODES, settings, null, VERSION, "off"),
  );
  check(`vs Actions [${strategy}] : identique off vs trend-v1`, J(raOff) === J(raOn));

  // 4. Vue pays (modèle serveur) : identique off vs trend-v1, pour chaque pays.
  for (const code of CODES) {
    const cpOff = await underEnv("off", () =>
      svc.getCountryQuadrantModel(code, settings, VERSION, "off"),
    );
    const cpOn = await underEnv("trend-v1", () =>
      svc.getCountryQuadrantModel(code, settings, VERSION, "off"),
    );
    check(`Vue pays ${code} [${strategy}] : identique off vs trend-v1`, J(cpOff) === J(cpOn));

    // 5. Capacité INTACTE quand overlay="trend-v1" est demandé EXPLICITEMENT (chemin labo) :
    //    la sortie DIFFÈRE de "off" dès qu'une poche Énergie a été détenue dans l'historique.
    const cpEnergy = await svc.getCountryQuadrantModel(code, settings, VERSION, "trend-v1");
    const backtestDiffers = J(cpOff.backtest) !== J(cpEnergy.backtest);
    check(
      `Vue pays ${code} [${strategy}] : overlay "trend-v1" EXPLICITE diffère de "off" (capacité intacte)`,
      backtestDiffers,
    );
  }
}

// 6. vs Browne (comparaison de modèles) : identique off vs trend-v1.
for (const code of CODES) {
  const opts = { period: null, mode: "real", costBps: 25, transitionWidth: 20 } as any;
  const brOff = await underEnv("off", () =>
    svc.computeModelComparisonForCountry(code, opts, VERSION, "off"),
  );
  const brOn = await underEnv("trend-v1", () =>
    svc.computeModelComparisonForCountry(code, opts, VERSION, "off"),
  );
  check(`vs Browne ${code} : identique off vs trend-v1`, J(brOff) === J(brOn));
}

console.log(
  `\n${fail === 0 ? "✅ NON-FUITE CONFIRMÉE" : "❌ FUITE DÉTECTÉE"} — ${pass} ok / ${fail} ko`,
);
process.exit(fail === 0 ? 0 : 1);
