"use server";

import {
  getCountryBrowne,
  type CountryBrowneConfig,
  type BrowneDataQuality,
} from "@/lib/coredata/browne-service";
import type { ComputeBrowneInput } from "@/lib/coredata/browne";

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
