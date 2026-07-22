// Constantes PURES du module de comparaison — AUCUN import (surtout pas le moteur,
// four-quadrants ni browne). Objectif : le bundle CLIENT (barre de params, vue)
// peut importer ces valeurs SANS tirer le moteur ni `browne.ts` côté client. Le
// calcul, lui, vit dans une action serveur (cf. `four-quadrants-service.ts`).

/** Minimum de mois de fenêtre commune pour produire une comparaison (~1 an). */
export const MIN_COMPARISON_MONTHS = 13;

/** Seuil sous lequel un turnover est considéré nul (pas de réallocation). */
export const EPS_REALLOC = 1e-9;

/** Fenêtres de la section « Performance glissante » (années). */
export const ROLLING_WINDOWS_YEARS = [5, 10, 15];

/** Hypothèse de coûts par défaut (bps sur la rotation exécutée). */
export const DEFAULT_COST_BPS = 25;

/** Options d'hypothèse de coûts (Réglages). */
export const COST_BPS_OPTIONS = [0, 10, 25, 50];
