/**
 *
 * Compose une ligne de watchlist CRYPTO
 *
 * Pas de réseau, pas de cache, pas d'état : fonction PURE.
 *
 */

import type { EodBar }                  from "@/lib/yann/analytics/metrics";
import type { CryptoWatchlistRow }      from "../types";
import { buildNormalizedSeries }        from "@/lib/yann";
import { cryptoReturns, distanceTo52WHigh, distanceToATH } from "@/lib/yann";
import { extractSparkline6m }           from "./shared";



export type CryptoBuilderInputs = {

    identity: {
        symbol   : string;
        name     : string;
        currency?: string;
    };

    /** Série EODHD brute (peut être vide si la donnée n'est pas encore là). */
    rawBars    : EodBar[];

};


export function buildCryptoRow(inputs: CryptoBuilderInputs): CryptoWatchlistRow {

    // ── 1. Normaliser la série brute en CALENDAR 7j/7 (LOCF) ─
    const series = buildNormalizedSeries(inputs.rawBars, "calendar");

    // ── 2. Dernier close NOMINAL + sa date ───────────────────
    const lastBar = series.bars.length > 0
                  ? series.bars[series.bars.length - 1]
                  : undefined;

    // ── 3. Métriques propriétaires ───────────────────────────
    const returns  =    cryptoReturns(series);
    const dist52w  = distanceTo52WHigh(series);   // fenêtre 365 j auto en mode "calendar"
    const distATH  =    distanceToATH(series);    // sur toute la série disponible

    // ── 5. Assemblage ────────────────────────────────────────
    return {
        kind     : "crypto",

        // Identité (issue du catalogue)
        symbol   : inputs.identity.symbol,
        name     : inputs.identity.name,
        currency : inputs.identity.currency,

        // Prix courant (nominal)
        last     : lastBar?.close,
        lastDate : lastBar?.date,

        // Rendements multi-horizons (sur adjusted_close, calendrier 7j/7)
        ...returns,

        // Distance (%) au plus haut 52 semaines et à l'ATH (close nominal)
        distanceTo52WHigh: dist52w,
        distanceToATH   : distATH,
        sparkline6m      : extractSparkline6m(series.bars),
    };
}
