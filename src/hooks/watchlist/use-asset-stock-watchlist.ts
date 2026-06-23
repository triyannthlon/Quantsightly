"use client";

/**
 * Hook watchlist STOCK — branché sur la couche MARKETS.
 * ==================================================
 *
 * Thin wrapper autour de `useWatchlistRows<StockWatchlistRow>` qui :
 *   1) appelle `fetchHistory(symbol)` (transport mutualisé),
 *   2) compose chaque ligne via `buildStockRow` (markets),
 *   3) considère la ligne complète dès que l'historique est arrivé.
 */

import { useWatchlistRows, type RowState } from "./use-watchlist-rows";
import { type StockWatchlistRow } from "@/lib/markets";
import { buildStockRow } from "@/lib/markets/watchlist/builder/asset-stock";
import type { EnrichedWatchlistItem } from "@/lib/markets/watchlist/clients/watchlist-client";

/** État courant d'une ligne stock (alias rétrocompatible). */
export type StockRowState = RowState<StockWatchlistRow>;

export function useAssetStockWatchlist(items: EnrichedWatchlistItem[]) {
  return useWatchlistRows<StockWatchlistRow>(items, (item, raw) =>
    buildStockRow({
      identity: {
        symbol: item.symbol,
        name: item.name ?? item.symbol,
        currency: item.currency,
        country: item.country,
        countryIso2: item.countryIso2,
      },
      rawBars: raw.history,
    }),
  );
}
