import type { ComparisonMetrics } from "./types";

/** Historique minimal (mois) pour que le ratio de Calmar soit jugé significatif. */
export const CALMAR_MIN_MONTHS = 36;

/**
 * Résultat du ratio de Calmar. On DISTINGUE les raisons d'indisponibilité (infobulle +
 * accessibilité) : une valeur attendue mais absente sur une stratégie disponible est une
 * ANOMALIE explicite, jamais un « — » silencieux.
 */
export type CalmarResult =
  | { kind: "ok"; value: number }
  | { kind: "insufficient-history" } // historique < CALMAR_MIN_MONTHS
  | { kind: "no-drawdown" } // max drawdown nul → division impossible
  | { kind: "anomaly" }; // annualized/maxDrawdown absent alors qu'ils devraient exister

/**
 * Ratio de Calmar DÉRIVÉ = performance annualisée nette de coûts ÷ |max drawdown|, sur
 * exactement la MÊME série (même période, même mode, mêmes coûts) — aucun nouveau calcul
 * moteur, uniquement une combinaison de valeurs déjà présentes dans `ComparisonMetrics`.
 * Sans unité ; une valeur élevée est favorable ; une performance négative donne un Calmar
 * négatif (calculable). Ordre des vérifications = ordre de priorité des raisons.
 */
export function calmar(m: ComparisonMetrics): CalmarResult {
  if (m.months < CALMAR_MIN_MONTHS) return { kind: "insufficient-history" };
  if (m.annualized === null || m.maxDrawdown === null) return { kind: "anomaly" };
  if (m.maxDrawdown === 0) return { kind: "no-drawdown" };
  return { kind: "ok", value: m.annualized / Math.abs(m.maxDrawdown) };
}

/** Libellé d'indisponibilité (infobulle + `aria-label`) selon la raison. */
export function calmarUnavailableReason(r: Exclude<CalmarResult, { kind: "ok" }>): string {
  switch (r.kind) {
    case "insufficient-history":
      return `Historique insuffisant : ${CALMAR_MIN_MONTHS} mois minimum`;
    case "no-drawdown":
      return "Ratio non calculable : aucun drawdown observé";
    case "anomaly":
      return "Valeur indisponible : donnée attendue manquante (anomalie)";
  }
}
