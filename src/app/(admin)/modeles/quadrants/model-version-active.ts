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

// Le flag peut FORCER une version (`v1` ou `v2`) ; absent → défaut du produit.
// ⇒ **retour global à v1** = déployer avec `NEXT_PUBLIC_QS_MODEL_VERSION=v1` (aucun code à changer).
const forced: ModelVersion | null = raw === "v1" || raw === "v2" ? raw : null;

/** Version méthodologique ACTIVE (défaut produit = v2 ; surchargeable par le flag). */
export const ACTIVE_MODEL_VERSION: ModelVersion = forced ?? DEFAULT_MODEL_VERSION;

/** Bande de réallocation active (fraction ; `null` en v1) — pour le recalcul client. */
export const ACTIVE_REALLOCATION_BAND = REALLOCATION_BAND[ACTIVE_MODEL_VERSION];

/**
 * Sélecteur de CONTENU spécifique v2 (Méthodologie, Composition « détenu vs cible »).
 * Suit la **version active**, PAS le staging : lorsque v2 deviendra le socle de production,
 * la formulation « réallocation conditionnelle » restera affichée sans le flag.
 */
export const IS_MODEL_V2 = ACTIVE_MODEL_VERSION === "v2";

/**
 * Mention interne de RECETTE : v2 active alors que la production par défaut est encore v1
 * (⇒ on a forcé v2 par le flag). Disparaît automatiquement quand v2 devient le défaut.
 */
export const IS_STAGING_V2 = IS_MODEL_V2 && DEFAULT_MODEL_VERSION !== "v2";
