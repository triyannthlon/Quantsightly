// Module macro « 4 Quadrants » (portefeuille MODÈLE) — types partagés de la
// couche domaine PURE. Deux stratégies d'allocation (binaire, dynamique DQAE)
// bâties sur les MÊMES coordonnées normalisées `x, y ∈ [-100, +100]` :
//   x — activité / efficacité énergétique  (ln(actions_prix / pétrole))
//   y — inflation / qualité de la monnaie   (ln(or / oblig 10 ans TR), convention directe)
// La normalisation est un « écart normalisé robuste à la moyenne mobile 7 ans »
// (cf. `robust-normalization.ts`), PAS un z-score robuste académique.

/** Quadrant (information pédagogique ; l'allocation dépend des coordonnées, pas du quadrant). */
export type Quadrant =
  | "inflationary-boom" // x > 0, y > 0 — Boom inflationniste (haut-droite)
  | "disinflationary-boom" // x > 0, y < 0 — Boom déflationniste (bas-droite)
  | "inflationary-contraction" // x < 0, y > 0 — Contraction inflationniste (haut-gauche)
  | "disinflationary-contraction"; // x < 0, y < 0 — Contraction déflationniste (bas-gauche)

/** État de la zone de transition (bande neutre ±T autour de chaque axe). */
export type TransitionState = "none" | "activity" | "monetary" | "double";

/** Stratégie d'allocation. */
export type Strategy = "binary" | "dynamic";

/** Statut de calcul d'un point du modèle. */
export type DataStatus = "complete" | "partial" | "insufficient-history";

/** Répartition des quatre actifs principaux (somme = 1). */
export interface CoreAllocation {
  equities: number;
  bonds: number;
  gold: number;
  cash: number;
}

/** Allocation finale après overlay Énergie (somme des cinq = 1). */
export interface FinalAllocation extends CoreAllocation {
  energy: number;
}

/** Vitesse du régime dans le plan (points de score par mois). */
export interface Velocity {
  x: number;
  y: number;
  magnitude: number;
  angleDegrees: number;
}

/** Accélération du régime (points de score par mois²). */
export interface Acceleration {
  x: number;
  y: number;
  magnitude: number;
}
