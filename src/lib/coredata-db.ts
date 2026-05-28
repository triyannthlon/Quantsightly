import { Pool } from "pg";

const globalForCodedata = globalThis as unknown as { codedataPool?: Pool };

export const codedataPool = globalForCodedata.codedataPool ?? new Pool({ connectionString: process.env.CODEDATA_DATABASE_URL });

if (process.env.NODE_ENV !== "production") { globalForCodedata.codedataPool = codedataPool; }

export interface EconomicSeries {id          : string ;
                                 code        : string ;
                                 ccy         : string ;
                                 reversequote: boolean;
                                 name        : string ;
                                 type        : string ;
                                 class       : string ;
                                 sector      : string ;
                                 country     : string ;}

export interface EconomicDataPoint {serie_id: string       ;
                                    date    : Date         ;
                                    value   : number | null;}

export interface SeriesMatch {id  : string;
                              code: string;
                              name: string;
                              ccy : string;}

export interface SeriesFilter { country: string;
                                class  : string;
                                type   : string;
                                ccy   ?: string;} /* optionnel */


export interface HierarchyRow {country: string;
                               class  : string;
                               type   : string;
                               ccy    : string;}

const DISTINCT_COLUMNS = {type   : "type_fr"   ,
                          class  : "class_fr"  ,
                          country: "country_fr",
                          ccy    : "ccy"       ,} as const;

export type DistinctField = keyof typeof DISTINCT_COLUMNS;


/******************** findSeries *****/
export async function findSeries(filter: SeriesFilter): Promise<SeriesMatch[]>
       {//findSeries

       const params: string[] = [filter.country, filter.class, filter.type];

                                              let ccyClause = "";
       if (filter.ccy) { params.push(filter.ccy); ccyClause = `AND ccy = $${params.length}`; }

        const { rows } = await codedataPool.query<SeriesMatch>(`SELECT id, code, name_fr AS name, ccy
                                                                FROM economic_series
                                                                WHERE country_fr = $1
                                                                AND class_fr   = $2
                                                                AND type_fr    = $3
                                                                ${ccyClause}
                                                                ORDER BY code`, params);

         return rows;

       }//findSeries


/******************** getSeriesData *****/
export async function getSeriesData(seriesId: string): Promise<EconomicDataPoint[]>
       {//getSeriesData

       const { rows } = await codedataPool.query<EconomicDataPoint>(`SELECT serie_id, date, value
                                                                     FROM economic_data
                                                                     WHERE serie_id = $1
                                                                     ORDER BY date`, [seriesId]);
        return rows;

       }//getSeriesData


/******************** getHierarchyRows *****/
export async function getHierarchyRows(): Promise<HierarchyRow[]>
       {//getHierarchyRows

       const { rows } = await codedataPool.query<HierarchyRow>(`SELECT DISTINCT country_fr AS country,
                                                                                class_fr   AS class,
                                                                                type_fr    AS type,
                                                                                ccy
                                                                                FROM economic_series
                                                                                ORDER BY country_fr, class_fr, type_fr`);
        return rows;

       }//getHierarchyRows

/******************** getDistinctValues *****/
export async function getDistinctValues(field: DistinctField): Promise<string[]>
       {//getDistinctValues

                                                                                 const col = DISTINCT_COLUMNS[field];
       const { rows } = await codedataPool.query<{ value: string }>(`SELECT DISTINCT ${col} AS value FROM economic_series ORDER BY ${col}`);

        return rows.map(r => r.value);

       }//getDistinctValues