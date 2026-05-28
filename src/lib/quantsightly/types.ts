
// ────────────────────────────────────────────────────────── //
// /api/search/:query                                         //
// ────────────────────────────────────────────────────────── //

export type SearchListing = {    symbol: string;
                              exchange?: string;
                              currency?: string;
                               country?: string;
                             };

export type SearchResult = {     security_id: number;
                                        name: string;
                                 short_name?: string;
                                        type: string;  /* "stock" | "etf" | "fund" | "index" | "forex" | "crypto" | "reit" | ... */
                                       isin?: string;
                                     sector?: string;
                                   domicile?: string;  /*  code ISO 2 lettres (ex: "US", "FR") */
                             primary_symbol?: string;  /* ex: "AAPL.US" */
                                 matched_via: string;  /*  "isin" | "symbol" | "name" | "short_name" | ... */
                                       score: number;
                                   listings?: SearchListing[];
                             };

// ────────────────────────────────────────────────────────── //
// /api/stock/:symbol/fundamentals                            //
// ────────────────────────────────────────────────────────── //

export type FundamentalsFreshness = { daily_refresh_at?: string;
                                       daily_age_hours?: number;
                                       full_refresh_at?: string;
                                         full_age_days?: number; };

export type FundamentalsSection = Record<string, unknown>;

export type FundamentalsResponse = {      symbol: string;
                                     security_id: number;
                                       freshness: FundamentalsFreshness;
                                       sections: {
                                                             general?: FundamentalsSection;
                                                          highlights?: FundamentalsSection;
                                                           valuation?: FundamentalsSection;
                                                          technicals?: FundamentalsSection;
                                                     analyst_ratings?: FundamentalsSection;
                                                        shares_stats?: FundamentalsSection;
                                                    splits_dividends?: FundamentalsSection;
                                                             holders?: FundamentalsSection;
                                                insider_transactions?: FundamentalsSection;
                                                          esg_scores?: FundamentalsSection;
                                                  outstanding_shares?: FundamentalsSection;
                                                            earnings?: FundamentalsSection;
                                                          financials?: FundamentalsSection;
                                                            etf_data?: FundamentalsSection; }; };

// ────────────────────────────────────────────────────────── //
// /api/etf/:symbol                                           //
// ────────────────────────────────────────────────────────── //

export type ETFPrice = { date: string;
                        close: number;
                       volume: number; };

export type ETFInfo = {       symbol: string  ;
                        security_id?: number  ;
                               name?: string  ;
                                type: string  ;
                           exchange?: string  ;
                           currency?: string  ;
                            country?: string  ;
                               isin?: string  ;
                              price?: ETFPrice;
                           etf_info?: {
                                        total_assets?: number;
                                       expense_ratio?: number;
                                               yield?: number;
                                            domicile?: string;
                                         asset_class?: string;
                                            category?: string;
                                      inception_date?: string;
                                         description?: string; }; };

// ────────────────────────────────────────────────────────── //
// /api/etf/:symbol/holdings                                  //
// ────────────────────────────────────────────────────────── //

export type ETFHolding = {    rank?: number;
                             symbol: string;
                              code?: string;
                          exchange?: string;
                               name: string;
                              isin?: string;
                             weight: number;
                            sector?: string;
                          industry?: string;
                           country?: string;
                            region?: string; };

export type ETFHoldingsResponse = {         symbol    : string;
                                            as_of_date: string;
                                            count     : number;
                                    top_n_total_weight: number;
                                              holdings: ETFHolding[]; };

// ────────────────────────────────────────────────────────── //
// /api/etf/:symbol/metadata                                  //
// ────────────────────────────────────────────────────────── //

export type ETFAssetAllocationItem = { "Net_Assets_%": string };

export type ETFMetadata = {                    symbol: string;
                                          security_id: number;
                                        company_name?: string;
                                         company_url?: string;
                                      inception_date?: string;
                                           yield_pct?: number;
                           dividend_paying_frequency?: string;
                                 average_mkt_cap_mil?: number;
                                        total_assets?: number;
                                  net_expenses_ratio?: number;
                                      holdings_count?: number;
                                            freshness: { last_refresh_at?: string; age_days?: number; };
                                   asset_allocation?: Record<string, ETFAssetAllocationItem>;
                                     sector_weights?: Record<string, ETFAssetAllocationItem>;
                                      world_regions?: Record<string, ETFAssetAllocationItem>;
                                  valuations_growth?: Record<string, unknown>;
                                       morning_star?: Record<string, unknown>;
                                        performance?: Record<string, unknown>; };

// ────────────────────────────────────────────────────────── //
// Réponses standardisées de l'API                            //
// ────────────────────────────────────────────────────────── //

export type LoadingResponse = {      status: "loading" | "loading_fundamentals" | "refreshing";
                                     symbol: string;
                                retry_after: number;
                                   message?: string; };

export type ApiError = {    error: string;
                         message?: string;
                          symbol?: string;
                       };


export type InputFormat = "isin" | "symbol_full" | "symbol_short" | "name"; /* Format détecté de l'input utilisateur (pour ranking côté UI) */


export type FetchState<T> = | { status: "idle" }
                            | { status: "loading"; attempts: number }
                            | { status: "success";     data: T }
                            | { status: "error"  ;  message: string; code: "not_found" | "timeout" | "server_error" | "network" }; /* État unifié d'un fetch avec polling */