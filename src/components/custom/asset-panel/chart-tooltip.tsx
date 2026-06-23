"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatPrice, formatPct } from "@/lib/markets/analytics/metrics";

type Payload = { payload?: { date: string; value: number } };

type Props = {
  active?: boolean;
  payload?: ReadonlyArray<Payload>;
  firstValue?: number;
  currency?: string;
};

export function ChartTooltip({ active, payload, firstValue, currency }: Props) {
  if (!active || !payload?.length) return null;

  const pt = payload[0].payload;
  if (!pt) return null;

  const { date, value } = pt;
  const d = new Date(`${date}T00:00:00Z`);
  const formattedDate = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const perf = firstValue && firstValue > 0 ? (value / firstValue - 1) * 100 : undefined;
  const up = perf !== undefined && perf > 0;
  const down = perf !== undefined && perf < 0;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-1.5">{formattedDate}</p>
      <p className="text-base font-semibold tabular-nums leading-none">
        {formatPrice(value, currency)}
      </p>
      {perf !== undefined && (
        <p
          className={cn(
            "text-xs tabular-nums mt-1",
            up && "text-success-700 dark:text-success-400",
            down && "text-error-700   dark:text-error-400",
            !up && !down && "text-muted-foreground",
          )}
        >
          {up ? "▲" : down ? "▼" : "—"} {formatPct(perf)}
        </p>
      )}
    </div>
  );
}
