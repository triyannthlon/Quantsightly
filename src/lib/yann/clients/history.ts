import type { EodBar } from "@/lib/yann/analytics/metrics";

const QS_API = process.env.NEXT_PUBLIC_QS_API_URL ?? "/qs-api";

const TTL_MS = 6 * 60 * 60 * 1000;   // 6 h

export type HistoryResult = {
    status  : "loading" | "ok" | "unavailable";
    history : EodBar[];
};

type Entry = {
    history ?: EodBar[];
    ts      ?: number;
};

const CACHE = new Map<string, Entry>();

async function fetchJson(url: string): Promise<{ status: number; body: unknown }> {
    try {
        const res  = await fetch(url);
        let   body: unknown = null;
        try { body = await res.json(); } catch { /* corps non-JSON */ }
        return { status: res.status, body };
    } catch {
        return { status: 0, body: null };
    }
}

/** Déclenche le chargement on-demand côté API C++ (réveil fire-and-forget, idempotent). */
function triggerLoad(encodedSymbol: string): void {
    void fetch(`${QS_API}/api/stock/${encodedSymbol}`, { cache: "no-store" }).catch(() => {});
}

/** Pré-chauffe le on-demand pour une liste de symbols sans attendre la réponse. */
export function warmSymbols(symbols: string[]): void {
    for (const symbol of symbols) triggerLoad(encodeURIComponent(symbol));
}

/** Récupère (et cache) l'historique EOD complet d'un symbol. */
export async function fetchHistory(symbol: string, force = false): Promise<HistoryResult> {
    const enc = encodeURIComponent(symbol);
    const now = Date.now();
    const e: Entry = CACHE.get(symbol) ?? {};

    const stale = force || !(e.history && e.history.length > 0 && e.ts && now - e.ts < TTL_MS);

    let unavailable = false;

    if (stale) {
        await fetchJson(`${QS_API}/api/stock/${enc}/history`).then(({ status, body }) => {
            if (status === 202) return;
            if (status === 200 && body && typeof body === "object") {
                const data = (body as { data?: unknown }).data;
                if (Array.isArray(data) && data.length > 0) {
                    e.history = data as EodBar[];
                    e.ts      = now;
                }
                return;
            }
            unavailable = true;
        });
    }

    CACHE.set(symbol, e);

    const hasHistory = !!(e.history && e.history.length > 0);

    const status: HistoryResult["status"] =
        hasHistory   ? "ok"          :
        unavailable  ? "unavailable" :
                       "loading";

    if (!hasHistory && !unavailable) warmSymbols([symbol]);

    return { status, history: e.history ?? [] };
}

/** Lecture directe du cache (pour le futur graphique, sans refetch). */
export function peekHistory(symbol: string): EodBar[] | undefined {
    return CACHE.get(symbol)?.history;
}