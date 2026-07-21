// Rapport canonique (aucune base) depuis canonical-results.json + canonical-oos.json.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const A: any[] = JSON.parse(readFileSync(path.join(HERE, "canonical-results.json"), "utf8"));
const OOS: any = JSON.parse(readFileSync(path.join(HERE, "canonical-oos.json"), "utf8"));
const T_WORLD = [0, 10, 20, 30, 40, 50], W = [0.05, 0.1, 0.15, 0.2, 0.25];
const g = (f: any) => A.find((r) => r.arm === f.arm && r.horizon === f.horizon && r.cost === f.cost && r.tW === f.tW && r.w === f.w);
const out: string[] = []; const L = (s = "") => { out.push(s); console.log(s); };
const sg = (v: number, d = 3) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;

L("# Étude Énergie v2 — rapport CANONIQUE\n");
L("Surcouche Énergie mondiale FIXE (step), financée prorata, sur `4q-standard-v2`. Témoin = v2 (w=0) sur la MÊME fenêtre. Net de coûts, coûts au compounding, bande δ=5 appliquée une fois sur 5 poches. 21 pays (DK exclu).\n");

// ── A. CELLULE DE RÉFÉRENCE (T_world=20, w=10 %), dyn/T20 ────────────────────
L("## A. Cellule de référence — T_world=20, w=10 %, dynamique/T20 (net 25 bps)\n");
L("| horizon | ΔSharpe (Q1/Q3/pire) %imp | ΔCAGR %imp | Δvol | ΔMDD | Δsous-l'eau | Δrotation | Δfréq réalloc | activation | poids É moyen | contrib É |");
L("|---|---|---|---|---|---|---|---|---|---|---|");
for (const h of ["Max", "20A", "10A", "5A", "Live"]) {
  const r = g({ arm: "dyn·T20", horizon: h, cost: 25, tW: 20, w: 0.1 }); if (!r) continue;
  L(`| ${h} | ${sg(r.dSharpe.med)} (${sg(r.dSharpe.q1)}/${sg(r.dSharpe.q3)}/${sg(r.dSharpe.worst)}) ${(r.dSharpe.pImp * 100).toFixed(0)}% | ${sg(r.dCAGR.med, 2)} ${(r.dCAGR.pImp * 100).toFixed(0)}% | ${sg(r.dVol, 2)} | ${sg(r.dMDD, 1)} | ${sg(r.dUW, 0)} | ${sg(r.dRot * 100, 1)}pt | ${sg(r.dFreq, 1)} | ${(r.activation * 100).toFixed(0)}% | ${(r.meanEnergy * 100).toFixed(1)}% | ${sg(r.energyContrib, 1)}% |`);
}

// ── B. Plateau T_world × w (dyn/T20, 25 bps) ────────────────────────────────
function plateau(horizon: string) {
  L(`\n### Plateau ΔSharpe — dyn/T20, net 25 bps, ${horizon} (✅ = pire-décile ≥ 0 & %imp ≥ 90)\n`);
  L("| T_world \\ w | " + W.map((w) => `${w * 100}%`).join(" | ") + " |");
  L("|" + "---|".repeat(W.length + 1));
  for (const tW of T_WORLD) {
    const cells = W.map((w) => { const r = g({ arm: "dyn·T20", horizon, cost: 25, tW, w }); if (!r) return "—"; const rob = r.dSharpe.worst >= 0 && r.dSharpe.pImp >= 0.9; return `${sg(r.dSharpe.med)}${rob ? " ✅" : ""}`; });
    L(`| **${tW}** | ${cells.join(" | ")} |`);
  }
}
L("\n## B. Cartes de plateau (T_world × poids Énergie)");
plateau("Max"); plateau("Live");

// ── C. Sous-périodes (le test décisif) ──────────────────────────────────────
L("\n## C. Décomposition en sous-périodes — dyn/T20, net 25 bps, médiane ΔSharpe (n)");
L("Le gain survit-il HORS du choc 2021-2022 ?\n");
const bkeys = ["95-00", "01-05", "06-10", "11-15", "16-20", "21-26", "Live11-20", "pré-2021", "Max"];
L("| w | " + bkeys.join(" | ") + " |");
L("|---|" + bkeys.map(() => "---|").join(""));
for (const row of OOS.subAgg) {
  L(`| ${row.w * 100}% | ` + bkeys.map((k) => `${sg(row[k].med)} (${row[k].n})`).join(" | ") + " |");
}
L("\nRappel gate Monde actif : 95-00 **0 %** · 01-05 **0 %** · 06-10 **0 %** · 11-15 7 % · 16-20 27 % · 21-26 **65 %**.");

// ── D. Leave-one-country-out ────────────────────────────────────────────────
L("\n## D. Leave-one-country-out — ΔSharpe Max (net 25 bps)");
L("| w | médiane pleine | LOO min | LOO max | 3 pires pays |");
L("|---|---|---|---|---|");
for (const w of [0.1, 0.2]) { const lo = OOS.loco[w]; L(`| ${w * 100}% | ${sg(lo.full)} | ${sg(lo.min)} | ${sg(lo.max)} | ${lo.worst.join(", ")} |`); }

// ── E. Contrôles (binaire, T0, T50) — plateau ΔSharpe Max & sous-période ─────
L("\n## E. Contrôles — ΔSharpe médiane (net 25 bps), cellule réf T_world=20");
L("| arm | Max w10 | Max w20 | Live w10 | Live w20 |");
L("|---|---|---|---|---|");
for (const arm of ["dyn·T20", "bin·T20", "dyn·T0", "dyn·T50"]) {
  const c = (h: string, w: number) => { const r = g({ arm, horizon: h, cost: 25, tW: 20, w }); return r ? sg(r.dSharpe.med) : "—"; };
  L(`| ${arm} | ${c("Max", 0.1)} | ${c("Max", 0.2)} | ${c("Live", 0.1)} | ${c("Live", 0.2)} |`);
}

// ── F. Sensibilité coûts + activation/poids détenu (réf) ────────────────────
L("\n## F. Sensibilité aux coûts — dyn/T20, T_world=20 (médiane ΔSharpe Max)");
L("| w | 0 bps | 10 bps | 25 bps | 50 bps | activation | poids É moyen détenu |");
L("|---|---|---|---|---|---|---|");
for (const w of W) {
  const cells = [0, 10, 25, 50].map((c) => { const r = g({ arm: "dyn·T20", horizon: "Max", cost: c, tW: 20, w }); return r ? sg(r.dSharpe.med) : "—"; });
  const r25 = g({ arm: "dyn·T20", horizon: "Max", cost: 25, tW: 20, w });
  L(`| ${w * 100}% | ${cells.join(" | ")} | ${r25 ? (r25.activation * 100).toFixed(0) + "%" : "—"} | ${r25 ? (r25.meanEnergy * 100).toFixed(1) + "%" : "—"} |`);
}

writeFileSync(path.join(HERE, "canonical-report.md"), out.join("\n"));
console.log("\nÉcrit : canonical-report.md");
