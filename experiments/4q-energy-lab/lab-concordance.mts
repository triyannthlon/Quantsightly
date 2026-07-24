// ─────────────────────────────────────────────────────────────────────────────
// CONCORDANCE DU LABORATOIRE ÉNERGIE — le service `computeEnergyLabComparison`
// consomme le moteur figé `energy-trend-v1` sans dérive.
//   • Génère (1ʳᵉ fois) puis VÉRIFIE des fixtures de PRODUCTION compactes dans
//     src/lib/coredata/four-quadrants/energy-trend-v1/__fixtures__/lab-signatures.json
//     (DISTINCTES des golden de recherche experiments/4q-energy-trend-rc1/, jamais importées
//      par le produit).
//   • Prouve la VALEUR MARGINALE : la variante Énergie DIFFÈRE du standard, et le signal a été
//     ACTIF dans l'historique (pas un faux-identique dû à l'inactivité actuelle).
//   pnpm exec tsx experiments/4q-energy-lab/lab-concordance.mts
// LECTURE DB seule ; écrit UNIQUEMENT le fichier de fixtures (golden de non-régression).
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const CODES = ["US", "FR", "JP", "BR"];
const STRATS: Array<"dynamic" | "binary"> = ["dynamic", "binary"];
const J = (x: unknown) => JSON.stringify(x);
let pass = 0,
  fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

const FIX_DIR = path.join(ROOT, "src/lib/coredata/four-quadrants/energy-trend-v1/__fixtures__");
const FIX_FILE = path.join(FIX_DIR, "lab-signatures.json");
const golden: Record<string, unknown> = existsSync(FIX_FILE)
  ? JSON.parse(readFileSync(FIX_FILE, "utf8"))
  : {};
const generating = !existsSync(FIX_FILE);
const live: Record<string, unknown> = {};

console.log(`# Concordance laboratoire Énergie — ${generating ? "GÉNÉRATION" : "VÉRIFICATION"}\n`);

for (const strategy of STRATS) {
  for (const code of CODES) {
    const key = `${code}:${strategy}`;
    const c = await svc.computeEnergyLabComparison(code, strategy);
    if (!c) {
      check(`${key} : comparaison disponible`, false, "null");
      continue;
    }
    const sig = lab.energyLabSignature(c);
    live[key] = sig;

    // Valeur marginale : Énergie ≠ standard, et le signal a été actif dans l'historique.
    check(`${key} : variante Énergie ≠ standard`, J(sig.energy) !== J(sig.standard));
    check(
      `${key} : signal actif dans l'historique (${sig.signal.activeMonths} mois)`,
      sig.signal.activeMonths > 0,
    );
    check(
      `${key} : contribution Énergie non nulle (standard = 0)`,
      sig.standard.contributions.energy === 0 && sig.energy.contributions.energy !== 0,
    );

    // Concordance golden (non-régression) — sauf 1ʳᵉ génération.
    if (!generating) {
      check(`${key} : concordance golden (bit à bit)`, J(sig) === J(golden[key]));
    }
  }
}

if (generating) {
  mkdirSync(FIX_DIR, { recursive: true });
  writeFileSync(FIX_FILE, JSON.stringify(live, null, 2) + "\n", "utf8");
  console.log(
    `\n📝 Fixtures générées : ${path.relative(ROOT, FIX_FILE)} (${Object.keys(live).length} cas)`,
  );
  console.log("   → relance le script pour la VÉRIFICATION de concordance.");
}

console.log(`\n${fail === 0 ? "✅ CONCORDANCE OK" : "❌ ÉCHEC"} — ${pass} ok / ${fail} ko`);
process.exit(fail === 0 ? 0 : 1);
