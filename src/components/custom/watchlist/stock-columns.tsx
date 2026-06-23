"use client";

/**
 * Colonnes de la watchlist STOCK (pipeline MARKETS).
 * ===============================================
 *
 * Layout :
 *   Ticker | Pays | Secteur | Last | 1D | 1W | 1M | YTD | 52W High % | Cap. | P/E
 *
 * Le contexte cellule porte la `StockWatchlistRow` produite par markets,
 * plus le `status` de transport (loading/ok/unavailable) et le drapeau
 * Le contexte cellule porte la `StockWatchlistRow` produite par markets.
 *
 * Sémantique des couleurs :
 *  • Returns 1D/1W/1M/YTD     → vert >0, rouge <0, neutre =0
 *  • 52W High % (≤ 0 toujours) → NEUTRE (texte muted) — pas d'alarme
 */

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AssetLogo } from "@/components/custom/screener/asset-logo";
import { AssetTypeIcon } from "@/components/custom/screener/asset-type-icon";
import { FavoriteStar } from "./favorite-star";
import { RowSparkline } from "./row-sparkline";
import { enCountryToIso2 } from "@/data/countries";
import { formatPrice, formatPct } from "@/lib/markets/analytics/metrics";
import type { StockWatchlistRow } from "@/lib/markets";
import type { WatchlistCellCtx, WatchlistColumnDef } from "./watchlist-table";
import { TICKER_COL_WIDTH } from "./watchlist-table";

/** Alias locaux : contexte + colonne paramétrés sur `StockWatchlistRow`. */
export type StockCellCtx = WatchlistCellCtx<StockWatchlistRow>;
export type StockColumnDef = WatchlistColumnDef<StockWatchlistRow>;

// ── États de cellule ─────────────────────────────────────────

type CellState = "skeleton" | "value" | "dash";

function priceState(ctx: StockCellCtx): CellState {
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

/**
 * 52W High % — sobre, sans coloration.
 * La valeur est ≤ 0 quasi toujours (≤ 0 par construction sauf records),
 * la coloriser en rouge serait inutilement alarmant.
 */
function Distance52W({ state, pct }: { state: CellState; pct?: number }) {
  if (state === "skeleton") return <Skeleton className="h-4 w-14 ml-auto" />;
  if (state === "dash" || pct === undefined)
    return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-block text-sm tabular-nums text-muted-foreground animate-in fade-in duration-300">
      {formatPct(pct)}
    </span>
  );
}

// ── Cellules spécifiques (Ticker, Pays) ──────────────────────

function TickerCell({ item, row, onToggleFavorite }: StockCellCtx) {
  return (
    <div className="flex items-center gap-2.5">
      <FavoriteStar isFavorite={item.isFavorite} onToggleAction={onToggleFavorite} />
      <div className="shrink-0">
        <AssetLogo
          logoUrl={row?.logoUrl}
          fallback={<AssetTypeIcon exchangeCode={item.exchangeCode} typeRaw={item.assetTypeRaw} />}
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

function CountryCell({ item }: StockCellCtx) {
  const iso2 = item.countryIso2 ?? enCountryToIso2(item.country);
  if (!iso2) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex items-center justify-center">
      <CountryFlag code={iso2} countryName={item.country ?? undefined} size={20} />
    </div>
  );
}

// ── Définition des colonnes ──────────────────────────────────

const COL_TICKER: StockColumnDef = {
  key: "ticker",
  label: "Nom",
  align: "left",
  width: TICKER_COL_WIDTH,
  sortValue: (item) => item.name ?? item.symbol,
  cell: (ctx) => <TickerCell {...ctx} />,
};
const COL_COUNTRY: StockColumnDef = {
  key: "country",
  label: "Pays\n(Cotation)",
  align: "center",
  cell: (ctx) => <CountryCell {...ctx} />,
};
const COL_CURRENCY: StockColumnDef = {
  key: "currency",
  label: "Devise",
  align: "center",
  sortValue: (_, row) => row?.currency,
  cell: (ctx) => <Value state={priceState(ctx)}>{ctx.row?.currency ?? "—"}</Value>,
};
const COL_LAST: StockColumnDef = {
  key: "last",
  label: "Dernier Prix",
  align: "right",
  sortValue: (_, row) => row?.last,
  cell: (ctx) => (
    <Value state={priceState(ctx)} align="right">
      {formatPrice(ctx.row?.last, ctx.row?.currency)}
    </Value>
  ),
};
const COL_SPARKLINE: StockColumnDef = {
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
const COL_1D: StockColumnDef = {
  key: "r1d",
  label: "1J",
  align: "right",
  sortValue: (_, row) => row?.ret1d,
  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.ret1d} />,
};
const COL_YTD: StockColumnDef = {
  key: "rytd",
  label: "YTD",
  align: "right",
  sortValue: (_, row) => row?.retYtd,
  cell: (ctx) => <Variation state={priceState(ctx)} pct={ctx.row?.retYtd} />,
};
const COL_DIST_52W: StockColumnDef = {
  key: "d52w",
  label: "Δ sommet 52S",
  align: "right",
  sortValue: (_, row) => row?.distanceTo52WHigh,
  hideSm: true,
  cell: (ctx) => <Distance52W state={priceState(ctx)} pct={ctx.row?.distanceTo52WHigh} />,
};

export const STOCK_COLUMNS: StockColumnDef[] = [
  COL_TICKER,
  COL_COUNTRY,
  COL_CURRENCY,
  COL_LAST,
  COL_SPARKLINE,
  COL_1D,
  COL_YTD,
  COL_DIST_52W,
];
