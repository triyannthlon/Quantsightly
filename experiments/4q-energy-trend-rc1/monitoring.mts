// ─────────────────────────────────────────────────────────────────────────────
// SUIVI PARALLÈLE (mensuel) — `4q-standard-v2` vs `4q-standard-v2-energy-trend-v1`.
// Début de l'OBSERVATION HORS-ÉCHANTILLON. À relancer chaque mois. Compare : état du
// signal · allocation cible · allocation détenue · transactions déclenchées · perf
// mensuelle · contribution Énergie · rotation supplémentaire. LECTURE SEULE.
// ⚠️ Les résultats futurs ne doivent JAMAIS servir à réoptimiser L ni le poids (figés).
//   pnpm exec tsx experiments/4q-energy-trend-rc1/monitoring.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { computeEnergyTrendSignal, ENERGY_TREND_V1_LOOKBACK } from "../../src/lib/coredata/four-quadrants/energy-trend-signal";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const envf = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = envf.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const db: any = await imp("src/lib/coredata/db.ts");
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const fq: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const { DEFAULT_FOUR_QUADRANTS_SETTINGS } = fq;
const mk = (d: string) => d.slice(0, 7);
const REPS = ["US", "FR", "JP", "BR"];
const pctW = (a: any) => `${(a.equities * 100).toFixed(0)}/${(a.bonds * 100).toFixed(0)}/${(a.gold * 100).toFixed(0)}/${(a.cash * 100).toFixed(0)}${a.energy !== undefined ? "/" + (a.energy * 100).toFixed(0) : ""}`;

const energyUsd: any[] = (await db.getSeriesData("SPDYENT Index-XX-5-2")).sort((a: any, b: any) => a.date.localeCompare(b.date));
const signal = computeEnergyTrendSignal(energyUsd, ENERGY_TREND_V1_LOOKBACK);
const months = [...signal.keys()].sort();
const last = months[months.length - 1];

const O: string[] = []; const P = (s = "") => { O.push(s); console.log(s); };
P(`# Suivi parallèle — v2 vs v2-energy-trend-v1 (au ${last})\n`);
P("Observation **hors-échantillon**. `energy-trend-v1` FIGÉ (SMA6, 10 %, prorata). Ne JAMAIS réoptimiser. À relancer chaque mois.\n");

// 1. État du signal mondial
P("## 1. Signal mondial `SPDYENT > SMA6`");
const spdy = energyUsd[energyUsd.length - 1];
let sma = 0; for (let i = energyUsd.length - ENERGY_TREND_V1_LOOKBACK; i < energyUsd.length; i++) sma += energyUsd[i].value; sma /= ENERGY_TREND_V1_LOOKBACK;
const active = signal.get(last);
P(`- **État au ${last} : ${active ? "🟢 ACTIF (Énergie 10 %)" : "⚪ INACTIF (Énergie 0 %)"}** — SPDYENT ${spdy.value.toFixed(1)} ${active ? ">" : "≤"} SMA6 ${sma.toFixed(1)}.`);
// dernière bascule
let lastFlip = "—", flipTo = active; for (let i = months.length - 1; i > 0; i--) { if (signal.get(months[i]) !== signal.get(months[i - 1])) { lastFlip = months[i]; flipTo = signal.get(months[i])!; break; } }
P(`- Dernière bascule : **${lastFlip}** → ${flipTo ? "ACTIF" : "INACTIF"}.`);
P(`- Timeline 18 derniers mois : ${months.slice(-18).map((m) => `${m.slice(2)}${signal.get(m) ? "🟢" : "·"}`).join(" ")}`);

// 2. Snapshot par pays (Dynamique) : cible / détenu v2 vs trend, transactions, rotation
P("\n## 2. Snapshot par pays — Dynamique (cible & détenu : Actions/Oblig/Or/Cash[/Énergie])");
P("| pays | signal | cible v2 | cible trend | détenu trend | transac. dernier mois | rotation v2→trend |");
P("|---|---|---|---|---|---|---|");
for (const code of REPS) {
  process.env.QS_ENERGY_OVERLAY = "off"; const v2 = await svc.getCountryQuadrantModel(code, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
  process.env.QS_ENERGY_OVERLAY = "trend-v1"; const tr = await svc.getCountryQuadrantModel(code, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 });
  if (v2.backtest.status !== "OK" || tr.backtest.status !== "OK") continue;
  const lastTurn = tr.backtest.turnover.monthly.filter((t: any) => t.turnover !== null).slice(-1)[0];
  P(`| ${code} | ${tr.model.latest.finalAllocation.energy > 1e-9 ? "🟢" : "⚪"} | ${pctW(v2.model.latest.finalAllocation)} | ${pctW(tr.model.latest.finalAllocation)} | ${pctW(tr.backtest.heldAllocation)} | ${lastTurn ? (lastTurn.turnover * 100).toFixed(1) + " %" : "—"} | ${(v2.backtest.turnover.annualized * 100).toFixed(0)}→${(tr.backtest.turnover.annualized * 100).toFixed(0)} %/an |`);
}
process.env.QS_ENERGY_OVERLAY = "off";

// 3. Perf & contribution récentes (12 derniers mois, réel net 25 bps) — US repère
P("\n## 3. Performance récente (US dynamique, réel net 25 bps, 12 derniers mois)");
{
  process.env.QS_ENERGY_OVERLAY = "trend-v1"; const tr = await svc.getCountryQuadrantModel("US", { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 }, undefined, "trend-v1");
  process.env.QS_ENERGY_OVERLAY = "off"; const v2 = await svc.getCountryQuadrantModel("US", { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20 }, undefined, "off");
  const perf12 = (cm: any) => { const r = cm.backtest.series.real; if (!r || r.length < 13) return NaN; return (r[r.length - 1].value / r[r.length - 13].value - 1) * 100; };
  const enContrib = tr.backtest.status === "OK" ? tr.backtest.contributions.energy : NaN;
  P(`- Perf réelle 12 m : v2 ${perf12(v2).toFixed(1)} % · trend ${perf12(tr).toFixed(1)} % · Δ ${(perf12(tr) - perf12(v2)).toFixed(1)} pt.`);
  P(`- Contribution cumulée de la poche Énergie (fenêtre complète) : ${enContrib.toFixed(1)} % · rotation supplémentaire ${((tr.backtest.turnover.annualized - v2.backtest.turnover.annualized) * 100).toFixed(0)} pt/an.`);
}
process.env.QS_ENERGY_OVERLAY = "off";

P("\n---");
P("**Rappel de discipline** : ce suivi est une OBSERVATION. Aucune réoptimisation de L, du poids, du financement, du signal ou de la bande. `4q-standard-v2` reste public ; `energy-trend-v1` reste derrière le flag `off`. Décision d'activation publique = ultérieure, humaine, sur accumulation de données hors-échantillon.");
writeFileSync(path.join(HERE, "monitoring-snapshot.md"), O.join("\n"));
await db.coredataPool?.end?.();
console.error(`\n✅ Snapshot de suivi écrit — monitoring-snapshot.md`);
