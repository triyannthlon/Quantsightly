"use server";

import { getCountryQuadrantModel } from "@/lib/coredata/four-quadrants-service";

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
