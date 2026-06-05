import { NextRequest, NextResponse } from "next/server";

type RawResult = {
    primary_symbol : string;
    code?          : string;
    exchange_code? : string;
    sub_market?    : string;
    name           : string;
    type?          : string;
    isin?          : string;
    currency?      : string;
    country?       : string;
    country_iso2?  : string;
    matched_via?   : string;
    score?         : number;
};

const QS_BACKEND       = process.env.QS_BACKEND_URL;
const MAX_BACKEND_LIMIT = 500;

export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams;

    const q        = sp.get("q")?.trim() ?? "";
    const type     = sp.get("type")     || undefined;
    const country  = sp.get("country")?.toUpperCase()  || undefined;
    const currency = sp.get("currency")?.toUpperCase() || undefined;
    const exchange = sp.get("exchange") || undefined;
    const limit    = Math.min(Math.max(parseInt(sp.get("limit") ?? "50", 10), 1), 100);

    if (q.length < 2) return NextResponse.json([]);

    if (!QS_BACKEND) {
        return NextResponse.json({ error: "QS_BACKEND_URL not configured" }, { status: 503 });
    }

    // When filters are active, fetch more results from the backend to compensate
    // for the rows that will be dropped after filtering.
    const hasFilters   = Boolean(country || currency || exchange);
    const backendLimit = hasFilters ? Math.min(limit * 5, MAX_BACKEND_LIMIT) : limit;

    const qs = new URLSearchParams({ q, limit: String(backendLimit) });
    if (type) qs.set("type", type);

    try {
        const res = await fetch(`${QS_BACKEND}/api/search?${qs}`, { cache: "no-store" });
        if (!res.ok) {
            return NextResponse.json({ error: `Backend ${res.status}` }, { status: res.status });
        }

        let results: RawResult[] = await res.json();

        if (country)  results = results.filter(r => r.country_iso2?.toUpperCase() === country);
        if (currency) results = results.filter(r => r.currency?.toUpperCase() === currency);
        if (exchange) results = results.filter(r => r.exchange_code === exchange);

        return NextResponse.json(results.slice(0, limit));
    } catch {
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}