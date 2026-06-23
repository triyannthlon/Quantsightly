/**
 * Couche MARKETS — point d'entrée (barrel)
 * =====================================
 *
 * Structure interne :
 *   series/      → types de base (EodBar, NormalizedSeries…) + pipeline de normalisation
 *   analytics/   → métriques calculées + formatters + conversion de devises
 *   watchlist/    → types de lignes watchlist + builders par type d'actif
 *   clients/     → clients HTTP EODHD (historique, quotes)
 */

// ── Series ────────────────────────────────────────────────────
export type { EodBar, SeriesKind, NormalizedBar, NormalizedSeries } from "./series/types";
export { buildNormalizedSeries } from "./series/normalize";

// ── Analytics ─────────────────────────────────────────────────
export type { FxRate, FxRateSource } from "./analytics/currency";
export { convertValue, convertSeries } from "./analytics/currency";
export {
  totalReturn,
  weekdayReturns,
  cryptoReturns,
  distanceTo52WHigh,
  distanceToATH,
  range52w,
  computePanelMetrics,
} from "./analytics/metrics";
export type { PanelMetrics } from "./analytics/metrics";

// ── Builders ──────────────────────────────────────────────────
export type { StockBuilderInputs } from "./watchlist/builder/asset-stock";
export { buildStockRow } from "./watchlist/builder/asset-stock";
export type { EtfBuilderInputs } from "./watchlist/builder/asset-etf";
export { buildEtfRow } from "./watchlist/builder/asset-etf";
export type { CryptoBuilderInputs } from "./watchlist/builder/asset-crypto";
export { buildCryptoRow } from "./watchlist/builder/asset-crypto";
export type { ForexBuilderInputs } from "./watchlist/builder/asset-forex";
export { buildForexRow } from "./watchlist/builder/asset-forex";
export type { IndexBuilderInputs } from "./watchlist/builder/asset-index";
export { buildIndexRow } from "./watchlist/builder/asset-index";
export type { BondBuilderInputs } from "./watchlist/builder/asset-bond";
export { buildBondRow } from "./watchlist/builder/asset-bond";

// ── Watchlist types ───────────────────────────────────────────
export type {
  WatchlistIdentity,
  CountryLocation,
  LastPrice,
  Distance52WHigh,
  Range52W,
  ReturnsWeekdayMultiHorizon,
  ReturnsCryptoMultiHorizon,
  StockWatchlistRow,
  EtfWatchlistRow,
  CryptoWatchlistRow,
  IndexWatchlistRow,
  ForexWatchlistRow,
  BondWatchlistRow,
  WatchlistRow,
  RowStatus,
} from "./watchlist/types";
