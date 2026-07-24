// Laboratoire Énergie — adaptateur PUR « Comportement pendant les crises ».
//
// Réutilise le calculateur de crises PARTAGÉ (`historical-stress/calculator.ts`, PUR) sans
// toucher à la section 4Q vs Browne (clôturée). Le calculateur est typé sur les identifiants
// de stratégie de la comparaison publique (`ComparisonStrategyId`) ; le labo ne compare pas
// des stratégies publiques mais DEUX variantes d'une même stratégie (socle vs socle + Énergie).
// On réutilise donc deux identifiants publics comme SIMPLES EMPLACEMENTS d'affichage opaques
// (jamais interprétés par le calculateur ni la section : ils ne servent que de clés stables pour
// les libellés/couleurs fournis par le labo). Aucun renommage d'identifiant moteur, aucune
// activation publique : cette structure n'existe que dans l'onglet interne gated.

import {
  buildHistoricalStressResults,
  type HistoricalStressStrategySeries,
} from "../../model-comparison/historical-stress/calculator";
import type {
  HistoricalCrisis,
  HistoricalCrisisResult,
} from "../../model-comparison/historical-stress/types";
import type { ComparisonStrategyId } from "../../model-comparison/types";
import type { EnergyLabComparison, EnergyVariantId } from "./lab";

/** Mode d'analyse du labo (comme les autres pages Modèles). */
export type EnergyLabMode = "nominal" | "real";

/**
 * Emplacements d'affichage (clés opaques) pour les DEUX colonnes du labo. Réutilise des
 * `ComparisonStrategyId` existants uniquement pour satisfaire le type du calculateur partagé :
 * ni le calculateur ni la section ne branchent sur la valeur — ce sont de simples clés pour
 * `labels`/`colors`. Les libellés et couleurs réels sont fournis par la vue du labo.
 */
export const LAB_CRISIS_SLOTS = {
  standard: "quadrants-dynamic-v2",
  energy: "quadrants-binary-v2",
} as const satisfies Record<EnergyVariantId, ComparisonStrategyId>;

const monthKey = (d: string): string => d.slice(0, 7);
const maxMonth = (a: string, b: string): string => (a >= b ? a : b);
const minMonth = (a: string, b: string): string => (a <= b ? a : b);

/**
 * Dérive les résultats de crises pour la comparaison socle vs socle + Énergie, dans le mode
 * choisi. RÉUTILISE les courbes NETTES base 100 déjà produites par le backtest (aucun recalcul)
 * et le calculateur PUR partagé. `null` si le mode demandé n'a pas de séries exploitables pour
 * les deux variantes (ex. réel sans CPI) — la vue affiche alors un message explicite.
 */
export function buildEnergyLabCrises(
  comparison: EnergyLabComparison,
  mode: EnergyLabMode,
  crises: readonly HistoricalCrisis[],
): HistoricalCrisisResult[] | null {
  const pick = (variant: EnergyLabComparison["standard"]) =>
    mode === "real" ? variant.backtest.series.real : variant.backtest.series.nominal;

  const standardLevels = pick(comparison.standard);
  const energyLevels = pick(comparison.energy);
  if (!standardLevels || !energyLevels || standardLevels.length < 2 || energyLevels.length < 2) {
    return null;
  }

  // Fenêtre commune (les deux variantes partagent l'historique du pays, mais on intersecte
  // par sécurité — jamais de crise mesurée hors de la zone couverte par les deux séries).
  const start = maxMonth(monthKey(standardLevels[0].date), monthKey(energyLevels[0].date));
  const end = minMonth(
    monthKey(standardLevels[standardLevels.length - 1].date),
    monthKey(energyLevels[energyLevels.length - 1].date),
  );

  const strategies: HistoricalStressStrategySeries[] = [
    { strategyId: LAB_CRISIS_SLOTS.standard, available: true, levels: standardLevels },
    { strategyId: LAB_CRISIS_SLOTS.energy, available: true, levels: energyLevels },
  ];

  return buildHistoricalStressResults({ window: { start, end }, strategies, crises });
}
