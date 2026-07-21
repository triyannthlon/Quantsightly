// Analyse de PLATEAU + robustesse depuis results.json (aucune base).
//   pnpm exec tsx experiments/4q-energie-v2/analyze.mts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const rows: any[] = JSON.parse(readFileSync(path.join(HERE, "results.json"), "utf8"));

const W = [0.05, 0.1, 0.15, 0.2, 0.25];
const T_E = [0, 10, 20, 30, 40];
const get = (f: any) => rows.find((r) => r.strategy === f.strategy && r.horizon === f.horizon && r.cost === f.cost && r.shape === f.shape && r.fin === f.fin && r.wMax === f.wMax && r.tE === f.tE);

const out: string[] = ["# Étude Énergie v2 — plateau & robustesse\n"];
const L = (s = "") => { out.push(s); console.log(s); };

// ── 1. Cartes de plateau : médiane ΔSharpe (pire-décile | %imp) ──────────────
function plateau(strategy: string, shape: string, fin: string, cost: number, horizon: string) {
  L(`\n### ${strategy} · ${shape} · ${fin} · net ${cost} bps · ${horizon}`);
  L("médiane ΔSharpe réel — cellule marquée ✅ si pire-décile ≥ 0 ET %imp ≥ 90\n");
  L("| T_E \\ w | " + W.map((w) => `${w * 100}%`).join(" | ") + " |");
  L("|" + "---|".repeat(W.length + 1));
  for (const tE of T_E) {
    const cells = W.map((w) => {
      const r = get({ strategy, horizon, cost, shape, fin, wMax: w, tE });
      if (!r) return "—";
      const robust = r.dSharpe.worst >= 0 && r.dSharpe.pImp >= 0.9;
      return `${r.dSharpe.med >= 0 ? "+" : ""}${r.dSharpe.med.toFixed(3)}${robust ? " ✅" : ""}`;
    });
    L(`| **${tE}** | ${cells.join(" | ")} |`);
  }
}
L("## 1. Cartes de plateau (dynamique, net 25 bps)");
for (const h of ["Max", "Live"]) for (const shape of ["step", "ramp"]) for (const fin of ["prorata", "boombloc"]) plateau("dynamic", shape, fin, 25, h);

// ── 2. Score de robustesse par cellule : passe-t-elle TOUS les tests ? ────────
// Conditions : ΔSharpe méd > 0 ET pire-décile ≥ −0,005 ET %imp ≥ 0,85, à net 25 bps,
// sur Max, Live, 20A, 10A, ET en dynamique ET en binaire.
L("\n\n## 2. Cellules PLATEAU ROBUSTE (tous tests passés)");
L("Test = ΔSharpe méd > 0, pire-décile ≥ −0,005, %imp ≥ 85 % — exigé sur {Max,Live,20A,10A} × {dynamique,binaire}, net 25 bps.\n");
interface Cand { shape: string; fin: string; tE: number; w: number; medMaxDyn: number; medLiveDyn: number; worstMin: number; pImpMin: number; cagrMaxDyn: number; rot: number; partE: number }
const cands: Cand[] = [];
for (const shape of ["step", "ramp"]) for (const fin of ["prorata", "boombloc"]) for (const tE of T_E) for (const w of W) {
  let pass = true; let worstMin = Infinity, pImpMin = Infinity;
  for (const strategy of ["dynamic", "binary"]) for (const horizon of ["Max", "Live", "20A", "10A"]) {
    const r = get({ strategy, horizon, cost: 25, shape, fin, wMax: w, tE });
    if (!r || r.dSharpe.med <= 0 || r.dSharpe.worst < -0.005 || r.dSharpe.pImp < 0.85) { pass = false; break; }
    worstMin = Math.min(worstMin, r.dSharpe.worst); pImpMin = Math.min(pImpMin, r.dSharpe.pImp);
  }
  if (!pass) continue;
  const rMax = get({ strategy: "dynamic", horizon: "Max", cost: 25, shape, fin, wMax: w, tE });
  const rLive = get({ strategy: "dynamic", horizon: "Live", cost: 25, shape, fin, wMax: w, tE });
  cands.push({ shape, fin, tE, w, medMaxDyn: rMax.dSharpe.med, medLiveDyn: rLive.dSharpe.med, worstMin, pImpMin, cagrMaxDyn: rMax.dCAGR.med, rot: rMax.reallocFreq, partE: rMax.energyShare });
}
cands.sort((a, b) => b.medMaxDyn - a.medMaxDyn);
L(`${cands.length} cellules passent tous les tests.\n`);
L("| shape/fin | T_E | w | ΔSharpe Max | ΔSharpe Live | pire-déc min | %imp min | ΔCAGR Max | fréq/an | partÉ |");
L("|---|---|---|---|---|---|---|---|---|---|");
for (const c of cands.slice(0, 30)) {
  L(`| ${c.shape}/${c.fin} | ${c.tE} | ${c.w * 100}% | +${c.medMaxDyn.toFixed(3)} | +${c.medLiveDyn.toFixed(3)} | ${c.worstMin >= 0 ? "+" : ""}${c.worstMin.toFixed(3)} | ${(c.pImpMin * 100).toFixed(0)}% | +${c.cagrMaxDyn.toFixed(2)} | ${c.rot.toFixed(1)} | ${(c.partE * 100).toFixed(0)}% |`);
}

// ── 3. Sensibilité aux COÛTS (candidats représentatifs) ──────────────────────
L("\n\n## 3. Sensibilité aux coûts (dynamique, Max) — médiane ΔSharpe");
L("| shape/fin T_E w | 0 bps | 10 bps | 25 bps | 50 bps |");
L("|---|---|---|---|---|");
const costProbe = cands.length ? cands.slice(0, 8) : [{ shape: "ramp", fin: "prorata", tE: 20, w: 0.15 } as any];
for (const c of costProbe) {
  const cells = [0, 10, 25, 50].map((cost) => { const r = get({ strategy: "dynamic", horizon: "Max", cost, shape: c.shape, fin: c.fin, wMax: c.w, tE: c.tE }); return r ? `${r.dSharpe.med >= 0 ? "+" : ""}${r.dSharpe.med.toFixed(3)}` : "—"; });
  L(`| ${c.shape}/${c.fin} T_E${c.tE} w${c.w * 100} | ${cells.join(" | ")} |`);
}

// ── 4. Stabilité MULTI-HORIZON (candidats) ───────────────────────────────────
L("\n\n## 4. Stabilité multi-horizon (dynamique, net 25 bps) — médiane ΔSharpe");
L("| shape/fin T_E w | Max | 20A | 10A | 5A | Live |");
L("|---|---|---|---|---|---|");
for (const c of costProbe) {
  const cells = ["Max", "20A", "10A", "5A", "Live"].map((h) => { const r = get({ strategy: "dynamic", horizon: h, cost: 25, shape: c.shape, fin: c.fin, wMax: c.w, tE: c.tE }); return r ? `${r.dSharpe.med >= 0 ? "+" : ""}${r.dSharpe.med.toFixed(3)}` : "—"; });
  L(`| ${c.shape}/${c.fin} T_E${c.tE} w${c.w * 100} | ${cells.join(" | ")} |`);
}

writeFileSync(path.join(HERE, "analyze-plateau.md"), out.join("\n"));
console.log("\nÉcrit : analyze-plateau.md");
