// Contrôle post-bascule : le SERVICE de production sort-il du v2 PAR DÉFAUT ?
// et le retour v1 (version:"v1") fonctionne-t-il ? LECTURE SEULE.
// pnpm exec tsx experiments/4q-stabilisation/bascule-check.mts
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
const db: any = await imp("src/lib/coredata/four-quadrants/model-version.ts");
const pool: any = await imp("src/lib/coredata/db.ts");

console.log(`DEFAULT_MODEL_VERSION (constante moteur) = "${db.DEFAULT_MODEL_VERSION}"  (attendu : v2)\n`);

// Service SANS argument version → doit utiliser le DÉFAUT (= v2 après bascule).
const usDefault = await svc.getCountryQuadrantModel("US");
// Service en forçant v1 → retour v1 (mécanisme de rollback).
const usV1 = await svc.getCountryQuadrantModel("US", undefined, "v1");
const rot = (m: any) => m.backtest.status === "OK" ? (m.backtest.turnover.annualized * 100).toFixed(1) + " %" : "—";
const cagr = (m: any) => m.backtest.status === "OK" ? m.backtest.metrics.real?.annualized?.toFixed(2) + " %" : "—";

console.log("US — rotation & CAGR réel (Max) :");
console.log(`  défaut service (attendu v2 ≈ 24 %) : rotation ${rot(usDefault)}, CAGR ${cagr(usDefault)}`);
console.log(`  version forcée "v1"  (≈ 37 %)      : rotation ${rot(usV1)}, CAGR ${cagr(usV1)}`);
const okDefaultV2 = usDefault.backtest.status === "OK" && usDefault.backtest.turnover.annualized < 0.30;
const okRollbackV1 = usV1.backtest.status === "OK" && usV1.backtest.turnover.annualized > 0.33;
console.log(`  ⇒ défaut = v2 : ${okDefaultV2 ? "OK ✅" : "NON ❌"} · retour v1 : ${okRollbackV1 ? "OK ✅" : "NON ❌"}`);

// GB — cas « détenu ≠ cible » sous v2 par défaut (position conservée).
const gb = await svc.getCountryQuadrantModel("GB");
if (gb.backtest.status === "OK") {
  const h = gb.backtest.heldAllocation, t = gb.backtest.targetAllocation;
  const half = 0.5 * (["equities", "bonds", "gold", "cash"] as const).reduce((s, k) => s + Math.abs(h[k] - t[k]), 0);
  const pc = (a: any) => `E${Math.round(a.equities * 100)}/B${Math.round(a.bonds * 100)}/G${Math.round(a.gold * 100)}/C${Math.round(a.cash * 100)}`;
  console.log(`\nGB (défaut v2) — détenu ${pc(h)} vs cible ${pc(t)} · écart ${(half * 100).toFixed(1)} % ⇒ ${half > 0.005 ? "divergence attendue ✅" : "identiques"}`);
}

await pool.coredataPool?.end?.();
console.log(`\n${okDefaultV2 && okRollbackV1 ? "✅ Bascule globale OK (service défaut v2, retour v1 fonctionnel)." : "❌ Anomalie — à investiguer."}`);
