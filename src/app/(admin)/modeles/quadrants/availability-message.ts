import type { BacktestReason } from "@/lib/coredata/four-quadrants";

/**
 * Cause d'indisponibilité au niveau UI = les codes techniques du backtest + le
 * CPI absent (le backtest reste « OK » sans CPI ; seules les mesures réelles et
 * l'inflation manquent). ⚠️ Le code technique (`reason`) reste distinct du texte
 * utilisateur produit ici — un même `reason` donne TOUJOURS le même message.
 */
export type AvailabilityReason = BacktestReason | "cpi_unavailable";

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** « YYYY-MM » → « avr. 2016 » (sans objet Date : insensible au fuseau horaire). */
function formatMonthKey(ym: string): string {
  const m = Number(ym.slice(5, 7));
  const name = MONTHS_FR[m - 1];
  return name ? `${name} ${ym.slice(0, 4)}` : ym;
}

/**
 * Message utilisateur FR homogène pour une cause d'indisponibilité. DÉTERMINISTE.
 * Le mois n'est ajouté que lorsqu'il localise une anomalie précise (discontinuité,
 * poids de signal, valeur d'actif) — jamais pour un historique globalement trop
 * court ou un CPI absent, où il n'apporte rien.
 */
export function availabilityMessage(
  reason: AvailabilityReason,
  firstInvalidMonth?: string | null,
): string {
  const from = firstInvalidMonth ? ` à partir de ${formatMonthKey(firstInvalidMonth)}` : "";
  const at = firstInvalidMonth ? ` (${formatMonthKey(firstInvalidMonth)})` : "";
  switch (reason) {
    case "insufficient_history":
      return "Historique trop court pour calculer les indicateurs sur cette fenêtre.";
    case "non_contiguous_history":
      return `Historique discontinu${from} : un mois est absent des séries.`;
    case "missing_signal_weight":
      return `Signal indisponible${from} : aucune allocation cible pour ce mois.`;
    case "invalid_asset_value":
      return `Valeur d'actif invalide${at} : nulle, négative ou non finie.`;
    case "cpi_unavailable":
      return "Indice des prix (CPI) indisponible : les mesures réelles et l'inflation ne peuvent pas être calculées.";
    case "missing_series":
      return "Séries de marché indisponibles pour ce pays.";
    case "invalid_value":
      return "Données de marché invalides pour ce pays.";
  }
}

/** Étiquette courte (badge) — même correspondance code → libellé, sans le détail. */
export function availabilityLabel(reason: AvailabilityReason): string {
  switch (reason) {
    case "insufficient_history":
      return "hist. court";
    case "non_contiguous_history":
      return "hist. discontinu";
    case "missing_signal_weight":
      return "signal manquant";
    case "invalid_asset_value":
      return "valeur invalide";
    case "cpi_unavailable":
      return "CPI absent";
    case "missing_series":
      return "indisponible";
    case "invalid_value":
      return "invalide";
  }
}
