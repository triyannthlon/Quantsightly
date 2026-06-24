// Namespace coredata — accès à la base `coredatadb` (indicateurs économiques)
// et algèbre d'autorisation des opérations de la page Exploration.

export * from "./types";
export * from "./authorization";
export * from "./compute";
export {
  coredataPool,
  getReferenceData,
  listSeries,
  getSeriesById,
  getSeriesData,
  getFxRates,
} from "./db";
