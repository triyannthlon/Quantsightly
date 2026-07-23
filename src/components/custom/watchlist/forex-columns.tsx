"use client";

/**
 * Colonnes de la watchlist FOREX (pipeline MARKETS).
 * ===============================================
 *
 * Layout :
 *   Pair | Pays (double drapeau) | Last | 1D | 1W | 1M | YTD | 52W Range
 *
 * Différences notables :
 *  - `Pair` à la place de `Ticker` (sémantique forex).
 *  - `Pays` affiche le double drapeau base→quote (via `ForexPairFlags`).
 *  - `Last` formatté en taux forex (4 décimales, sans symbole devise).
 *  - **52W Range = [low — high]** (les 2 bornes), pas une distance %.
 */

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AssetLogo } from "@/components/custom/screener/asset-logo";
import { AssetTypeIcon } from "@/components/custom/screener/asset-type-icon";
import { FavoriteStar } from "./favorite-star";
import { RowSparkline } from "./row-sparkline";
import { ForexPairFlags } from "@/components/custom/screener/asset-flag";
import { formatPct, formatForexRate } from "@/lib/markets/analytics/metrics";
import type { ForexWatchlistRow } from "@/lib/markets";
import type { WatchlistCellCtx, WatchlistColumnDef } from "./watchlist-table";
import { TICKER_COL_WIDTH } from "./watchlist-table";

/** Alias locaux : contexte + colonne paramétrés sur `ForexWatchlistRow`. */
export type ForexCellCtx = WatchlistCellCtx<ForexWatchlistRow>;
export type ForexColumnDef = WatchlistColumnDef<ForexWatchlistRow>;

// ── États de cellule ─────────────────────────────────────────

type CellState = "skeleton" | "value" | "dash";

function priceState(ctx: ForexCellCtx): CellState {
  if (ctx.status === "loading") return "skeleton";
  if (ctx.status === "unavailable") return "dash";
  return "value";
}

// ── Rendus génériques ────────────────────────────────────────

function Value({
  state,
  align,
  children,
}: {
  state: CellState;
  align?: "left" | "right";
  children: ReactNode;
}) {
  if (state === "skeleton")
    return <Skeleton className={cn("h-4 w-14", align === "right" && "ml-auto")} />;
  if (state === "dash") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="animate-in fade-in duration-300 block truncate tabular-nums">{children}</span>
  );
}

function Variation({ state, pct }: { state: CellState; pct?: number }) {
  if (state === "skeleton") return <Skeleton className="h-5 w-14 ml-auto" />;
  if (state === "dash" || pct === undefined)
    return <span className="text-xs text-muted-foreground">—</span>;

  const up = pct > 0;
  const down = pct < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium tabular-nums animate-in fade-in duration-300",
        up && "text-success-700 bg-success-50 dark:text-success-400 dark:bg-success-500/10",
        down && "text-error-700   bg-error-50   dark:text-error-400   dark:bg-error-500/10",
        !up && !down && "text-muted-foreground bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {formatPct(pct)}
    </span>
  );
}

/** 52W Range — affiche "low — high" en sobre (muted). */
function Range52W({ state, low, high }: { state: CellState; low?: number; high?: number }) {
  if (state === "skeleton") return <Skeleton className="h-4 w-24 ml-auto" />;
  if (state === "dash" || low === undefined || high === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-block text-sm tabular-nums text-muted-foreground animate-in fade-in duration-300">
      {formatForexRate(low)} / {formatForexRate(high)}
    </span>
  );
}

// ── Cellules spécifiques ─────────────────────────────────────

/** Strip ".FOREX" du symbole pour passer le code brut à ForexPairFlags. */
function bareCode(symbol: string): string {
  const dot = symbol.lastIndexOf(".");
  return dot > 0 ? symbol.slice(0, dot) : symbol;
}

function PairCell({ item, row, onToggleFavorite }: ForexCellCtx) {
  return (
    <div className="flex items-center gap-2.5">
      <FavoriteStar isFavorite={item.isFavorite} onToggleAction={onToggleFavorite} />
      <div className="shrink-0">
        <AssetLogo
          logoUrl={undefined}
          fallback={
            <AssetTypeIcon
              kind="forex"
              exchangeCode={item.exchangeCode}
              typeRaw={item.assetTypeRaw}
            />
          }
        />
      </div>
      <div className="min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-sm font-semibold truncate">
              {row?.name ?? item.name ?? item.symbol}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{row?.name ?? item.name ?? item.symbol}</TooltipContent>
        </Tooltip>
        <div className="font-mono text-xs text-muted-foreground truncate">{item.symbol}</div>
      </div>
    </div>
  );
}

function FlagPairCell({ item }: ForexCellCtx) {
  return <ForexPairFlags code={bareCode(item.symbol)} />;
}

// ── Définition des colonnes ──────────────────────────────────

const COL_PAIR: ForexColumnDef = {
  key: "pair",
  label: "Paire",
  align: "left",
  width: TICKER_COL_WIDTH,
  sortValue: (item) => item.name ?? item.symbol,
  cell: (ctx) => <PairCell {...ctx} />,
};
const COL_COUNTRY: ForexColumnDef = {
  key: "country",
  label: "Devises",
  align: "left",
  width: "w-16",
  cell: (ctx) => <FlagPairCell {...ctx} />,
};
const COL_LAST: ForexColumnDef = {
  key: "last",
  label: "Dernier Taux",
  align: "right",
  sortValue: (_, row) => row?.last,
  cell: (ctx) => (
    <Value state={priceState(ctx)} align="right">
      {formatForexRate(ctx.row?.last)}
    </Value>
  ),
};
const COL_SPARKLINE: ForexColumnDef = {
  key: "spk6m",
  label: "6 Mois",
  align: "center",
  width: "w-28",
  cell: (ctx) => (
    <div className="w-full flex items-center justify-center">
      {ctx.row?.sparkline6m && ctx.row.sparkline6m.length >= 2 ? (
        <RowSparkline data={ctx.row.sparkline6m} symbol={ctx.item.symbol} />
      ) : null}
    </div>
  ),
};
const COL_1D: ForexColumnDef = {
  key: "r1d",
  label: "1J",
  align: "right",
  sortValue: (_, row) => row?.ret1d,
  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.ret1d} />,
};
const COL_YTD: ForexColumnDef = {
  key: "rytd",
  label: "YTD",
  align: "right",
  sortValue: (_, row) => row?.retYtd,
  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.retYtd} />,
};
const COL_RANGE: ForexColumnDef = {
  key: "range",
  label: "Bas/Haut 52S",
  align: "right",
  sortValue: (_, row) => row?.high52w,
  hideSm: true,
  cell: (ctx) => <Range52W state={priceState(ctx)} low={ctx.row?.low52w} high={ctx.row?.high52w} />,
};

export const FOREX_COLUMNS: ForexColumnDef[] = [
  COL_PAIR,
  COL_COUNTRY,
  COL_LAST,
  COL_SPARKLINE,
  COL_1D,
  COL_YTD,
  COL_RANGE,
];
