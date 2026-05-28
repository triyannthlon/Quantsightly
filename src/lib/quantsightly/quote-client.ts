const QS_API = process.env.NEXT_PUBLIC_QS_API_URL ?? "/qs-api";

// ──────────────────────────────────────────────────────────── //
// Cotation d'un actif : dernier prix + variation journalière     //
// ──────────────────────────────────────────────────────────── //

export type QuoteStatus = "loading" | "ok" | "unavailable";

export type Quote = {
    symbol      : string;
    status      : QuoteStatus;
    price      ?: number;   // dernier close
    change     ?: number;   // variation absolue (close - prevClose)
    changePct  ?: number;   // variation en %
    asOf       ?: string;   // date du dernier point (YYYY-MM-DD)
};

type Bar = { date?: string; close?: number };

/** Parse tolérant : nombre ou chaîne numérique → number | undefined */
function num(v: unknown): number | undefined {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

/**
 * Extrait un tableau de barres OHLCV depuis la réponse de l'historique.
 * Tolérant au format : tableau direct, ou objet { history | data | prices | results: [...] }.
 * ⚠️ Si le JSON réel de /api/stock/:symbol/history diffère, ajuster ICI uniquement.
 */
function extractBars(raw: unknown): Bar[] {
    let arr: unknown = raw;

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const o = raw as Record<string, unknown>;
        arr = o.history ?? o.data ?? o.prices ?? o.results ?? [];
    }

    if (!Array.isArray(arr)) return [];

    return arr.map((b) => {
        const o = (b ?? {}) as Record<string, unknown>;
        return {
            date : (o.date ?? o.datetime ?? o.timestamp) as string | undefined,
            close: num(o.close ?? o.adjusted_close ?? o.adjclose ?? o.c ?? o.price),
        };
    });
}

/**
 * Déclenche le chargement on-demand d'un ticker inconnu.
 * Le snapshot /api/stock/:symbol enqueue un initial_load côté API C++
 * (réponse 202). On ne lit pas le body — c'est un simple "réveil".
 */
async function triggerLoad(encodedSymbol: string): Promise<void> {
    try {
        await fetch(`${QS_API}/api/stock/${encodedSymbol}`, { cache: "no-store" });
    } catch {
        /* best-effort : on ignore les erreurs réseau du trigger */
    }
}

/**
 * Récupère la cotation d'un symbol.
 *  - 200 + barres   → { ok, price, change, changePct }
 *  - 202 / 404 / [] → déclenche le chargement + { loading }
 *  - autre erreur   → { unavailable }
 */
export async function fetchQuote(symbol: string): Promise<Quote> {
    const enc = encodeURIComponent(symbol);

    let res: Response;
    try {
        res = await fetch(`${QS_API}/api/stock/${enc}/history?limit=2`, { cache: "no-store" });
    } catch {
        return { symbol, status: "unavailable" };
    }

    if (res.status === 202 || res.status === 404) {
        void triggerLoad(enc);
        return { symbol, status: "loading" };
    }

    if (!res.ok) return { symbol, status: "unavailable" };

    let bars: Bar[];
    try {
        bars = extractBars(await res.json());
    } catch {
        return { symbol, status: "unavailable" };
    }

    // Garde les barres avec close, trie par date décroissante (plus récent en tête)
    const valid = bars
        .filter((b) => b.close !== undefined)
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    if (valid.length === 0) {
        void triggerLoad(enc);
        return { symbol, status: "loading" };
    }

    const price = valid[0].close as number;
    const prev  = valid[1]?.close;

    const change    = prev !== undefined ? price - prev : undefined;
    const changePct = prev !== undefined && prev !== 0 ? ((price - prev) / prev) * 100 : undefined;

    return { symbol, status: "ok", price, change, changePct, asOf: valid[0].date };
}

// ──────────────────────────────────────────────────────────── //
// Helpers de formatage                                          //
// ──────────────────────────────────────────────────────────── //

export function formatPrice(value: number | undefined, currency?: string): string {
    if (value === undefined) return "—";

    const fractionDigits = Math.abs(value) < 1 ? 6 : 2;
    const opts: Intl.NumberFormatOptions = {
        minimumFractionDigits: 2,
        maximumFractionDigits: fractionDigits,
    };

    if (currency && /^[A-Z]{3}$/.test(currency)) {
        try {
            return new Intl.NumberFormat("fr-FR", { style: "currency", currency, ...opts }).format(value);
        } catch {
            /* devise non reconnue par Intl → fallback nombre nu */
        }
    }
    return new Intl.NumberFormat("fr-FR", opts).format(value);
}

export function formatPct(value: number | undefined): string {
    if (value === undefined) return "—";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)} %`;
}
