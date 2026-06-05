import type { NormalizedBar } from "@/lib/yann";

export function extractSparkline6m(bars: NormalizedBar[]): { date: string; value: number }[] {
    if (!bars.length) return [];
    const last = bars[bars.length - 1].date;
    const d    = new Date(`${last}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 6);
    const from = d.toISOString().slice(0, 10);
    return bars.filter(b => b.date >= from).map(b => ({ date: b.date, value: b.adjusted_close }));
}
