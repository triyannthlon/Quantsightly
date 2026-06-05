"use client";

import React from "react";
import { Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MetricSparkline } from "./metric-sparkline";

export type MetricSign = "positive" | "negative" | "neutral";

export type MetricCardProps = {
    label           : string;
    value           : string;
    sign           ?: MetricSign;
    context        ?: string;
    qualLabel      ?: string;
    qualLabelClass ?: string;
    sparkData      ?: { date: string; value: number }[];
    gradientId     ?: string;
    loading        ?: boolean;
    gaugeValue     ?: number;
    volatilityValue?: number;
};

const SPARK_COLORS: Record<MetricSign, string> = {
    positive: "#22c55e",
    negative: "#ef4444",
    neutral : "#6b7280",
};

const GRAD_STYLES: Record<MetricSign, string> = {
    positive: "linear-gradient(to bottom right, hsl(142 70% 50% / 0.08), transparent 60%)",
    negative: "linear-gradient(to bottom right, hsl(0 75% 60% / 0.10), transparent 60%)",
    neutral : "",
};

function SharpeGauge({ value }: { value: number }) {
    const pct   = `${Math.min(Math.max(value / 3, 0), 1) * 100}%`;
    const color = value < 0 ? "#f04438"
                : value < 1 ? "#fb923c"
                : value < 2 ? "#34d399"
                :              "#10b981";

    return (
        <div className="w-full">
            <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: pct, backgroundColor: color }}
                />
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground/60 leading-none">0</span>
                <span className="text-[9px] text-muted-foreground/60 leading-none">1</span>
                <span className="text-[9px] text-muted-foreground/60 leading-none">2</span>
                <span className="text-[9px] text-muted-foreground/60 leading-none">3+</span>
            </div>
        </div>
    );
}

const VOLATILITY_GRADIENT = "linear-gradient(to right, #10b981 0%, #f59e0b 30%, #fb923c 50%, #ef4444 80%)";

function VolatilityGauge({ value }: { value: number }) {
    const pct = `${Math.min(Math.max(value / 50, 0), 1) * 100}%`;

    return (
        <div className="w-full">
            <div className="relative h-1.5 rounded-full overflow-hidden"
                style={{ background: VOLATILITY_GRADIENT }}>
                <div
                    className="absolute inset-y-0 w-0.5 bg-white/80"
                    style={{ left: pct, transform: "translateX(-50%)" }}
                />
            </div>
            <div className="relative mt-1 h-3">
                <span className="absolute left-0 text-[9px] text-muted-foreground/60 leading-none">0</span>
                <span className="absolute text-[9px] text-muted-foreground/60 leading-none -translate-x-1/2" style={{ left: "30%" }}>15</span>
                <span className="absolute text-[9px] text-muted-foreground/60 leading-none -translate-x-1/2" style={{ left: "50%" }}>25</span>
                <span className="absolute text-[9px] text-muted-foreground/60 leading-none -translate-x-1/2" style={{ left: "80%" }}>40+</span>
            </div>
        </div>
    );
}

export function MetricCard({
    label, value, sign, context, qualLabel, qualLabelClass,
    sparkData, gradientId, loading, gaugeValue, volatilityValue,
}: MetricCardProps) {
    const sparkColor   = SPARK_COLORS[sign ?? "neutral"];
    const gradStyle    = sign && sign !== "neutral" ? GRAD_STYLES[sign] : undefined;
    const hasSparkline = !loading && !!sparkData && sparkData.length >= 2 && !!gradientId;
    const hasGauge     = !loading && !hasSparkline && (gaugeValue !== undefined || volatilityValue !== undefined);

    return (
        <div className={cn(
            "relative rounded-xl border border-border bg-card/40 backdrop-blur-md shadow-sm",
            "flex flex-col overflow-hidden min-h-[140px]",
            "transition-all duration-200",
            "hover:bg-card/60 hover:shadow-md hover:scale-[1.01]",
        )}>
            {gradStyle && (
                <div
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ backgroundImage: gradStyle }}
                />
            )}

            <Info className="absolute top-3 right-3 h-[14px] w-[14px] text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors cursor-default" />

            <div className={cn(
                "flex flex-col px-4 pt-4 flex-1",
                hasSparkline ? "pb-1" : hasGauge ? "pb-2" : "pb-4",
            )}>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground select-none">
                    {label}
                </span>
                <div className="mt-3">
                    {loading ? (
                        <Skeleton className="h-8 w-20" />
                    ) : (
                        <>
                            <span className={cn(
                                "text-3xl font-bold tabular-nums leading-none block",
                                sign === "positive"          && "text-success-700 dark:text-success-400",
                                sign === "negative"          && "text-error-700   dark:text-error-400",
                                (!sign || sign === "neutral") && "text-foreground",
                            )}>
                                {value}
                            </span>
                            {context && (
                                <span className="text-xs text-muted-foreground mt-1 block">
                                    {context}
                                </span>
                            )}
                            {qualLabel && (
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1.5 mt-2 w-fit",
                                        "px-2 py-0.5 rounded-md text-xs font-medium",
                                        qualLabelClass,
                                    )}
                                    style={{ backgroundColor: "color-mix(in oklch, currentColor 10%, transparent)" }}
                                >
                                    <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-current" />
                                    {qualLabel}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {hasSparkline && (
                <MetricSparkline data={sparkData!} color={sparkColor} gradientId={gradientId!} />
            )}
            {hasGauge && (
                <div className="px-4 pb-3">
                    {gaugeValue !== undefined
                        ? <SharpeGauge value={gaugeValue} />
                        : <VolatilityGauge value={volatilityValue!} />
                    }
                </div>
            )}
        </div>
    );
}
