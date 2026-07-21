// Audit Énergie 0 — LECTURE SEULE sur coredatadb. Aucun écrit, aucune modif modèle.
// Lance : pnpm exec node scripts/energie-0-audit.mjs   (charge .env manuellement)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = readFileSync(path.join(root, ".env"), "utf8");
const line = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="));
const url = line.slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
process.env.CODEDATA_DATABASE_URL = url;

const { default: pg } = await import("pg");
const pool = new pg.Pool({ connectionString: url });

const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

const sep = (t) => console.log("\n" + "═".repeat(78) + "\n" + t + "\n" + "═".repeat(78));

// Trous mensuels : dates distinctes YYYY-MM entre premier et dernier mois.
function monthGaps(dates) {
  const months = [...new Set(dates.map((d) => new Date(d).toISOString().slice(0, 7)))].sort();
  if (months.length < 2) return { months: months.length, gaps: [] };
  const gaps = [];
  const [y0, m0] = months[0].split("-").map(Number);
  const [y1, m1] = months[months.length - 1].split("-").map(Number);
  const expected = (y1 - y0) * 12 + (m1 - m0) + 1;
  const set = new Set(months);
  let y = y0, m = m0;
  for (let i = 0; i < expected; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!set.has(key)) gaps.push(key);
    m++; if (m > 12) { m = 1; y++; }
  }
  return { first: months[0], last: months[months.length - 1], distinctMonths: months.length, expected, missing: gaps.length, gapsSample: gaps.slice(0, 24) };
}

// ── 0. Réf secteurs (confirmer secteur 10 = énergie) ─────────────────────────
sep("0. Table sectors (réf)");
console.table(await q(`SELECT reference, name_fr, name_en FROM sectors ORDER BY reference`));

// ── 1. Pétrole signal + toutes les matières premières (class 5) ──────────────
sep("1. Matières premières (class 5) — métadonnées + profondeur");
const commodities = await q(`
  SELECT s.id, s.bbg_ticker, s.bbg_field, s.ticker_name, s.country_iso, s.currency,
         s."class", s."type", s.sector, s.operation,
         count(d.value) AS n, min(d.date) AS first, max(d.date) AS last
  FROM economic_series s LEFT JOIN economic_data d ON d.serie_id = s.id
  WHERE s."class" = 5
  GROUP BY s.id, s.bbg_ticker, s.bbg_field, s.ticker_name, s.country_iso, s.currency, s."class", s."type", s.sector, s.operation
  ORDER BY s.bbg_ticker, s."type"`);
console.table(commodities.map((r) => ({ id: r.id, ticker: r.bbg_ticker, field: r.bbg_field, name: r.ticker_name, cur: r.currency, type: r.type, sector: r.sector, op: r.operation, n: r.n, first: r.first && new Date(r.first).toISOString().slice(0,10), last: r.last && new Date(r.last).toISOString().slice(0,10) })));

// ── 2. Indices MSCI World & sous-indices sectoriels (bbg MXWO*) ──────────────
sep("2. MSCI World & sous-indices sectoriels (bbg_ticker LIKE 'MXWO%')");
const msci = await q(`
  SELECT s.id, s.bbg_ticker, s.bbg_field, s.ticker_name, s.country_iso, s.currency,
         s."class", s."type", s.sector, s.operation,
         count(d.value) AS n, min(d.date) AS first, max(d.date) AS last
  FROM economic_series s LEFT JOIN economic_data d ON d.serie_id = s.id
  WHERE s.bbg_ticker ILIKE 'MXWO%'
  GROUP BY s.id, s.bbg_ticker, s.bbg_field, s.ticker_name, s.country_iso, s.currency, s."class", s."type", s.sector, s.operation
  ORDER BY s.bbg_ticker, s."type"`);
console.table(msci.map((r) => ({ id: r.id, ticker: r.bbg_ticker, name: r.ticker_name, cur: r.currency, cls: r.class, type: r.type, sector: r.sector, n: r.n, first: r.first && new Date(r.first).toISOString().slice(0,10), last: r.last && new Date(r.last).toISOString().slice(0,10) })));

// ── 3. Recherche large « énergie / energy / oil / brent » ────────────────────
sep("3. Recherche large énergie/oil/brent/gas (ticker_name ou bbg_ticker)");
const energyLike = await q(`
  SELECT s.id, s.bbg_ticker, s.ticker_name, s.country_iso, s.currency, s."class", s."type", s.sector,
         count(d.value) AS n, min(d.date) AS first, max(d.date) AS last
  FROM economic_series s LEFT JOIN economic_data d ON d.serie_id = s.id
  WHERE s.ticker_name ILIKE '%energ%' OR s.ticker_name ILIKE '%oil%' OR s.ticker_name ILIKE '%brent%'
     OR s.ticker_name ILIKE '%gas%' OR s.bbg_ticker ILIKE '%CL%comdty%' OR s.bbg_ticker ILIKE '%CO%comdty%'
     OR s.bbg_ticker ILIKE '%0EN%'
  GROUP BY s.id, s.bbg_ticker, s.ticker_name, s.country_iso, s.currency, s."class", s."type", s.sector
  ORDER BY s.bbg_ticker`);
console.table(energyLike.map((r) => ({ id: r.id, ticker: r.bbg_ticker, name: r.ticker_name, iso: r.country_iso, cur: r.currency, cls: r.class, type: r.type, sector: r.sector, n: r.n, first: r.first && new Date(r.first).toISOString().slice(0,10), last: r.last && new Date(r.last).toISOString().slice(0,10) })));

// ── 4. Trous mensuels des séries clés ────────────────────────────────────────
sep("4. Continuité mensuelle des séries clés");
for (const id of ["CL1 comdty-XX-5-1", "MXWO0EN Index-XX-1-1", "MXWO0EN Index-XX-1-2", "XAU Comdty-XX-5-1"]) {
  const rows = await q(`SELECT date FROM economic_data WHERE serie_id = $1 ORDER BY date`, [id]);
  if (!rows.length) { console.log(`  ${id} : ABSENTE ou vide`); continue; }
  const g = monthGaps(rows.map((r) => r.date));
  console.log(`  ${id} : ${g.first}→${g.last} | ${g.distinctMonths} mois distincts / ${g.expected} attendus | trous=${g.missing}`);
  if (g.missing) console.log(`      trous (échantillon) : ${g.gapsSample.join(", ")}`);
}

// ── 5. Un indice Énergie existe-t-il par PAYS (pas seulement XX) ? ────────────
sep("5. Y a-t-il des indices actions sectoriels par pays (sector=10) ?");
const sectorByCountry = await q(`
  SELECT country_iso, "class", "type", count(*) AS n, string_agg(DISTINCT bbg_ticker, ', ') AS tickers
  FROM economic_series WHERE sector = 10 GROUP BY country_iso, "class", "type" ORDER BY country_iso`);
console.table(sectorByCountry);

await pool.end();
console.log("\n✅ Audit terminé (lecture seule).");
