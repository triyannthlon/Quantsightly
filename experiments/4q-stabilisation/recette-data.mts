// RECETTE v2 — vérification DATA-LEVEL de ce que l'UI afficherait sous v2 (moteur de
// production). Points de contrôle : allocation affichée (CIBLE latest.finalAllocation)
// vs poids réellement DÉTENUS ; rotation/fréquence v1 vs v2 ; fenêtre identique.
// pnpm exec tsx experiments/4q-stabilisation/recette-data.mts
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const eng: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const db: any = await imp("src/lib/coredata/db.ts");
const { buildModel, backtestQuadrants, weightsFromModel, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = eng;
const V2 = REALLOCATION_BAND.v2;

type Alloc = { equities: number; bonds: number; gold: number; cash: number };
const KEYS: (keyof Alloc)[] = ["equities", "bonds", "gold", "cash"];
const mk = (d: string) => d.slice(0, 7);
const half = (a: Alloc, b: Alloc) => 0.5 * KEYS.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);

// Rejoue le CHEMIN des poids détenus (mêmes règles que backtest.ts) → dernier held.
function lastHeld(model: any, perf: any, band: number): Alloc | null {
  const toMap = (arr: any[]) => new Map(arr.map((p) => [mk(p.date), p.value]));
  const b = toMap(perf.bondTotalReturn), c = toMap(perf.cashTotalReturn), g = toMap(perf.gold);
  const rows: any[] = [];
  for (const p of perf.equityTotalReturn) { const m = mk(p.date); const bd = b.get(m), ca = c.get(m), go = g.get(m); if (bd! > 0 && ca! > 0 && go! > 0 && p.value > 0) rows.push({ m, date: p.date, eq: p.value, bd, ca, go }); }
  rows.sort((x, y) => x.date.localeCompare(y.date));
  const tg = new Map<string, Alloc>();
  for (const r of model.monthlyResults) tg.set(mk(r.date), { equities: r.finalAllocation.equities, bonds: r.finalAllocation.bonds, gold: r.finalAllocation.gold, cash: r.finalAllocation.cash });
  const start = rows.findIndex((r) => tg.has(r.m));
  if (start < 0) return null;
  let held: Alloc = tg.get(rows[start].m)!;
  for (let t = start + 1; t < rows.length; t++) {
    const prev = rows[t - 1], cur = rows[t];
    const rEq = cur.eq / prev.eq - 1, rBd = cur.bd / prev.bd - 1, rCa = cur.ca / prev.ca - 1, rGo = cur.go / prev.go - 1;
    const gv = { equities: held.equities * (1 + rEq), bonds: held.bonds * (1 + rBd), cash: held.cash * (1 + rCa), gold: held.gold * (1 + rGo) };
    const tot = gv.equities + gv.bonds + gv.cash + gv.gold;
    const drifted: Alloc = { equities: gv.equities / tot, bonds: gv.bonds / tot, cash: gv.cash / tot, gold: gv.gold / tot };
    const target = tg.get(cur.m) ?? drifted;
    held = band > 0 ? (half(target, drifted) <= band / 100 ? drifted : target) : target;
  }
  return held;
}
const freq = (bt: any) => { const t = bt.turnover.monthly.map((m: any) => m.turnover).filter((v: any) => v != null); return t.length ? (t.filter((v: number) => v > 0.005).length / t.length) * 12 : 0; };
const pct = (a: Alloc) => KEYS.map((k) => `${k[0].toUpperCase()}${Math.round(a[k] * 100)}`).join("/");

const CODES: string[] = (await svc.listQuadrantCountries()).map((c: any) => c.iso);
const cache: Record<string, any> = {};
for (let i = 0; i < CODES.length; i += 4) { const chunk = CODES.slice(i, i + 4); const got = await Promise.all(chunk.map((c: string) => svc.getCountryQuadrantModel(c))); chunk.forEach((c, j) => { if (got[j].model.status === "OK") cache[c] = got[j]; }); }
const LOADED = Object.keys(cache).sort();

console.log("═".repeat(80));
console.log("POINT #1/#2 — Allocation AFFICHÉE (cible = latest.finalAllocation) vs DÉTENUE (v2)");
console.log("  Sous v2, la carte « Composition » montre la CIBLE ; les poids RÉELLEMENT tenus");
console.log("  peuvent différer si la dernière réallocation a été bloquée par la bande.");
console.log("═".repeat(80));
console.log("pays | cible (latest)      | détenu v2           | écart ½Σ| divergence ?");
let divergent = 0;
const rows: { code: string; d: number }[] = [];
for (const code of LOADED) {
  const cm = cache[code];
  const target: Alloc = { equities: cm.model.latest.finalAllocation.equities, bonds: cm.model.latest.finalAllocation.bonds, gold: cm.model.latest.finalAllocation.gold, cash: cm.model.latest.finalAllocation.cash };
  const held = lastHeld(cm.model, cm.perf, V2);
  if (!held) continue;
  const d = half(target, held);
  rows.push({ code, d });
  if (d > 0.005) divergent++;
  const mark = d > 0.05 ? "⚠️ FORTE" : d > 0.005 ? "· visible" : "≈ identiques";
  console.log(`${code.padEnd(4)} | ${pct(target).padEnd(19)} | ${pct(held).padEnd(19)} | ${(d * 100).toFixed(1).padStart(5)}% | ${mark}`);
}
console.log(`\n→ ${divergent}/${LOADED.length} pays où l'allocation DÉTENUE (v2) diffère de la CIBLE affichée (écart > 0,5 %).`);
console.log(`  ⇒ la carte « Composition » (qui montre la cible) est TROMPEUSE sous v2 pour ces pays.`);

console.log("\n" + "═".repeat(80));
console.log("POINT #5/#6 — Rotation / fréquence / fenêtre : v1 vs v2 (production, Max) — échantillon");
console.log("═".repeat(80));
for (const code of ["US", "FR", "IN", "CN"]) {
  const cm = cache[code]; if (!cm) continue;
  const w = weightsFromModel(cm.model);
  const v1 = backtestQuadrants({ countryCode: code, weights: w, ...cm.perf, reallocationBand: null });
  const v2 = backtestQuadrants({ countryCode: code, weights: w, ...cm.perf, reallocationBand: V2 });
  if (v1.status !== "OK" || v2.status !== "OK") continue;
  const win = v1.start === v2.start && v1.end === v2.end && v1.metrics.nominal.months === v2.metrics.nominal.months;
  console.log(`${code} | rotation ${(v1.turnover.annualized * 100).toFixed(1)}%→${(v2.turnover.annualized * 100).toFixed(1)}% | fréq ${freq(v1).toFixed(1)}→${freq(v2).toFixed(1)}/an | CAGR réel ${v1.metrics.real?.annualized?.toFixed(2)}→${v2.metrics.real?.annualized?.toFixed(2)}% | fenêtre ${win ? "IDENTIQUE ✓" : "DIFFÈRE ✗"} (${v1.start.slice(0, 7)}→${v1.end.slice(0, 7)}, ${v1.metrics.nominal.months} mois)`);
}
await db.coredataPool?.end?.();
console.log("\n✅ Recette data-level terminée.");
