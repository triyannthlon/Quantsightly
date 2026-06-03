/**
 *
 * Compose une ligne de watchlist INDEX (indices boursiers : S&P 500, CAC 40, …).
 *
 * Pas de réseau, pas de cache, pas d'état : fonction PURE.
 *
 */

import type { EodBar }                  from "@/lib/yann/analytics/metrics";
import type { IndexWatchlistRow }       from "../types";
import { buildNormalizedSeries }        from "@/lib/yann";
import { weekdayReturns, distanceTo52WHigh } from "@/lib/yann";
import { enCountryToIso2 }              from "@/data/countries";
import { iso2ToRegion }                 from "@/data/regions";


export type IndexBuilderInputs = {

    identity: {
        symbol      : string;
        name        : string;
        currency   ?: string;
        country    ?: string;
        countryIso2?: string;
    };

    /** Série EODHD brute (peut être vide). */
    rawBars    : EodBar[];

};


export function buildIndexRow(inputs: IndexBuilderInputs): IndexWatchlistRow {

    // ── 1. Normaliser la série brute en WEEKDAY (LOCF) ───────
    const series = buildNormalizedSeries(inputs.rawBars, "weekday");

    // ── 2. Dernier close NOMINAL + sa date ───────────────────
    const lastBar = series.bars.length > 0
                  ? series.bars[series.bars.length - 1]
                  : undefined;

    // ── 3. Métriques propriétaires ───────────────────────────
    const returns = weekdayReturns(series);
    const dist52w = distanceTo52WHigh(series);

    // ── 4. Région : iso2 prioritaire, sinon fallback via nom de pays.
    //    Si l'iso2 est inconnu ou que la région n'est pas mappée
    //    (indice global type W1DOW, ou pays hors REGION_BY_ISO2),
    //    on retombe sur "Global" — l'UI affichera ça plutôt qu'un "—".
    const iso2   = inputs.identity.countryIso2 ?? enCountryToIso2(inputs.identity.country);
    const region = iso2ToRegion(iso2) ?? "Global";

    // ── 5. Assemblage ────────────────────────────────────────
    return {
        kind        : "index",

        // Identité
        symbol      : inputs.identity.symbol,
        name        : inputs.identity.name,
        currency    : inputs.identity.currency,
        country     : inputs.identity.country,
        countryIso2 : iso2,

        // Région macro (peut être undefined pour les indices globaux)
        region,

        // Prix courant (nominal)
        last        : lastBar?.close,
        lastDate    : lastBar?.date,

        // Rendements multi-horizons
        ...returns,

        // Distance (%) au plus haut 52 semaines
        distanceTo52WHigh: dist52w,
    };
}
