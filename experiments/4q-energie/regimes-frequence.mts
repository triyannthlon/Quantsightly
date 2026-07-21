// Audit Énergie 0 — fréquence du régime « boom inflationniste » sur les 22 pays.
// LECTURE SEULE : lit la sortie du moteur FIGÉ (buildModel), ne code aucune Énergie.
// Lance : pnpm exec tsx scripts/energie-0-regimes.mts
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = readFileSync(path.join(root, ".env"), "utf8");
const line = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="));
process.env.CODEDATA_DATABASE_URL = line!.slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");

const svc = await import(
  pathToFileURL(path.join(root, "src/lib/coredata/four-quadrants-service.ts")).href
);

const T = 20; // zone neutre par défaut
const countries = await svc.listQuadrantCountries();

const agg = { total: 0, TR: 0, TRsince95: 0, totalSince95: 0, TRstrong: 0, BR: 0, TL: 0, BL: 0 };
const rows: Record<string, unknown>[] = [];

for (const { iso } of countries) {
  const cm = await svc.getCountryQuadrantModel(iso);
  if (cm.model.status !== "OK") { rows.push({ iso, status: cm.model.status }); continue; }
  const res = cm.model.monthlyResults as Array<{ date: string; x: number; y: number; quadrant: string }>;
  let TR = 0, BR = 0, TL = 0, BL = 0, TRstrong = 0, TR95 = 0, n95 = 0;
  for (const r of res) {
    if (r.quadrant === "inflationary-boom") TR++;
    else if (r.quadrant === "disinflationary-boom") BR++;
    else if (r.quadrant === "inflationary-contraction") TL++;
    else if (r.quadrant === "disinflationary-contraction") BL++;
    if (r.x > T && r.y > T) TRstrong++; // boom inflationniste NET (hors zone neutre sur les 2 axes)
    if (r.date >= "1995-01") { n95++; if (r.quadrant === "inflationary-boom") TR95++; }
  }
  const n = res.length;
  agg.total += n; agg.TR += TR; agg.BR += BR; agg.TL += TL; agg.BL += BL;
  agg.TRstrong += TRstrong; agg.TRsince95 += TR95; agg.totalSince95 += n95;
  const pct = (v: number, d = n) => (d ? ((100 * v) / d).toFixed(1) : "—");
  rows.push({
    iso, from: res[0].date.slice(0, 7), n,
    "TR%": pct(TR), "TRnet%(x,y>20)": pct(TRstrong),
    "TR%_95+": pct(TR95, n95), "BR%": pct(BR), "TL%": pct(TL), "BL%": pct(BL),
  });
}

console.table(rows);
const P = (v: number, d: number) => (d ? ((100 * v) / d).toFixed(1) + " %" : "—");
console.log("\n── Agrégat 22 pays (historique complet) ──");
console.log(`  Boom inflationniste (TR)          : ${P(agg.TR, agg.total)}`);
console.log(`  Boom inflationniste NET (x,y>20)  : ${P(agg.TRstrong, agg.total)}`);
console.log(`  TR depuis 1995 (fenêtre Énergie)  : ${P(agg.TRsince95, agg.totalSince95)}`);
console.log(`  BR / TL / BL                      : ${P(agg.BR, agg.total)} / ${P(agg.TL, agg.total)} / ${P(agg.BL, agg.total)}`);
console.log("\n✅ Lecture terminée (aucune Énergie codée).");
