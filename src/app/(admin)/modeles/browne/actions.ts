"use server";

import {
  getCountryBrowne,
  computeBrowneComparison,
  computeBrowneRealSeries,
  type CountryBrowneConfig,
  type BrowneDataQuality,
  type BrowneComparisonRow,
  type BrowneRealSeries,
} from "@/lib/coredata/browne-service";
import type { ComputeBrowneInput, RebalanceFrequency } from "@/lib/coredata/browne";

export interface BrowneCountryPayload {
  config: CountryBrowneConfig | null;
  dataQuality: BrowneDataQuality;
  /** Séries locales prêtes pour un recalcul côté client. */
  input: ComputeBrowneInput | null;
}

/**
 * Charge les données Browne d'un pays (config + qualité + séries locales) au
 * changement de pays. Le `result` calculé côté serveur est ignoré : le client
 * recalcule à partir de `input` (rééquilibrage/période instantanés).
 */
export async function loadCountryBrowne(country: string): Promise<BrowneCountryPayload> {
  const r = await getCountryBrowne(country);
  return { config: r.config, dataQuality: r.dataQuality, input: r.input };
}

/**
 * Comparaison des pays sous les mêmes paramètres (rééquilibrage + période).
 * `years` = null (MAX) / 20 / 10 / 5. Ne renvoie que des métriques légères.
 */
export async function loadBrowneComparison(
  rebalance: RebalanceFrequency,
  years: number | null,
): Promise<BrowneComparisonRow[]> {
  return computeBrowneComparison(rebalance, years);
}

/** Séries réelles (base 100) des pays sélectionnés — comparateur multi-pays. */
export async function loadBrowneRealSeries(
  codes: string[],
  rebalance: RebalanceFrequency,
  years: number | null,
): Promise<BrowneRealSeries[]> {
  return computeBrowneRealSeries(codes, rebalance, years);
}
