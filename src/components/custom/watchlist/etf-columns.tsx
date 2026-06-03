"use client";

/**
 * Colonnes de la watchlist ETF (pipeline YANN).
 * =============================================
 *
 * Layout :
 *   Ticker | Pays | Category | Last | 1D | 1W | 1M | YTD | 52W High % | AUM | TER
 *
 * Mêmes returns que stock (1D/1W/1M/YTD) et même 52W High %.
 * Différences :
 *  - `Category` à la place de `Secteur`
 *  - `AUM` à la place de `Cap.`
 *  - `TER` à la place de `P/E`
 *
 * Couleurs : returns vert/rouge/neutre, 52W High % sobre (muted).
 */

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AssetLogo }     from "@/components/custom/screener/asset-logo";
import { AssetTypeIcon } from "@/components/custom/screener/asset-type-icon";
import { FavoriteStar }  from "./favorite-star";
import { enCountryToIso2 } from "@/data/countries";
import {
    formatPrice, formatPct,
} from "@/lib/yann/analytics/metrics";
import type { EtfWatchlistRow } from "@/lib/yann";
import type { WatchlistCellCtx, WatchlistColumnDef } from "./watchlist-table";
import { TICKER_COL_WIDTH } from "./watchlist-table";


/** Alias locaux : contexte + colonne paramétrés sur `EtfWatchlistRow`. */
export type EtfCellCtx   = WatchlistCellCtx<EtfWatchlistRow>;
export type EtfColumnDef = WatchlistColumnDef<EtfWatchlistRow>;


// ── États de cellule ─────────────────────────────────────────

type CellState = "skeleton" | "value" | "dash";

function priceState(ctx: EtfCellCtx): CellState {
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

/** 52W High % — sobre, sans coloration (cf. stock/crypto-columns). */
function Distance52W({ state, pct }: { state: CellState; pct?: number }) {
    if (state === "skeleton")                  return <Skeleton className="h-4 w-14 ml-auto" />;
    if (state === "dash" || pct === undefined) return <span className="text-xs text-muted-foreground">—</span>;
    return (
        <span className="inline-block text-sm tabular-nums text-muted-foreground animate-in fade-in duration-300">
            {formatPct(pct)}
        </span>
    );
}


// ── Cellules spécifiques (Ticker, Pays) ──────────────────────

function TickerCell({ item, row, onToggleFavorite }: EtfCellCtx) {
    return (
        <div className="flex items-center gap-2.5">
            <FavoriteStar isFavorite={!!item.isFavorite} onToggleAction={onToggleFavorite} />
            <div className="shrink-0">
                <AssetLogo
                    logoUrl={row?.logoUrl}
                    fallback={<AssetTypeIcon kind="etf" exchangeCode={item.exchangeCode} typeRaw={item.assetTypeRaw} />}
                />
            </div>
            <div className="min-w-0">
                <div className="text-sm font-semibold truncate" title={item.name ?? item.symbol}>
                    {item.name ?? item.symbol}
                </div>
                <div className="font-mono text-xs text-muted-foreground truncate">{item.symbol}</div>
            </div>
        </div>
    );
}

function CountryCell({ item }: EtfCellCtx) {
    const iso2 = item.countryIso2 ?? enCountryToIso2(item.country);
    if (!iso2) return <span className="text-xs text-muted-foreground">—</span>;

    return (
        <div className="flex items-center">
            <Image
                src={`/flags/${iso2.toLowerCase()}.svg`}
                alt={item.country ?? ""}
                title={item.country ?? undefined}
                width={20}
                height={15}
                className="rounded-[2px] object-cover"
            />
        </div>
    );
}


// ── Définition des colonnes ──────────────────────────────────

const COL_TICKER   : EtfColumnDef = { key: "ticker",   label: "Nom"             , align: "left",  width: TICKER_COL_WIDTH, sortValue: (item)    => item.name ?? item.symbol,  cell: (ctx) => <TickerCell  {...ctx} /> };
const COL_COUNTRY  : EtfColumnDef = { key: "country",  label: "Pays"            , align: "left",  width: "w-16",                                    cell: (ctx) => <CountryCell {...ctx} /> };
const COL_LAST     : EtfColumnDef = { key: "last",     label: "Dernier Prix"    , align: "right", sortValue: (_, row) => row?.last, cell: (ctx) => <Value state={priceState(ctx)} align="right">{formatPrice(ctx.row?.last, ctx.row?.currency)}</Value> };
const COL_1D       : EtfColumnDef = { key: "r1d",      label: "1J"              , align: "right", sortValue: (_, row) => row?.ret1d,  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.ret1d}  /> };
const COL_1W       : EtfColumnDef = { key: "r1w",      label: "1S"              , align: "right", sortValue: (_, row) => row?.ret1w,  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.ret1w}  /> };
const COL_1M       : EtfColumnDef = { key: "r1m",      label: "1M"              , align: "right", sortValue: (_, row) => row?.ret1m,  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.ret1m}  /> };
const COL_YTD      : EtfColumnDef = { key: "rytd",     label: "YTD"             , align: "right", sortValue: (_, row) => row?.retYtd, cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.retYtd} /> };
const COL_DIST_52W : EtfColumnDef = { key: "d52w",     label: "Écart sommet 52S", align: "right", sortValue: (_, row) => row?.distanceTo52WHigh, hideSm: true,
    cell: (ctx) => <Distance52W state={priceState(ctx)} pct={ctx.row?.distanceTo52WHigh} /> };

export const ETF_COLUMNS: EtfColumnDef[] = [
    COL_TICKER, COL_COUNTRY, COL_LAST,
    COL_1D, COL_1W, COL_1M, COL_YTD,
    COL_DIST_52W,
];
