// Glue SERVEUR de la section « Comportement pendant les crises ». ⚠️ Module SERVEUR :
// tire `four-quadrants-service` (→ pool pg). Ne pas importer côté client.
//
// Résout la fenêtre commune / la période / le mode / les coûts / le dernier mois clôturé
// en RÉUTILISANT le moteur de comparaison (`computeModelComparisonForCountry`, qui exclut
// déjà le mois courant via l'horloge serveur), puis mesure chaque épisode. Aucun calcul
// de Browne ni de `4q-standard-v2` n'est refait : on consomme les séries déjà produites.

import {
  computeModelComparisonForCountry,
  type BrowneComparisonOptions,
} from "../../four-quadrants-service";
import { historicalStressFromComparison } from "./calculator";
import { listHistoricalCrises } from "./repository";
import type { ComparisonMode, ModelComparisonResult } from "../types";
import type { HistoricalCrisisResult } from "./types";

export interface HistoricalStressResult {
  countryCode: string;
  mode: ComparisonMode;
  /** Hypothèse de coûts appliquée (bps), identique à la comparaison. */
  costBps: number;
  /** Fenêtre commune retenue (`null` si aucune comparaison possible). */
  window: ModelComparisonResult["window"];
  /** Épisodes retenus par la période, ordre `display_order`. */
  crises: HistoricalCrisisResult[];
}

/**
 * Comportement des stratégies pendant les crises pour UN pays, CÔTÉ SERVEUR. Les bornes
 * (fenêtre commune, dernier mois clôturé, période) proviennent de la comparaison ; la
 * section n'ajoute qu'un découpage par épisode. `null` si le pays n'a pas de comparaison.
 */
export async function computeHistoricalStressForCountry(
  countryCode: string,
  opts: BrowneComparisonOptions,
): Promise<HistoricalStressResult | null> {
  const comparison = await computeModelComparisonForCountry(countryCode, opts);
  if (!comparison) return null;

  const net = comparison.net;
  const crises = await listHistoricalCrises();

  return {
    countryCode,
    mode: net.mode,
    costBps: net.costBps,
    window: net.window,
    crises: historicalStressFromComparison(net, crises),
  };
}
