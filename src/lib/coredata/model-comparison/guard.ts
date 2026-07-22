// Garde « MOIS COURANT EXCLU » — CENTRALISÉE (une seule fois pour Browne ET le 4Q).
// Le moteur pur reste sans horloge : la couche service / page injecte le mois de
// référence. Dernière observation admissible = dernier mois civil ENTIÈREMENT
// clôturé (strictement antérieur au mois courant). Toute observation du mois courant
// est retirée AVANT l'appel au moteur, même si elle existe en base.

import type { EconomicDataPoint } from "../types";
import type { SharedComparisonInput } from "./registry";

/** Clé « YYYY-MM » d'une date ISO (ou d'une clé déjà mensuelle). */
const monthKey = (iso: string): string => iso.slice(0, 7);

/**
 * Retire les points appartenant au MOIS COURANT (`nowMonth`, ISO ou « YYYY-MM ») :
 * on ne garde que les mois strictement antérieurs. En janvier, le dernier mois
 * admissible est donc décembre de l'année précédente.
 */
export function excludeCurrentMonth(
  series: EconomicDataPoint[],
  nowMonth: string,
): EconomicDataPoint[] {
  const cur = monthKey(nowMonth);
  return series.filter((p) => monthKey(p.date) < cur);
}

/**
 * Applique la garde à TOUT l'input partagé (signal + perf) de façon centralisée →
 * Browne et le 4Q partagent exactement la même dernière date admissible. `nowMonth`
 * = mois de référence fourni par la couche service / page (le moteur reste pur).
 */
export function withCurrentMonthExcluded(
  shared: SharedComparisonInput,
  nowMonth: string,
): SharedComparisonInput {
  const cut = (s: EconomicDataPoint[]) => excludeCurrentMonth(s, nowMonth);
  const cutOpt = (s: EconomicDataPoint[] | undefined) => (s ? cut(s) : s);
  return {
    ...shared,
    signal: shared.signal
      ? {
          ...shared.signal,
          equityPrice: cut(shared.signal.equityPrice),
          oil: cut(shared.signal.oil),
          gold: cut(shared.signal.gold),
          bond: cut(shared.signal.bond),
          energyScore: cutOpt(shared.signal.energyScore),
        }
      : null,
    perf: {
      equityTotalReturn: cut(shared.perf.equityTotalReturn),
      bondTotalReturn: cut(shared.perf.bondTotalReturn),
      cashTotalReturn: cut(shared.perf.cashTotalReturn),
      gold: cut(shared.perf.gold),
      cpi: cutOpt(shared.perf.cpi),
    },
  };
}
