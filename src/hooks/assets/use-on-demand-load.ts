"use client";

import { useState, useRef, useCallback } from "react";
import { QuantsightlyApi } from "@/lib/quantsightly/api-clients";
import { isETFLike } from "@/lib/quantsightly/detect-input-format";

type LoadState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "polling"; symbol: string; elapsedSec: number }
  | { status: "success"; symbol: string; route: "stock" | "etf"; name?: string }
  | { status: "error"; code: "not_found" | "timeout" | "server"; message: string };

const MAX_DURATION_MS = 60_000;
const RETRY_INTERVAL_MS = 5_000;

/**
 * Hook de chargement on-demand d'un actif inconnu.
 * 1. Appelle /api/stock/{symbol}/fundamentals → 202 (enqueue automatique)
 * 2. Poll toutes les 5s pendant max 60s
 * 3. Retourne le route (stock/etf) et le name dès réception 200
 */
export function useOnDemandLoad() {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const cancelRef = useRef(false);

  const reset = useCallback(() => {
    cancelRef.current = true;
    setState({ status: "idle" });
  }, []);

  const load = useCallback(async (rawInput: string) => {
    const symbol = rawInput.trim().toUpperCase();
    if (!symbol) return;

    cancelRef.current = false;
    setState({ status: "submitting" });

    const startTime = Date.now();

    const pollOnce = async (): Promise<void> => {
      if (cancelRef.current) return;

      const elapsed = Date.now() - startTime;
      if (elapsed >= MAX_DURATION_MS) {
        setState({
          status: "error",
          code: "timeout",
          message: `Le chargement a dépassé ${MAX_DURATION_MS / 1000}s. Réessayez plus tard.`,
        });
        return;
      }

      const res = await QuantsightlyApi.fundamentals(symbol);

      if (cancelRef.current) return;

      if (res.notFound) {
        setState({
          status: "error",
          code: "not_found",
          message: `Le symbol « ${symbol} » n'existe pas chez notre fournisseur de données.`,
        });
        return;
      }

      if (res.error) {
        setState({
          status: "error",
          code: "server",
          message: res.error,
        });
        return;
      }

      if (res.data) {
        // 200 OK — chargement terminé
        const type = (res.data.sections.general?.["Type"] as string | undefined) ?? "stock";
        const name = res.data.sections.general?.["Name"] as string | undefined;
        const route = isETFLike(type) ? "etf" : "stock";
        setState({ status: "success", symbol, route, name });
        return;
      }

      if (res.loading) {
        // 202 — encore en cours, on poll
        setState({
          status: "polling",
          symbol,
          elapsedSec: Math.floor(elapsed / 1000),
        });
        const wait = (res.loading.retry_after ?? 5) * 1000;
        setTimeout(pollOnce, Math.min(wait, RETRY_INTERVAL_MS));
        return;
      }

      // Cas inattendu
      setState({
        status: "error",
        code: "server",
        message: `Réponse inattendue (HTTP ${res.status})`,
      });
    };

    await pollOnce();
  }, []);

  return { state, load, reset };
}