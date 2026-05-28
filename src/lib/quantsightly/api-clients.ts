import type {SearchResult        ,
             FundamentalsResponse,
             ETFInfo             ,
             ETFHoldingsResponse ,
             ETFMetadata         ,
             LoadingResponse,} from "./types";

const API_URL = process.env.NEXT_PUBLIC_QS_API_URL ?? "";

/**
 * Résultat d'un fetch API standardisé.
 * - `data`     : le payload si HTTP 200
 * - `loading`  : le payload de loading si HTTP 202
 * - `notFound` : true si HTTP 404
 * - `error`    : message si HTTP 5xx ou erreur réseau
 **/

export type ApiFetchResult<T> = {   status: number;
                                     data?: T;
                                  loading?: LoadingResponse;
                                 notFound?: boolean;
                                    error?: string; };

/************* apiFetch *****/
async function apiFetch<T>(path: string): Promise<ApiFetchResult<T>>
      {//apiFetch
      if (!API_URL) return { status: 0, error: "NEXT_PUBLIC_QS_API_URL is not defined" };
      const url = `${API_URL}${path}`;

      let response: Response;
      try
        {
          response = await fetch(url, {method: "GET", headers: { Accept: "application/json" }, cache: "no-store",});
        }
      catch (err) {                 return { status: 0, error: err instanceof Error ? err.message : "Network error",}; }

      if (response.status === 202)//(1)
         {//(1)
                                                    const loading = (await response.json()) as LoadingResponse;
                                    return { status: 202, loading };
         }//(1)

     if (response.status === 404) { return { status: 404, notFound: true };}

     if (response.status >=  400)//(1)
        {//(1)
                        let message = `HTTP ${response.status}`;
        try
          {
          const body = (await response.json()) as { error?: string; message?: string };
            if (body.error) message = body.message ? `${body.error}: ${body.message}` : body.error;
          }
        catch { /* ignore JSON parse failure */}

                                    return { status: response.status, error: message };
        }//(1)

      const data = (await response.json()) as T;

                                    return { status: response.status, data };
      }//apiFetch


export const QuantsightlyApi =
       {

             search(query: string, limit: number = 20): Promise<ApiFetchResult<SearchResult[]>>
                   {
                       /** GET /api/search?q= — retourne une liste de candidats */

                                                            const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
                   return apiFetch<SearchResult[]>(`/api/search?${params.toString()}`);

                   },

       fundamentals(symbol: string, sections?: string[]): Promise<ApiFetchResult<FundamentalsResponse>>
                   {
                   /** GET /api/stock/:symbol/fundamentals?sections=... */
                                                                                                           const qs = sections && sections.length > 0 ? `?sections=${sections.join(",")}` : "";
                   return apiFetch<FundamentalsResponse>(`/api/stock/${encodeURIComponent(symbol)}/fundamentals${qs}`);
                   },

            ETFInfo(symbol: string): Promise<ApiFetchResult<ETFInfo>>
                   {
                   /** GET /api/etf/:symbol */

                   return apiFetch<ETFInfo>(`/api/etf/${encodeURIComponent(symbol)}`);

                   },

        ETFHoldings(symbol: string, limit: number = 50): Promise<ApiFetchResult<ETFHoldingsResponse>>
                   {
                   /** GET /api/etf/:symbol/holdings?limit=N */

                   return apiFetch<ETFHoldingsResponse>(`/api/etf/${encodeURIComponent(symbol)}/holdings?limit=${limit}`);

                   },

        ETFMetadata(symbol: string): Promise<ApiFetchResult<ETFMetadata>>
                   {
                   /** GET /api/etf/:symbol/metadata */

                   return apiFetch<ETFMetadata>(`/api/etf/${encodeURIComponent(symbol)}/metadata`);

                   },

             health(): Promise<ApiFetchResult<unknown>>
                   {
                   /** GET /api/health (utile pour les checks) */

                   return apiFetch<unknown>(`/api/health`);

                   },
       };