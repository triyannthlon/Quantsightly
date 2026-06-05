"use client";

import { useState, useRef, useMemo } from "react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Loader2, Check, Plus, X, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import type { AssetType, SearchResult, SearchFilters } from "@/lib/yann/watchlist/clients/watchlist-client";
import { EXCHANGE_BY_CODE } from "@/data/exchanges";

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
    assetType          : AssetType;
    open               : boolean;
    onOpenChangeAction : (open: boolean) => void;
    onAddedAction     ?: () => void;
    existingSymbols   ?: string[];
};

type FilterOption = { code: string; label: string };

// ── Constantes ───────────────────────────────────────────────────────────────

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

/** Quels filtres afficher selon le type d'actif */
const FILTERS_BY_TYPE: Record<AssetType, Array<"country" | "currency" | "exchange">> = {
    stock    : ["country", "currency", "exchange"],
    etf      : ["country", "currency", "exchange"],
    index    : ["country", "currency"],
    crypto   : ["currency"],
    currency : ["currency"],
};

const COUNTRY_OPTIONS: FilterOption[] = [
    { code: "AU", label: "Australie" },
    { code: "BR", label: "Brésil" },
    { code: "CA", label: "Canada" },
    { code: "CN", label: "Chine" },
    { code: "KR", label: "Corée du Sud" },
    { code: "DK", label: "Danemark" },
    { code: "ES", label: "Espagne" },
    { code: "US", label: "États-Unis" },
    { code: "FR", label: "France" },
    { code: "DE", label: "Allemagne" },
    { code: "HK", label: "Hong Kong" },
    { code: "IN", label: "Inde" },
    { code: "IE", label: "Irlande" },
    { code: "IT", label: "Italie" },
    { code: "JP", label: "Japon" },
    { code: "LU", label: "Luxembourg" },
    { code: "MX", label: "Mexique" },
    { code: "NO", label: "Norvège" },
    { code: "NL", label: "Pays-Bas" },
    { code: "GB", label: "Royaume-Uni" },
    { code: "SG", label: "Singapour" },
    { code: "SE", label: "Suède" },
    { code: "CH", label: "Suisse" },
    { code: "TW", label: "Taïwan" },
    { code: "ZA", label: "Afrique du Sud" },
];

const CURRENCY_OPTIONS: FilterOption[] = [
    { code: "AUD", label: "Dollar australien" },
    { code: "BRL", label: "Real brésilien" },
    { code: "CAD", label: "Dollar canadien" },
    { code: "CNY", label: "Yuan chinois" },
    { code: "DKK", label: "Couronne danoise" },
    { code: "EUR", label: "Euro" },
    { code: "GBP", label: "Livre sterling" },
    { code: "HKD", label: "Dollar de HK" },
    { code: "INR", label: "Roupie indienne" },
    { code: "JPY", label: "Yen japonais" },
    { code: "KRW", label: "Won coréen" },
    { code: "MXN", label: "Peso mexicain" },
    { code: "NOK", label: "Couronne norvégienne" },
    { code: "SEK", label: "Couronne suédoise" },
    { code: "SGD", label: "Dollar de Singapour" },
    { code: "CHF", label: "Franc suisse" },
    { code: "TWD", label: "Dollar taïwanais" },
    { code: "USD", label: "Dollar américain" },
    { code: "ZAR", label: "Rand sud-africain" },
];

// ── Sous-composants ──────────────────────────────────────────────────────────

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

function ResultIcon({ result, size = 28 }: { result: SearchResult; size?: number }) {
    const kind = assetKind(result.exchange_code, result.type);
    if ((kind === "stock" || kind === "etf") && result.country_iso2) {
        return (
            <CountryFlag code={result.country_iso2} countryName={result.country ?? undefined} size={20} />
        );
    }
    return <AssetTypeIcon exchangeCode={result.exchange_code} typeRaw={result.type} size={size} />;
}

