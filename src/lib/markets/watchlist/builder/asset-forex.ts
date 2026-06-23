/**
 *
 * Compose une ligne de watchlist FOREX.
 *
 * Pas de réseau, pas de cache, pas d'état : fonction PURE.
 */

import type { EodBar } from "@/lib/markets/analytics/metrics";
import type { ForexWatchlistRow } from "../types";
import { buildNormalizedSeries } from "@/lib/markets";
import { weekdayReturns, range52w } from "@/lib/markets";
import { extractSparkline6m } from "./shared";

export type ForexBuilderInputs = {
  identity: {
    symbol: string;
    name: string;
    currency?: string;
  };

  /** Série EODHD brute (peut être vide). */
  rawBars: EodBar[];
};

/** Parse "EURCAD.FOREX" → { base: "EUR", quote: "CAD" }. */
function parseForexPair(symbol: string): { base?: string; quote?: string } {
  const dot = symbol.lastIndexOf(".");
  const code = dot > 0 ? symbol.slice(0, dot) : symbol;

  if (code.length === 6) {
    return {
      base: code.slice(0, 3).toUpperCase(),
      quote: code.slice(3, 6).toUpperCase(),
    };
  }
  if (code.length === 3) {
    // EODHD convention : code 3 chars = USD/XXX (USD implicite)
    return { base: "USD", quote: code.toUpperCase() };
  }
  return {};
}

export function buildForexRow(inputs: ForexBuilderInputs): ForexWatchlistRow {
  // ── 1. Normaliser la série en WEEKDAY (LOCF) ─────────────
  const series = buildNormalizedSeries(inputs.rawBars, "weekday");

  // ── 2. Dernier close NOMINAL + sa date ───────────────────
  const lastBar = series.bars.length > 0 ? series.bars[series.bars.length - 1] : undefined;

  // ── 3. Métriques : retours + range 52W ───────────────────
  const returns = weekdayReturns(series);
  const range = range52w(series);

  // ── 4. Parse base / quote depuis le symbole ──────────────
  const { base, quote } = parseForexPair(inputs.identity.symbol);

  // ── 5. Assemblage ────────────────────────────────────────
  return {
    kind: "forex",

    // Identité
    symbol: inputs.identity.symbol,
    name: inputs.identity.name,
    currency: inputs.identity.currency,

    // Paire base / quote (les drapeaux sont dérivés côté UI par ForexPairFlags)
    base,
    quote,

    // Prix courant
    last: lastBar?.close,
    lastDate: lastBar?.date,

    // Rendements multi-horizons
    ...returns,

    // 52 semaines glissantes : low + high (pas de distance %)
    high52w: range.high52w,
    low52w: range.low52w,
    sparkline6m: extractSparkline6m(series.bars),
  };
}
