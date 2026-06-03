"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Loader2, Check, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { addToWatchlist, removeFromWatchlist } from "@/lib/yann/watchlist/clients/watchlist-client";
import {
    Command,
    CommandInput,
    CommandList,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssetTypeIcon, assetKind } from "./asset-type-icon";
import { SuccessParticles } from "./success-particles";
import { warmSymbols } from "@/lib/yann/clients/history";
import { useCatalogSearch } from "@/hooks/watchlist/use-catalog-search";
import type { AssetType, SearchResult } from "@/lib/yann/watchlist/clients/watchlist-client";

type Props = {
    assetType          : AssetType;
    open               : boolean;
    onOpenChangeAction : (open: boolean) => void;
    onAddedAction     ?: () => void;
    existingSymbols   ?: string[];
};

const TYPE_LABELS: Record<AssetType, string> = {
    stock    : "une action",
    etf      : "un ETF",
    crypto   : "une cryptomonnaie",
    currency : "une devise",
    index    : "un indice",
};

const TYPE_TITLES: Record<AssetType, string> = {
    stock    : "Rechercher une action",
    etf      : "Rechercher un ETF",
    crypto   : "Rechercher une cryptomonnaie",
    currency : "Rechercher une devise",
    index    : "Rechercher un indice",
};

const WATCHLIST_LABELS: Record<AssetType, string> = {
    stock    : "Actions",
    etf      : "ETF",
    crypto   : "Cryptomonnaies",
    currency : "Devises",
    index    : "Indices",
};

function matchedViaLabel(via?: string): string | null {
    switch (via) {
        case "isin"          : return "ISIN";
        case "symbol"        : return "Symbole";
        case "code"          : return "Code";
        case "name_prefix"   :
        case "name_contains" :
        case "name_fuzzy"    : return "Nom";
        default              : return null;
    }
}

/** Icône d'un résultat : drapeau pays pour stock/ETF, pastille typée sinon. */
function ResultIcon({ result, size = 28 }: { result: SearchResult; size?: number }) {
    const kind = assetKind(result.exchange_code, result.type);

    if ((kind === "stock" || kind === "etf") && result.country_iso2) {
        return (
            <Image
                src={`/flags/${result.country_iso2.toLowerCase()}.svg`}
                alt={result.country ?? ""}
                width={20}
                height={15}
                className="rounded-[2px] object-cover"
            />
        );
    }

    return <AssetTypeIcon exchangeCode={result.exchange_code} typeRaw={result.type} size={size} />;
}