/** Pill cliquable avec popover de sélection. */
function FilterPill({
    label,
    value,
    options,
    onSelect,
    withFlags = false,
}: {
    label      : string;
    value     ?: string;
    options    : FilterOption[];
    onSelect   : (code: string | undefined) => void;
    withFlags ?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find(o => o.code === value);
    const sorted   = useMemo(
        () => [...options].sort((a, b) => a.label.localeCompare(b.label, "fr")),
        [options],
    );

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(undefined);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs border transition-all duration-150",
                        "cursor-pointer select-none shrink-0",
                        selected
                            ? "bg-primary/10 text-primary border-primary/30 font-medium hover:bg-primary/15"
                            : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted/50 hover:text-foreground",
                    )}
                >
                    {selected && withFlags && (
                        <CountryFlag code={selected.code} size={14} />
                    )}
                    <span className="leading-tight">{selected ? selected.label : label}</span>
                    {selected ? (
                        <X className="h-3 w-3 shrink-0 opacity-60 hover:opacity-100 transition-opacity" onClick={handleClear} />
                    ) : (
                        <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-50 transition-transform duration-150", open && "rotate-180")} />
                    )}
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-52 p-1.5 shadow-lg" align="start" sideOffset={6}>
                <div className="overflow-y-auto max-h-60 space-y-px">
                    {/* Option "Tous" */}
                    <button
                        type="button"
                        onClick={() => { onSelect(undefined); setOpen(false); }}
                        className={cn(
                            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors",
                            "hover:bg-muted cursor-pointer",
                            !value && "font-medium text-foreground",
                        )}
                    >
                        <span className="flex-1 text-left">Tous</span>
                        {!value && <Check className="h-3 w-3 text-primary shrink-0" />}
                    </button>

                    <div className="h-px bg-border/40 mx-1 my-1" />

                    {sorted.length === 0 && (
                        <p className="px-2.5 py-2 text-xs text-muted-foreground italic">
                            Aucune option disponible
                        </p>
                    )}

                    {sorted.map(opt => (
                        <button
                            key={opt.code}
                            type="button"
                            onClick={() => { onSelect(opt.code); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors",
                                "hover:bg-muted cursor-pointer",
                                value === opt.code && "bg-primary/10 text-primary font-medium",
                            )}
                        >
                            {withFlags && (
                                <CountryFlag code={opt.code} size={16} />
                            )}
                            <span className="flex-1 text-left">{opt.label}</span>
                            <span className="font-mono text-[10px] opacity-50 shrink-0">{opt.code}</span>
                            {value === opt.code && <Check className="h-3 w-3 shrink-0 text-primary" />}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function AssetSearchModal({
    assetType,
    open,
    onOpenChangeAction,
    onAddedAction,
    existingSymbols = [],
}: Props) {
    const [query,     setQuery]     = useState("");
    const [selected,  setSelected]  = useState<Map<string, SearchResult>>(new Map());
    const [filters,   setFilters]   = useState<SearchFilters>({});
    const [particle,  setParticle]  = useState<{ x: number; y: number; count: number } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const addBtnRef = useRef<HTMLButtonElement>(null);

    const search  = useCatalogSearch(query, assetType, filters);
    const results = search.status === "success" ? search.results : [];

    const existingSet  = new Set(existingSymbols);
    const selectedList = Array.from(selected.values());

    const activeFilterKeys = FILTERS_BY_TYPE[assetType];
    const hasActiveFilter  = Boolean(filters.country || filters.currency || filters.exchange);

    /** Options de place boursière extraites des résultats courants, avec nom résolu. */
    const exchangeOptions = useMemo<FilterOption[]>(() => {
        const seen = new Set<string>();
        const opts: FilterOption[] = [];
        for (const r of results) {
            if (r.exchange_code && !seen.has(r.exchange_code)) {
                seen.add(r.exchange_code);
                opts.push({
                    code  : r.exchange_code,
                    label : EXCHANGE_BY_CODE[r.exchange_code]?.label ?? r.exchange_code,
                });
            }
        }
        return opts;
    }, [results]);

    const setFilter = (key: keyof SearchFilters) => (code: string | undefined) =>
        setFilters(prev => ({ ...prev, [key]: code }));

    const resetFilters = () => setFilters({});

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setQuery("");
            setSelected(new Map());
            setFilters({});
        }
        onOpenChangeAction(next);
    };

    const toggleSelect = (r: SearchResult) => {
        setSelected(prev => {
            const next = new Map(prev);
            if (next.has(r.primary_symbol)) next.delete(r.primary_symbol);
            else                            next.set(r.primary_symbol, r);
            return next;
        });
    };

    const removeSelected = (symbol: string) => {
        setSelected(prev => { const n = new Map(prev); n.delete(symbol); return n; });
    };

    const handleAdd = async () => {
        if (selectedList.length === 0) return;

        const rect = addBtnRef.current?.getBoundingClientRect();
        if (rect) setParticle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, count: selectedList.length });
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(10);

        setSubmitting(true);
        try {
            const symbols    = selectedList.map(r => r.primary_symbol);
            const res        = await addToWatchlist(assetType, symbols);
            warmSymbols(symbols);

            const addedSet   = new Set(symbols);
            const addedItems = res.items.filter(i => addedSet.has(i.symbol));
            onAddedAction?.();
            handleOpenChange(false);

            const n = symbols.length;
            toast.success(`${n} actif${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}`, {
                description: `Ajouté${n > 1 ? "s" : ""} à « ${WATCHLIST_LABELS[assetType]} »`,
                duration   : 7000,
                action     : {
                    label  : "Annuler",
                    onClick: () => {
                        void (async () => {
                            try {
                                await Promise.all(addedItems.map(i => removeFromWatchlist(assetType, i.id)));
                                onAddedAction?.();
                                toast.success("Annulé");
                            } catch { toast.error("Impossible d'annuler"); }
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

    // ── Rendu ────────────────────────────────────────────────────────────────

    return (
        <>
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="p-0 gap-0 overflow-hidden max-w-2xl top-[15%] translate-y-0 shadow-2xl"
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">{TYPE_TITLES[assetType]}</DialogTitle>

                <Command shouldFilter={false} className="rounded-none">
                    {/* Barre de recherche */}
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        placeholder={`Rechercher ${TYPE_LABELS[assetType]} (nom, symbole, ISIN)…`}
                        className="h-14 text-base"
                    />

                    {/* Barre de filtres */}
                    {activeFilterKeys.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
                            <div className="flex flex-wrap gap-1.5 flex-1">
                                {activeFilterKeys.includes("country") && (
                                    <FilterPill
                                        label="Pays de cotation"
                                        value={filters.country}
                                        options={COUNTRY_OPTIONS}
                                        onSelect={setFilter("country")}
                                        withFlags
                                    />
                                )}
                                {activeFilterKeys.includes("currency") && (
                                    <FilterPill
                                        label="Devise"
                                        value={filters.currency}
                                        options={CURRENCY_OPTIONS}
                                        onSelect={setFilter("currency")}
                                    />
                                )}
                                {activeFilterKeys.includes("exchange") && (
                                    <FilterPill
                                        label="Place"
                                        value={filters.exchange}
                                        options={exchangeOptions}
                                        onSelect={setFilter("exchange")}
                                    />
                                )}
                            </div>

                            {hasActiveFilter && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors shrink-0 cursor-pointer"
                                >
                                    Réinitialiser
                                </button>
                            )}
                        </div>
                    )}

                    {/* Liste des résultats */}
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
                            <div className="py-12 text-center space-y-1">
                                <p className="text-sm text-muted-foreground">
                                    Aucun résultat pour «&nbsp;<span className="font-medium">{query}</span>&nbsp;»
                                </p>
                                {hasActiveFilter && (
                                    <p className="text-xs text-muted-foreground/70">
                                        Essayez d&apos;élargir les filtres.
                                    </p>
                                )}
                            </div>
                        )}

                        {results.length > 0 && (
                            <CommandGroup heading={`${results.length} résultat${results.length > 1 ? "s" : ""}${hasActiveFilter ? " · filtrés" : ""}`}>
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
                                    onClick={() => setSelected(new Map())}
                                    className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                >
                                    Tout effacer
                                </button>
                            </div>
                            <div className="max-h-35 overflow-y-auto px-2 pb-2 space-y-1">
                                {selectedList.map(r => (
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