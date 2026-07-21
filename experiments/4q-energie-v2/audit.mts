// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE ÉNERGIE v2 — AUDIT de la nouvelle série SPDYENT + DÉCOUVERTE signal Monde.
// (LECTURE SEULE, aucune écriture base, moteur non modifié.)
//
// Série cible : S&P GSCI Energy Dynamic Roll Total Return = `SPDYENT Index-XX-5-2`
//   (classe 5 = matière première, type 2 = total-return, XX = global, USD).
//   C'est la condition UNIQUE de réouverture posée à la clôture de l'étude Énergie v1
//   (matières premières Énergie TR intégrant le rendement de roll, ≠ actions énergie).
//
// Ce script :
//   1. métadonnées SPDYENT (id, ticker, devise, classe/type) ;
//   2. continuité mensuelle janv. 1995 → juin 2026, doublons, valeurs nulles ;
//   3. calcul des rendements (stats, valeurs non finies, jour du mois) ;
//   4. conversion USD → devise locale (contrôle de cohérence) ;
//   5. inventaire des séries candidates au SIGNAL MONDE (MSCI World prix, oblig, CL1, XAU).
//
// pnpm exec tsx experiments/4q-energie-v2/audit.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env
  .split(/\r?\n/)
  .find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length)
  .trim()
  .replace(/^"|"$/g, "");

const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const db: any = await imp("src/lib/coredata/db.ts");
const compute: any = await imp("src/lib/coredata/compute.ts");

const ENERGY_ID = "SPDYENT Index-XX-5-2";
const pool = db.coredataPool;

const line = (s = "") => console.log(s);
const h = (s: string) => {
  line();
  line("═".repeat(78));
  line(s);
  line("═".repeat(78));
};

// ─── 1. Métadonnées ──────────────────────────────────────────────────────────
h("1. MÉTADONNÉES SPDYENT");
const meta = await db.getSeriesById(ENERGY_ID);
if (!meta) {
  line(`❌ Série INTROUVABLE : ${ENERGY_ID}`);
  await pool?.end?.();
  process.exit(1);
}
line(`  id            : ${meta.id}`);
line(`  ticker        : ${meta.tickerName}`);
line(`  pays          : ${meta.countryIso} (${meta.countryFr ?? "—"})`);
line(`  devise        : ${meta.currency}`);
line(`  classe/type   : ${meta.class} (${meta.classFr}) / ${meta.type} (${meta.typeFr})`);
line(`  secteur       : ${meta.sector ?? "—"} (${meta.sectorFr ?? "—"})`);

// ─── 2. Doublons / nulls / bornes (SQL brut) ─────────────────────────────────
h("2. INTÉGRITÉ (SQL brut sur economic_data)");
const integrity = await pool.query(
  `SELECT
     COUNT(*)                              AS n_rows,
     COUNT(DISTINCT date)                  AS n_dates,
     COUNT(*) FILTER (WHERE value IS NULL) AS n_null,
     to_char(MIN(date),'YYYY-MM-DD')       AS d_min,
     to_char(MAX(date),'YYYY-MM-DD')       AS d_max
   FROM economic_data WHERE serie_id = $1`,
  [ENERGY_ID],
);
const it = integrity.rows[0];
line(`  lignes                 : ${it.n_rows}`);
line(`  dates distinctes       : ${it.n_dates}`);
line(`  doublons (lignes-dates): ${Number(it.n_rows) - Number(it.n_dates)}`);
line(`  valeurs NULL           : ${it.n_null}`);
line(`  bornes                 : ${it.d_min} → ${it.d_max}`);

const dups = await pool.query(
  `SELECT to_char(date,'YYYY-MM-DD') AS date, COUNT(*) AS n
   FROM economic_data WHERE serie_id = $1
   GROUP BY date HAVING COUNT(*) > 1 ORDER BY date`,
  [ENERGY_ID],
);
line(`  dates dupliquées       : ${dups.rows.length}${dups.rows.length ? " → " + dups.rows.slice(0, 10).map((r: any) => `${r.date}×${r.n}`).join(", ") : ""}`);

