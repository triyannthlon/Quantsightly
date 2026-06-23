"use client";

/**
 * Hook watchlist CRYPTO — branché sur la couche MARKETS.
 * ===================================================
 *
 * Thin wrapper autour de `useWatchlistRows<CryptoWatchlistRow>` qui :
 *   1) appelle `fetchHistory(symbol)` (transport mutualisé),
 *   2) compose chaque ligne via `buildCryptoRow` (markets, calendrier 7j/7),
 *   3) considère la ligne complète DÈS que l'historique est arrivé
 *      (stratégie `"history"`) — EODHD ne sert pas de fundamentals
 *      exploitables pour la crypto.
 */

import { useWatchlistRows, type RowState } from "./use-watchlist-rows";
import { type CryptoWatchlistRow } from "@/lib/markets";
import { buildCryptoRow } from "@/lib/markets/watchlist/builder/asset-crypto";
import type { EnrichedWatchlistItem } from "@/lib/markets/watchlist/clients/watchlist-client";

/** État courant d'une ligne crypto (alias rétrocompatible). */
export type CryptoRowState = RowState<CryptoWatchlistRow>;

export function useAssetCryptoWatchlist(items: EnrichedWatchlistItem[]) {
  return useWatchlistRows<CryptoWatchlistRow>(items, (item, raw) =>
    buildCryptoRow({
      identity: {
        symbol: item.symbol,
        name: item.name ?? item.symbol,
        currency: item.currency,
      },
      rawBars: raw.history,
    }),
  );
}
