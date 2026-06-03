/**
 * Couche YANN — normalisation d'une série brute
 * =============================================
 *
 * Transforme une liste de cotations brutes (`EodBar[]`) en une
 * `NormalizedSeries` SANS TROU sur le calendrier demandé.
 *
 * Algorithme
 * ----------
 *   1) Filtrer les barres avec un `close` valide et trier par date
 *      croissante (défensif : on ne fait pas confiance à l'ordre du brut).
 *
 *   2) Déterminer les bornes :
 *        from = date du 1ᵉʳ close réel
 *        to   = date du dernier close réel
 *
 *   3) Générer le calendrier cible entre `from` et `to`
 *      (Lun→Ven ou 7j/7 selon `kind`).
 *
 *   4) Pour chaque date `d` du calendrier :
 *        - Trouver, par recherche binaire (O(log n)), l'indice de la
 *          DERNIÈRE barre brute dont `date ≤ d`.
 *        - Émettre une `NormalizedBar` :
 *            • `date`   = `d` (la date du calendrier, pas celle du brut)
 *            • `close`  = close du brut trouvé
 *            • `adjusted_close` = adjusted_close du brut, fallback close
 *            • `synthetic` = vrai SI la date brute ≠ `d` (= valeur reportée)
 *
 * C'est le LOCF (« Last Observation Carried Forward »), équivalent du
 * « fill » de Bloomberg : on prolonge la dernière valeur connue jusqu'à
 * la prochaine cotation réelle.
 *
 * Garanties
 * ---------
 *  • Aucune extrapolation avant la 1ʳᵉ cotation réelle.
 *    (Le titre n'existait pas — on ne fabrique pas un passé.)
 *  • `adjusted_close` est toujours un nombre.
 *  • `bars` est ordonné par date croissante, sans trou.
 *
 * Complexité
 * ----------
 *   O((n + m) log n) avec n = bruts, m = jours du calendrier.
 *   Pour 30 ans d'historique quotidien (~10 000 bruts, ~7 800 weekdays),
 *   c'est instantané.
 */

import type { EodBar } from "@/lib/yann/analytics/metrics";
import type { NormalizedBar, NormalizedSeries, SeriesKind } from "./types";
import { buildCalendar }  from "./calendar";

/************** buildNormalizedSeries *****/
export function buildNormalizedSeries(rawBars: EodBar[], kind: SeriesKind): NormalizedSeries
       {//buildNormalizedSeries

      /**
       * Construit la série normalisée à partir d'une série brute.
       *
       * @param rawBars  série EODHD brute (peut contenir des trous, peut être désordonnée)
       * @param kind     `"weekday"` (Lun→Ven) ou `"calendar"` (7j/7)
       *
       * @returns        `NormalizedSeries` continue sur [première vraie cotation ; dernière]
       */


       // ── Étape 1 : filtrer + trier (défensif) ────────────────

       const sorted = [...rawBars].filter((b): b is EodBar & { close: number } => typeof b.close === "number").sort((a, b) => a.date.localeCompare(b.date)); /*   - on rejette les barres sans close exploitable - on trie par date croissante (string compare = date compare pour YYYY-MM-DD) */
         if (sorted.length === 0) {return { kind, bars: [], source: { from: "", to: "" } };} /* Cas dégénéré : aucune cotation valide → série vide */

       // ── Étape 2 : bornes du brut ────────────────────────────

       const from = sorted[0                ].date;
       const to   = sorted[sorted.length - 1].date;

       // ── Étape 3 : calendrier cible ──────────────────────────

       const calendar = buildCalendar(from, to, kind);

       // ── Étape 4 : remplissage par LOCF (recherche binaire) ──

       const bars: NormalizedBar[] = [];

       for (const targetDate of calendar)//(1)
           {//(1)
           const idx = findLastBarOnOrBefore(sorted, targetDate);
             if (idx < 0) continue;   /* ne devrait pas arriver : le calendrier commence à `from` qui est dans `sorted` */

           const src    = sorted[idx]                    ;
           const isReal = src.date === targetDate        ;
           const adj    = src.adjusted_close ?? src.close;

           bars.push({date          : targetDate,
                      close         : src.close ,
                      adjusted_close: adj       ,
                      synthetic     : !isReal    ,});
           }//(1)

       return { kind, bars, source: { from, to } };

       }//buildNormalizedSeries

/******* findLastBarOnOrBefore *****/
function findLastBarOnOrBefore(sorted: EodBar[], targetDate: string): number
         {//findLastBarOnOrBefore

         /**
          * Renvoie l'indice de la DERNIÈRE barre dont `date ≤ targetDate`,
          * ou `-1` si aucune barre n'est ≤ `targetDate`.
          *
          * Préconditions : `sorted` est trié par `date` croissante.
          *
          * Logique :
          *   - On maintient `result` = meilleur candidat trouvé.
          *   - À chaque itération, si `sorted[mid].date ≤ targetDate` :
          *       → c'est un candidat valide ; on note et on cherche plus à droite.
          *     Sinon :
          *       → on cherche à gauche.
          */

         let lo     = 0                ;
         let hi     = sorted.length - 1;
         let result = -1               ;

         while (lo <= hi)
               {
                    const mid = (lo + hi) >>> 1;   /* moyenne entière, sûre côté débordement */

               if (sorted[mid].date <= targetDate) {result = mid;lo     = mid + 1;}
               else                                {             hi     = mid - 1;}
               }

         return result;

         }//findLastBarOnOrBefore
