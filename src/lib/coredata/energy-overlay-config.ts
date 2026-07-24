// Configuration Énergie — DEUX flags SÉPARÉS (séparation stricte visibilité ≠ calcul) :
//
//   1. `QS_ENERGY_LAB_ENABLED=off|on` (gate UI SEUL) → visibilité de l'onglet interne
//      « Énergie » (labo staging). **Ne participe à AUCUN calcul de portefeuille.**
//
//   2. `QS_ENERGY_OVERLAY=off|trend-v1` (sélection de variante) → **N'EST PLUS lu dans un chemin
//      de requête PRODUIT.** La variante est désormais un ARGUMENT EXPLICITE des services
//      (`overlay: "off" | "trend-v1"`) : pages publiques = "off", labo = "off" & "trend-v1".
//      `readEnergyOverlay` est conservé UNIQUEMENT pour les scripts / experiments / outils de
//      concordance — jamais pour piloter une page.
//
// Config SERVEUR (pas de `NEXT_PUBLIC_` ; l'UI reçoit une valeur transmise par le serveur).

/** Version de la surcouche Énergie (interne). */
export type EnergyOverlayVersion = "off" | "trend-v1";

/** Défaut PRODUCTION : surcouche désactivée (public = v2, rollback). */
export const DEFAULT_ENERGY_OVERLAY: EnergyOverlayVersion = "off";

/**
 * ⚠️ RÉSERVÉ scripts / experiments / concordance — NE PAS appeler dans un chemin de requête
 * produit (la variante y est un argument explicite). Lit `QS_ENERGY_OVERLAY` ; toute valeur
 * autre que `"trend-v1"` (absente ou malformée) ⇒ `"off"` (sûr). Jamais dérivé d'un booléen.
 */
export function readEnergyOverlay(): EnergyOverlayVersion {
  return process.env.QS_ENERGY_OVERLAY?.trim() === "trend-v1" ? "trend-v1" : "off";
}

/**
 * Gate UI du laboratoire Énergie (staging). `on` ⇒ l'onglet interne « Énergie » est visible et
 * sa route accessible. **Ne participe à AUCUN calcul de portefeuille** : ouvrir le labo ne change
 * jamais les pages publiques (qui utilisent toujours `overlay: "off"` explicitement). Défaut `off`.
 */
export function readEnergyLabEnabled(): boolean {
  return process.env.QS_ENERGY_LAB_ENABLED?.trim() === "on";
}
