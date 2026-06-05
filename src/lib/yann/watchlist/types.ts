/**
 * Couche YANN — types propriétaires de watchlist
 * ==============================================
 *
 * Décrivent UNE LIGNE de chaque watchlist (par type d'actif) dans la
 * forme finale consommée par l'UI.
 *
 * Pattern « filtre »
 * ------------------
 *  - On RÉUTILISE ('Pick<...>') les champs déjà définis dans la couche
 *    brute ('@/lib/yann/analytics/metrics') lorsqu'ils servent :
 *    `sector', `marketCap', `pe` de `StockFundamentals', ...
 *  - On AJOUTE les champs supplémentaires qui seront calculés par YANN
 *    sur la série normalisée : `ret1d', `ret1w', `ret7d', `ret30d',
 *    `high52w', `low52w', ...
 *  - On PROJETTE uniquement les champs utiles à l'affichage (pas
 *    d'over typing).
 *
 * Discriminated union
 * -------------------
 * Chaque type de ligne porte un champ `kind` qui sert de discriminant
 * pour l'union `WatchlistRow'. Cela permet à l'UI ou aux helpers de
 * faire un `switch (row.kind)` typé, sans assertion.
 *
 * Optionnalité
 * ------------
 * La quasi-totalité des champs sont OPTIONNELS (?:) : la donnée arrive
 * de façon asynchrone et partielle (prix d'abord, fondamentaux ensuite),
 * et l'UI doit pouvoir afficher une ligne « en cours » sans planter.
 */


export type WatchlistIdentity = {

                                /** Identité minimale d'un actif (présente sur TOUS les types). */

                                symbol   : string; /* Symbol canonique EODHD (ex. "AAPL.US", "BTC-USD.CC", "EURUSD.FOREX"). */
                                name     : string; /* Nom de l'actif (Apple Inc., Bitcoin USD…). */
                                currency?: string; /* Devise dans laquelle est exprimé le `last` (USD, EUR, GBX…). */
                                };


export type LastPrice = {

                        /** Dernier prix observé + sa date. */

                        last     ?: number;
                        lastDate ?: string; /* "YYYY-MM-DD" */
                        };


export type ReturnsWeekdayMultiHorizon = {

                                         /** Multi-horizons « weekday » (lun→ven) — pour actions, ETF, indices, forex. Tous les retours sont en %. Calculés sur la série NORMALISÉE weekday. */

                                         ret1d  ?: number;              /* veille → aujourd'hui (jour ouvré précédent) */
                                         ret1w  ?: number;              /* 5 jours ouvrés */
                                         ret1m  ?: number;              /* ~1 mois calendaire (via LOCF) */
                                         retYtd ?: number;              /* depuis le 31 déc N-1 */
                                         };

export type ReturnsCryptoMultiHorizon = {

                                        /** Multi-horizons « calendar » (7j/7) — pour crypto. Tous les retours sont en %. Calculés sur la série normalisée 7j/7. */

                                        ret1d  ?: number;
                                        ret7d  ?: number;              // 7 jours calendaires
                                        ret30d ?: number;              // 30 jours calendaires
                                        retYtd ?: number;
                                        };


export type Distance52WHigh = {

                              /** Distance (en %) du close courant au PLUS HAUT close des 252 dernières
                                  sessions. Formule : (close_t / max(close_{t-251..t}) − 1) × 100.
                                  Voir `distanceTo52WHigh()` dans `yann/metrics`. */

                              distanceTo52WHigh ?: number;
                              };

export type Range52W = {

                       /** CINQUANTE-DEUX semaines glissantes : plus bas + plus haut (utile pour forex). */

                       high52w ?: number;
                       low52w  ?: number;
                       };

export type Sparkline6M = {

                          /** Série de closes ajustés sur les 6 derniers mois, prêts pour le mini-graphique en colonne. */

                          sparkline6m?: { date: string; value: number }[];
                          };

