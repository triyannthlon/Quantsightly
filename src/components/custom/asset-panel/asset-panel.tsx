"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, Star, GripVertical } from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip,
    ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { AssetTypeIcon, assetKind } from "@/components/custom/screener/asset-type-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetPanelMetrics } from "@/hooks/watchlist/use-asset-panel-metrics";
import { formatPct, formatPrice, computePanelMetrics, weekdayReturns, cryptoReturns } from "@/lib/yann/analytics/metrics";
import type { PanelMetrics } from "@/lib/yann/analytics/metrics";
import type { NormalizedSeries } from "@/lib/yann/series/types";
import type { AssetType, EnrichedWatchlistItem } from "@/lib/yann/watchlist/clients/watchlist-client";


// ── Periods ───────────────────────────────────────────────────

type Period = "1M" | "3M" | "6M" | "1A" | "3A" | "5A" | "MAX";

const PERIODS_FULL    : Period[] = ["1M", "3M", "6M", "1A", "3A", "5A", "MAX"];
const PERIODS_COMPACT : Period[] = ["1M", "3M", "6M", "1A", "MAX"];


// ── KPI ───────────────────────────────────────────────────────

type KpiItem = {
    label     : string;
    value     : string;
    subValue ?: string;
    sign     ?: "positive" | "negative" | "neutral";
};

const KPI_LABELS = ["Perf. cumulée", "Perf. annualisée", "Volatilité ann.", "Max DD", "DD courant", "Sharpe"];
const KPIS_DASH: KpiItem[] = KPI_LABELS.map(label => ({ label, value: "—" }));

function metricsToKpis(m: PanelMetrics, isForex = false): KpiItem[] {
    const sign = (v?: number): KpiItem["sign"] =>
        v === undefined ? undefined : v > 0 ? "positive" : v < 0 ? "negative" : "neutral";

    const lastKpi: KpiItem = isForex
        ? {
            label: "Jours haussiers",
            value: m.positiveDaysPct !== undefined ? `${m.positiveDaysPct.toFixed(1)} %` : "—",
            sign : m.positiveDaysPct !== undefined
                       ? m.positiveDaysPct > 50 ? "positive" : m.positiveDaysPct < 50 ? "negative" : "neutral"
                       : undefined,
          }
        : {
            label: "Sharpe",
            value: m.sharpe !== undefined ? m.sharpe.toFixed(2) : "—",
            sign : sign(m.sharpe),
          };

    const baseKpis: KpiItem[] = [
        {
            label: "Perf. cumulée",
            value: m.cumulativeReturn    !== undefined ? formatPct(m.cumulativeReturn)                  : "—",
            sign : sign(m.cumulativeReturn),
        },
        {
            label: "Perf. annualisée",
            value: m.annualizedReturn    !== undefined ? formatPct(m.annualizedReturn)                  : "—",
            sign : sign(m.annualizedReturn),
        },
        {
            label: "Volatilité ann.",
            value: m.annualizedVolatility !== undefined ? `${m.annualizedVolatility.toFixed(1)} %`      : "—",
        },
        {
            label: "Max DD",
            value: m.maxDrawdown         !== undefined ? formatPct(m.maxDrawdown)                       : "—",
            sign : m.maxDrawdown !== undefined && m.maxDrawdown < -0.5 ? "negative" : "neutral",
        },
        {
            label: "DD courant",
            value: m.currentDrawdown     !== undefined ? formatPct(m.currentDrawdown)                   : "—",
            sign : m.currentDrawdown !== undefined && m.currentDrawdown < -0.5 ? "negative" : "neutral",
        },
        lastKpi,
    ];

    if (isForex) {
        const rangePct = m.periodHigh !== undefined && m.periodLow !== undefined && m.periodLow > 0
            ? ((m.periodHigh - m.periodLow) / m.periodLow) * 100
            : undefined;
        baseKpis.push({
            label: "Range période",
            value: rangePct !== undefined ? `+${rangePct.toFixed(2)} %` : "—",
        });
    }

    return baseKpis;
}


