"use client";

/**
 * Hook watchlist FOREX — branché sur la couche YANN.
 * ==================================================
 *
 * Thin wrapper autour de `useWatchlistRows<ForexWatchlistRow>` :
 *   1) `fetchHistory(symbol)` (transport mutualisé),
 *   2) `buildForexRow` (yann),
 *   3) stratégie `"history"` — pas de fundamentals utiles pour le forex.
 */

import { useWatchlistRows, type RowState } from "./use-watchlist-rows";
import { type ForexWatchlistRow } from "@/lib/yann";
import { buildForexRow } from "@/lib/yann/watchlist/builder/asset-forex";
import type { EnrichedWatchlistItem } from "@/lib/yann/watchlist/clients/watchlist-client";


export type ForexRowState = RowState<ForexWatchlistRow>;


export function useAssetForexWatchlist(items: EnrichedWatchlistItem[]) {
    return useWatchlistRows<ForexWatchlistRow>(
        items,
        (item, raw) => buildForexRow({
            identity   : {
                             symbol   : item.symbol,
                             name     : item.name ?? item.symbol,
                             currency : item.currency,
                         },
            rawBars    : raw.history,
       }),
    );
}
