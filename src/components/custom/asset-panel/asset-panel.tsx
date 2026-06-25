"use client";

import React, { useState, useMemo, useCallback, useId } from "react";
import { Star, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MetricCard } from "./metric-card";
import { ChartHeader } from "./chart-header";
import { ChartTooltip } from "./chart-tooltip";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogTitle, FrostedDialogContent } from "@/components/custom/ui/frosted-dialog";
import { AssetTypeIcon, assetKind } from "@/components/custom/screener/asset-type-icon";
import { enCountryToIso2 } from "@/data/countries";
import { useAssetPanelMetrics } from "@/hooks/watchlist/use-asset-panel-metrics";
import {
  formatPct,
  formatPrice,
  computePanelMetrics,
  weekdayReturns,
  cryptoReturns,
  drawdownSeries,
} from "@/lib/markets/analytics/metrics";
import type { PanelMetrics } from "@/lib/markets/analytics/metrics";
import type { NormalizedSeries } from "@/lib/markets/series/types";
import type {
  AssetType,
  EnrichedWatchlistItem,
} from "@/lib/markets/watchlist/clients/watchlist-client";

// ── Periods ───────────────────────────────────────────────────

export type Period = "1M" | "3M" | "6M" | "YTD" | "1A" | "3A" | "5A" | "MAX";

const PERIODS_FULL: Period[] = ["1M", "3M", "6M", "YTD", "1A", "3A", "5A", "MAX"];

// ── KPI ───────────────────────────────────────────────────────

type KpiItem = {
  label: string;
  value: string;
  subValue?: string;
  sign?: "positive" | "negative" | "neutral";
  qualLabel?: string;
  qualLabelClass?: string;
  gaugeValue?: number;
  volatilityValue?: number;
};

const KPI_LABELS = [
  "Perf. cumulée",
  "Perf. annualisée",
  "Volatilité ann.",
  "Max DD",
  "DD courant",
  "Sharpe",
];
const KPIS_DASH: KpiItem[] = KPI_LABELS.map((label) => ({ label, value: "—" }));

const PERIOD_LABEL: Record<Period, string> = {
  "1M": "sur 1 mois",
  "3M": "sur 3 mois",
  "6M": "sur 6 mois",
  YTD: "depuis le 1er janvier",
  "1A": "sur 1 an",
  "3A": "sur 3 ans",
  "5A": "sur 5 ans",
  MAX: "sur toute la période",
};

const PERIOD_HINT: Record<Period, string> = {
  "1M": "Le dernier mois",
  "3M": "Les 3 derniers mois",
  "6M": "Les 6 derniers mois",
  YTD: "Depuis le 1er janvier",
  "1A": "La dernière année",
  "3A": "Les 3 dernières années",
  "5A": "Les 5 dernières années",
  MAX: "Tout l'historique disponible",
};

type SparkKind = "return" | "drawdown";

const SPARK_KIND: Record<string, SparkKind> = {
  "Perf. cumulée": "return",
  "Perf. annualisée": "return",
  "Max DD": "drawdown",
  "DD courant": "drawdown",
};

const CONTEXT_LABELS = new Set(Object.keys(SPARK_KIND));

function volatilityRisk(v?: number): Pick<KpiItem, "qualLabel" | "qualLabelClass"> {
  if (v === undefined) return {};
  if (v < 15)
    return { qualLabel: "Risque faible", qualLabelClass: "text-success-700 dark:text-success-400" };
  if (v < 25) return { qualLabel: "Risque modéré", qualLabelClass: "text-yellow-500" };
  if (v < 40) return { qualLabel: "Risque élevé", qualLabelClass: "text-orange-500" };
  return { qualLabel: "Risque très élevé", qualLabelClass: "text-destructive" };
}

function sharpeQual(v?: number): Pick<KpiItem, "qualLabel" | "qualLabelClass"> {
  if (v === undefined) return {};
  if (v < 0) return { qualLabel: "Mauvais", qualLabelClass: "text-destructive" };
  if (v < 1) return { qualLabel: "Médiocre", qualLabelClass: "text-orange-500" };
  if (v < 2) return { qualLabel: "Bon", qualLabelClass: "text-success-700 dark:text-success-400" };
  return {
    qualLabel: "Excellent",
    qualLabelClass: "text-success-700 dark:text-success-400 font-bold",
  };
}