export type CountryLocation = {

                              /** Localisation pays d'un actif (stock, ETF, index). */

                              countryIso2 ?: string;         // "US", "FR", "DE"…
                              country     ?: string;         // Nom du pays (ex. "USA", "France")

                              };


/**
 * Ligne de watchlist STOCK
 * Colonnes : Name | Pays | Last | 1D | 1W | 1M | YTD | 52W High
 */
export type StockWatchlistRow = & { kind: "stock" } & WatchlistIdentity & CountryLocation & {
                                                                                            logoUrl?: string /* logo société (EODHD) */
                                                                                            } & LastPrice
                                                                                              & ReturnsWeekdayMultiHorizon
                                                                                              & Distance52WHigh
                                                                                              & Sparkline6M;


/**
 * Ligne de watchlist ETF
 * Colonnes : Name | Pays | Last | 1D | 1W | 1M | YTD | 52W High
 */
export type EtfWatchlistRow = & { kind: "etf" } & WatchlistIdentity & CountryLocation & {
                                                                                        logoUrl?: string
                                                                                        } & LastPrice
                                                                                          & ReturnsWeekdayMultiHorizon
                                                                                          & Distance52WHigh
                                                                                          & Sparkline6M;


/**
 * Ligne de watchlist CRYPTO
 * Colonnes : Name | Last | 1D | 7D | 30D | YTD | 52W High
 * (Pas de "Pays" / "Sector" pour la crypto.)
 */
export type CryptoWatchlistRow = & { kind: "crypto" } & WatchlistIdentity
                                                       & LastPrice
                                                       & ReturnsCryptoMultiHorizon
                                                       & Distance52WHigh
                                                       & { distanceToATH?: number }
                                                       & Sparkline6M;


/**
 * Ligne de watchlist INDEX
 * Colonnes : Name | Region | Last | 1D | 1W | 1M | YTD | 52W High
 * (Region = agrégation des pays : "Europe", "North America", "Asia", "Emerging"…)
 */
export type IndexWatchlistRow = & { kind: "index" } & WatchlistIdentity & CountryLocation & {
                                                                                            region ?: string; /* groupe macro déduit du pays */
                                                                                            } & LastPrice
                                                                                              & ReturnsWeekdayMultiHorizon
                                                                                              & Distance52WHigh
                                                                                              & Sparkline6M;


/**
 * Ligne de watchlist FOREX
 * Colonnes : Pair | Pays (double drapeau) | Last | 1D | 1W | 1M | YTD | 52W Range
 */
export type ForexWatchlistRow = & { kind: "forex" } & WatchlistIdentity & {
                                                                          base       ?: string;    /* devise base  ("EUR") */
                                                                          quote      ?: string;    /* devise quote ("USD") */
                                                                          baseIso2   ?: string;    /* ISO2 du pays / zone de la devise base  (drapeau) */
                                                                          quoteIso2  ?: string;    /* ISO2 du pays / zone de la devise quote (drapeau) */
                                                                          } & LastPrice
                                                                            & ReturnsWeekdayMultiHorizon
                                                                            & Range52W             /* ← low + high (52W Range) */
                                                                            & Sparkline6M;



/**
 * Union discriminée par le champ `kind` :
 *
 *   switch (row.kind) {
 *     case "stock":  // TS sait que row est StockWatchlistRow
 *     case "etf":    // ...
 *     case "crypto": // ...
 *     case "index":  // ...
 *     case "forex":  // ...
 *   }
 */
export type WatchlistRow = | StockWatchlistRow | EtfWatchlistRow | CryptoWatchlistRow | IndexWatchlistRow | ForexWatchlistRow;

/**
 * statut de chargement d'une ligne. Utile pour piloter le rendu
 * (skeleton / valeur / "—"). Se compose avec la ligne au besoin :
 *
 *   type Row = StockWatchlistRow & { status : RowStatus } ;
 */
export type RowStatus = "loading" | "ok" | "unavailable";
