// Accès base des crises historiques (LECTURE SEULE). ⚠️ Module SERVEUR : importe le pool
// pg de coredata — ne jamais l'importer côté client. La source de vérité est la table
// `economic_crises` ; on lit la vue `economic_crises_effective` qui ajoute
// `effective_end_date` (borne provisoire des épisodes en cours, résolue côté base).
//
// Les colonnes `date` sont renvoyées via `to_char(..., 'YYYY-MM-DD')` — même précaution
// que `db.ts` : le driver pg mappe sinon `date` vers un `Date` JS et décale le fuseau.

import { coredataPool } from "../../db";
import type {
  HistoricalCrisis,
  HistoricalCrisisCategory,
  HistoricalCrisisImportance,
  HistoricalCrisisStatus,
} from "./types";

interface CrisisRow {
  id: string;
  name_fr: string;
  definition_fr: string;
  start_date: string;
  end_date: string | null;
  effective_end_date: string;
  category: string;
  status: string;
  importance: string;
  include_in_aggregates: boolean;
  display_order: number;
}

const CRISES_SELECT = `
  SELECT
    id,
    name_fr,
    definition_fr,
    to_char(start_date, 'YYYY-MM-DD')          AS start_date,
    to_char(end_date, 'YYYY-MM-DD')            AS end_date,
    to_char(effective_end_date, 'YYYY-MM-DD')  AS effective_end_date,
    category,
    status,
    importance,
    include_in_aggregates,
    display_order
  FROM economic_crises_effective
  ORDER BY display_order
`;

function mapCrisis(r: CrisisRow): HistoricalCrisis {
  return {
    id: r.id,
    name: r.name_fr,
    definition: r.definition_fr,
    startDate: r.start_date,
    endDate: r.end_date,
    effectiveEndDate: r.effective_end_date,
    category: r.category as HistoricalCrisisCategory,
    status: r.status as HistoricalCrisisStatus,
    importance: r.importance as HistoricalCrisisImportance,
    includeInAggregates: r.include_in_aggregates,
    displayOrder: r.display_order,
  };
}

/** Registre complet des crises (ordre `display_order`), bornes effectives incluses. */
export async function listHistoricalCrises(): Promise<HistoricalCrisis[]> {
  const { rows } = await coredataPool.query<CrisisRow>(CRISES_SELECT);
  return rows.map(mapCrisis);
}
