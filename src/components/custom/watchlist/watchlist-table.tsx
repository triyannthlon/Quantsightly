"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import React from "react";
import { RefreshCw, Loader2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WatchlistRow } from "./watchlist-row";
import { AssetPanel } from "@/components/custom/asset-panel/asset-panel";
import type { RowState } from "@/hooks/watchlist/use-watchlist-rows";
import type { RowStatus } from "@/lib/yann";
import type { EnrichedWatchlistItem } from "@/lib/yann/watchlist/clients/watchlist-client";


// ──────────────────────────────────────────────────────────── //
// Constantes partagées de layout                                //
// ──────────────────────────────────────────────────────────── //

export const TICKER_COL_WIDTH = "w-[420px]";


// ──────────────────────────────────────────────────────────── //
// Types partagés (consommés par les fichiers *-columns.tsx)    //
// ──────────────────────────────────────────────────────────── //

export type WatchlistCellCtx<TRow> = {
    item             : EnrichedWatchlistItem;
    row             ?: TRow;
    status           : RowStatus;
    onToggleFavorite : () => void;
};

export type WatchlistColumnDef<TRow> = {
    key        : string;
    label      : string;
    align     ?: "left" | "right";
    width     ?: string;
    hideSm    ?: boolean;
    cell       : (ctx: WatchlistCellCtx<TRow>) => ReactNode;
    sortValue ?: (item: EnrichedWatchlistItem, row: TRow | undefined) => string | number | undefined;
};


// ──────────────────────────────────────────────────────────── //
// Sort                                                          //
// ──────────────────────────────────────────────────────────── //

type SortState = { key: string; dir: "asc" | "desc" } | null;

