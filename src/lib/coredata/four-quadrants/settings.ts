import type { Strategy } from "./types";

// Configuration centralisée du modèle « 4 Quadrants » — SOURCE UNIQUE DE VÉRITÉ.
// Le même objet paramètre le moteur de calcul, le backtest, le graphique des
// quadrants, les cartes KPI, le panneau Paramètres et l'état persistant (URL /
// localStorage). Aucun de ces paramètres ne doit être codé en dur ailleurs.

// `trend` = surcouche méthodologique FIGÉE `energy-trend-v1` (SPDYENT > SMA6, poids 10 %,
// prorata) — paramètres NON configurables (cf. `energy-overlay.ts`). `disabled` = socle v2.
export type EnergyMode = "disabled" | "automatic" | "fixed" | "trend";

export interface FourQuadrantsModelSettings {
  /** Stratégie d'allocation cible. */
  strategy: Strategy;
  /** Demi-largeur de la zone de transition `T`, en points de coordonnées [0, 50]. */
  transitionWidth: number;
  /** Mode de la poche Énergie : désactivée / pilotée par le score / poids fixe. */
  energyMode: EnergyMode;
  /** Poids maximal de la poche Énergie (mode `automatic`). */
  energyMaxWeight: number;
  /** Poids fixe de la poche Énergie (mode `fixed`). */
  energyFixedWeight?: number;
  /** Fenêtre de la vitesse (mois). */
  velocityWindowMonths: number;
  /** Fenêtre de l'accélération (mois). */
  accelerationWindowMonths: number;
}

/** Valeurs par défaut du modèle (défaut produit : dynamique DQAE, T=20, Énergie off). */
export const DEFAULT_FOUR_QUADRANTS_SETTINGS: FourQuadrantsModelSettings = {
  strategy: "dynamic",
  transitionWidth: 20,
  energyMode: "disabled",
  energyMaxWeight: 0.2,
  velocityWindowMonths: 6,
  accelerationWindowMonths: 6,
};
