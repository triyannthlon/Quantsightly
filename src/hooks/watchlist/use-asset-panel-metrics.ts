"use client";

import { useState, useEffect }          from "react";
import { fetchHistory }                  from "@/lib/yann/clients/history";
import { buildNormalizedSeries }         from "@/lib/yann/series/normalize";
import type { PanelMetrics }             from "@/lib/yann/analytics/metrics";
import type { NormalizedSeries }         from "@/lib/yann/series/types";
import type { EnrichedWatchlistItem }    from "@/lib/yann/watchlist/clients/watchlist-client";

export type { PanelMetrics };

type Status = "loading" | "ok" | "unavailable";

const POLL_MS      = 5_000;
const MAX_ATTEMPTS = 12;

export function useAssetPanelMetrics(item: EnrichedWatchlistItem) {
    const [series, setSeries] = useState<NormalizedSeries | null>(null);
    const [status, setStatus] = useState<Status>("loading");

    const symbol     = item.symbol;
    const seriesKind = item.exchangeCode === "CC" ? "calendar" : "weekday" as const;

    useEffect(() => {
        let cancelled = false;
        let attempts  = 0;
        let timer     : ReturnType<typeof setTimeout> | null = null;

        setStatus("loading");
        setSeries(null);

        const load = async () => {
            const { status: histStatus, history } = await fetchHistory(symbol);
            if (cancelled) return;

            if (histStatus === "unavailable") { setStatus("unavailable"); return; }

            if (histStatus === "loading") {
                attempts++;
                if (attempts < MAX_ATTEMPTS) { timer = setTimeout(() => { void load(); }, POLL_MS); }
                else                         { setStatus("unavailable"); }
                return;
            }

            setSeries(buildNormalizedSeries(history, seriesKind));
            setStatus("ok");
        };

        void load();
        return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, [symbol, seriesKind]);

    return { series, status };
}