function enrichKpis(
  kpis: KpiItem[],
  period: Period,
  series: NormalizedSeries | null | undefined,
  symbol: string,
) {
  const periodLabel = PERIOD_LABEL[period];
  const filteredBars = series ? filterByPeriod(series, period) : [];
  const first = filteredBars[0]?.adjusted_close;
  const returnData =
    first && first > 0
      ? filteredBars.map((b) => ({ date: b.date, value: (b.adjusted_close / first - 1) * 100 }))
      : [];
  const ddData = drawdownSeries(filteredBars);
  const safeSymbol = symbol.replace(/[^a-zA-Z0-9]/g, "-");

  return kpis.map((kpi, idx) => {
    const kind = SPARK_KIND[kpi.label];
    const rawSpark = kind === "return" ? returnData : kind === "drawdown" ? ddData : undefined;
    return {
      ...kpi,
      context: CONTEXT_LABELS.has(kpi.label) ? periodLabel : undefined,
      sparkData: rawSpark && rawSpark.length >= 2 ? rawSpark : undefined,
      gradientId: `spark-${safeSymbol}-${idx}`,
    };
  });
}

function metricsToKpis(m: PanelMetrics, isForex = false): KpiItem[] {
  const sign = (v?: number): KpiItem["sign"] =>
    v === undefined ? undefined : v > 0 ? "positive" : v < 0 ? "negative" : "neutral";

  const lastKpi: KpiItem = isForex
    ? {
        label: "Jours haussiers",
        value: m.positiveDaysPct !== undefined ? `${m.positiveDaysPct.toFixed(1)} %` : "—",
        sign:
          m.positiveDaysPct !== undefined
            ? m.positiveDaysPct > 50
              ? "positive"
              : m.positiveDaysPct < 50
                ? "negative"
                : "neutral"
            : undefined,
      }
    : {
        label: "Sharpe",
        value: m.sharpe !== undefined ? m.sharpe.toFixed(2) : "—",
        sign: sign(m.sharpe),
        gaugeValue: m.sharpe,
        ...sharpeQual(m.sharpe),
      };

  const baseKpis: KpiItem[] = [
    {
      label: "Perf. cumulée",
      value: m.cumulativeReturn !== undefined ? formatPct(m.cumulativeReturn) : "—",
      sign: sign(m.cumulativeReturn),
    },
    {
      label: "Perf. annualisée",
      value: m.annualizedReturn !== undefined ? formatPct(m.annualizedReturn) : "—",
      sign: sign(m.annualizedReturn),
    },
    {
      label: "Volatilité ann.",
      value: m.annualizedVolatility !== undefined ? `${m.annualizedVolatility.toFixed(1)} %` : "—",
      volatilityValue: m.annualizedVolatility,
      ...volatilityRisk(m.annualizedVolatility),
    },
    {
      label: "Max DD",
      value: m.maxDrawdown !== undefined ? formatPct(m.maxDrawdown) : "—",
      sign: m.maxDrawdown !== undefined && m.maxDrawdown < -0.5 ? "negative" : "neutral",
    },
    {
      label: "DD courant",
      value: m.currentDrawdown !== undefined ? formatPct(m.currentDrawdown) : "—",
      sign: m.currentDrawdown !== undefined && m.currentDrawdown < -0.5 ? "negative" : "neutral",
    },
    lastKpi,
  ];

  if (isForex) {
    const rangePct =
      m.periodHigh !== undefined && m.periodLow !== undefined && m.periodLow > 0
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

function PeriodSelector({
  value,
  onChange,
  periods,
  size = "default",
}: {
  value: Period;
  onChange: (p: Period) => void;
  periods: Period[];
  /** "compact" = boutons plus petits, adapté aux cards dashboard étroites */
  size?: "default" | "compact";
}) {
  const uid = useId();
  const isCompact = size === "compact";
  return (
    <TooltipProvider delayDuration={500}>
      <div className="inline-flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        {periods.map((p) => {
          const active = value === p;
          const btn = (
            <button
              onClick={() => onChange(p)}
              className={cn(
                "relative rounded-md font-medium",
                "select-none cursor-pointer transition-colors duration-150",
                isCompact ? "h-7 min-w-[2.25rem] px-1.5 text-xs" : "h-8 min-w-[3rem] px-3 text-sm",
                active
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`${uid}-pill`}
                  className="absolute inset-0 bg-background rounded-md shadow-sm"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                />
              )}
              <span className="relative z-10">{p}</span>
            </button>
          );

          if (active) return <React.Fragment key={p}>{btn}</React.Fragment>;

          return (
            <Tooltip key={p}>
              <TooltipTrigger asChild>{btn}</TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {PERIOD_HINT[p]}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// ── Graphique des prix ────────────────────────────────────────

const COLOR_UP = "#039855"; // success-600
const COLOR_DOWN = "#f04438"; // error-500
const COLOR_FLAT = "#8c8c8c";

function filterByPeriod(series: NormalizedSeries, period: Period) {
  const { bars } = series;
  if (bars.length === 0 || period === "MAX") return bars;
  const last = bars[bars.length - 1].date;
  const d = new Date(`${last}T00:00:00Z`);
  if (period === "1M") d.setUTCMonth(d.getUTCMonth() - 1);
  else if (period === "3M") d.setUTCMonth(d.getUTCMonth() - 3);
  else if (period === "6M") d.setUTCMonth(d.getUTCMonth() - 6);
  else if (period === "YTD") {
    d.setUTCMonth(0);
    d.setUTCDate(1);
  } else if (period === "1A") d.setUTCFullYear(d.getUTCFullYear() - 1);
  else if (period === "3A") d.setUTCFullYear(d.getUTCFullYear() - 3);
  else if (period === "5A") d.setUTCFullYear(d.getUTCFullYear() - 5);
  const from = d.toISOString().slice(0, 10);
  return bars.filter((b) => b.date >= from);
}

function decimate(bars: ReturnType<typeof filterByPeriod>, max = 600) {
  if (bars.length <= max) return bars;
  const step = Math.ceil(bars.length / max);
  const result = bars.filter((_, i) => i % step === 0);
  const last = bars[bars.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

function chartColor(bars: ReturnType<typeof filterByPeriod>): string {
  if (bars.length < 2) return COLOR_FLAT;
  const first = bars[0].adjusted_close;
  const last = bars[bars.length - 1].adjusted_close;
  return last > first ? COLOR_UP : last < first ? COLOR_DOWN : COLOR_FLAT;
}

type ChartPoint = { date: string; value: number };

// ── Helpers axes ──────────────────────────────────────────────

function axisFormatPrice(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(0)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatAxisDate(dateStr: string, period: Period): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (period === "1M" || period === "3M") return format(d, "d MMM", { locale: fr });
  if (period === "6M" || period === "1A") return format(d, "MMM", { locale: fr });
  return format(d, "MMM yy", { locale: fr });
}

function computeTicks(data: ChartPoint[], period: Period): string[] {
  if (data.length <= 1) return data.map((d) => d.date);
  const n = period === "1M" ? 5 : period === "3M" ? 4 : 6;
  const count = Math.min(n, data.length);
  const ticks: string[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(data[Math.round((i / (count - 1)) * (data.length - 1))].date);
  }
  return [...new Set(ticks)];
}

// ── PriceChart ────────────────────────────────────────────────

function PriceChart({
  series,
  period,
  height,
  gradientId,
  item,
  showHeader = false,
}: {
  series: NormalizedSeries;
  period: Period;
  height: number;
  gradientId: string;
  item: EnrichedWatchlistItem;
  showHeader?: boolean;
}) {
  const data: ChartPoint[] = useMemo(() => {
    const filtered = filterByPeriod(series, period);
    return decimate(filtered).map((b) => ({ date: b.date, value: b.adjusted_close }));
  }, [series, period]);

  const { color, lastPrice, perf } = useMemo(() => {
    const filtered = filterByPeriod(series, period);
    const c = chartColor(filtered);
    const lp = filtered.length > 0 ? filtered[filtered.length - 1].adjusted_close : undefined;
    const first = filtered.length > 0 ? filtered[0].adjusted_close : undefined;
    const p = lp && first && first > 0 ? (lp / first - 1) * 100 : undefined;
    return { color: c, lastPrice: lp, perf: p };
  }, [series, period]);

  const ticks = useMemo(() => computeTicks(data, period), [data, period]);
  const firstValue = data[0]?.value;
  const lastPoint = data[data.length - 1];

  const yDomain = useMemo((): [number, number] | ["auto", "auto"] => {
    if (data.length === 0) return ["auto", "auto"];
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [min * 0.995, max * 1.005];
  }, [data]);

  const tooltipContent = useCallback(
    (props: { active?: boolean; payload?: ReadonlyArray<{ payload?: ChartPoint }> }) => (
      <ChartTooltip {...props} firstValue={firstValue} currency={item.currency} />
    ),
    [firstValue, item.currency],
  );

  const [zoomOpen, setZoomOpen] = useState(false);

  if (data.length < 2) {
    return (
      <div
        className="w-full rounded-lg bg-muted/20 flex items-center justify-center text-xs text-muted-foreground/40"
        style={{ height }}
      >
        Données insuffisantes
      </div>
    );
  }

  // Rendu du graphique réutilisable : inline (px) et dans la fenêtre de zoom
  // (hauteur CSS "vh" → wrapper à hauteur définie + container 100 %). `gid` rend
  // l'id du dégradé unique entre les deux instances.
  const renderChart = (h: number | string, gid: string) => {
    const isCss = typeof h === "string";
    return (
      <div style={isCss ? { height: h } : undefined}>
        <ResponsiveContainer width="100%" height={isCss ? "100%" : h}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 10 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
              vertical={false}
            />

            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={(v) => formatAxisDate(v, period)}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--muted-foreground)"
              dy={4}
            />

            <YAxis
              tickFormatter={axisFormatPrice}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--muted-foreground)"
              width={52}
              domain={yDomain}
              tickCount={5}
              dx={-2}
            />

            <ReTooltip
              content={tooltipContent}
              cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3", strokeWidth: 1 }}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gid})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: "hsl(var(--background))", strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={500}
              animationEasing="ease-out"
            />

            {lastPoint && (
              <ReferenceDot
                x={lastPoint.date}
                y={lastPoint.value}
                r={4}
                fill={color}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="pb-2">
      {showHeader && (
        <ChartHeader
          name={item.name ?? item.symbol}
          symbol={item.symbol}
          price={lastPrice}
          currency={item.currency}
          perf={perf}
          period={PERIOD_LABEL[period]}
          country={item.country}
          countryIso2={item.countryIso2 ?? enCountryToIso2(item.country)}
          exchangeCode={item.exchangeCode}
        />
      )}

      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        className="cursor-zoom-img block w-full"
        aria-label="Agrandir le graphique"
      >
        {renderChart(height, gradientId)}
      </button>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <FrostedDialogContent
          className="max-h-[92vh] w-[92vw] max-w-[92vw] sm:max-w-[92vw]"
          showCloseButton
        >
          <DialogTitle className="text-center text-base font-medium">
            {item.name ?? item.symbol} · {item.symbol}
          </DialogTitle>
          {renderChart("78vh", `${gradientId}-zoom`)}
        </FrostedDialogContent>
      </Dialog>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────

export type AssetPanelMode = "inline" | "card";

type Props = {
  item: EnrichedWatchlistItem;
  mode: AssetPanelMode;
  assetType?: AssetType;
  onCloseAction?: () => void;
  onRemoveFavoriteAction?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  /** Période contrôlée par le parent (mode dashboard). Si omis, état local. */
  period?: Period;
  /** Callback du changement de période (mode dashboard). */
  onPeriodChangeAction?: (p: Period) => void;
};

// ── Mode inline (accordion screener) ─────────────────────────

function AssetPanelInline({
  item,
  period: controlledPeriod,
  onPeriodChangeAction,
}: Omit<Props, "mode" | "assetType" | "onRemoveFavoriteAction">) {
  // Pattern controlled/uncontrolled : si le parent passe period + handler,
  // on les utilise ; sinon, on retombe sur l'état local (rétrocompat).
  const [internalPeriod, setInternalPeriod] = useState<Period>("1A");
  const period = controlledPeriod ?? internalPeriod;
  const setPeriod = onPeriodChangeAction ?? setInternalPeriod;
  const { series, status } = useAssetPanelMetrics(item);
  const loading = status === "loading";
  const gradId = `grad-${item.symbol.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const isForex = item.exchangeCode === "FOREX";

  const metrics = useMemo<PanelMetrics | null>(() => {
    if (!series) return null;
    const filtered = filterByPeriod(series, period);
    return computePanelMetrics({ kind: series.kind, bars: filtered, source: series.source });
  }, [series, period]);

  const kpis = metrics ? metricsToKpis(metrics, isForex) : KPIS_DASH;
  const enrichedKpis = useMemo(
    () => enrichKpis(kpis, period, series, item.symbol),
    [kpis, period, series, item.symbol],
  );

  return (
    <div className="bg-transparent">
      {/* KPI row — pleine largeur. Cross-fade lors d'un changement de période. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={period}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn("grid gap-3 px-4 py-4", isForex ? "grid-cols-7" : "grid-cols-6")}
        >
          {enrichedKpis.map((kpi) => (
            <MetricCard key={kpi.label} {...kpi} loading={loading} />
          ))}
        </motion.div>
      </AnimatePresence>

      <Separator />

      {/* Sélecteur période + graphique */}
      <div className="px-4 py-4 space-y-3">
        <PeriodSelector value={period} onChange={setPeriod} periods={PERIODS_FULL} />
        {series ? (
          <PriceChart
            series={series}
            period={period}
            height={160}
            gradientId={gradId}
            item={item}
            showHeader
          />
        ) : (
          <div className="w-full rounded-lg bg-muted/20 animate-pulse" style={{ height: 160 }} />
        )}
      </div>
    </div>
  );
}

// ── Mode card (dashboard) ─────────────────────────────────────

function AssetPanelCard({
  item,
  onRemoveFavoriteAction,
  dragHandleProps,
  period: controlledPeriod,
  onPeriodChangeAction,
}: Omit<Props, "mode" | "onCloseAction">) {
  // Pattern controlled/uncontrolled : si le parent passe period + handler,
  // on les utilise ; sinon, on retombe sur l'état local (rétrocompat).
  const [internalPeriod, setInternalPeriod] = useState<Period>("1A");
  const period = controlledPeriod ?? internalPeriod;
  const setPeriod = onPeriodChangeAction ?? setInternalPeriod;
  const { series, status } = useAssetPanelMetrics(item);
  const loading = status === "loading";
  const kind = assetKind(item.exchangeCode, item.assetTypeRaw);
  const isForex = item.exchangeCode === "FOREX";

  const metrics = useMemo<PanelMetrics | null>(() => {
    if (!series) return null;
    const filtered = filterByPeriod(series, period);
    return computePanelMetrics({ kind: series.kind, bars: filtered, source: series.source });
  }, [series, period]);

  const kpis = metrics ? metricsToKpis(metrics, isForex).slice(0, 4) : KPIS_DASH.slice(0, 4);
  const enrichedKpis = useMemo(
    () => enrichKpis(kpis, period, series, item.symbol),
    [kpis, period, series, item.symbol],
  );

  // Prix actuel + perf 1J — calculés sur la série complète (indépendants de la période)
  const { lastPrice, ret1d } = useMemo(() => {
    if (!series || series.bars.length === 0) return { lastPrice: undefined, ret1d: undefined };
    const lastBar = series.bars[series.bars.length - 1];
    const rets = series.kind === "calendar" ? cryptoReturns(series) : weekdayReturns(series);
    return { lastPrice: lastBar.close, ret1d: rets.ret1d };
  }, [series]);

  const ret1dSign =
    ret1d === undefined ? "neutral" : ret1d > 0 ? "positive" : ret1d < 0 ? "negative" : "neutral";

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
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.symbol}</p>

          {/* Prix + 1J */}
          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-2xl font-bold tabular-nums tracking-tight">
              {lastPrice !== undefined ? formatPrice(lastPrice, item.currency) : "—"}
            </span>
            <span
              className={cn(
                "text-base font-semibold tabular-nums px-1.5 py-0.5 rounded",
                ret1dSign === "positive" &&
                  "text-success-700 bg-success-50 dark:text-success-400 dark:bg-success-500/10",
                ret1dSign === "negative" &&
                  "text-error-700 bg-error-50 dark:text-error-400 dark:bg-error-500/10",
                ret1dSign === "neutral" && "text-muted-foreground bg-muted",
              )}
            >
              {ret1d !== undefined ? `1J ${formatPct(ret1d)}` : "1J —"}
            </span>
          </div>
        </div>
      </CardHeader>

      {/* KPI (4 métriques). Cross-fade lors d'un changement de période. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={period}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="grid grid-cols-2 gap-3 px-4 py-3"
        >
          {enrichedKpis.map((kpi) => (
            <MetricCard key={kpi.label} {...kpi} loading={loading} />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Graphique */}
      <CardContent className="px-4 pt-0 pb-4 space-y-3">
        <PeriodSelector value={period} onChange={setPeriod} periods={PERIODS_FULL} size="compact" />
        {series ? (
          <PriceChart
            series={series}
            period={period}
            height={160}
            gradientId={`grad-card-${item.symbol.replace(/[^a-zA-Z0-9]/g, "-")}`}
            item={item}
          />
        ) : (
          <div className="w-full rounded-lg bg-muted/20 animate-pulse" style={{ height: 160 }} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Export principal ──────────────────────────────────────────

export function AssetPanel({
  item,
  mode,
  onCloseAction,
  onRemoveFavoriteAction,
  dragHandleProps,
  period,
  onPeriodChangeAction,
}: Props) {
  if (mode === "card")
    return (
      <AssetPanelCard
        item={item}
        onRemoveFavoriteAction={onRemoveFavoriteAction}
        dragHandleProps={dragHandleProps}
        period={period}
        onPeriodChangeAction={onPeriodChangeAction}
      />
    );
  return (
    <AssetPanelInline
      item={item}
      onCloseAction={onCloseAction}
      period={period}
      onPeriodChangeAction={onPeriodChangeAction}
    />
  );
}
