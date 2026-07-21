// Configuration de la surcouche Énergie — SOURCE UNIQUE de lecture de `QS_ENERGY_OVERLAY`.
//
// Choix méthodologique de BUILD (pas un réglage utilisateur) : changer la valeur exige un
// rebuild + redéploiement. Configuration SERVEUR (pas de préfixe `NEXT_PUBLIC_` à cette
// étape moteur — l'UI cliente lira une valeur transmise explicitement par le serveur en
// étape 2). On expose un enum interne, jamais un booléen ambigu.
//
//   QS_ENERGY_OVERLAY=off        → socle `4q-standard-v2` (défaut, rollback)
//   QS_ENERGY_OVERLAY=trend-v1   → surcouche figée `energy-trend-v1` (Dynamique + Binaire)

/** Version de la surcouche Énergie (interne). */
export type EnergyOverlayVersion = "off" | "trend-v1";

/** Défaut PRODUCTION : surcouche désactivée (public = v2, rollback). */
export const DEFAULT_ENERGY_OVERLAY: EnergyOverlayVersion = "off";

/**
 * Lit `QS_ENERGY_OVERLAY`. Toute valeur autre que `"trend-v1"` (y compris absente ou
 * malformée) ⇒ `"off"` (sûr par défaut). Ne jamais dériver d'un booléen.
 */
export function readEnergyOverlay(): EnergyOverlayVersion {
  return process.env.QS_ENERGY_OVERLAY?.trim() === "trend-v1" ? "trend-v1" : "off";
}
