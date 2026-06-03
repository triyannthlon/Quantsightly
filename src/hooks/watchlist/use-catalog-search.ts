"use client";

import { useState, useEffect } from "react";
import { searchCatalog, type SearchResult } from "@/lib/yann/watchlist/clients/watchlist-client";
import type { AssetType } from "@/lib/yann/watchlist/clients/watchlist-client";

type SearchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; results: SearchResult[] }
    | { status: "error"; message: string };

const DEBOUNCE_MS = 250;
const MIN_LENGTH  = 2;

export function useCatalogSearch(query: string, type: AssetType): SearchState {
    const [state, setState] = useState<SearchState>({ status: "idle" });

    useEffect(() => {
        const trimmed = query.trim();
        let ignore = false;

        const timer = setTimeout(() => {
            if (trimmed.length < MIN_LENGTH) {
                if (!ignore) setState({ status: "idle" });
                return;
            }

            setState({ status: "loading" });

            searchCatalog(trimmed, 50, type)
                .then((results) => {
                    if (!ignore) setState({ status: "success", results });
                })
                .catch((err) => {
                    if (!ignore) {
                        setState({
                            status  : "error",
                            message : err instanceof Error ? err.message : "Erreur de recherche",
                        });
                    }
                });
        }, DEBOUNCE_MS);

        return () => {
            ignore = true;
            clearTimeout(timer);
        };
    }, [query, type]);

    return state;
}