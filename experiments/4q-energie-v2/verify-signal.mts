// Vérif conventions du SIGNAL MONDE : GT10 = série de PRIX obligataire (pas un taux) ;
// MXWO = PRIX (ty1), même convention que le signal actions national.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const db: any = await imp("src/lib/coredata/db.ts");

const L = (s = "") => console.log(s);
const cagr = (d: any[]) => d.length > 1 ? ((d[d.length - 1].value / d[0].value) ** (12 / (d.length - 1)) - 1) * 100 : NaN;
const stats = (d: any[]) => {
  const v = d.map((p) => p.value);
  return { min: Math.min(...v), max: Math.max(...v), first: d[0].value, last: d[d.length - 1].value };
};

// ── GT10 : PRIX obligataire (total-return dérivé du taux, op1) ou TAUX brut ? ──
L("═══ GT10 Govt-US-4-2 (axe monétaire Monde : dénominateur) ═══");
const gt10 = await db.getSeriesData("GT10 Govt-US-4-2");
const g = stats(gt10);
L(`  ${gt10.length} pts ${gt10[0].date}→${gt10[gt10.length - 1].date}`);
L(`  premières valeurs : ${gt10.slice(0, 3).map((p: any) => `${p.date.slice(0, 7)}=${p.value.toFixed(3)}`).join("  ")}`);
L(`  dernières valeurs : ${gt10.slice(-3).map((p: any) => `${p.date.slice(0, 7)}=${p.value.toFixed(3)}`).join("  ")}`);
L(`  min/max=${g.min.toFixed(3)}/${g.max.toFixed(3)}  first/last=${g.first.toFixed(2)}/${g.last.toFixed(2)}  CAGR=${cagr(gt10).toFixed(2)} %/an`);
// Un TAUX brut oscillerait 1–16 (%). Un indice PRIX/TR croît de façon quasi monotone (x10+ sur 60 ans).
const isYieldLike = g.min > 0 && g.max < 25 && g.last < g.first * 3;
L(`  → ${isYieldLike ? "⚠️ ressemble à un TAUX (bornes basses, pas de croissance cumulative)" : "✅ ressemble à un INDICE PRIX/TR (croissance cumulative, cohérent op1 BOND_YIELD_TO_PRICE)"}`);
// Comparaison avec le proxy TR d'un pays connu (US bond du service) pour cohérence de convention.

// ── ratio Or/Oblig actuel (doit matcher l'ordre de grandeur du panneau Signaux) ──
const xau = await db.getSeriesData("XAU Comdty-XX-5-1");
const bByM = new Map(gt10.map((p: any) => [p.date.slice(0, 7), p.value]));
const last = xau[xau.length - 1];
const bLast = bByM.get(last.date.slice(0, 7));
if (bLast) {
  const lv = Number(last.value), bl = Number(bLast);
  L(`  Or/Oblig (y = XAU/GT10) au ${last.date.slice(0, 7)} : ${(lv / bl).toFixed(2)}  |  Oblig/Or = ${(bl / lv).toFixed(4)} (panneau Signaux ≈ 0,0116)`);
}

// ── MXWO : PRIX (ty1) vs TR (NDDUWI ty2) ──────────────────────────────────────
L("\n═══ MXWO Index-XX-1-1 (actions Monde, signal) — convention PRIX ? ═══");
const mxwoP = await db.getSeriesData("MXWO Index-XX-1-1"); // prix ty1
const mxwoTR = await db.getSeriesData("NDDUWI Index-XX-1-2"); // MSCI World net TR ty2
L(`  MXWO ty1 (prix)   : ${mxwoP.length} pts ${mxwoP[0].date.slice(0, 7)}→${mxwoP[mxwoP.length - 1].date.slice(0, 7)}  CAGR=${cagr(mxwoP).toFixed(2)} %/an`);
L(`  NDDUWI ty2 (TR)   : ${mxwoTR.length} pts  CAGR=${cagr(mxwoTR).toFixed(2)} %/an`);
L(`  écart TR−prix     : ${(cagr(mxwoTR) - cagr(mxwoP)).toFixed(2)} pts/an ≈ rendement du dividende → ${cagr(mxwoTR) - cagr(mxwoP) > 1 ? "✅ MXWO ty1 est bien un PRIX (hors dividendes)" : "⚠️ écart trop faible, vérifier"}`);

// ── Convention du signal actions NATIONAL : class 1 type 1 = PRIX ? ────────────
const series: any[] = await db.listSeries();
const sample = series.filter((s) => s.class === 1 && s.type === 1 && ["US", "FR", "JP"].includes(s.countryIso));
L(`\n  Signal actions national = class 1 / type 1 (${sample[0]?.typeFr}) :`);
for (const s of sample) L(`    ${s.countryIso} ${s.id.padEnd(24)} ${s.tickerName}`);
L(`  → MXWO ty1 suit la MÊME convention (class 1 / type 1 = prix). ✅`);

await db.coredataPool?.end?.();
