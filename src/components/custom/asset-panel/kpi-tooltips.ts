/**
 * Dictionnaire pédagogique des KPI affichés dans AssetPanel.
 * Indexé par le label exact du KPI (chaîne identique à MetricCardProps.label).
 *
 * Pourquoi un dictionnaire centralisé :
 * - Toutes les explications au même endroit, faciles à éditer/relire.
 * - Pas de prop drilling depuis AssetPanel jusqu'à MetricCard.
 * - Si une entrée est absente, le tooltip n'apparaît pas (graceful fallback).
 *
 * Convention pédagogique : 2 niveaux par tooltip
 *   - `definition`     → ce que c'est (formulation accessible à un débutant)
 *   - `interpretation` → comment lire la valeur (utile au confirmé pour situer)
 */

export type KpiTooltip = {
  definition: string;
  interpretation: string;
};

export const KPI_TOOLTIPS: Record<string, KpiTooltip> = {
  "Perf. cumulée": {
    definition: "Rendement total entre le début et la fin de la période.",
    interpretation: "Ex : +10 % = ton placement aurait gagné 10 % sur la période.",
  },
  "Perf. annualisée": {
    definition: "Rendement moyen ramené à un an équivalent (CAGR).",
    interpretation: "Permet de comparer des périodes de durées différentes.",
  },
  "Volatilité ann.": {
    definition: "Amplitude moyenne des variations journalières, annualisée.",
    interpretation: "< 15 % stable · 15-25 % modéré · 25-40 % élevé · > 40 % très volatil.",
  },
  "Max DD": {
    definition: "Pire perte historique observée, du sommet au creux le plus bas.",
    interpretation: "Représente le risque maximum déjà subi sur cette période.",
  },
  "DD courant": {
    definition: "Recul actuel par rapport au plus haut historique atteint.",
    interpretation: "0 % = au sommet · −10 % = 10 % en dessous du dernier pic.",
  },
  Sharpe: {
    definition: "Rapport rendement / risque (taux sans risque = 0).",
    interpretation: "< 0 mauvais · < 1 médiocre · 1-2 bon · > 2 excellent.",
  },
  "Jours haussiers": {
    definition: "% de séances où le prix a clôturé en hausse sur la période.",
    interpretation: "> 50 % = tendance globalement haussière.",
  },
  "Range période": {
    definition: "Écart entre le plus haut et le plus bas de la période.",
    interpretation: "Plus large = volatilité directionnelle plus forte.",
  },
};
