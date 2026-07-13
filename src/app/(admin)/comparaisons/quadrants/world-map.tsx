"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { REGIME, REGIME_ORDER, type RegimeKey } from "./regime-palette";
import {
  cellOf,
  isQuadrant,
  countryHover,
  CountryTooltip,
  type QuadrantPoint,
  type CountryHover,
} from "./quadrant-map";
import { GeoChoropleth, type GeoItem, type Region } from "./geo-choropleth";

// La carte des régimes est un habillage mince de `GeoChoropleth` : couleurs et
// infobulle spécifiques au régime, liste groupée par régime sous la carte.
export { REGION_LABELS, type Region } from "./geo-choropleth";

const MAX_CHIPS = 10;

const NODATA_HOVER: CountryHover = {
  name: "",
  dot: "bg-muted/50",
  hasData: false,
  regime: "Sans données",
  growth: "",
  inflation: "",
  signal: "",
};

const regimeKey = (p: QuadrantPoint): RegimeKey => {
  const cell = cellOf(p);
  return isQuadrant(cell) ? cell : "transition";
};

export function WorldMap({
  points,
  asOfLabel,
  region,
}: {
  points: QuadrantPoint[];
  asOfLabel: string | null;
  region: Region;
}) {
  const pointByCode = useMemo(() => new Map(points.map((p) => [p.countryCode, p])), [points]);

  const items = useMemo<GeoItem[]>(
    () =>
      points.map((p) => {
        const k = regimeKey(p);
        return { code: p.countryCode, name: p.name, fillClass: REGIME[k].area, dotClass: REGIME[k].dot };
      }),
    [points],
  );

  return (
    <GeoChoropleth
      items={items}
      region={region}
      title="Carte des régimes par pays"
      renderTooltip={({ code, name, x, y }) => {
        const p = code ? pointByCode.get(code) : undefined;
        const data = p ? countryHover(p) : { ...NODATA_HOVER, name };
        return <CountryTooltip data={data} asOfLabel={asOfLabel} x={x} y={y} />;
      }}
      renderBelow={(framedCodes) => {
        const groups: Record<RegimeKey, QuadrantPoint[]> = { TR: [], BR: [], TL: [], BL: [], transition: [] };
        for (const code of framedCodes) {
          const p = pointByCode.get(code);
          if (p) groups[regimeKey(p)].push(p);
        }
        for (const k of Object.keys(groups) as RegimeKey[]) {
          groups[k].sort((a, b) => a.countryCode.localeCompare(b.countryCode));
        }
        const total = REGIME_ORDER.reduce((s, k) => s + groups[k].length, 0);
        return (
          <div className="rounded-xl border bg-card p-3">
            <div className="mb-4 text-xs font-medium text-muted-foreground">
              Pays couverts par régime
              {total > 0 && <span className="text-muted-foreground/70"> · {total}</span>}
            </div>
            {total === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun pays couvert dans cette zone.</p>
            ) : (
              <TooltipProvider delayDuration={150}>
                <div className="space-y-2">
                  {REGIME_ORDER.filter((k) => groups[k].length > 0).map((k) => {
                    const list = groups[k];
                    const shown = list.slice(0, MAX_CHIPS);
                    const overflow = list.slice(MAX_CHIPS);
                    return (
                      <div key={k} className="flex items-center gap-3">
                        <div className="flex w-48 shrink-0 items-center gap-1.5">
                          <span className={cn("size-2.5 shrink-0 rounded-full", REGIME[k].dot)} />
                          <span className="truncate text-xs font-medium">{REGIME[k].label}</span>
                        </div>
                        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {list.length}
                        </span>
                        <div className="flex flex-1 flex-wrap items-center gap-1.5">
                          {shown.map((p) => (
                            <span
                              key={p.countryCode}
                              className="inline-flex items-center gap-1 rounded-md border bg-background/60 px-1.5 py-0.5 text-[11px]"
                            >
                              <CountryFlag code={p.countryCode} countryName={p.name} size={14} />
                              <span className="font-medium tabular-nums">{p.countryCode}</span>
                            </span>
                          ))}
                          {overflow.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex cursor-pointer items-center rounded-md border bg-background/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                                >
                                  +{overflow.length}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="flex max-w-[240px] flex-wrap gap-1.5">
                                {overflow.map((p) => (
                                  <span
                                    key={p.countryCode}
                                    className="inline-flex items-center gap-1 text-[11px]"
                                  >
                                    <CountryFlag code={p.countryCode} countryName={p.name} size={14} />
                                    <span className="font-medium tabular-nums">{p.countryCode}</span>
                                  </span>
                                ))}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>
        );
      }}
    />
  );
}
