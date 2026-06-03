"use client";

/**
 * Colonnes de la watchlist CRYPTO (pipeline YANN).
 * ================================================
 *
 * Layout :
 *   Ticker | Last | 1D | 7D | 30D | YTD | 52W High % | Cap. | Volume
 *
 * Différences notables vs stock :
 *  - Pas de colonne Pays ni Secteur (crypto = 24/7, sans rattachement pays).
 *  - Returns sur horizons calendaires (1D / 7D / 30D / YTD).
 *  - Colonne Volume à la place du P/E.
 *
 * Couleurs : identiques à stock — vert/rouge/neutre sur les returns,
 * sobre (muted) pour le 52W High %.
 */

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AssetLogo }     from "@/components/custom/screener/asset-logo";
import { AssetTypeIcon } from "@/components/custom/screener/asset-type-icon";
import { FavoriteStar }  from "./favorite-star";
import {
    formatPrice, formatPct,
} from "@/lib/yann/analytics/metrics";
import type { CryptoWatchlistRow } from "@/lib/yann";
import type { WatchlistCellCtx, WatchlistColumnDef } from "./watchlist-table";
import { TICKER_COL_WIDTH } from "./watchlist-table";


/** Alias locaux : contexte + colonne paramétrés sur `CryptoWatchlistRow`. */
export type CryptoCellCtx   = WatchlistCellCtx<CryptoWatchlistRow>;
export type CryptoColumnDef = WatchlistColumnDef<CryptoWatchlistRow>;


// ── États de cellule ─────────────────────────────────────────

type CellState = "skeleton" | "value" | "dash";

function priceState(ctx: CryptoCellCtx): CellState {
    if (ctx.status === "loading")     return "skeleton";
    if (ctx.status === "unavailable") return "dash";
    return "value";
}



// ── Rendus génériques ────────────────────────────────────────

function Value({ state, align, children }: { state: CellState; align?: "left" | "right"; children: ReactNode }) {
    if (state === "skeleton") return <Skeleton className={cn("h-4 w-14", align === "right" && "ml-auto")} />;
    if (state === "dash")     return <span className="text-xs text-muted-foreground">—</span>;
    return <span className="animate-in fade-in duration-300 block truncate">{children}</span>;
}

function Variation({ state, pct }: { state: CellState; pct?: number }) {
    if (state === "skeleton")                  return <Skeleton className="h-5 w-14 ml-auto" />;
    if (state === "dash" || pct === undefined) return <span className="text-xs text-muted-foreground">—</span>;

    const up   = pct > 0;
    const down = pct < 0;
    const Icon = up ? TrendingUp : down ? TrendingDown : Minus;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium tabular-nums animate-in fade-in duration-300",
                up   && "text-success-700 bg-success-50 dark:text-success-400 dark:bg-success-500/10",
                down && "text-error-700   bg-error-50   dark:text-error-400   dark:bg-error-500/10",
                !up && !down && "text-muted-foreground bg-muted",
            )}
        >
            <Icon className="h-3.5 w-3.5" />
            {formatPct(pct)}
        </span>
    );
}

/** Écart sommet 52S / ATH — deux distances dans la même cellule. */
function HighDistances({ state, dist52w, distATH }: { state: CellState; dist52w?: number; distATH?: number }) {
    if (state === "skeleton") return <Skeleton className="h-4 w-24 ml-auto" />;
    if (state === "dash" || dist52w === undefined) return <span className="text-xs text-muted-foreground">—</span>;
    return (
        <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground animate-in fade-in duration-300">
            {formatPct(dist52w)}
            {distATH !== undefined && (
                <>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="text-muted-foreground/70">{formatPct(distATH)}</span>
                </>
            )}
        </span>
    );
}


// ── Cellules spécifiques ─────────────────────────────────────

function TickerCell({ item, row, onToggleFavorite }: CryptoCellCtx) {
    return (
        <div className="flex items-center gap-2.5">
            <FavoriteStar isFavorite={!!item.isFavorite} onToggleAction={onToggleFavorite} />
            <div className="shrink-0">
                <AssetLogo
                    logoUrl={undefined}
                    fallback={<AssetTypeIcon exchangeCode={item.exchangeCode} typeRaw={item.assetTypeRaw} kind="crypto" />}
                />
            </div>
            <div className="min-w-0">
                <div className="text-sm font-semibold truncate" title={row?.name ?? item.name ?? item.symbol}>
                    {row?.name ?? item.name ?? item.symbol}
                </div>
                <div className="font-mono text-xs text-muted-foreground truncate">{item.symbol}</div>
            </div>
        </div>
    );
}


// ── Définition des colonnes ──────────────────────────────────

const COL_TICKER   : CryptoColumnDef = { key: "ticker",  label: "Nom"             , align: "left",  width: TICKER_COL_WIDTH, sortValue: (item)    => item.name ?? item.symbol,  cell: (ctx) => <TickerCell {...ctx} /> };
const COL_FLAG     : CryptoColumnDef = { key: "flag",    label: ""                , align: "left",  width: "w-16",                                                             cell: () => null };
const COL_LAST     : CryptoColumnDef = { key: "last",    label: "Dernier Prix"    , align: "right", sortValue: (_, row) => row?.last, cell: (ctx) => <Value state={priceState(ctx)} align="right">{formatPrice(ctx.row?.last, ctx.row?.currency)}</Value> };
const COL_1D       : CryptoColumnDef = { key: "r1d",     label: "1J"              , align: "right", sortValue: (_, row) => row?.ret1d,  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.ret1d}  /> };
const COL_7D       : CryptoColumnDef = { key: "r7d",     label: "1S"              , align: "right", sortValue: (_, row) => row?.ret7d,  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.ret7d}  /> };
const COL_30D      : CryptoColumnDef = { key: "r30d",    label: "1M"              , align: "right", sortValue: (_, row) => row?.ret30d, cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.ret30d} /> };
const COL_YTD      : CryptoColumnDef = { key: "rytd",    label: "YTD"             , align: "right", sortValue: (_, row) => row?.retYtd, cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.retYtd} /> };
const COL_DIST_52W : CryptoColumnDef = { key: "d52w", label: "Δ Sommet 52S / Δ ATH", align: "right", sortValue: (_, row) => row?.distanceTo52WHigh, hideSm: true,
    cell: (ctx) => <HighDistances state={priceState(ctx)} dist52w={ctx.row?.distanceTo52WHigh} distATH={ctx.row?.distanceToATH} /> };

export const CRYPTO_COLUMNS: CryptoColumnDef[] = [
    COL_TICKER, COL_FLAG, COL_LAST,
    COL_1D, COL_7D, COL_30D, COL_YTD,
    COL_DIST_52W,
];
