// STAGING / RECETTE v2-rc1 — sélectionne la version méthodologique ACTIVE du module
// 4 Quadrants via `NEXT_PUBLIC_QS_MODEL_VERSION` (dev/staging uniquement).
//   • absent (production)        → v1 (comportement historique, inchangé) ;
//   • "v2"                       → 4q-standard-v2 (bande de réallocation).
//
// Source UNIQUE partagée par le recalcul CLIENT (quadrants-view) et les actions
// SERVEUR (comparaison / multi-pays) : impossible de mélanger v1 et v2 dans une même
// vue. ⚠️ INTERNE : ne jamais exposer le seuil/formule de la bande à l'utilisateur ;
// ce fichier ne fait que choisir une version, il ne publie aucun paramètre.
import {
  REALLOCATION_BAND,
  DEFAULT_MODEL_VERSION,
  type ModelVersion,
} from "@/lib/coredata/four-quadrants";

const raw = process.env.NEXT_PUBLIC_QS_MODEL_VERSION;

/** Version méthodologique active (défaut = production v1). */
export const ACTIVE_MODEL_VERSION: ModelVersion = raw === "v2" ? "v2" : DEFAULT_MODEL_VERSION;

/** Bande de réallocation active (fraction ; `null` en v1) — pour le recalcul client. */
export const ACTIVE_REALLOCATION_BAND = REALLOCATION_BAND[ACTIVE_MODEL_VERSION];

/** Vrai en recette v2 (affiche la mention interne de staging). */
export const IS_STAGING_V2 = ACTIVE_MODEL_VERSION === "v2";
