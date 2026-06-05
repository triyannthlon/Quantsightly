"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatPct } from "@/lib/yann/analytics/metrics";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { ForexPairFlags } from "@/components/custom/screener/asset-flag";

type Props = {
    name         : string;
    symbol       : string;
    price       ?: number;
    currency    ?: string;
    perf        ?: number;
    period       : string;
    country     ?: string;
    countryIso2 ?: string;
    exchangeCode?: string;
};

export function ChartHeader({ name, symbol, price, currency, perf, period, country, countryIso2, exchangeCode }: Props) {
    const hasPerf  = perf !== undefined;
    const up       = hasPerf && perf > 0;
    const down     = hasPerf && perf < 0;
    const PerfIcon = up ? TrendingUp : down ? TrendingDown : Minus;

    const isForex  = exchangeCode === "FOREX";
    const isCrypto = exchangeCode === "CC";

    // Pour les paires Forex, strip le suffixe ".FOREX" du symbole
    const forexCode = isForex ? symbol.replace(/\.\w+$/, "") : undefined;

    const showFlag = !isCrypto && (isForex ? !!forexCode : !!(countryIso2 || country));

    return (
        <div className="pb-4 border-b border-border/50">
            {/* Ligne 1 : nom */}
            <span className="text-base font-semibold leading-none truncate block">{name}</span>

            {/* Ligne 2 : méta ticker · devise · drapeau(s) + pays */}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">{symbol}</span>
                {currency && (
                    <>
                        <span className="text-muted-foreground/40 text-xs select-none">·</span>
                        <span className="text-xs text-muted-foreground">{currency}</span>
                    </>
                )}
                {showFlag && (
                    <>
                        <span className="text-muted-foreground/40 text-xs select-none">·</span>
                        {isForex && forexCode ? (
                            <ForexPairFlags code={forexCode} />
                        ) : (
                            <>
                                {countryIso2 && (
                                    <CountryFlag code={countryIso2} countryName={country} size={14} className="opacity-80" />
                                )}
                                {country && <span className="text-xs text-muted-foreground">{country}</span>}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Prix + variation */}
            <div className="flex items-center gap-2 mt-3">
                <span className="text-2xl font-bold tabular-nums leading-none">
                    {price !== undefined ? formatPrice(price, currency) : "—"}
                </span>

                {hasPerf && (
                    <>
                        <span className="text-border/80 select-none text-base">|</span>
                        <span className={cn(
                            "inline-flex items-center gap-1 text-base font-medium tabular-nums",
                            up   && "text-success-700 dark:text-success-400",
                            down && "text-error-700   dark:text-error-400",
                            !up && !down && "text-muted-foreground",
                        )}>
                            <PerfIcon className="h-4 w-4 shrink-0" />
                            {formatPct(perf)}
                            <span className="text-xs font-normal text-muted-foreground">{period}</span>
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
