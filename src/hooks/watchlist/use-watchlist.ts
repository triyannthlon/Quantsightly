"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getWatchlist,
  resolveCatalog,
  removeFromWatchlist,
  setFavorite,
  type AssetType,
  type EnrichedWatchlistItem,
} from "@/lib/markets/watchlist/clients/watchlist-client";

type State = {
  items: EnrichedWatchlistItem[];
  loading: boolean;
  error: string | null;
};

export function useWatchlist(assetType: AssetType) {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null });
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const wl = await getWatchlist(assetType);
        if (ignore) return;

        if (wl.items.length === 0) {
          setState({ items: [], loading: false, error: null });
          return;
        }

        const symbols = wl.items.map((i) => i.symbol);
        const resolved = await resolveCatalog(symbols);
        if (ignore) return;

        const bySymbol = new Map(resolved.map((r) => [r.symbol, r]));

        const enriched: EnrichedWatchlistItem[] = wl.items.map((item) => {
          const meta = bySymbol.get(item.symbol);
          return {
            ...item,
            name: meta?.name,
            exchangeCode: meta?.exchange_code,
            assetTypeRaw: meta?.type,
            isin: meta?.isin,
            currency: meta?.currency,
            country: meta?.country,
            countryIso2: meta?.country_iso2,
          };
        });

        setState({ items: enriched, loading: false, error: null });
      } catch (err) {
        if (ignore) return;
        setState({
          items: [],
          loading: false,
          error: err instanceof Error ? err.message : "Erreur de chargement",
        });
      } finally {
        if (!ignore) setRefreshing(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [assetType, refreshToken]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshToken((n) => n + 1);
  }, []);

  const remove = useCallback(
    async (itemId: string) => {
      setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) }));
      try {
        await removeFromWatchlist(assetType, itemId);
      } catch {
        setRefreshToken((n) => n + 1);
      }
    },
    [assetType],
  );

  // Mise à jour optimiste : bascule isFavorite immédiatement, rollback si erreur
  const toggleFavorite = useCallback(
    async (itemId: string) => {
      let newValue = false;
      let itemLabel = itemId;
      setState((s) => {
        const items = s.items.map((i) => {
          if (i.id !== itemId) return i;
          newValue = !i.isFavorite;
          itemLabel = i.name ?? i.symbol;
          return { ...i, isFavorite: newValue };
        });
        return { ...s, items };
      });
      if (newValue) {
        toast.success("Ajouté au dashboard principal", { description: itemLabel, duration: 4000 });
      } else {
        toast.info("Retiré du dashboard principal", { description: itemLabel, duration: 4000 });
      }
      try {
        await setFavorite(assetType, itemId, newValue);
      } catch {
        setRefreshToken((n) => n + 1);
      }
    },
    [assetType],
  );

  return { ...state, refresh, remove, toggleFavorite, refreshing };
}
