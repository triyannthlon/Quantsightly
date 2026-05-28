"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getWatchlist,
    resolveCatalog,
    removeFromWatchlist,
    type AssetType,
    type EnrichedWatchlistItem,
} from "@/lib/quantsightly/watchlist-client";

type State = {
    items   : EnrichedWatchlistItem[];
    loading : boolean;
    error   : string | null;
};

export function useWatchlist(assetType: AssetType) {
    const [state, setState] = useState<State>({ items: [], loading: true, error: null });
    const [refreshToken, setRefreshToken] = useState(0);

    useEffect(() => {
        let ignore = false;

        (async () => {
            try {
                // 1. Watchlist (symbols + ids) depuis Prisma
                const wl = await getWatchlist(assetType);
                if (ignore) return;

                if (wl.items.length === 0) {
                    setState({ items: [], loading: false, error: null });
                    return;
                }

                // 2. Résolution des métadonnées depuis le catalogue (API C++)
                const symbols  = wl.items.map((i) => i.symbol);
                const resolved = await resolveCatalog(symbols);
                if (ignore) return;

                const bySymbol = new Map(resolved.map((r) => [r.symbol, r]));

                // 3. Merge
                const enriched: EnrichedWatchlistItem[] = wl.items.map((item) => {
                    const meta = bySymbol.get(item.symbol);
                    return {
                        ...item,
                        name         : meta?.name,
                        exchangeCode : meta?.exchange_code,
                        assetTypeRaw : meta?.type,
                        isin         : meta?.isin,
                        currency     : meta?.currency,
                        country      : meta?.country,
                        countryIso2  : meta?.country_iso2,
                    };
                });

                setState({ items: enriched, loading: false, error: null });
            } catch (err) {
                if (ignore) return;
                setState({
                    items   : [],
                    loading : false,
                    error   : err instanceof Error ? err.message : "Erreur de chargement",
                });
            }
        })();

        return () => { ignore = true; };
    }, [assetType, refreshToken]);

    // Refresh = incrémente le token → relance le useEffect
    const refresh = useCallback(() => {
        setRefreshToken((n) => n + 1);
    }, []);

    // Suppression optimiste (dans un event handler, pas un effet → ESLint OK)
    const remove = useCallback(async (itemId: string) => {
        setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) }));
        try {
            await removeFromWatchlist(assetType, itemId);
        } catch {
            setRefreshToken((n) => n + 1); // rollback via refetch
        }
    }, [assetType]);

    return { ...state, refresh, remove };
}