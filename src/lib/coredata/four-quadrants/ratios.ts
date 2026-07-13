// Ratios de marché à la base des deux axes. On travaille ensuite en logarithme
// (multiplicatif → additif, symétrique hausse/baisse) avant la normalisation.

/**
 * Ratio d'activité = actions (indice de PRIX, sans dividendes) / pétrole.
 * Fidèle à Charles Gave : le signal utilise le prix nu ; la performance de la
 * poche Actions utilise, elle, le total-return (couche service/backtest).
 * Ratio en hausse ⇒ les actions battent le pétrole ⇒ efficacité énergétique /
 * expansion (x > 0).
 */
export function activityRatio(equityPriceIndex: number, oil: number): number {
  return equityPriceIndex / oil;
}

/**
 * Ratio monétaire = or / obligations 10 ans (total-return) — convention DIRECTE,
 * unifiée avec la page Régimes macro (`quadrant.ts`). Ratio en hausse ⇒ l'or bat
 * les obligations ⇒ pression inflationniste / mauvaise monnaie ⇒ HAUT du plan
 * (y > 0). Pas d'inversion de signe (on évite toute ambiguïté).
 */
export function monetaryRatio(gold: number, bond10YTotalReturn: number): number {
  return gold / bond10YTotalReturn;
}

/** Log d'un ratio strictement positif. */
export function logRatio(ratio: number): number {
  return Math.log(ratio);
}
