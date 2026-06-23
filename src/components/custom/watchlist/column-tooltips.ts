/**
 * Dictionnaire pédagogique des en-têtes de colonnes des screeners.
 * Indexé par le label EXACT du WatchlistColumnDef.
 *
 * Convention identique à src/components/custom/asset-panel/kpi-tooltips.ts :
 *   - `definition`     → ce que c'est (formulation accessible à un débutant)
 *   - `interpretation` → comment lire la valeur (utile au confirmé pour situer)
 *
 * Si une entrée est absente, aucun tooltip n'apparaît sur l'en-tête (fallback silencieux).
 * Les colonnes purement identitaires (Nom, Devise, Pays, Dernier Prix…) ne portent pas de tooltip.
 */

export type ColumnTooltip = {
  definition: string;
  interpretation: string;
};

export const COLUMN_TOOLTIPS: Record<string, ColumnTooltip> = {
  "6 Mois": {
    definition: "Évolution du cours sur les 6 derniers mois.",
    interpretation: "Vert = tendance haussière · Rouge = tendance baissière sur la période.",
  },
  "1J": {
    definition: "Variation entre la veille et aujourd'hui.",
    interpretation: "Ex : +1,5 % = le prix a gagné 1,5 % par rapport à hier.",
  },
  YTD: {
    definition: "Variation depuis le 1er janvier de l'année en cours.",
    interpretation: "Year-to-Date — performance cumulée de l'année.",
  },
  "Δ sommet 52S": {
    definition: "Distance au plus haut des 252 derniers jours de bourse.",
    interpretation: "0 % = au plus haut · −10 % = 10 % sous le pic annuel.",
  },
  "Δ Sommet 52S / Δ ATH": {
    definition: "Distance au plus haut 52 semaines et au plus haut historique (ATH).",
    interpretation: "0 % = au sommet · valeurs négatives = recul depuis ce sommet.",
  },
  "Bas/Haut 52S": {
    definition: "Fourchette des cours observés sur 52 semaines (plus bas — plus haut).",
    interpretation: "Plus la fourchette est large, plus la paire a été volatile.",
  },
};
