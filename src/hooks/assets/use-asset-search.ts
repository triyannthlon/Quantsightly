"use client";

import { useState, useEffect, useRef } from "react";
import { QuantsightlyApi } from "@/lib/quantsightly/api-clients";
import type { SearchResult } from "@/lib/quantsightly/types";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; results: SearchResult[] }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

/**
 * Hook de recherche d'actifs avec debounce.
 * Appelle /api/search/{query} après 300ms d'inactivité.
 * Annule les requêtes obsolètes si la query change avant la réponse.
 */
export function useAssetSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const requestIdRef = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) {
      // Invalide toute requête en cours sans appeler setState de façon synchrone
      requestIdRef.current++;
      return;
    }

    const currentRequestId = ++requestIdRef.current;

    const timer = setTimeout(async () => {
      setState({ status: "loading" });

      const res = await QuantsightlyApi.search(trimmed);

      // Ignore si une nouvelle requête a été lancée entre-temps
      if (currentRequestId !== requestIdRef.current) return;

      if (res.error) {
        setState({ status: "error", message: res.error });
      } else if (res.data) {
        setState({ status: "success", results: res.data });
      } else {
        setState({ status: "success", results: [] });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  // État "idle" dérivé au render — évite un setState synchrone dans l'effet
  if (trimmed.length < MIN_LENGTH) return { status: "idle" };
  return state;
}