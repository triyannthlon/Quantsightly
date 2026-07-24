"use server";

import {
  getCountryQuadrantModel,
  computeAllCountryQuadrantModels,
  computeQuadrantsRealSeries,
  computeModelComparisonForCountry,
  type BrowneComparisonOptions,
} from "@/lib/coredata/four-quadrants-service";
import { listHistoricalCrises } from "@/lib/coredata/model-comparison/historical-stress/repository";
import { historicalStressFromComparison } from "@/lib/coredata/model-comparison/historical-stress/calculator";
import type { FourQuadrantsModelSettings } from "@/lib/coredata/four-quadrants";
import { ACTIVE_MODEL_VERSION } from "./model-version-active";

/** Charge les séries brutes (signal + perf) + config d'un pays (recalcul client-side du 4Q). */
export async function loadCountryQuadrantModel(iso: string) {
  // overlay "off" EXPLICITE : page publique → toujours socle 4q-standard-v2 (jamais l'ambiant).
  const m = await getCountryQuadrantModel(iso, undefined, undefined, "off");
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
  // Comparaison pays PUBLIQUE → overlay "off" explicite (jamais d'énergie ambiante).
  return computeAllCountryQuadrantModels(settings, years, ACTIVE_MODEL_VERSION, "off");
}

/** Séries réelles (base 100) de 2–5 pays pour le comparateur multi-pays de vs Actions. */
export async function loadQuadrantsRealSeries(
  codes: string[],
  settings: FourQuadrantsModelSettings,
  years: number | null,
) {
  // vs Actions PUBLIQUE → overlay "off" explicite (jamais d'énergie ambiante).
  return computeQuadrantsRealSeries(codes, settings, years, ACTIVE_MODEL_VERSION, "off");
}

/**
 * Comparaison « 4Q vs Browne » d'un pays (calcul SERVEUR : le moteur reste hors du
 * bundle client). Renvoie la version nette de coûts + la version brute (0 bps) + les
 * résultats de la section « crises » (dérivés de la version NETTE, sans double calcul :
 * mêmes fenêtre / mode / coûts). `null` si le pays n'a pas de comparaison exploitable.
 */
export async function loadModelComparison(countryCode: string, opts: BrowneComparisonOptions) {
  // vs Browne PUBLIQUE → overlay "off" explicite (jamais d'énergie ambiante).
  const comparison = await computeModelComparisonForCountry(
    countryCode,
    opts,
    ACTIVE_MODEL_VERSION,
    "off",
  );
  if (!comparison) return null;
  const crises = await listHistoricalCrises();
  const crisisResults = historicalStressFromComparison(comparison.net, crises);
  return { net: comparison.net, gross: comparison.gross, crisisResults };
}
