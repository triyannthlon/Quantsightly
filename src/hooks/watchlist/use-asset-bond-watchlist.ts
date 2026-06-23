"use client";

/**
 * Hook watchlist BOND (obligations souveraines) — branché sur la couche MARKETS.
 * ==============================================================================
 *
 * Thin wrapper autour de `useWatchlistRows<BondWatchlistRow>` qui :
 *   1) appelle `fetchHistory(symbol)` (transport mutualisé),
 *   2) compose chaque ligne via `buildBondRow` (markets),
 *   3) stratégie `"history"` — pas de fundamentals à attendre pour les bonds.
 */

import { useWatchlistRows, type RowState } from "./use-watchlist-rows";
import { type BondWatchlistRow } from "@/lib/markets";
import { buildBondRow } from "@/lib/markets/watchlist/builder/asset-bond";
import type { EnrichedWatchlistItem } from "@/lib/markets/watchlist/clients/watchlist-client";

/** État courant d'une ligne bond (alias rétrocompatible). */
export type BondRowState = RowState<BondWatchlistRow>;

export function useAssetBondWatchlist(items: EnrichedWatchlistItem[]) {
  return useWatchlistRows<BondWatchlistRow>(items, (item, raw) =>
    buildBondRow({
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
