/**
 * Couche MARKETS — types dérivés
 * ===========================
 *
 * Ce module définit des types « filtres » : ils sont des projections du
 * type brut `EodBar` (issu de l'API EODHD) auxquelles on ajoute une
 * GARANTIE supplémentaire — la continuité temporelle.
 *
 * Idée clé
 * --------
 *  - `EodBar` (brut)         : cotation EODHD telle que reçue. Peut
 *                              contenir des trous (fériés, week-ends,
 *                              fermetures, données manquantes).
 *
 *  - `NormalizedBar` (markets)  : cotation reformatée pour qu'il y en ait
 *                              EXACTEMENT UNE par jour du calendrier
 *                              visé (Lun→Ven pour actions / ETF /
 *                              indices / forex, 7j/7 pour crypto).
 *                              Les valeurs des jours manquants sont
 *                              REPORTÉES depuis le dernier close connu
 *                              (LOCF = Last Observation Carried Forward,
 *                              équivalent du « fill » de Bloomberg).
 *
 * Le flag `synthetic` indique si une barre est :
 *   - false → la VRAIE cotation de ce jour (vrai close du marché)
 *   - true  → une valeur REPORTÉE depuis un jour précédent (LOCF)
 *
 * Ce flag est précieux pour les modèles : ils peuvent par exemple
 * choisir d'exclure les valeurs reportées d'un calcul de volatilité
 * réaliste, ou de pondérer différemment.
 */

export type EodBar = {
  date: string; // "YYYY-MM-DD"
  close: number;
  adjusted_close?: number;
};

/**
 * - `"weekday"`  : Lundi → Vendredi uniquement (actions, ETF, indices, forex)
 * - `"calendar"` : tous les jours, week-ends inclus (crypto, marchés 24/7)
 */

export type SeriesKind = "weekday" | "calendar";

/**
 * Une cotation d'un jour précis dans une série normalisée.
 *
 * Garanties par rapport au brut :
 *   1) `adjusted_close` est garanti défini (fallback sur `close` si le
 *      brut ne le fournit pas).
 *   2) Le flag `synthetic` documente l'origine de la valeur :
 *        - false → close réel ce jour-là (marché ouvert)
 *        - true  → close reporté d'un jour précédent (LOCF — férié,
 *                  week-end inclus dans un calendrier 7/7, fermeture…)
 *
 * Pattern « filtre » : on PICK uniquement les champs utiles à l'analyse
 * (date + close), on raffine `adjusted_close` pour qu'il soit non-NULL,
 * et on AJOUTE la métadonnée `synthetic`.
 */

export type NormalizedBar = Pick<EodBar, "date" | "close"> & {
  adjusted_close: number; /* ← garanti défini (fallback sur close) */
  synthetic: boolean; /* ← true si valeur reportée (LOCF)      */
};

/**
 * Une série continue sur l'intervalle [`source.from` ; `source.to`].
 *
 * - `bars` est ordonné par date croissante.
 * - Aucun trou entre `source.from` et `source.to` selon le calendrier
 *   défini par `kind`.
 * - On n'extrapole JAMAIS avant `source.from` (le titre n'existait pas)
 *   ni après `source.to` (on ne projette pas dans le futur).
 */

export type NormalizedSeries = {
  kind: SeriesKind; /* Calendrier appliqué à la série. */
  bars: NormalizedBar[]; /* Barres ordonnées par date croissante, sans trou. */
  source: {
    from: string;
    to: string;
  }; /* Bornes (au format YYYY-MM-DD) du brut d'origine : - `from` = date du 1er     close réel
                                                                                                                           - `to`   = date du dernier close réel */
};
