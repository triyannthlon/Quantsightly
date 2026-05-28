"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/watchlist/use-watchlist";
import { WatchlistTable } from "@/components/custom/watchlist/watchlist-table";
import { AssetSearchModal } from "./asset-search-modal";
import type { AssetType } from "@/lib/quantsightly/watchlist-client";

const TITLES: Record<AssetType, string> = {
    stock    : "Actions",
    etf      : "ETF",
    crypto   : "Cryptomonnaies",
    currency : "Devises",
};

export function ScreenerPage({ assetType }: { assetType: AssetType }) {
    const { items, loading, error, remove, refresh } = useWatchlist(assetType);
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
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{TITLES[assetType]}</h1>
                    {!loading && !error && (
                        <p className="text-sm text-muted-foreground mt-1">
                            {items.length} actif{items.length > 1 ? "s" : ""}
                        </p>
                    )}
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
            ) : (
                <WatchlistTable items={items} loading={loading} onRemoveAction={remove} />
            )}

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