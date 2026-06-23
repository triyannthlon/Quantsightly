"use client";

/**
 * Hook watchlist INDEX — branché sur la couche MARKETS.
 * ==================================================
 *
 * Thin wrapper autour de `useWatchlistRows<IndexWatchlistRow>` :
 *   1) `fetchHistory(symbol)` (transport mutualisé),
 *   2) `buildIndexRow` (markets),
 *   3) stratégie `"history"` — pas de fundamentals à attendre pour les indices.
 */

import { useWatchlistRows, type RowState } from "./use-watchlist-rows";
import { type IndexWatchlistRow } from "@/lib/markets";
import { buildIndexRow } from "@/lib/markets/watchlist/builder/asset-index";
import type { EnrichedWatchlistItem } from "@/lib/markets/watchlist/clients/watchlist-client";

export type IndexRowState = RowState<IndexWatchlistRow>;

export function useAssetIndexWatchlist(items: EnrichedWatchlistItem[]) {
  return useWatchlistRows<IndexWatchlistRow>(items, (item, raw) =>
    buildIndexRow({
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
