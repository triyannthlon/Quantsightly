/**
 * Couche YANN — générateur de calendrier
 * ======================================
 *
 * Produit la liste des dates (au format `YYYY-MM-DD`) qui doivent
 * apparaître dans une série normalisée.
 *
 * Deux variantes (sélectionnées via `SeriesKind`) :
 *   - `"weekday"'  : du lundi au vendredi (actions, ETF, indices, forex)
 *   - `"calendar"` : tous les jours, week-ends inclus (crypto, marchés 24/7).
 *
 * Notes importantes
 * -----------------
 *  • TIMEZONE : on manipule TOUT en UTC. Les méthodes JavaScript locales
 *    (`getDay`, `setDate`, …) sont sensibles au fuseau du navigateur et
 *    peuvent faire « basculer » les jours d'un côté ou de l'autre du
 *    week-end. En UTC, le code donne le MÊME résultat partout.
 *
 *  • ORDRE LEXICOGRAPHIQUE : une chaîne `"YYYY-MM-DD"` se compare avec
 *    `<`, `>` ou `localeCompare` exactement comme la date qu'elle
 *    représente. On peut donc trier / chercher sans construire de Date.
 */

import type { SeriesKind } from "./types";

/******  fromISO *****/
function fromISO(iso: string): Date
         {//fromISO

         /** Construit un `Date` UTC depuis une chaîne `YYYY-MM-DD`. */

         return new Date(`${iso}T00:00:00Z`);

         }//fromISO


function toISO(d: Date): string
         {//toISO

         /** Renvoie la chaîne `YYYY-MM-DD` d'un `Date` lu en UTC. */

         return d.toISOString().slice(0, 10);

         }//toISO

/******* utcDayOfWeek *****/
function utcDayOfWeek(d: Date): number
         {//utcDayOfWeek

         /**
           * Numéro du jour de la semaine en UTC :
           *   0 = dimanche, 1 = lundi, …, 6 = samedi
         **/

         return d.getUTCDay();
         }//utcDayOfWeek

/******* isWeekday *****/
function isWeekday(d: Date): boolean
         {//isWeekday

         /** Vrai si la date (lue en UTC) est un jour ouvré du lundi au vendredi. */

          const dow  = utcDayOfWeek(d);
         return dow >= 1 && dow <= 5;

         }//isWeekday


/************** buildCalendar *****/
export function buildCalendar(from: string, to: string, kind: SeriesKind): string[]
       {//buildCalendar

       /**
        * Génère toutes les dates entre `from` et `to` (inclus) qui correspondent
        * au calendrier demandé.
        *
        * @param from  date de départ `"YYYY-MM-DD"` (incluse)
        * @param to    date de fin `"YYYY-MM-DD"` (incluse)
        * @param kind  `"weekday"` (lun→ven) ou `"calendar"` (7j/7)
        *
        * @returns     liste ordonnée de chaînes `"YYYY-MM-DD"` couvrant
        *              l'intervalle selon le calendrier.
        *
        * @example
        *   1ᵉʳ janvier 2026 = jeudi. Sam 3 et dim 4 sont exclus en weekday.
        *   buildCalendar("2026-01-01", "2026-01-07", "weekday" ) → ["2026-01-01","2026-01-02","2026-01-05","2026-01-06","2026-01-07"]
        *
        *   buildCalendar("2026-01-01", "2026-01-07", "calendar") → ["2026-01-01","2026-01-02","2026-01-03","2026-01-04","2026-01-05","2026-01-06","2026-01-07"]
        */


       const out    = [] as string[];

       const cursor = fromISO(from);
       const end    = fromISO(to  );


         if (cursor.getTime() >  end.getTime()) return out; /* Cas dégénéré : intervalle invalide → tableau vide (pas d'erreur) */

      while (cursor.getTime() <= end.getTime())//(1)
            {//(1)
            if (kind === "calendar" || isWeekday(cursor))
                                 {out.push(toISO(cursor));}

                                                 cursor.setUTCDate(cursor.getUTCDate() + 1);   /* +1 jour en UTC */
            }//(1)
      return out;

       }//buildCalendar
