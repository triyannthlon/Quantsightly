"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getWatchlist,
  resolveCatalog,
  setFavorite,
  type AssetType,
  type EnrichedWatchlistItem,
} from "@/lib/markets/watchlist/clients/watchlist-client";
import { fetchAuth } from "@/lib/api/fetch-auth";
import { toast } from "sonner";

export type DashboardFavorite = EnrichedWatchlistItem & { assetType: AssetType };

const ASSET_TYPES: AssetType[] = ["stock", "etf", "crypto", "currency", "index"];

// ── API helpers ───────────────────────────────────────────────

async function fetchLayout(): Promise<string[]> {
  const res = await fetchAuth("/api/me/dashboard/layout", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { layout: string[] };
  return data.layout ?? [];
}

async function saveLayout(ids: string[]): Promise<void> {
  await fetchAuth("/api/me/dashboard/layout", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout: ids }),
  });
}

// ── Tri selon layout sauvegardé ───────────────────────────────

function applyLayout(favorites: DashboardFavorite[], layout: string[]): DashboardFavorite[] {
  if (layout.length === 0) return favorites;
  const indexMap = new Map(layout.map((id, i) => [id, i]));
  return [...favorites].sort((a, b) => {
    const ia = indexMap.get(a.id) ?? Infinity;
    const ib = indexMap.get(b.id) ?? Infinity;
    return ia - ib;
  });
}

// ── Hook ──────────────────────────────────────────────────────

type State = {
  favorites: DashboardFavorite[];
  loading: boolean;
  error: string | null;
};

export function useDashboardFavorites() {
  const [state, setState] = useState<State>({ favorites: [], loading: true, error: null });
  const [refreshToken, setRefresh] = useState(0);

  // Référence stable pour le debounce de sauvegarde
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        // Charger favoris + layout en parallèle
        const [results, layout] = await Promise.all([
          Promise.all(ASSET_TYPES.map((t) => getWatchlist(t))),
          fetchLayout(),
        ]);

        const rawFavorites: DashboardFavorite[] = results.flatMap((wl, i) =>
          wl.items
            .filter((item) => item.isFavorite)
            .map((item) => ({ ...item, assetType: ASSET_TYPES[i] })),
        );

        if (ignore) return;

        if (rawFavorites.length === 0) {
          setState({ favorites: [], loading: false, error: null });
          return;
        }

        const symbols = rawFavorites.map((i) => i.symbol);
        const resolved = await resolveCatalog(symbols);
        if (ignore) return;

        const bySymbol = new Map(resolved.map((r) => [r.symbol, r]));

        const enriched: DashboardFavorite[] = rawFavorites.map((item) => {
          const meta = bySymbol.get(item.symbol);
          return {
            ...item,
            name: meta?.name ?? item.name,
            exchangeCode: meta?.exchange_code ?? item.exchangeCode,
            assetTypeRaw: meta?.type ?? item.assetTypeRaw,
            isin: meta?.isin ?? item.isin,
            currency: meta?.currency ?? item.currency,
            country: meta?.country ?? item.country,
            countryIso2: meta?.country_iso2 ?? item.countryIso2,
          };
        });

        setState({ favorites: applyLayout(enriched, layout), loading: false, error: null });
      } catch (err) {
        if (ignore) return;
        setState({
          favorites: [],
          loading: false,
          error: err instanceof Error ? err.message : "Erreur de chargement",
        });
      }
    })();

    return () => {
      ignore = true;
    };
  }, [refreshToken]);

  // ── Réordonner (DnD) — sauvegarde déboncée 800 ms ─────────

  const reorder = useCallback((newFavorites: DashboardFavorite[]) => {
    setState((s) => ({ ...s, favorites: newFavorites }));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveLayout(newFavorites.map((f) => f.id));
    }, 800);
  }, []);

  // ── Retrait d'un favori ────────────────────────────────────

  const removeFavorite = useCallback(async (item: DashboardFavorite) => {
    setState((s) => ({ ...s, favorites: s.favorites.filter((f) => f.id !== item.id) }));
    try {
      await setFavorite(item.assetType, item.id, false);
      toast.info("Retiré du dashboard principal", {
        description: item.name ?? item.symbol,
        duration: 4000,
      });
    } catch {
      setRefresh((n) => n + 1);
    }
  }, []);

  return { ...state, reorder, removeFavorite };
}
