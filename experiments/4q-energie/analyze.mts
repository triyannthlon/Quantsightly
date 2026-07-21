// Analyse des résultats de l'étude Énergie (lit results.json). LECTURE SEULE.
// pnpm exec tsx experiments/4q-energie/analyze.mts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rows: any[] = JSON.parse(readFileSync(path.join(HERE, "results.json"), "utf8"));
const P = (v: number, d = 3) => (v >= 0 ? "+" : "") + v.toFixed(d);

// ── 1. Distribution globale des médianes ΔSharpe (net 25 bps) ────────────────
const meds = rows.map((r) => r.dSharpe25.med);
const maxMed = Math.max(...meds);
console.log("═".repeat(76));
console.log("1. DISTRIBUTION GLOBALE — médiane ΔSharpe réel (net 25 bps), 5184 cellules");
console.log("═".repeat(76));
console.log(`  max médiane           : ${P(maxMed)}   (bar d'admissibilité protocole : +0.050)`);
console.log(`  cellules médiane>+0.05 : ${rows.filter((r) => r.dSharpe25.med > 0.05).length}`);
console.log(`  cellules médiane>+0.02 : ${rows.filter((r) => r.dSharpe25.med > 0.02).length}`);
console.log(`  cellules médiane>0     : ${rows.filter((r) => r.dSharpe25.med > 0).length} / ${rows.length}`);

// ── 2. Meilleure cellule par (stratégie, horizon) ────────────────────────────
console.log("\n" + "═".repeat(76));
console.log("2. MEILLEURE CELLULE par stratégie × horizon (tri médiane ΔSharpe net 25 bps)");
console.log("═".repeat(76));
for (const strategy of ["dynamic", "binary"]) {
  for (const h of ["Max", "20A", "10A", "5A"]) {
    const s = rows.filter((r) => r.strategy === strategy && r.T === 20 && r.horizon === h);
    const best = s.sort((a, b) => b.dSharpe25.med - a.dSharpe25.med)[0];
    console.log(`  ${strategy.padEnd(7)} ${h.padEnd(3)} : ${best.shape}/${best.fin} T_E=${best.tE} w=${(best.wMax * 100).toFixed(0)}%  ` +
      `ΔSharpe ${P(best.dSharpe25.med)} [q1 ${P(best.dSharpe25.q1)} q3 ${P(best.dSharpe25.q3)} pire ${P(best.dSharpe25.worst)}] ` +
      `%imp ${(best.dSharpe25.pImp * 100).toFixed(0)} | ΔMDD ${P(best.dMDD.med, 1)}pt | Δrot ${P(best.dTurnover.med * 100, 0)}pt`);
  }
}

// ── 3. Gradient : plus d'Énergie = ? (dynamique, T=20, Max, moyenne sur T_E) ──
console.log("\n" + "═".repeat(76));
console.log("3. GRADIENT vs POIDS — dynamique T=20 Max, médiane ΔSharpe moyennée sur T_E & shape");
console.log("═".repeat(76));
for (const fin of ["prorata", "boombloc", "cash"]) {
  const line = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map((w) => {
    const cells = rows.filter((r) => r.strategy === "dynamic" && r.T === 20 && r.horizon === "Max" && r.fin === fin && r.wMax === w);
    const m = cells.reduce((s, c) => s + c.dSharpe25.med, 0) / cells.length;
    return `${(w * 100).toFixed(0)}%:${P(m)}`;
  });
  console.log(`  ${fin.padEnd(9)} | ${line.join("  ")}`);
}

// ── 4. Angle DRAWDOWN — l'Énergie réduit-elle le risque quelque part ? ────────
console.log("\n" + "═".repeat(76));
console.log("4. RÉDUCTION DRAWDOWN — meilleure ΔMDD réelle (dyn T=20), coût Sharpe/rotation");
console.log("═".repeat(76));
for (const h of ["Max", "20A", "10A", "5A"]) {
  const s = rows.filter((r) => r.strategy === "dynamic" && r.T === 20 && r.horizon === h);
  const best = s.sort((a, b) => b.dMDD.med - a.dMDD.med)[0];
  console.log(`  ${h.padEnd(3)} : ${best.shape}/${best.fin} T_E=${best.tE} w=${(best.wMax * 100).toFixed(0)}%  ` +
    `ΔMDD ${P(best.dMDD.med, 1)}pt [pire ${P(best.dMDD.worst, 1)}] | ΔSharpe ${P(best.dSharpe25.med)} | Δrot ${P(best.dTurnover.med * 100, 0)}pt | partÉ ${(best.energyShare * 100).toFixed(0)}%`);
}