export function AssetSearchModal({
                                     assetType,
                                     open,
                                     onOpenChangeAction,
                                     onAddedAction,
                                     existingSymbols = [],
                                 }: Props) {
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Map<string, SearchResult>>(new Map());
    const [particle, setParticle] = useState<{ x: number; y: number; count: number } | null>(null);
    const addBtnRef = useRef<HTMLButtonElement>(null);

    const search = useCatalogSearch(query, assetType);
    const results = search.status === "success" ? search.results : [];

    const existingSet  = new Set(existingSymbols);
    const selectedList = Array.from(selected.values());

    // Reset propre à la fermeture (dans un handler → pas d'effet, ESLint OK)
    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setQuery("");
            setSelected(new Map());
        }
        onOpenChangeAction(next);
    };

    const toggleSelect = (r: SearchResult) => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(r.primary_symbol)) next.delete(r.primary_symbol);
            else                            next.set(r.primary_symbol, r);
            return next;
        });
    };

    const removeSelected = (symbol: string) => {
        setSelected((prev) => {
            const next = new Map(prev);
            next.delete(symbol);
            return next;
        });
    };

    const clearAll = () => setSelected(new Map());

    const [submitting, setSubmitting] = useState(false);

    const handleAdd = async () => {
        if (selectedList.length === 0) return;

        // Moment 5 : particules depuis le bouton + haptic mobile (déclenchés au clic)
        const rect = addBtnRef.current?.getBoundingClientRect();
        if (rect) {
            setParticle({
                x    : rect.left + rect.width / 2,
                y    : rect.top + rect.height / 2,
                count: selectedList.length,
            });
        }
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            navigator.vibrate(10);
        }

        setSubmitting(true);
        try {
            const symbols = selectedList.map((r) => r.primary_symbol);
            const res = await addToWatchlist(assetType, symbols);

            warmSymbols(symbols);   // pattern A : pré-chauffe le on-demand (fire-and-forget)

            // IDs des lignes qu'on vient d'ajouter (pour le bouton "Annuler")
            const addedSet   = new Set(symbols);
            const addedItems = res.items.filter((i) => addedSet.has(i.symbol));

            onAddedAction?.();        // refresh la watchlist du screener
            handleOpenChange(false);  // ferme + reset

            const n = symbols.length;
            toast.success(`${n} actif${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}`, {
                description: `Ajouté${n > 1 ? "s" : ""} à « ${WATCHLIST_LABELS[assetType]} »`,
                duration   : 7000,
                action     : {
                    label  : "Annuler",
                    onClick: () => {
                        void (async () => {
                            try {
                                await Promise.all(addedItems.map((i) => removeFromWatchlist(assetType, i.id)));
                                onAddedAction?.();
                                toast.success("Annulé");
                            } catch {
                                toast.error("Impossible d'annuler");
                            }
                        })();
                    },
                },
            });
        } catch {
            toast.error("Impossible d'ajouter ces actifs");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="p-0 gap-0 overflow-hidden max-w-2xl top-[15%] translate-y-0 shadow-2xl"
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">{TYPE_TITLES[assetType]}</DialogTitle>

                <Command shouldFilter={false} className="rounded-none">
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        placeholder={`Rechercher ${TYPE_LABELS[assetType]} (nom, symbol, ISIN)…`}
                        className="h-14 text-base"
                    />

                    <CommandList className="max-h-90">
                        {search.status === "idle" && (
                            <div className="py-12 text-center text-sm text-muted-foreground">
                                Commencez à taper pour rechercher.
                            </div>
                        )}

                        {search.status === "loading" && (
                            <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Recherche en cours…
                            </div>
                        )}

                        {search.status === "error" && (
                            <div className="py-12 text-center text-sm text-destructive">
                                {search.message}
                            </div>
                        )}

                        {search.status === "success" && results.length === 0 && (
                            <div className="py-12 text-center text-sm text-muted-foreground">
                                Aucun résultat pour «&nbsp;<span className="font-medium">{query}</span>&nbsp;»
                            </div>
                        )}

                        {results.length > 0 && (
                            <CommandGroup heading={`${results.length} résultat${results.length > 1 ? "s" : ""}`}>
                                {results.map((r, idx) => {
                                    const isSelected = selected.has(r.primary_symbol);
                                    const isExisting = existingSet.has(r.primary_symbol);

                                    return (
                                        <CommandItem
                                            key={`${r.primary_symbol}-${idx}`}
                                            value={`${r.primary_symbol}-${idx}`}
                                            onSelect={() => { if (!isExisting) toggleSelect(r); }}
                                            className={cn(
                                                "group flex items-center gap-3 py-3",
                                                isExisting ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                                isSelected && "bg-primary/5",
                                            )}
                                        >
                                            <div className="shrink-0 w-7 flex justify-center">
                                                <ResultIcon result={r} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium truncate">{r.name}</span>
                                                    {r.type && (
                                                        <Badge variant="secondary" className="text-[10px] shrink-0">
                                                            {r.type}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                    <span className="font-mono">{r.primary_symbol}</span>
                                                    {r.currency && <span>· {r.currency}</span>}
                                                    {matchedViaLabel(r.matched_via) && <span>· {matchedViaLabel(r.matched_via)}</span>}
                                                </div>
                                            </div>

                                            {/* Indicateur état */}
                                            {isExisting ? (
                                                <Badge variant="outline" className="text-[10px] shrink-0 text-success-600 border-success-300">
                                                    ✓ Ajouté
                                                </Badge>
                                            ) : isSelected ? (
                                                <Check className="h-4 w-4 text-primary shrink-0" />
                                            ) : (
                                                <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        )}
                    </CommandList>

                    {/* Tray de sélection */}
                    {selectedList.length > 0 && (
                        <div className="border-t bg-muted/30">
                            <div className="flex items-center justify-between px-4 py-2">
                             <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                              Sélection ({selectedList.length})
                             </span>
                                <button
                                    type="button"
                                    onClick={clearAll}
                                    className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                >
                                    Tout effacer
                                </button>
                            </div>
                            <div className="max-h-35 overflow-y-auto px-2 pb-2 space-y-1">
                                {selectedList.map((r) => (
                                    <div
                                        key={r.primary_symbol}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background border"
                                    >
                                        <div className="shrink-0 w-6 flex justify-center">
                                            <ResultIcon result={r} size={22} />
                                        </div>
                                        <span className="font-mono text-xs shrink-0">{r.primary_symbol}</span>
                                        <span className="text-xs text-muted-foreground truncate flex-1">{r.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeSelected(r.primary_symbol)}
                                            className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
                                            aria-label="Retirer"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="border-t flex items-center justify-between px-4 py-3">
                      <span className="hidden sm:block text-xs text-muted-foreground">
                       ↑↓ naviguer · ↵ sélectionner · Esc fermer
                      </span>
                        <div className="flex items-center gap-2 ml-auto">
                            <Button variant="ghost" onClick={() => handleOpenChange(false)} className="cursor-pointer">
                                Annuler
                            </Button>
                            <Button
                                ref={addBtnRef}
                                onClick={handleAdd}
                                disabled={selectedList.length === 0 || submitting}
                                className="gap-2 cursor-pointer"
                            >
                                {submitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                                Ajouter{selectedList.length > 0 ? ` ${selectedList.length}` : ""}
                            </Button>
                        </div>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>

        {particle && (
            <SuccessParticles
                origin={{ x: particle.x, y: particle.y }}
                count={particle.count}
                onDoneAction={() => setParticle(null)}
            />
        )}
        </>
    );
}