/**
 * Couche MARKETS — conversion de devises
 * ===================================
 *
 * Centralise la conversion d'une valeur monétaire (prix, capitalisation,
 * AUM, plus haut, plus bas…) d'une devise à une autre.
 *
 * Pourquoi cette brique
 * ---------------------
 * Un utilisateur veut souvent visualiser son portefeuille / sa watchlist
 * dans UNE seule devise (ex. EUR), alors que les actifs sont cotés dans
 * des devises différentes (USD pour AAPL, GBX pour les UK, JPY pour
 * Tokyo, etc.).
 *
 * Architecture
 * ------------
 *  - Les `WatchlistRow` et `NormalizedSeries` portent une devise
 *    NATIVE (champ `currency`).
 *  - Une `FxRateSource` est une INTERFACE permettant à markets de demander
 *    un taux de change spot (le plus récent) ou historique (à une date
 *    donnée). L'implémentation est fournie par l'application (UI/hooks)
 *    et alimentée par les pairs FOREX du backend (ex. EURUSD.FOREX).
 *  - `convertValue` et `convertSeries` produisent les valeurs dans la
 *    devise cible sans muter l'entrée.
 *
 * Ce qui se convertit / ne se convertit PAS
 * -----------------------------------------
 *   ✓ Convertit : `last`, `close`, `adjusted_close`, `marketCap`,
 *                 `aum`, `high52w`, `low52w`.
 *   ✗ Ne convertit pas : retours en %, P/E, TER, ratios divers
 *                         (ils sont currency-invariants).
 *                 Le `volume` (nb d'actions / coins) n'est pas non plus
 *                 un montant monétaire à convertir.
 *
 * Pattern d'usage typique
 * -----------------------
 *   // L'app fournit la source (alimentée par les pairs FOREX)
 *   const fx: FxRateSource = buildFxSourceFromBackend();
 *
 *   // Convertir un montant ponctuel (ex. market cap d'AAPL en EUR)
 *   const capEur = convertValue(stock.marketCap, "USD", "EUR", fx);
 *
 *   // Convertir une série historique pour un graphique en EUR
 *   const usd = buildNormalizedSeries(rawBars, "weekday");
 *   const eur = convertSeries(usd, "USD", "EUR", fx);
 */

import type { NormalizedSeries } from "../series/types";

/**
 * Taux de change `from → to` à une date donnée.
 *
 * Convention : `rate` est le multiplicateur à appliquer à 1 unité
 *              de `from` pour obtenir des unités de `to`.
 *
 * Exemple : { from: "USD", to: "EUR", rate: 0.92 }
 *           1 USD = 0,92 EUR  →  100 USD × 0.92 = 92 EUR.
 */
export type FxRate = {
  from: string; /* ex. "USD"  */
  to: string; /* ex. "EUR"  */
  date: string; /* YYYY-MM-DD */
  rate: number;
};

/**
 * Interface d'une source de taux de change.
 *
 * Implémentations possibles :
 *   - cache mémoire alimenté par les pairs FOREX (cas nominal),
 *   - appel direct à une API,
 *   - mock dans les tests (taux fixes).
 *
 * Conventions à respecter par toute implémentation :
 *   - si `from === to`, renvoyer 1,
 *   - si le taux n'est pas connu, renvoyer `undefined` (NE PAS lever
 *     d'exception, NE PAS inventer un taux par défaut).
 */
export type FxRateSource = {
  /**
   * Taux le plus récent connu pour la conversion `from → to`.
   * Utile pour convertir un montant « courant » (last, marketCap).
   */
  spot(from: string, to: string): number | undefined;

  /**
   * Taux à une date précise (au format `YYYY-MM-DD`).
   *
   * Pour la cohérence d'une série historique, l'implémentation
   * appliquera idéalement un LOCF interne sur les pairs FOREX
   * (= dernier taux connu ≤ `date`).
   */
  at(from: string, to: string, date: string): number | undefined;
};

/************** convertValue *****/
export function convertValue(
  amount: number | undefined,
  from: string,
  to: string,
  source: FxRateSource,
  date?: string,
): number | undefined {
  /**
   * Convertit un montant d'une devise à une autre.
   *
   * - Si `amount` est `undefined`, on renvoie `undefined`.
   * - Si `from === to`, on renvoie `amount` inchangé.
   * - Sinon on multiplie par le taux (spot par défaut, ou à la date `date`).
   * - Si le taux est inconnu, on renvoie `undefined` (ne JAMAIS inventer).
   *
   * @param amount  montant à convertir (peut être `undefined`)
   * @param from    devise source (ISO 4217, p. ex. "USD")
   * @param to      devise cible  (ISO 4217, p. ex. "EUR")
   * @param source  fournisseur de taux
   * @param date    si fournie → taux historique (`source.at`)
   *                sinon       → taux spot (`source.spot`)
   *
   * @example
   *   convertValue(100, "USD", "EUR", fx)              // ex. → 92
   *   convertValue(100, "EUR", "EUR", fx)              // → 100 (identique)
   *   convertValue(undefined, "USD", "EUR", fx)        // → undefined
   *   convertValue(100, "USD", "EUR", fx, "2024-06-15")// taux du 15 juin
   */

  if (amount === undefined) return undefined;
  if (from === to) return amount;

  const rate = date !== undefined ? source.at(from, to, date) : source.spot(from, to);

  if (rate === undefined) return undefined;

  return amount * rate;
}

/************** convertSeries *****/
export function convertSeries(
  series: NormalizedSeries,
  from: string,
  to: string,
  source: FxRateSource,
): NormalizedSeries {
  /**
   * Convertit une série normalisée d'une devise à une autre, barre par barre.
   *
   * Pour chaque barre, on cherche le taux `from → to` valable à sa `date`
   * (via `source.at`). Les champs `close` et `adjusted_close` sont
   * multipliés par ce taux.
   *
   * Comportement si le taux est introuvable à une date :
   *   La barre est CONSERVÉE INCHANGÉE (`close` et `adjusted_close`
   *   restent en devise NATIVE) et son flag `synthetic` reste à sa valeur
   *   d'origine. L'appelant peut détecter ce cas en comparant la série
   *   de sortie aux dates pour lesquelles `source.at` renvoie `undefined`.
   *
   *   ⚠️ Idéalement, l'implémentation de `FxRateSource` couvre tout
   *      l'intervalle de la série avec un LOCF interne — alors aucune
   *      barre n'est laissée inchangée.
   *
   * Cas particulier : `from === to` → on renvoie la série telle quelle.
   *
   * @returns une NOUVELLE série (immutabilité préservée).
   */

  if (from === to) return series;

  const bars = series.bars.map((b) => {
    const rate = source.at(from, to, b.date);

    if (rate === undefined) return b; // taux inconnu : on laisse en natif

    return { ...b, close: b.close * rate, adjusted_close: b.adjusted_close * rate };
  });

  return { ...series, bars };
}
