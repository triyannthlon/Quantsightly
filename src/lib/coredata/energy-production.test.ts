import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Garde-fous de la MISE EN PRODUCTION de l'onglet Énergie : l'ancien flag de gate a été
// entièrement supprimé et l'onglet est une fonctionnalité publique inconditionnelle.
//
// ⚠️ Les motifs recherchés sont construits par concaténation pour que CE fichier de test ne
// s'auto-détecte pas lors du scan de `src/`.
const FLAG = ["QS", "ENERGY", "LAB", "ENABLED"].join("_");
const READER = "readEnergyLab" + "Enabled";
const GATE_VAR = "energyLab" + "Enabled";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = path.join(ROOT, "src");
// Racines scannées : code applicatif + scripts/docs d'expérience (couvre « le dépôt »).
const SCAN_ROOTS = [SRC, path.join(ROOT, "experiments")];
const SCAN_EXT = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".md"]);
// On saute les répertoires de données figées et les fixtures (pas du code/doc).
const SKIP_DIRS = new Set(["output", "output-audit", "__fixtures__", "node_modules"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...walk(path.join(dir, e.name)));
    } else if (SCAN_EXT.has(path.extname(e.name))) out.push(path.join(dir, e.name));
  }
  return out;
}
const files = SCAN_ROOTS.flatMap(walk);
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, "/");
const read = (f: string) => readFileSync(f, "utf8");

describe("Onglet Énergie — mise en production (suppression du flag)", () => {
  it("aucune occurrence du flag de gate dans le dépôt (src/ + experiments/)", () => {
    const hits = files.filter((f) => read(f).includes(FLAG)).map(rel);
    expect(hits).toEqual([]);
  });

  it("aucune référence au lecteur de gate dans le dépôt", () => {
    const hits = files.filter((f) => read(f).includes(READER)).map(rel);
    expect(hits).toEqual([]);
  });

  it("l'onglet Énergie est déclaré dans la navigation, sans variable de gate", () => {
    const view = read(path.join(SRC, "app/(admin)/modeles/quadrants/quadrants-view.tsx"));
    expect(view).toMatch(/key:\s*"energie"/); // onglet présent inconditionnellement
    expect(view.includes(GATE_VAR)).toBe(false); // aucune garde d'accès résiduelle
  });

  it("la page ne lit aucune variable d'environnement pour la visibilité de l'onglet", () => {
    const page = read(path.join(SRC, "app/(admin)/modeles/quadrants/page.tsx"));
    expect(page.includes(READER)).toBe(false);
    expect(page.includes(GATE_VAR)).toBe(false);
  });
});
