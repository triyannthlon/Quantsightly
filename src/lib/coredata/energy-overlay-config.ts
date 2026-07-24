// Configuration Énergie — sélection de VARIANTE de la surcouche (réservée aux scripts).
//
// `QS_ENERGY_OVERLAY=off|trend-v1` → **N'EST PAS lu dans un chemin de requête PRODUIT.** La variante
// est un ARGUMENT EXPLICITE des services (`overlay: "off" | "trend-v1"`) : pages publiques = "off" ;
// onglet Énergie = "off" (variante de référence) & "trend-v1" (variante avec surcouche).
// `readEnergyOverlay` est conservé UNIQUEMENT pour les scripts / experiments / outils de concordance
// — jamais pour piloter une page.
//
// ⚠️ L'onglet Énergie est une fonctionnalité PUBLIQUE : sa visibilité ne dépend d'AUCUNE variable
// d'environnement. Le flag de gate historique a été supprimé lors de la mise en production ; aucun
// flag de remplacement n'existe.
//
// Config SERVEUR (pas de `NEXT_PUBLIC_`).

/** Version de la surcouche Énergie (interne). */
export type EnergyOverlayVersion = "off" | "trend-v1";

/** Défaut : surcouche désactivée (variante de référence). */
export const DEFAULT_ENERGY_OVERLAY: EnergyOverlayVersion = "off";

/**
 * ⚠️ RÉSERVÉ scripts / experiments / concordance — NE PAS appeler dans un chemin de requête
 * produit (la variante y est un argument explicite). Lit `QS_ENERGY_OVERLAY` ; toute valeur
 * autre que `"trend-v1"` (absente ou malformée) ⇒ `"off"` (sûr). Jamais dérivé d'un booléen.
 */
export function readEnergyOverlay(): EnergyOverlayVersion {
  return process.env.QS_ENERGY_OVERLAY?.trim() === "trend-v1" ? "trend-v1" : "off";
}
