"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchQuote, type Quote } from "@/lib/quantsightly/quote-client";

const POLL_MS      = 5_000;  // intervalle de poll d'un ticker en cours de chargement
const MAX_ATTEMPTS = 12;     // 12 × 5s ≈ 60s avant abandon
const CONCURRENCY  = 6;      // nb de requêtes simultanées max

/**
 * Récupère les cotations (prix + variation) d'une liste de symbols.
 *
 * - Charge en parallèle (pool de CONCURRENCY requêtes).
 * - Pour un ticker non encore chargé (status "loading"), poll toutes les 5s
 *   jusqu'à MAX_ATTEMPTS, puis bascule en "unavailable".
 * - `refreshKey` : incrémenter pour forcer un rechargement complet.
 *
 * Retourne un dictionnaire { [symbol]: Quote }. Un symbol absent du dico
 * est considéré comme "en cours de chargement" par l'UI.
 */
export function useQuotes(symbols: string[], refreshKey = 0) {
    const [quotes, setQuotes] = useState<Record<string, Quote>>({});

    // Clé stable : ne relance l'effet que si la liste de symbols change réellement
    const key = symbols.join(",");

    useEffect(() => {
        const list = key ? key.split(",") : [];
        if (list.length === 0) return;

        let cancelled = false;
        const timers: ReturnType<typeof setTimeout>[] = [];
        const attempts: Record<string, number> = {};

        const fetchOne = async (symbol: string): Promise<void> => {
            if (cancelled) return;

            const q = await fetchQuote(symbol);
            if (cancelled) return;

            setQuotes((prev) => ({ ...prev, [symbol]: q }));

            if (q.status === "loading") {
                attempts[symbol] = (attempts[symbol] ?? 0) + 1;

                if (attempts[symbol] < MAX_ATTEMPTS) {
                    timers.push(setTimeout(() => { void fetchOne(symbol); }, POLL_MS));
                } else {
                    setQuotes((prev) => ({ ...prev, [symbol]: { symbol, status: "unavailable" } }));
                }
            }
        };

        // Pool de concurrence : on dépile `list` avec CONCURRENCY workers
        void (async () => {
            const queue = [...list];
            const worker = async (): Promise<void> => {
                while (queue.length > 0 && !cancelled) {
                    const symbol = queue.shift();
                    if (symbol) await fetchOne(symbol);
                }
            };
            await Promise.all(
                Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
            );
        })();

        return () => {
            cancelled = true;
            timers.forEach((t) => clearTimeout(t));
        };
    }, [key, refreshKey]);

    return quotes;
}

/** Petit hook utilitaire pour un bouton "Actualiser les cours". */
export function useQuoteRefresh() {
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = useCallback(() => setRefreshKey((n) => n + 1), []);
    return { refreshKey, refresh };
}
