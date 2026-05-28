"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAssetSearch } from "@/hooks/assets/use-asset-search";
import { SearchResultItem } from "@/components/custom/assets/search-result-item";
import { isETFLike,} from "@/lib/quantsightly/detect-input-format";
import type { SearchResult } from "@/lib/quantsightly/types";
import { LoadAssetCta } from "@/components/custom/assets/load-asset-cta";

const MAX_RESULTS = 8;

export function UniversalSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  // true = l'utilisateur n'a pas fermé explicitement (Escape, clic dehors, clear)
  const [isOpen, setIsOpen] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchState = useAssetSearch(query);

  const results =
    searchState.status === "success" ? searchState.results.slice(0, MAX_RESULTS) : [];

  // Dropdown visible uniquement si : l'utilisateur n'a pas fermé + query assez longue + recherche active.
  // Pas d'effet synchrone nécessaire — tout est dérivé au render.
  const showDropdown = isOpen && query.trim().length >= 2 && searchState.status !== "idle";

  // Ferme au clic en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset highlight quand le nombre de résultats change.
  // Pattern React recommandé : useState pour la valeur précédente, setState pendant le render
  const [prevResultsLength, setPrevResultsLength] = useState(results.length);
  if (prevResultsLength !== results.length) {
    setPrevResultsLength(results.length);
    if (highlightIndex !== -1) setHighlightIndex(-1);
  }

    const navigateToResult = useCallback(
        (result: SearchResult) => {
            if (!result.primary_symbol) return;
            const route = isETFLike(result.type) ? "etf" : "stock";
            router.push(`/playground/assets/${route}/${result.primary_symbol}`);
            setIsOpen(false);
        },
        [router],
    );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = highlightIndex >= 0 ? highlightIndex : 0;
      const r = results[idx];
      if (r) navigateToResult(r);
    }
  };

  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher une action ou un ETF (nom, symbol, ISIN)…"
          className="w-full pl-12 pr-12 py-4 text-lg rounded-xl border border-input bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {searchState.status === "loading" && (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          )}
          {query && searchState.status !== "loading" && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Effacer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg overflow-hidden z-50"
          >
            {searchState.status === "loading" && results.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                Recherche en cours…
              </div>
            )}

              {searchState.status === "success" && results.length === 0 && (
                  <LoadAssetCta
                      initialQuery={query}
                      onResetAction={() => {
                          setQuery("");
                          setIsOpen(false);
                      }}
                  />
              )}

            {searchState.status === "error" && (
              <div className="p-4 text-center text-sm text-destructive">
                Erreur : {searchState.message}
              </div>
            )}

            {results.length > 0 && (
              <>
                <div className="max-h-125 overflow-y-auto no-scrollbar">
                  {results.map((result, idx) => (
                    <SearchResultItem
                        key={`${result.security_id}-${idx}`}
                      result={result}
                      isHighlighted={idx === highlightIndex}
                      onClickAction={() => navigateToResult(result)}
                      onMouseEnterAction={() => setHighlightIndex(idx)}
                    />
                  ))}
                </div>

                <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    {results.length} résultat{results.length > 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓</kbd>
                    naviguer
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd>
                    ouvrir
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}