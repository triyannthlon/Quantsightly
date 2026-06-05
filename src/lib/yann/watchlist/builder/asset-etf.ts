/**
 *
 * Compose une ligne de watchlist ETF.
 *
 * Pas de réseau, pas de cache, pas d'état : fonction PURE.
 *
 */

import type { EodBar }                  from "@/lib/yann/analytics/metrics";
import type { EtfWatchlistRow }         from "../types";
import { buildNormalizedSeries }        from "@/lib/yann";
import { weekdayReturns, distanceTo52WHigh } from "@/lib/yann";
import { extractSparkline6m }           from "./shared";


export type EtfBuilderInputs = {

    identity: {
        symbol      : string;
        name        : string;
        currency   ?: string;
        country    ?: string;
        countryIso2?: string;
    };

    /** Série EODHD brute (peut être vide si la donnée n'est pas encore là). */
    rawBars    : EodBar[];

};


export function buildEtfRow(inputs: EtfBuilderInputs): EtfWatchlistRow {

    // ── 1. Normaliser la série brute en WEEKDAY (LOCF) ───────
    const series = buildNormalizedSeries(inputs.rawBars, "weekday");

    // ── 2. Dernier close NOMINAL + sa date ───────────────────
    const lastBar = series.bars.length > 0
                  ? series.bars[series.bars.length - 1]
                  : undefined;

    // ── 3. Métriques propriétaires ───────────────────────────
    const returns =    weekdayReturns(series);
    const dist52w = distanceTo52WHigh(series);

    // ── 5. Assemblage de la ligne ────────────────────────────
    return {
        kind        : "etf",

        // Identité (issue du catalogue)
        symbol      : inputs.identity.symbol,
        name        : inputs.identity.name,
        currency    : inputs.identity.currency,
        country     : inputs.identity.country,
        countryIso2 : inputs.identity.countryIso2,

        // Prix courant (nominal)
        last        : lastBar?.close,
        lastDate    : lastBar?.date,

        // Rendements multi-horizons (sur adjusted_close)
        ...returns,

        // Distance (%) au plus haut 52 semaines
        distanceTo52WHigh: dist52w,
        sparkline6m      : extractSparkline6m(series.bars),
    };
}