function SortIcon({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
    if (!active || !dir) return <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />;
    if (dir === "asc")   return <ChevronUp   className="h-3 w-3 shrink-0 text-foreground" />;
    return                      <ChevronDown className="h-3 w-3 shrink-0 text-foreground" />;
}

function FavoriteDivider({ colSpan }: { colSpan: number }) {
    return (
        <TableRow className="hover:bg-transparent border-none h-0">
            <TableCell colSpan={colSpan} className="py-0 px-4">
                <div className="flex items-center gap-3 py-1.5">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 select-none">
                        Autres
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                </div>
            </TableCell>
        </TableRow>
    );
}


// ──────────────────────────────────────────────────────────── //
// Props                                                         //
// ──────────────────────────────────────────────────────────── //

type HookResult<TRow> = {
    rows       : Record<string, RowState<TRow>>;
    refresh    : () => void;
    refreshing : boolean;
};

type Props<TRow> = {
    items                : EnrichedWatchlistItem[];
    loading              : boolean;
    listRefreshing      ?: boolean;
    onRemoveAction       : (itemId: string) => void;
    onToggleFavoriteAction: (itemId: string) => void;
    columns              : WatchlistColumnDef<TRow>[];
    hookResult           : HookResult<TRow>;
};


// ──────────────────────────────────────────────────────────── //
// Composant                                                     //
// ──────────────────────────────────────────────────────────── //

export function WatchlistTable<TRow>({
    items,
    loading,
    listRefreshing,
    onRemoveAction,
    onToggleFavoriteAction,
    columns,
    hookResult,
}: Props<TRow>) {

    const { rows, refresh, refreshing } = hookResult;

    // ── Expand ────────────────────────────────────────────────

    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleRemove = useCallback((itemId: string) => {
        if (expandedId === itemId) setExpandedId(null);
        onRemoveAction(itemId);
    }, [expandedId, onRemoveAction]);

    // ── Sort ─────────────────────────────────────────────────

    const [sort, setSort] = useState<SortState>(null);

    function handleSort(col: WatchlistColumnDef<TRow>) {
        if (!col.sortValue) return;
        setSort(prev => {
            if (!prev || prev.key !== col.key) return { key: col.key, dir: "desc" };
            if (prev.dir === "desc")           return { key: col.key, dir: "asc"  };
            return null;
        });
    }

    // Tri colonne, puis favoris remontent toujours en tête
    const { favorites, others } = useMemo(() => {
        let sorted = items;
        if (sort) {
            const col = columns.find(c => c.key === sort.key);
            if (col?.sortValue) {
                sorted = [...items].sort((a, b) => {
                    const va = col.sortValue!(a, rows[a.symbol]?.row);
                    const vb = col.sortValue!(b, rows[b.symbol]?.row);
                    if (va === undefined && vb === undefined) return 0;
                    if (va === undefined) return 1;
                    if (vb === undefined) return -1;
                    const cmp = typeof va === "string" && typeof vb === "string"
                        ? va.localeCompare(vb, undefined, { sensitivity: "base" })
                        : (va as number) - (vb as number);
                    return sort.dir === "asc" ? cmp : -cmp;
                });
            }
        }
        return {
            favorites: sorted.filter(i => i.isFavorite),
            others   : sorted.filter(i => !i.isFavorite),
        };
    }, [items, sort, columns, rows]);

    const hasDivider = favorites.length > 0 && others.length > 0;

    // ── Loading ───────────────────────────────────────────────

    const loadingCount = items.filter((i) => {
        const s = rows[i.symbol];
        return !s || s.status === "loading";
    }).length;

    const isLoading = loadingCount > 0 || Boolean(listRefreshing);
    const [showLoading, setShowLoading] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setShowLoading(isLoading), isLoading ? 300 : 0);
        return () => clearTimeout(t);
    }, [isLoading]);


    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-20 text-muted-foreground border rounded-lg bg-card">
                <p className="text-sm font-medium">Aucun actif dans cette liste</p>
                <p className="text-xs mt-1">Cliquez sur « Rechercher » pour en ajouter.</p>
            </div>
        );
    }

    const makeCtx = (item: EnrichedWatchlistItem): WatchlistCellCtx<TRow> => {
        const state = rows[item.symbol];
        return {
            item,
            row             : state?.row,
            status          : state?.status ?? "loading",
            onToggleFavorite: () => onToggleFavoriteAction(item.id),
        };
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between min-h-8">
                {showLoading ? (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {loadingCount > 0
                            ? `Chargement de ${loadingCount} actif${loadingCount > 1 ? "s" : ""}…`
                            : "Mise à jour…"}
                    </span>
                ) : (
                    <span />
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={refresh}
                    disabled={refreshing}
                    className="gap-2 text-muted-foreground cursor-pointer"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                    Actualiser
                </Button>
            </div>

            <div className="rounded-lg border overflow-hidden bg-card">
                <Table className="table-fixed w-full">
                    <TableHeader>
                        <TableRow>
                            {columns.map((c) => {
                                const sortable = !!c.sortValue;
                                const isActive = sort?.key === c.key;
                                return (
                                    <TableHead
                                        key={c.key}
                                        onClick={sortable ? () => handleSort(c) : undefined}
                                        className={cn(
                                            "group select-none",
                                            c.width,
                                            c.hideSm && "hidden md:table-cell",
                                            sortable  && "cursor-pointer hover:bg-muted/50 transition-colors",
                                            isActive  && "text-foreground",
                                        )}
                                    >
                                        {sortable ? (
                                            <span className={cn(
                                                "inline-flex items-center gap-1",
                                                c.align === "right" ? "flex-row-reverse w-full justify-start" : "",
                                            )}>
                                                {c.label}
                                                <SortIcon active={isActive} dir={isActive ? sort!.dir : undefined} />
                                            </span>
                                        ) : c.label}
                                    </TableHead>
                                );
                            })}
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody className={cn("transition-opacity duration-200", refreshing && "opacity-60")}>
                        {favorites.map((item) => (
                            <React.Fragment key={item.id}>
                                <WatchlistRow
                                    ctx={makeCtx(item)}
                                    columns={columns}
                                    onRemoveAction={handleRemove}
                                    isExpanded={expandedId === item.id}
                                    onToggleExpandAction={() => setExpandedId(id => id === item.id ? null : item.id)}
                                />
                                {expandedId === item.id && (
                                    <TableRow className="hover:bg-transparent border-b-0">
                                        <TableCell colSpan={columns.length + 1} className="p-0">
                                            <AssetPanel item={item} mode="inline" onCloseAction={() => setExpandedId(null)} />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}

                        {hasDivider && <FavoriteDivider colSpan={columns.length + 1} />}

                        {others.map((item) => (
                            <React.Fragment key={item.id}>
                                <WatchlistRow
                                    ctx={makeCtx(item)}
                                    columns={columns}
                                    onRemoveAction={handleRemove}
                                    isExpanded={expandedId === item.id}
                                    onToggleExpandAction={() => setExpandedId(id => id === item.id ? null : item.id)}
                                />
                                {expandedId === item.id && (
                                    <TableRow className="hover:bg-transparent border-b-0">
                                        <TableCell colSpan={columns.length + 1} className="p-0">
                                            <AssetPanel item={item} mode="inline" onCloseAction={() => setExpandedId(null)} />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}