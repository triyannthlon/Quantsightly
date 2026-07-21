// Version méthodologique du modèle « 4 Quadrants ».
//
// ⚠️ Paramètre GLOBAL, interne, NON exposé à l'interface utilisateur. Ce n'est pas
// un réglage : c'est le choix de méthodologie du modèle de référence.
//
//  • `v1` (`4q-standard-v1`) — comportement historique : réallocation pleine à
//    chaque mois vers la cible du signal (aucune bande).
//  • `v2` (`4q-standard-v2`) — même moteur + BANDE DE RÉALLOCATION `δ = 5 points` :
//    on conserve les poids détenus tant que la rotation-vers-cible reste ≤ 5 %,
//    sinon on réalloue intégralement. Amélioration d'EFFICIENCE / de COÛTS
//    (moins de réallocations à performance nette égale ou meilleure), démontrée
//    robuste sur 22 pays × 4 horizons (cf. `experiments/4q-stabilisation/`).
//
// La bande est une propriété d'EXÉCUTION appliquée dans le backtest (après la cible
// du mois `t`, avant `t+1`). Les coûts de transaction NE font PAS partie de la règle
// et ne sont jamais codés en dur dans le moteur : ils restent une hypothèse de
// simulation appliquée à la rotation réellement exécutée.

/** Version méthodologique du modèle de référence. */
export type ModelVersion = "v1" | "v2";

/** δ de la bande v2, en POINTS de portefeuille (documentaire). */
export const DELTA_V2_POINTS = 5;

/**
 * Bande de réallocation par version, en FRACTION de rotation (½·Σ|cible − détenu|).
 * `null` = aucune bande (réallocation pleine, comportement v1). δ=5 pts ⇔ 0.05.
 */
export const REALLOCATION_BAND: Record<ModelVersion, number | null> = {
  v1: null,
  v2: DELTA_V2_POINTS / 100,
};

/** Version de référence par défaut du produit (inchangée tant que v2 n'est pas publiée). */
export const DEFAULT_MODEL_VERSION: ModelVersion = "v1";