// ── Sub-components ────────────────────────────────────────────

function KpiGrid({ kpis, cols, loading = false }: { kpis: KpiItem[]; cols: number; loading?: boolean }) {
    return (
        <div className={cn(
            "grid gap-2 px-4 py-3",
            cols === 7 && "grid-cols-7",
            cols === 6 && "grid-cols-6",
            cols === 4 && "grid-cols-2",
        )}>
            {kpis.map((kpi) => (
                <div
                    key={kpi.label}
                    className="rounded-lg bg-card border border-border/60 shadow-xs px-3 pt-3 pb-2.5 flex flex-col justify-between gap-1.5"
                >
                    {loading
                        ? <Skeleton className="h-6 w-16" />
                        : (
                            <div className="flex flex-col gap-0.5">
                                <span className={cn(
                                    "text-[18px] font-bold tabular-nums leading-none",
                                    kpi.sign === "positive" && "text-success-700 dark:text-success-400",
                                    kpi.sign === "negative" && "text-error-700   dark:text-error-400",
                                    !kpi.sign              && "text-foreground",
                                )}>
                                    {kpi.value}
                                </span>
                                {kpi.subValue && (
                                    <span className="text-xs tabular-nums text-muted-foreground leading-none">
                                        {kpi.subValue}
                                    </span>
                                )}
                            </div>
                        )
                    }
                    <span className="text-[11px] font-medium text-muted-foreground select-none leading-none">
                        {kpi.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

function PeriodSelector({
    value,
    onChange,
    periods,
}: {
    value   : Period;
    onChange: (p: Period) => void;
    periods : Period[];
}) {
    return (
        <div className="flex gap-0.5">
            {periods.map((p) => (
                <Button
                    key={p}
                    variant={value === p ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => onChange(p)}
                    className={cn(
                        "font-mono",
                        value !== p && "text-muted-foreground",
                    )}
                >
                    {p}
                </Button>
            ))}
        </div>
    );
}

// ── Graphique des prix ────────────────────────────────────────

const COLOR_UP   = "#039855";   // success-600
const COLOR_DOWN = "#f04438";   // error-500
const COLOR_FLAT = "#8c8c8c";

function filterByPeriod(series: NormalizedSeries, period: Period) {
    const { bars } = series;
    if (bars.length === 0 || period === "MAX") return bars;
    const last = bars[bars.length - 1].date;
    const d    = new Date(`${last}T00:00:00Z`);
    if      (period === "1M") d.setUTCMonth(d.getUTCMonth()      -  1);
    else if (period === "3M") d.setUTCMonth(d.getUTCMonth()      -  3);
    else if (period === "6M") d.setUTCMonth(d.getUTCMonth()      -  6);
    else if (period === "1A") d.setUTCFullYear(d.getUTCFullYear()-  1);
    else if (period === "3A") d.setUTCFullYear(d.getUTCFullYear()-  3);
    else if (period === "5A") d.setUTCFullYear(d.getUTCFullYear()-  5);
    const from = d.toISOString().slice(0, 10);
    return bars.filter(b => b.date >= from);
}

function decimate(bars: ReturnType<typeof filterByPeriod>, max = 600) {
    if (bars.length <= max) return bars;
    const step   = Math.ceil(bars.length / max);
    const result = bars.filter((_, i) => i % step === 0);
    const last   = bars[bars.length - 1];
    if (result[result.length - 1] !== last) result.push(last);
    return result;
}

function chartColor(bars: ReturnType<typeof filterByPeriod>): string {
    if (bars.length < 2) return COLOR_FLAT;
    const first = bars[0].adjusted_close;
    const last  = bars[bars.length - 1].adjusted_close;
    return last > first ? COLOR_UP : last < first ? COLOR_DOWN : COLOR_FLAT;
}

function ChartTooltip({ active, payload }: {
    active ?: boolean;
    payload?: Array<{ payload: { date: string; value: number } }>;
}) {
    if (!active || !payload?.length) return null;
    const { date, value } = payload[0].payload;
    const d = new Date(`${date}T00:00:00Z`);
    return (
        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
            <p className="text-muted-foreground">
                {d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <p className="font-semibold tabular-nums mt-0.5">{value.toFixed(2)}</p>
        </div>
    );
}

type ChartPoint = { date: string; value: number };

function PriceChart({
    series,
    period,
    height,
    gradientId,
}: {
    series    : NormalizedSeries;
    period    : Period;
    height    : number;
    gradientId: string;
}) {
    const data: ChartPoint[] = useMemo(() => {
        const filtered = filterByPeriod(series, period);
        return decimate(filtered).map(b => ({ date: b.date, value: b.adjusted_close }));
    }, [series, period]);

    const color = useMemo(() => {
        const filtered = filterByPeriod(series, period);
        return chartColor(filtered);
    }, [series, period]);

    if (data.length < 2) {
        return (
            <div className="w-full rounded-lg bg-muted/20 flex items-center justify-center text-xs text-muted-foreground/40" style={{ height }}>
                Données insuffisantes
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={color} stopOpacity={0}    />
                    </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <ReTooltip content={<ChartTooltip />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 2" }} />
                <Area
                    type="linear"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: color }}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}


// ── Props ─────────────────────────────────────────────────────

export type AssetPanelMode = "inline" | "card";

type Props = {
    item                    : EnrichedWatchlistItem;
    mode                    : AssetPanelMode;
    assetType              ?: AssetType;
    onCloseAction          ?: () => void;
    onRemoveFavoriteAction ?: () => void;
    dragHandleProps        ?: React.HTMLAttributes<HTMLElement>;
};


// ── Mode inline (accordion screener) ─────────────────────────

function AssetPanelInline({ item, onCloseAction }: Omit<Props, "mode" | "assetType" | "onRemoveFavoriteAction">) {
    const [period, setPeriod]   = useState<Period>("1A");
    const { series, status }    = useAssetPanelMetrics(item);
    const loading               = status === "loading";
    const gradId                = `grad-${item.symbol.replace(/[^a-zA-Z0-9]/g, "-")}`;

    const isForex = item.exchangeCode === "FOREX";

    const metrics = useMemo<PanelMetrics | null>(() => {
        if (!series) return null;
        const filtered = filterByPeriod(series, period);
        return computePanelMetrics({ kind: series.kind, bars: filtered, source: series.source });
    }, [series, period]);

    const kpis = metrics ? metricsToKpis(metrics, isForex) : KPIS_DASH;

    return (
        <div className="bg-muted/20">

            {/* KPI row — pleine largeur */}
            <KpiGrid kpis={kpis} cols={isForex ? 7 : 6} loading={loading} />

            <Separator />

            {/* Sélecteur période + graphique */}
            <div className="px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                    <PeriodSelector value={period} onChange={setPeriod} periods={PERIODS_FULL} />
                    {onCloseAction && (
                        <Button variant="ghost" size="icon-sm" onClick={onCloseAction} className="text-muted-foreground" aria-label="Fermer">
                            <ChevronUp />
                        </Button>
                    )}
                </div>
                {series
                    ? <PriceChart series={series} period={period} height={220} gradientId={gradId} />
                    : <div className="w-full rounded-lg bg-muted/20 animate-pulse" style={{ height: 220 }} />
                }
            </div>

        </div>
    );
}


// ── Mode card (dashboard) ─────────────────────────────────────

function AssetPanelCard({ item, onRemoveFavoriteAction, dragHandleProps }: Omit<Props, "mode" | "onCloseAction">) {
    const [period, setPeriod]  = useState<Period>("1A");
    const { series, status }   = useAssetPanelMetrics(item);
    const loading              = status === "loading";
    const kind                 = assetKind(item.exchangeCode, item.assetTypeRaw);
    const isForex              = item.exchangeCode === "FOREX";

    const metrics = useMemo<PanelMetrics | null>(() => {
        if (!series) return null;
        const filtered = filterByPeriod(series, period);
        return computePanelMetrics({ kind: series.kind, bars: filtered, source: series.source });
    }, [series, period]);

    const kpis = metrics ? metricsToKpis(metrics, isForex).slice(0, 4) : KPIS_DASH.slice(0, 4);

    // Prix actuel + perf 1J — calculés sur la série complète (indépendants de la période)
    const { lastPrice, ret1d } = useMemo(() => {
        if (!series || series.bars.length === 0) return { lastPrice: undefined, ret1d: undefined };
        const lastBar = series.bars[series.bars.length - 1];
        const rets    = series.kind === "calendar" ? cryptoReturns(series) : weekdayReturns(series);
        return { lastPrice: lastBar.close, ret1d: rets.ret1d };
    }, [series]);

    const ret1dSign = ret1d === undefined ? "neutral" : ret1d > 0 ? "positive" : ret1d < 0 ? "negative" : "neutral";

    return (
        <Card className="overflow-hidden gap-0 py-0">

            {/* En-tête identité */}
            <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-start gap-3 border-b">
                {dragHandleProps && (
                    <button
                        {...dragHandleProps}
                        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 mt-0.5"
                        aria-label="Déplacer"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                )}
                <AssetTypeIcon kind={kind} size={32} />

                <div className="min-w-0 flex-1">
                    {/* Nom + étoile */}
                    <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold truncate">
                            {item.name ?? item.symbol}
                        </CardTitle>
                        {onRemoveFavoriteAction && (
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={onRemoveFavoriteAction}
                                aria-label="Retirer du dashboard"
                                className="text-amber-400 hover:text-muted-foreground shrink-0 -mt-0.5 -mr-1"
                            >
                                <Star className="fill-amber-400" />
                            </Button>
                        )}
                    </div>

                    {/* Symbole */}
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {item.symbol}
                    </p>

                    {/* Prix + 1J */}
                    <div className="flex items-baseline gap-3 mt-2">
                        <span className="text-2xl font-bold tabular-nums tracking-tight">
                            {lastPrice !== undefined ? formatPrice(lastPrice, item.currency) : "—"}
                        </span>
                        <span className={cn(
                            "text-base font-semibold tabular-nums px-1.5 py-0.5 rounded",
                            ret1dSign === "positive" && "text-success-700 bg-success-50 dark:text-success-400 dark:bg-success-500/10",
                            ret1dSign === "negative" && "text-error-700 bg-error-50 dark:text-error-400 dark:bg-error-500/10",
                            ret1dSign === "neutral"  && "text-muted-foreground bg-muted",
                        )}>
                            {ret1d !== undefined ? `1J ${formatPct(ret1d)}` : "1J —"}
                        </span>
                    </div>
                </div>
            </CardHeader>

            {/* KPI (4 métriques) */}
            <KpiGrid kpis={kpis} cols={4} loading={loading} />

            {/* Graphique */}
            <CardContent className="px-4 pt-0 pb-4 space-y-3">
                <PeriodSelector value={period} onChange={setPeriod} periods={PERIODS_COMPACT} />
                {series
                    ? <PriceChart series={series} period={period} height={160} gradientId={`grad-card-${item.symbol.replace(/[^a-zA-Z0-9]/g, "-")}`} />
                    : <div className="w-full rounded-lg bg-muted/20 animate-pulse" style={{ height: 160 }} />
                }
            </CardContent>

        </Card>
    );
}


// ── Export principal ──────────────────────────────────────────

export function AssetPanel({ item, mode, onCloseAction, onRemoveFavoriteAction, dragHandleProps }: Props) {
    if (mode === "card") return (
        <AssetPanelCard
            item={item}
            onRemoveFavoriteAction={onRemoveFavoriteAction}
            dragHandleProps={dragHandleProps}
        />
    );
    return <AssetPanelInline item={item} onCloseAction={onCloseAction} />;
}
