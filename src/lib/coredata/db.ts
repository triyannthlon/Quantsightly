import { Pool } from "pg";
import type {
  ClassRef,
  TypeRef,
  SectorRef,
  CoredataCountry,
  ReferenceData,
  EconomicSeries,
  EconomicDataPoint,
  FxRate,
  RefLabel,
} from "./types";

// Pool singleton — réutilisé entre les hot-reloads en dev (évite d'épuiser les
// connexions Postgres à chaque rechargement de module).
const globalForCoredata = globalThis as unknown as { coredataPool?: Pool };

export const coredataPool =
  globalForCoredata.coredataPool ??
  new Pool({ connectionString: process.env.CODEDATA_DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForCoredata.coredataPool = coredataPool;
}

// ─── Nomenclatures (tables de référence) ────────────────────────────────────

interface RefRow {
  reference: number;
  name_fr: string;
  name_en: string;
}

interface CountryRow {
  iso: string;
  name_fr: string;
  name_en: string;
  currency: string;
  reverse: boolean;
  days_basis: number | null;
}

function mapRef<R extends number>(r: RefRow): RefLabel<R> {
  return { reference: r.reference as R, nameFr: r.name_fr, nameEn: r.name_en };
}

function mapCountry(r: CountryRow): CoredataCountry {
  return {
    iso: r.iso.trim(),
    nameFr: r.name_fr,
    nameEn: r.name_en,
    currency: r.currency?.trim() ?? "",
    reverse: r.reverse,
    daysBasis: r.days_basis,
  };
}

/** Charge les 4 tables de nomenclature en une passe. */
export async function getReferenceData(): Promise<ReferenceData> {
  const [classes, types, sectors, countries] = await Promise.all([
    coredataPool.query<RefRow>("SELECT reference, name_fr, name_en FROM classes ORDER BY reference"),
    coredataPool.query<RefRow>("SELECT reference, name_fr, name_en FROM types ORDER BY reference"),
    coredataPool.query<RefRow>("SELECT reference, name_fr, name_en FROM sectors ORDER BY reference"),
    coredataPool.query<CountryRow>(
      "SELECT TRIM(iso) AS iso, name_fr, name_en, currency, reverse, days_basis FROM countries ORDER BY name_fr",
    ),
  ]);

  return {
    classes: classes.rows.map(mapRef<ClassRef>),
    types: types.rows.map(mapRef<TypeRef>),
    sectors: sectors.rows.map(mapRef<SectorRef>),
    countries: countries.rows.map(mapCountry),
  };
}

// ─── Séries ─────────────────────────────────────────────────────────────────

interface SeriesRow {
  id: string;
  ticker_name: string;
  country_iso: string;
  currency: string;
  class: number;
  type: number;
  sector: number | null;
  class_fr: string;
  type_fr: string;
  sector_fr: string | null;
  country_fr: string | null;
  country_reverse: boolean | null;
}

function mapSeries(r: SeriesRow): EconomicSeries {
  return {
    id: r.id,
    tickerName: r.ticker_name,
    countryIso: r.country_iso?.trim() ?? "",
    currency: r.currency?.trim() ?? "",
    class: r.class as ClassRef,
    type: r.type as TypeRef,
    sector: (r.sector as SectorRef | null) ?? null,
    classFr: r.class_fr,
    typeFr: r.type_fr,
    sectorFr: r.sector_fr,
    countryFr: r.country_fr,
    countryReverse: r.country_reverse,
  };
}

const SERIES_SELECT = `
  SELECT
    s.id,
    s.ticker_name,
    TRIM(s.country_iso) AS country_iso,
    TRIM(s.currency)    AS currency,
    s.class,
    s.type,
    s.sector,
    c.name_fr   AS class_fr,
    t.name_fr   AS type_fr,
    sec.name_fr AS sector_fr,
    co.name_fr  AS country_fr,
    co.reverse  AS country_reverse
  FROM economic_series s
  JOIN classes c        ON c.reference = s.class
  JOIN types t          ON t.reference = s.type
  LEFT JOIN sectors sec ON sec.reference = s.sector
  LEFT JOIN countries co ON TRIM(co.iso) = TRIM(s.country_iso)
`;

/**
 * Liste de toutes les séries enrichies de leurs libellés FR. Le catalogue est
 * petit (~360 lignes) : on le charge en entier et la cascade de sélection
 * (classe → type → pays → devise → série) est dérivée côté client.
 */
export async function listSeries(): Promise<EconomicSeries[]> {
  const { rows } = await coredataPool.query<SeriesRow>(
    `${SERIES_SELECT} ORDER BY c.name_fr, t.name_fr, co.name_fr, s.id`,
  );
  return rows.map(mapSeries);
}

/** Récupère une série précise par son identifiant. */
export async function getSeriesById(serieId: string): Promise<EconomicSeries | null> {
  const { rows } = await coredataPool.query<SeriesRow>(`${SERIES_SELECT} WHERE s.id = $1`, [serieId]);
  return rows.length ? mapSeries(rows[0]) : null;
}

// ─── Données temporelles ────────────────────────────────────────────────────

interface DataRow {
  date: string;
  value: number;
}

/**
 * Série temporelle d'une série donnée, triée par date croissante.
 * `date` est renvoyée en chaîne ISO `YYYY-MM-DD` (cast SQL) pour éviter toute
 * dérive de fuseau horaire ; `value` est convertie en nombre flottant.
 */
export async function getSeriesData(serieId: string): Promise<EconomicDataPoint[]> {
  const { rows } = await coredataPool.query<DataRow>(
    `SELECT to_char(date, 'YYYY-MM-DD') AS date, value::float8 AS value
     FROM economic_data
     WHERE serie_id = $1
     ORDER BY date`,
    [serieId],
  );
  return rows.map((r) => ({ date: r.date, value: r.value }));
}

// ─── Taux de change (pour la conversion de devise) ──────────────────────────

interface FxIdRow {
  currency: string;
  id: string;
  reverse: boolean;
}

interface FxDataRow {
  serie_id: string;
  date: string;
  value: number;
}

/**
 * Une série FX spot (classe 2, type 7) par devise, avec son flag `reverse` et
 * son historique. Sert à convertir n'importe quelle série dans une devise cible
 * (via le pivot USD). USD n'a pas d'entrée — c'est le pivot (facteur 1).
 */
export async function getFxRates(): Promise<FxRate[]> {
  const { rows: idRows } = await coredataPool.query<FxIdRow>(
    `SELECT DISTINCT ON (TRIM(s.currency))
       TRIM(s.currency) AS currency, s.id, co.reverse
     FROM economic_series s
     LEFT JOIN countries co ON TRIM(co.iso) = TRIM(s.country_iso)
     WHERE s.class = 2 AND s.type = 7
     ORDER BY TRIM(s.currency), s.id`,
  );

  const ids = idRows.map((r) => r.id);
  if (ids.length === 0) return [];

  const { rows: dataRows } = await coredataPool.query<FxDataRow>(
    `SELECT serie_id, to_char(date, 'YYYY-MM-DD') AS date, value::float8 AS value
     FROM economic_data
     WHERE serie_id = ANY($1)
     ORDER BY serie_id, date`,
    [ids],
  );

  const byId = new Map<string, EconomicDataPoint[]>();
  for (const r of dataRows) {
    let arr = byId.get(r.serie_id);
    if (!arr) {
      arr = [];
      byId.set(r.serie_id, arr);
    }
    arr.push({ date: r.date, value: r.value });
  }

  return idRows.map((r) => ({
    currency: r.currency,
    reverse: r.reverse,
    data: byId.get(r.id) ?? [],
  }));
}
