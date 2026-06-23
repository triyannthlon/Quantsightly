"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/watchlist/use-watchlist";
import {
  StockWatchlistTable,
  CryptoWatchlistTable,
  EtfWatchlistTable,
  IndexWatchlistTable,
  ForexWatchlistTable,
  BondWatchlistTable,
} from "@/components/custom/watchlist/watchlists-by-type";
import { AssetSearchModal } from "./asset-search-modal";
import { AssetTypeIcon, type AssetKind } from "./asset-type-icon";
import type { AssetType } from "@/lib/markets/watchlist/clients/watchlist-client";

const TITLES: Record<AssetType, string> = {
  stock: "Actions",
  etf: "ETF",
  crypto: "Cryptomonnaies",
  currency: "Devises",
  index: "Indices",
  bond: "Obligations",
};

const KIND: Record<AssetType, AssetKind> = {
  stock: "stock",
  etf: "etf",
  crypto: "crypto",
  currency: "forex",
  index: "index",
  bond: "bond",
};

export function ScreenerPage({ assetType }: { assetType: AssetType }) {
  const { items, loading, error, remove, toggleFavorite, refresh, refreshing } =
    useWatchlist(assetType);
  const [searchOpen, setSearchOpen] = useState(false);

  // Raccourci ⌘K / Ctrl+K pour ouvrir la modale
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AssetTypeIcon kind={KIND[assetType]} size={40} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{TITLES[assetType]}</h1>
            {/* Hauteur réservée en permanence → pas de saut au (re)chargement */}
            <p className="text-sm text-muted-foreground mt-1 h-5">
              {!loading && !error ? `${items.length} actif${items.length > 1 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>

        <Button onClick={() => setSearchOpen(true)} className="gap-2 cursor-pointer">
          <Search className="h-4 w-4" />
          Rechercher
          <kbd className="ml-1 hidden sm:inline-flex items-center gap-0.5 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </Button>
      </div>

      {/* Contenu */}
      {error ? (
        <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Erreur : {error}
        </div>
      ) : assetType === "stock" ? (
        /* Pipeline markets (étape 1c) — actions */
        <StockWatchlistTable
          items={items}
          loading={loading}
          listRefreshing={refreshing}
          onRemoveAction={remove}
          onToggleFavoriteAction={toggleFavorite}
        />
      ) : assetType === "crypto" ? (
        /* Pipeline markets (étape 2c) — crypto */
        <CryptoWatchlistTable
          items={items}
          loading={loading}
          listRefreshing={refreshing}
          onRemoveAction={remove}
          onToggleFavoriteAction={toggleFavorite}
        />
      ) : assetType === "etf" ? (
        /* Pipeline markets (étape 3c) — ETF */
        <EtfWatchlistTable
          items={items}
          loading={loading}
          listRefreshing={refreshing}
          onRemoveAction={remove}
          onToggleFavoriteAction={toggleFavorite}
        />
      ) : assetType === "index" ? (
        /* Pipeline markets (étape 4c) — indices */
        <IndexWatchlistTable
          items={items}
          loading={loading}
          listRefreshing={refreshing}
          onRemoveAction={remove}
          onToggleFavoriteAction={toggleFavorite}
        />
      ) : assetType === "currency" ? (
        /* Pipeline markets (étape 5c) — forex */
        <ForexWatchlistTable
          items={items}
          loading={loading}
          listRefreshing={refreshing}
          onRemoveAction={remove}
          onToggleFavoriteAction={toggleFavorite}
        />
      ) : assetType === "bond" ? (
        /* Pipeline markets (étape 6c) — obligations souveraines */
        <BondWatchlistTable
          items={items}
          loading={loading}
          listRefreshing={refreshing}
          onRemoveAction={remove}
          onToggleFavoriteAction={toggleFavorite}
        />
      ) : null}

      {/* Modale de recherche */}
      <AssetSearchModal
        assetType={assetType}
        open={searchOpen}
        onOpenChangeAction={setSearchOpen}
        onAddedAction={refresh}
        existingSymbols={items.map((i) => i.symbol)}
      />
    </div>
  );
}
