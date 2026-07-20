"use server";

import {
  getCountryQuadrantModel,
  computeAllCountryQuadrantModels,
} from "@/lib/coredata/four-quadrants-service";
import type { FourQuadrantsModelSettings } from "@/lib/coredata/four-quadrants";

/** Charge les séries brutes (signal + perf) + config d'un pays (recalcul client-side du 4Q). */
export async function loadCountryQuadrantModel(iso: string) {
  const m = await getCountryQuadrantModel(iso);
  return {
    config: m.config,
    dataQuality: m.dataQuality,
    signal: m.signal,
    perf: m.perf,
  };
}

/**
 * Comparaison de tous les pays sous les mêmes paramètres (stratégie + zone neutre)
 * et la même fenêtre `years`. Régime/allocation sur historique complet ; perfs,
 * risques et rotation sur la fenêtre. Ne renvoie que les lignes (aucune série).
 */
export async function loadQuadrantComparison(
  settings: FourQuadrantsModelSettings,
  years: number | null,
) {
  return computeAllCountryQuadrantModels(settings, years);
}
