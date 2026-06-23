"use client";

/**
 * Dispatchers par type d'actif vers la table générique.
 * =====================================================
 *
 * Chaque dispatcher est un thin wrapper qui :
 *   - appelle le hook spécifique au type (`useAssetStockWatchlist`, `useAssetCryptoWatchlist`…),
 *   - passe les colonnes spécifiques (`STOCK_COLUMNS`, `CRYPTO_COLUMNS`…),
 *   - rend `<WatchlistTable>` (générique).
 *
 * Justification : les hooks ne peuvent pas être appelés conditionnellement
 * (règle React des hooks). Un dispatcher par type stabilise l'ordre des
 * hooks dans le composant rendu.
 *
 * Le `screener-page.tsx` n'importe plus que ces 5 dispatchers et branche
 * sur `assetType` sans toucher au pipeline markets.
 */

import { WatchlistTable } from "./watchlist-table";

import { STOCK_COLUMNS } from "./stock-columns";
import { CRYPTO_COLUMNS } from "./crypto-columns";
import { ETF_COLUMNS } from "./etf-columns";
import { INDEX_COLUMNS } from "./index-columns";
import { FOREX_COLUMNS } from "./forex-columns";
import { BOND_COLUMNS } from "./bond-columns";

import { useAssetStockWatchlist } from "@/hooks/watchlist/use-asset-stock-watchlist";
import { useAssetCryptoWatchlist } from "@/hooks/watchlist/use-asset-crypto-watchlist";
import { useAssetEtfWatchlist } from "@/hooks/watchlist/use-asset-etf-watchlist";
import { useAssetIndexWatchlist } from "@/hooks/watchlist/use-asset-index-watchlist";
import { useAssetForexWatchlist } from "@/hooks/watchlist/use-asset-forex-watchlist";
import { useAssetBondWatchlist } from "@/hooks/watchlist/use-asset-bond-watchlist";

import type { EnrichedWatchlistItem } from "@/lib/markets/watchlist/clients/watchlist-client";

type Props = {
  items: EnrichedWatchlistItem[];
  loading: boolean;
  listRefreshing?: boolean;
  onRemoveAction: (itemId: string) => void;
  onToggleFavoriteAction: (itemId: string) => void;
};

// ──────────────────────────────────────────────────────────── //
// Dispatchers — 1 par type d'actif                              //
// ──────────────────────────────────────────────────────────── //

export function StockWatchlistTable(props: Props) {
  const hookResult = useAssetStockWatchlist(props.items);
  return <WatchlistTable {...props} columns={STOCK_COLUMNS} hookResult={hookResult} />;
}

export function CryptoWatchlistTable(props: Props) {
  const hookResult = useAssetCryptoWatchlist(props.items);
  return <WatchlistTable {...props} columns={CRYPTO_COLUMNS} hookResult={hookResult} />;
}

export function EtfWatchlistTable(props: Props) {
  const hookResult = useAssetEtfWatchlist(props.items);
  return <WatchlistTable {...props} columns={ETF_COLUMNS} hookResult={hookResult} />;
}

export function IndexWatchlistTable(props: Props) {
  const hookResult = useAssetIndexWatchlist(props.items);
  return <WatchlistTable {...props} columns={INDEX_COLUMNS} hookResult={hookResult} />;
}

export function ForexWatchlistTable(props: Props) {
  const hookResult = useAssetForexWatchlist(props.items);
  return <WatchlistTable {...props} columns={FOREX_COLUMNS} hookResult={hookResult} />;
}

export function BondWatchlistTable(props: Props) {
  const hookResult = useAssetBondWatchlist(props.items);
  return <WatchlistTable {...props} columns={BOND_COLUMNS} hookResult={hookResult} />;
}