// ── 5. Meilleur cas POSSIBLE pour l'Énergie : période récente 5A ──────────────
console.log("\n" + "═".repeat(76));
console.log("5. MEILLEUR CAS 5A (épisode inflationniste récent 2021→) — top 5 dynamique");
console.log("═".repeat(76));
const s5 = rows.filter((r) => r.strategy === "dynamic" && r.T === 20 && r.horizon === "5A")
  .sort((a, b) => b.dSharpe25.med - a.dSharpe25.med).slice(0, 5);
for (const r of s5) {
  console.log(`  ${r.shape}/${r.fin} T_E=${r.tE} w=${(r.wMax * 100).toFixed(0)}% : ΔSharpe ${P(r.dSharpe25.med)} ` +
    `[pire ${P(r.dSharpe25.worst)}] %imp ${(r.dSharpe25.pImp * 100).toFixed(0)} | ΔCAGR ${P(r.dCAGR25.med, 2)}pt | ΔMDD ${P(r.dMDD.med, 1)}pt | partÉ ${(r.energyShare * 100).toFixed(0)}%`);
}

// ── 6. TEST D'ADMISSIBILITÉ : un jeu robuste sur les 4 horizons à la fois ? ───
console.log("\n" + "═".repeat(76));
console.log("6. TEST D'ADMISSIBILITÉ — config robuste sur les 4 horizons (dynamique)");
console.log("   Critère : médiane ΔSharpe≥+0.05 ET %imp≥60 ET pire décile≥0, sur Max ET 20A ET 10A ET 5A");
console.log("═".repeat(76));
const configKeys = new Set(rows.map((r) => `${r.shape}|${r.fin}|${r.wMax}|${r.tE}`));
let admissible = 0;
const relaxed: string[] = [];
for (const key of configKeys) {
  const [shape, fin, wMax, tE] = key.split("|");
  const cells = ["Max", "20A", "10A", "5A"].map((h) =>
    rows.find((r) => r.strategy === "dynamic" && r.T === 20 && r.horizon === h && r.shape === shape && r.fin === fin && r.wMax === +wMax && r.tE === +tE));
  if (cells.some((c) => !c)) continue;
  const strict = cells.every((c) => c.dSharpe25.med >= 0.05 && c.dSharpe25.pImp >= 0.6 && c.dSharpe25.worst >= 0);
  if (strict) { admissible++; console.log(`  ✅ ADMISSIBLE : ${shape}/${fin} T_E=${tE} w=${(+wMax * 100).toFixed(0)}%`); }
  // version relâchée : juste "jamais négatif en médiane + %imp≥55 partout"
  const soft = cells.every((c) => c.dSharpe25.med >= 0 && c.dSharpe25.pImp >= 0.55);
  if (soft) relaxed.push(`${shape}/${fin} T_E=${tE} w=${(+wMax * 100).toFixed(0)}%`);
}
if (!admissible) console.log("  ❌ AUCUNE config admissible (critère strict).");
console.log(`\n  Critère RELÂCHÉ (médiane≥0 & %imp≥55 sur les 4 horizons) : ${relaxed.length} config(s)`);
relaxed.slice(0, 10).forEach((r) => console.log(`     · ${r}`));

// ── 7. T robustesse : la meilleure cellule Max tient-elle en T=0 et T=50 ? ────
console.log("\n" + "═".repeat(76));
console.log("7. ROBUSTESSE zone neutre T — la meilleure cellule (dyn Max) selon T∈{0,20,50}");
console.log("═".repeat(76));
const bestMax = rows.filter((r) => r.strategy === "dynamic" && r.T === 20 && r.horizon === "Max")
  .sort((a, b) => b.dSharpe25.med - a.dSharpe25.med)[0];
console.log(`  Cellule : ${bestMax.shape}/${bestMax.fin} T_E=${bestMax.tE} w=${(bestMax.wMax * 100).toFixed(0)}%`);
for (const T of [0, 20, 50]) {
  const c = rows.find((r) => r.strategy === "dynamic" && r.T === T && r.horizon === "Max" && r.shape === bestMax.shape && r.fin === bestMax.fin && r.wMax === bestMax.wMax && r.tE === bestMax.tE);
  if (c) console.log(`  T=${String(T).padEnd(2)} : ΔSharpe ${P(c.dSharpe25.med)} [pire ${P(c.dSharpe25.worst)}] %imp ${(c.dSharpe25.pImp * 100).toFixed(0)}`);
}
