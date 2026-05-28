const QS_API = process.env.NEXT_PUBLIC_QS_API_URL ?? "/qs-api";

export type AssetType = "stock" | "etf" | "crypto" | "currency";

export type WatchlistItem = {
    id           : string;
    symbol       : string;
    positionRank : number;
    addedAt      : string;
};

export type WatchlistResponse = {
    watchlistId : string;
    assetType   : string;
    items       : WatchlistItem[];
    count       : number;
};

export type ResolvedAsset = {
    symbol         : string;
    name           : string;
    code          ?: string;
    exchange_code ?: string;
    sub_market    ?: string;
    type          ?: string;
    isin          ?: string;
    currency      ?: string;
    country       ?: string;
    country_iso2  ?: string;
};

/** Item de watchlist + métadonnées résolues depuis le catalogue */
export type EnrichedWatchlistItem = WatchlistItem & {
    name         ?: string;
    exchangeCode ?: string;
    assetTypeRaw ?: string;     // "Common Stock", "ETF"... (type EODHD)
    isin         ?: string;
    currency     ?: string;
    country      ?: string;
    countryIso2  ?: string;
};

export type SearchResult = {
    primary_symbol : string;
    code          ?: string;
    exchange_code ?: string;
    sub_market    ?: string;
    name           : string;
    type          ?: string;
    isin          ?: string;
    currency      ?: string;
    country       ?: string;
    country_iso2  ?: string;
    matched_via   ?: string;
    score         ?: number;
};

// ── Recherche catalogue (API C++ via /api/search) ─────────────

export async function searchCatalog(
    query: string,
    limit = 50,
    type?: string,): Promise<SearchResult[]> {
    const qs = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    if (type) qs.set("type", type);
    const res = await fetch(`${QS_API}/api/search?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`searchCatalog ${res.status}`);
    return res.json();
}


// ── Watchlist (API Next.js / Prisma) ──────────────────────────

export async function getWatchlist(type: AssetType): Promise<WatchlistResponse> {
    const res = await fetch(`/api/me/watchlist/${type}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`getWatchlist ${res.status}`);
    return res.json();
}

export async function addToWatchlist(type: AssetType, symbols: string[]): Promise<WatchlistResponse> {
    const res = await fetch(`/api/me/watchlist/${type}/items`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ symbols }),
    });
    if (!res.ok) throw new Error(`addToWatchlist ${res.status}`);
    return res.json();
}

export async function removeFromWatchlist(type: AssetType, itemId: string): Promise<void> {
    const res = await fetch(`/api/me/watchlist/${type}/items/${itemId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) throw new Error(`removeFromWatchlist ${res.status}`);
}

// ── Resolve (API C++ via proxy /qs-api) ───────────────────────

export async function resolveCatalog(symbols: string[]): Promise<ResolvedAsset[]> {
    if (symbols.length === 0) return [];
    const qs = encodeURIComponent(symbols.join(","));
    const res = await fetch(`${QS_API}/api/catalog/resolve?symbols=${qs}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`resolveCatalog ${res.status}`);
    return res.json();
}