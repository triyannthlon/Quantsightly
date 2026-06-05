const QS_API = process.env.NEXT_PUBLIC_QS_API_URL ?? "/qs-api";

/** Session terminée (401) → retour direct à la page de connexion. */
function redirectToSignIn(): void {
    if (typeof window !== "undefined") window.location.href = "/";
}

export type AssetType = "stock" | "etf" | "crypto" | "currency" | "index";

export type WatchlistItem = {
    id           : string;
    symbol       : string;
    positionRank : number;
    isFavorite   : boolean;
    addedAt      : string;
};

export type WatchlistResponse = {
    watchlistId : string;
    assetType   : string;
    items       : WatchlistItem[];
    count       : number;
};

type ResolvedAsset = {
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

// ── Recherche catalogue ────────────────────────────────────────

export type SearchFilters = {
    country?  : string;   // ISO 3166-1 alpha-2, e.g. "FR"
    currency? : string;   // ISO 4217, e.g. "EUR"
    exchange? : string;   // exchange_code, e.g. "PA"
};

export async function searchCatalog(
    query   : string,
    limit   = 50,
    type   ?: string,
    filters?: SearchFilters,
): Promise<SearchResult[]> {
    const qs = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    if (type)              qs.set("type",     type);
    if (filters?.country)  qs.set("country",  filters.country);
    if (filters?.currency) qs.set("currency", filters.currency);
    if (filters?.exchange) qs.set("exchange", filters.exchange);
    const res = await fetch(`/api/search?${qs}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`searchCatalog ${res.status}`);
    return res.json();
}


// ── Watchlist (API Next.js / Prisma) ──────────────────────────

export async function getWatchlist(type: AssetType): Promise<WatchlistResponse> {
    const res = await fetch(`/api/me/watchlist/${type}`, { cache: "no-store" });
    if (res.status === 401) { redirectToSignIn(); throw new Error("unauthorized"); }
    if (!res.ok) throw new Error(`getWatchlist ${res.status}`);
    return res.json();
}

export async function addToWatchlist(type: AssetType, symbols: string[]): Promise<WatchlistResponse> {
    const res = await fetch(`/api/me/watchlist/${type}/items`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ symbols }),
    });
    if (res.status === 401) { redirectToSignIn(); throw new Error("unauthorized"); }
    if (!res.ok) throw new Error(`addToWatchlist ${res.status}`);
    return res.json();
}

export async function removeFromWatchlist(type: AssetType, itemId: string): Promise<void> {
    const res = await fetch(`/api/me/watchlist/${type}/items/${itemId}`, { method: "DELETE" });
    if (res.status === 401) { redirectToSignIn(); throw new Error("unauthorized"); }
    if (!res.ok && res.status !== 204) throw new Error(`removeFromWatchlist ${res.status}`);
}

export async function setFavorite(type: AssetType, itemId: string, value: boolean): Promise<void> {
    const res = await fetch(`/api/me/watchlist/${type}/items/${itemId}`, {
        method : "PATCH",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ isFavorite: value }),
    });
    if (res.status === 401) { redirectToSignIn(); throw new Error("unauthorized"); }
    if (!res.ok && res.status !== 204) throw new Error(`setFavorite ${res.status}`);
}

// ── Resolve (API C++ via proxy /qs-api) ───────────────────────

export async function resolveCatalog(symbols: string[]): Promise<ResolvedAsset[]> {
    if (symbols.length === 0) return [];
    const qs = encodeURIComponent(symbols.join(","));
    const res = await fetch(`${QS_API}/api/catalog/resolve?symbols=${qs}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`resolveCatalog ${res.status}`);
    return res.json();
}