"use client";

/**
 * Hook watchlist ETF — branché sur la couche YANN.
 * ================================================
 *
 * Thin wrapper autour de `useWatchlistRows<EtfWatchlistRow>` qui :
 *   1) appelle `fetchHistory(symbol)` (transport mutualisé),
 *   2) compose chaque ligne via `buildEtfRow` (yann),
 *   3) considère la ligne complète dès que l'historique est arrivé.
 */

import { useWatchlistRows, type RowState } from "./use-watchlist-rows";
import { type EtfWatchlistRow } from "@/lib/yann";
import { buildEtfRow } from "@/lib/yann/watchlist/builder/asset-etf";
import type { EnrichedWatchlistItem } from "@/lib/yann/watchlist/clients/watchlist-client";


/** État courant d'une ligne ETF (alias rétrocompatible). */
export type EtfRowState = RowState<EtfWatchlistRow>;


export function useAssetEtfWatchlist(items: EnrichedWatchlistItem[]) {
    return useWatchlistRows<EtfWatchlistRow>(
        items,
        (item, raw) => buildEtfRow({
            identity   : {
                             symbol      : item.symbol,
                             name        : item.name ?? item.symbol,
                             currency    : item.currency,
                             country     : item.country,
                             countryIso2 : item.countryIso2,
                         },
            rawBars    : raw.history,
        }),
    );
}
