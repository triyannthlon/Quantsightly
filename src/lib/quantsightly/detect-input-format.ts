import type { InputFormat } from "./types";

/************** buildLogoUrl *****/
export function buildLogoUrl(code: string, exchange: string): string
       {//buildLogoUrl

       /**
         * Construit l'URL du logo EODHD à partir du code et exchange.
        * Pattern : https://eodhd.com/img/logos/{EXCHANGE}/{code-lowercase}.png
        *
        * Le logo peut ne pas exister pour tous les tickers — le composant <img>
        * doit gérer l'erreur de chargement avec un fallback (icône générique).
        **/

       return `https://eodhd.com/img/logos/${exchange.toUpperCase()}/${code.toLowerCase()}.png`;

       }//buildLogoUrl

/************** buildLogoUrlFromSymbol *****/
export function buildLogoUrlFromSymbol(primarySymbol: string | undefined): string
       {//buildLogoUrlFromSymbol

                                                    if (!primarySymbol) return "";
                                             const dot = primarySymbol.lastIndexOf(".");
                                               if (dot <= 0) return "";

       const code     = primarySymbol.substring(0, dot);
       const exchange = primarySymbol.substring(   dot + 1);

       return buildLogoUrl(code, exchange);

       }//buildLogoUrlFromSymbol


/************** detectInputFormat *****/
export function detectInputFormat(raw: string): InputFormat
       {//detectInputFormat

       /**
        * Détecte le format de l'input utilisateur (purement cosmétique : aide au ranking).
        * La résolution réelle est faite par /api/search côté backend EODHD.
       **/

       const input = raw.trim().toUpperCase();

       if (/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(input)) {return "isin";         } /* ISIN : 2 lettres pays + 9 alphanum + 1 chiffre check digit */

             if (/^[A-Z0-9-]+\.[A-Z]+$/.test(input)) { return "symbol_full"; } /* Symbol complet : LETTRES.EXCHANGE (ex: AAPL.US, BRK-B.US) */

                  if (/^[A-Z0-9]{1,5}$/.test(input)) { return "symbol_short";} /* Symbol court : 1 à 5 caractères alphanumériques uniquement */

                                                       return "name";         /* Sinon : nom d'entreprise (espaces, minuscules originales, etc.) */
       }//detectInputFormat

/************** buildSymbol *****/
export function buildSymbol(code: string, exchange: string): string
       {//buildSymbol

        /**
         * Construit le symbol canonique au format EODHD (CODE.EXCHANGE)
         * à partir d'un résultat de search.
         **/

        return `${code.toUpperCase()}.${exchange.toUpperCase()}`;

        }//buildSymbol

/************** isETFLike *****/
export function isETFLike(type: string | undefined): boolean
       {//isETFLike

       /**
        * Détermine si un type EODHD est un ETF ou un actif "fund-like" (à router vers /etf/).
        **/
             if (!type) return false;
        const t = type.toLowerCase();
       return t === "etf"                  ||
              t === "fund"                 ||
              t === "exchange traded fund" ||
              t === "mutual fund";

       }//isETFLike

/************** isStockLike *****/
export function isStockLike(type: string | undefined): boolean
       {//isStockLike

       /**
        * Détermine si un type EODHD est une action (à router vers /stock/).
       **/
           
             if (!type) return false;
        const t = type.toLowerCase();
       return t === "stock"           ||
              t === "common stock"    ||
              t === "preferred stock" ||
              t === "reit";

       }//isStockLike