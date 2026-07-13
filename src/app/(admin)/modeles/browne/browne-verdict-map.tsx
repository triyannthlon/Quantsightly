"use client";

import { useMemo } from "react";
import type { BrowneComparisonRow } from "@/lib/coredata/browne-service";
import { GeoChoropleth, type GeoItem, type Region } from "../../comparaisons/quadrants/geo-choropleth";
import { browneVsEquity, fmtPts, VERDICT_HEX, VERDICT_ORDER, type BrowneVerdict } from "./helpers";

// Classes Tailwind LITTÉRALES (aplat carte + pastille) par verdict.
const MAP_CLASS: Record<BrowneVerdict, { fill: string; dot: string }> = {
  "Supérieur aux actions": { fill: "fill-[#34d399] stroke-[#34d399]", dot: "bg-[#34d399]" },
  "Excellent compromis": { fill: "fill-[#22d3ee] stroke-[#22d3ee]", dot: "bg-[#22d3ee]" },
  Protecteur: { fill: "fill-[#fbbf24] stroke-[#fbbf24]", dot: "bg-[#fbbf24]" },
  "Protection limitée": { fill: "fill-[#f87171] stroke-[#f87171]", dot: "bg-[#f87171]" },
  "Profil atypique": { fill: "fill-[#a78bfa] stroke-[#a78bfa]", dot: "bg-[#a78bfa]" },
  "Compromis modéré": { fill: "fill-[#94a3b8] stroke-[#94a3b8]", dot: "bg-[#94a3b8]" },
};

export function BrowneVerdictMap({
  rows,
  region,
}: {
  rows: BrowneComparisonRow[];
  region: Region;
}) {
  const veByCode = useMemo(
    () => new Map(rows.map((r) => [r.countryCode, browneVsEquity(r)])),
    [rows],
  );

  const items = useMemo<GeoItem[]>(
    () =>
      rows.flatMap((r) => {
        const v = veByCode.get(r.countryCode)?.verdict;
        if (!v) return [];
        return [
          {
            code: r.countryCode,
            name: r.countryFr ?? r.countryCode,
            fillClass: MAP_CLASS[v].fill,
            dotClass: MAP_CLASS[v].dot,
          },
        ];
      }),
    [rows, veByCode],
  );

  return (
    <GeoChoropleth
      items={items}
      region={region}
      title="Carte des verdicts Browne vs Actions"
      renderTooltip={({ code, name, x, y }) => {
        const ve = code ? veByCode.get(code) : null;
        return (
          <div
            className="pointer-events-none fixed z-50 min-w-48 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md"
            style={{ left: x + 14, top: y + 14 }}
          >
            <div className="font-semibold">{name}</div>
            {ve?.verdict ? (
              <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <span className="text-muted-foreground">Profil :</span>
                <span className="text-right font-semibold" style={{ color: VERDICT_HEX[ve.verdict] }}>
                  {ve.verdict}
                </span>
                <span className="text-muted-foreground">Écart rendement :</span>
                <span className="text-right tabular-nums">{fmtPts(ve.ecartReturn)}</span>
                <span className="text-muted-foreground">Réduction drawdown :</span>
                <span className="text-right tabular-nums">{fmtPts(ve.drawdownReduction)}</span>
                <span className="text-muted-foreground">Écart volatilité :</span>
                <span className="text-right tabular-nums">{fmtPts(ve.ecartVol)}</span>
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-muted-foreground">Sans données</div>
            )}
          </div>
        );
      }}
      renderBelow={(framedCodes) => {
        const counts = {} as Record<BrowneVerdict, number>;
        for (const code of framedCodes) {
          const v = veByCode.get(code)?.verdict;
          if (v) counts[v] = (counts[v] ?? 0) + 1;
        }
        const present = VERDICT_ORDER.filter((v) => counts[v] > 0);
        if (!present.length) return null;
        return (
          <div className="rounded-xl border bg-card p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Profils couverts</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
              {present.map((v) => (
                <span key={v} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: VERDICT_HEX[v] }} />
                  {v}
                  <span className="font-semibold tabular-nums text-foreground">{counts[v]}</span>
                </span>
              ))}
            </div>
          </div>
        );
      }}
    />
  );
}
