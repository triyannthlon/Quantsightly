/**
 * Compose une ligne de watchlist BOND (obligations souveraines).
 *
 * Symbol format : "{CODE}.GBOND" — ex. "US10Y.GBOND", "FR10Y.GBOND".
 * Calendrier weekday (lun-ven, comme actions/indices/forex).
 * Pas de logo, pas de fundamentals, pas de dividends côté C++.
 *
 * Pas de réseau, pas de cache, pas d'état : fonction PURE.
 */

import type { EodBar } from "@/lib/markets/analytics/metrics";
import type { BondWatchlistRow } from "../types";
import { buildNormalizedSeries } from "@/lib/markets";
import { weekdayReturns, distanceTo52WHigh } from "@/lib/markets";
import { extractSparkline6m } from "./shared";

export type BondBuilderInputs = {
  identity: {
    symbol: string;
    name: string;
    currency?: string;
    country?: string;
    countryIso2?: string;
  };
  rawBars: EodBar[];
};

export function buildBondRow(inputs: BondBuilderInputs): BondWatchlistRow {
  const series = buildNormalizedSeries(inputs.rawBars, "weekday");
  const lastBar = series.bars.length > 0 ? series.bars[series.bars.length - 1] : undefined;
  const returns = weekdayReturns(series);
  const dist52w = distanceTo52WHigh(series);

  return {
    kind: "bond",
    symbol: inputs.identity.symbol,
    name: inputs.identity.name,
    currency: inputs.identity.currency,
    country: inputs.identity.country,
    countryIso2: inputs.identity.countryIso2,
    last: lastBar?.close,
    lastDate: lastBar?.date,
    ...returns,
    distanceTo52WHigh: dist52w,
    sparkline6m: extractSparkline6m(series.bars),
  };
}