// valeurs non strictement positives (une série TR doit être > 0)
const nonpos = await pool.query(
  `SELECT to_char(date,'YYYY-MM-DD') AS date, value FROM economic_data
   WHERE serie_id = $1 AND (value IS NULL OR value <= 0) ORDER BY date`,
  [ENERGY_ID],
);
line(`  valeurs ≤ 0 ou NULL    : ${nonpos.rows.length}${nonpos.rows.length ? " → " + nonpos.rows.slice(0, 6).map((r: any) => `${r.date}=${r.value}`).join(", ") : ""}`);

// ─── 3. Granularité + jour du mois ───────────────────────────────────────────
h("3. GRANULARITÉ (jour du mois)");
const dom = await pool.query(
  `SELECT EXTRACT(DAY FROM date)::int AS d, COUNT(*) AS n
   FROM economic_data WHERE serie_id = $1 GROUP BY d ORDER BY n DESC LIMIT 8`,
  [ENERGY_ID],
);
line("  jours-du-mois les plus fréquents : " + dom.rows.map((r: any) => `j${r.d}×${r.n}`).join(", "));
// dates multiples dans un même mois (granularité intra-mois éventuelle)
const perMonth = await pool.query(
  `SELECT to_char(date,'YYYY-MM') AS ym, COUNT(*) AS n
   FROM economic_data WHERE serie_id = $1 GROUP BY ym HAVING COUNT(*) > 1 ORDER BY ym LIMIT 10`,
  [ENERGY_ID],
);
line(`  mois avec > 1 observation : ${perMonth.rows.length}${perMonth.rows.length ? " → " + perMonth.rows.slice(0, 8).map((r: any) => `${r.ym}×${r.n}`).join(", ") : " (mensuel pur)"}`);

// ─── 4. Continuité mensuelle janv. 1995 → juin 2026 ──────────────────────────
h("4. CONTINUITÉ MENSUELLE (1995-01 → 2026-06)");
const data: Array<{ date: string; value: number }> = await db.getSeriesData(ENERGY_ID);
const byMonth = new Map<string, number>();
for (const p of data) byMonth.set(p.date.slice(0, 7), p.value);
const wanted: string[] = [];
for (let y = 1995; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === 2026 && m > 6) break;
    wanted.push(`${y}-${String(m).padStart(2, "0")}`);
  }
}
const missing = wanted.filter((ym) => !byMonth.has(ym));
const firstYm = data.length ? data[0].date.slice(0, 7) : "—";
const lastYm = data.length ? data[data.length - 1].date.slice(0, 7) : "—";
line(`  1ʳᵉ / dernière obs (mensuelle) : ${firstYm} → ${lastYm}`);
line(`  mois attendus (95-01→26-06)   : ${wanted.length}`);
line(`  mois présents dans la plage   : ${wanted.length - missing.length}`);
line(`  mois MANQUANTS                : ${missing.length}${missing.length ? " → " + missing.slice(0, 24).join(", ") + (missing.length > 24 ? " …" : "") : " ✅ aucun trou"}`);
// trous internes hors plage 95-06 (au cas où la série démarre avant/après)
const allMonths = [...byMonth.keys()].sort();
let internalGaps = 0;
for (let i = 1; i < allMonths.length; i++) {
  const prev = allMonths[i - 1], cur = allMonths[i];
  const [py, pm] = prev.split("-").map(Number);
  const expected = pm >= 12 ? `${py + 1}-01` : `${py}-${String(pm + 1).padStart(2, "0")}`;
  if (cur !== expected) internalGaps++;
}
line(`  trous internes (toute la série): ${internalGaps}`);

