"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchHistory, type HistoryResult } from "@/lib/markets/clients/history";
import type { RowStatus } from "@/lib/markets";
import type { EnrichedWatchlistItem } from "@/lib/markets/watchlist/clients/watchlist-client";

export type RowState<TRow> = {
  row?: TRow;
  status: RowStatus;
};

export type BuildRow<TRow> = (item: EnrichedWatchlistItem, raw: HistoryResult) => TRow;

const POLL_MS = 5_000;
const MAX_ATTEMPTS = 12; // 12 × 5s = 60s
const CONCURRENCY = 4;

export function useWatchlistRows<TRow>(items: EnrichedWatchlistItem[], build: BuildRow<TRow>) {
  const [rows, setRows] = useState<Record<string, RowState<TRow>>>({});
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const itemsRef = useRef<EnrichedWatchlistItem[]>([]);
  const buildRef = useRef<BuildRow<TRow>>(build);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  const key = items.map((i) => i.symbol).join(",");

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const list = itemsRef.current;
    if (list.length === 0) {
      setRefreshing(false);
      return;
    }

    const force = tick > 0;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const attempts: Record<string, number> = {};

    const handle = async (item: EnrichedWatchlistItem, forceThis: boolean): Promise<void> => {
      if (cancelled) return;

      const raw = await fetchHistory(item.symbol, forceThis);
      if (cancelled) return;

      const row = buildRef.current(item, raw);
      setRows((prev) => ({ ...prev, [item.symbol]: { row, status: raw.status } }));

      if (raw.status === "loading") {
        attempts[item.symbol] = (attempts[item.symbol] ?? 0) + 1;
        if (attempts[item.symbol] < MAX_ATTEMPTS) {
          timers.push(
            setTimeout(() => {
              void handle(item, false);
            }, POLL_MS),
          );
        } else {
          setRows((prev) => ({ ...prev, [item.symbol]: { status: "unavailable" } }));
        }
      }
    };

    void (async () => {
      const queue = [...list];
      const worker = async (): Promise<void> => {
        while (queue.length > 0 && !cancelled) {
          const item = queue.shift();
          if (item) await handle(item, force);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
      if (!cancelled) setRefreshing(false);
    })();

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [key, tick]);

  return { rows, refresh, refreshing };
}
