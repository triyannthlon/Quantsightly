import type { OperationKind } from "@/lib/coredata/types";

/**
 * Config d'un graphique de comparaison épinglé : tout ce qu'il faut pour le
 * reconstruire (sérialisée en JSON dans `SavedComparator.config`).
 */
export interface ComparisonConfig {
  serieAId: string;
  serieBId?: string;
  operation: OperationKind;
  currencyA?: string;
  currencyB?: string;
  showMA: boolean;
  maYears: number;
  from?: string;
  to?: string;
}

/** Comparaison épinglée telle que renvoyée par l'API. */
export interface SavedComparison {
  id: string;
  title: string;
  config: ComparisonConfig;
}
