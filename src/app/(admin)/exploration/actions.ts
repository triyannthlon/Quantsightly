"use server";

import { getSeriesData, type EconomicDataPoint } from "@/lib/coredata";

/** Charge la série temporelle brute d'une série du catalogue coredata. */
export async function loadSeriesData(serieId: string): Promise<EconomicDataPoint[]> {
  return getSeriesData(serieId);
}