// ─── 5. Calcul des rendements ────────────────────────────────────────────────
h("5. RENDEMENTS MENSUELS (série brute USD)");
const sorted = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const rets: number[] = [];
let nonFinite = 0;
for (let i = 1; i < sorted.length; i++) {
  const r = sorted[i][1] / sorted[i - 1][1] - 1;
  if (!Number.isFinite(r)) nonFinite++;
  else rets.push(r);
}
const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
const variance = rets.reduce((s, v) => s + (v - mean) ** 2, 0) / (rets.length - 1);
const vol = Math.sqrt(variance);
const sortedRets = [...rets].sort((a, b) => a - b);
const cagr = (sorted[sorted.length - 1][1] / sorted[0][1]) ** (12 / (sorted.length - 1)) - 1;
line(`  observations de rendement     : ${rets.length} (non finies : ${nonFinite})`);
line(`  rendement mensuel moyen       : ${(mean * 100).toFixed(3)} %`);
line(`  volatilité mensuelle          : ${(vol * 100).toFixed(2)} %  → annualisée ${(vol * Math.sqrt(12) * 100).toFixed(1)} %`);
line(`  min / max mensuel             : ${(sortedRets[0] * 100).toFixed(1)} % / ${(sortedRets[sortedRets.length - 1] * 100).toFixed(1)} %`);
line(`  CAGR brut (USD, toute série)  : ${(cagr * 100).toFixed(2)} %/an`);
line(`  niveau initial / final        : ${sorted[0][1].toFixed(2)} (${sorted[0][0]}) → ${sorted[sorted.length - 1][1].toFixed(2)} (${sorted[sorted.length - 1][0]})`);

// ─── 6. Conversion USD → devise locale (contrôle) ────────────────────────────
h("6. CONVERSION USD → DEVISE LOCALE (contrôle EUR/JPY)");
const fxRates: any[] = await db.getFxRates();
const usdPerUnit = new Map<string, Map<string, number>>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
for (const cur of ["EUR", "JPY", "BRL"]) {
  const tgt = usdPerUnit.get(cur);
  if (!tgt) {
    line(`  ${cur} : pas de table FX`);
    continue;
  }
  const local = compute.convertCurrency(data, null, tgt); // USD → devise (native null = USD pivot)
  const lb = new Map<string, number>();
  for (const p of local) lb.set(p.date.slice(0, 7), p.value);
  const ls = [...lb.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const lcagr = ls.length > 1 ? (ls[ls.length - 1][1] / ls[0][1]) ** (12 / (ls.length - 1)) - 1 : NaN;
  line(`  ${cur} : ${ls.length} pts, CAGR local ${(lcagr * 100).toFixed(2)} %/an (vs USD ${(cagr * 100).toFixed(2)} %) — écart = effet devise`);
}

// ─── 7. Inventaire du SIGNAL MONDE ───────────────────────────────────────────
h("7. INVENTAIRE — séries candidates au SIGNAL MONDE (XX + oblig US)");
const series: any[] = await db.listSeries();
const xx = series.filter((s) => s.countryIso === "XX").sort((a, b) => a.class - b.class || a.type - b.type);
line("  Séries XX (globales) :");
for (const s of xx) {
  const d = await db.getSeriesData(s.id);
  const range = d.length ? `${d[0].date.slice(0, 7)}→${d[d.length - 1].date.slice(0, 7)} (${d.length})` : "vide";
  line(`    ${s.id.padEnd(28)} cl${s.class}/ty${s.type} ${(s.classFr + "/" + s.typeFr).padEnd(34)} ${s.currency.padEnd(4)} ${range}`);
}
// obligations 10Y candidates (class 4 type 2) pour l'axe monétaire Monde
line();
line("  Obligations 10Y (cl4/ty2) — candidat proxy Monde (US / DE / autres longues) :");
const bonds = series.filter((s) => s.class === 4 && s.type === 2 && /(?<!\d)10(?!\d)/.test(s.tickerName));
for (const s of bonds.filter((s) => ["US", "DE", "GB", "JP", "XX"].includes(s.countryIso))) {
  const d = await db.getSeriesData(s.id);
  const range = d.length ? `${d[0].date.slice(0, 7)}→${d[d.length - 1].date.slice(0, 7)} (${d.length})` : "vide";
  line(`    ${s.id.padEnd(28)} ${s.countryIso} ${s.currency.padEnd(4)} ${s.tickerName.padEnd(18)} ${range}`);
}

await pool?.end?.();
line();
line("✅ Audit terminé.");
