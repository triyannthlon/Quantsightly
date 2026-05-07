"use server";

import { findSeries, getSeriesData, type SeriesFilter, type SeriesMatch, type EconomicDataPoint } from "@/lib/coredata-db";

export interface LoadedSeries {
  match: SeriesMatch;
  data : EconomicDataPoint[];
}

export async function loadSeries(filter: SeriesFilter): Promise<LoadedSeries | { error: string }> {
  const matches = await findSeries(filter);

  if (matches.length === 0) return { error: "Aucune série trouvée pour ce filtre." };

  const match = matches[0];
  const data  = await getSeriesData(match.id);

  return { match, data };
}