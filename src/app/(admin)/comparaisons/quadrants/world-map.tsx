"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { WORLD_COUNTRIES } from "./world-geo";
import {
  cellOf,
  isQuadrant,
  countryHover,
  CountryTooltip,
  type QuadrantPoint,
  type CountryHover,
} from "./quadrant-map";

// Étirement vertical des tracés (l'équirectangulaire rend la carte plate/large).
const Y_STRETCH = 1.25;
const VIEWBOX = "-180 -110 360 200";

// Remplissage TRANSPARENT + bordure colorée (comme l'intérieur des cercles du
// 2×2), assombrissement au survol. Pays non traités = couleur du fond.
const QUAD_CLASS: Record<"TR" | "TL" | "BR" | "BL", string> = {
  TR: "fill-amber-500/15 stroke-amber-500/55 hover:fill-amber-500/40",
  TL: "fill-rose-500/15 stroke-rose-500/55 hover:fill-rose-500/40",
  BR: "fill-emerald-500/15 stroke-emerald-500/55 hover:fill-emerald-500/40",
  BL: "fill-blue-500/15 stroke-blue-500/55 hover:fill-blue-500/40",
};
const TRANSITION_CLASS =
  "fill-muted-foreground/25 stroke-muted-foreground/50 hover:fill-muted-foreground/40";
const NODATA_CLASS = "fill-card stroke-foreground/12";

const NODATA_HOVER: CountryHover = {
  name: "",
  dot: "bg-muted/50",
  hasData: false,
  regime: "Sans données",
  growth: "",
  inflation: "",
  signal: "",
};

export function WorldMap({
  points,
  asOfLabel,
}: {
  points: QuadrantPoint[];
  asOfLabel: string | null;
}) {
  const [hover, setHover] = useState<{ data: CountryHover; x: number; y: number } | null>(null);

  // Tracés memoïsés (indépendants du survol) → seule l'infobulle se redessine.
  const paths = useMemo(() => {
    const byId = new Map(points.map((p) => [p.countryCode, p]));
    return WORLD_COUNTRIES.map((c, i) => {
      const p = c.id ? byId.get(c.id) : undefined;
      let className = NODATA_CLASS;
      let data: CountryHover = { ...NODATA_HOVER, name: c.name };
      if (p) {
        const cell = cellOf(p);
        className = isQuadrant(cell) ? QUAD_CLASS[cell] : TRANSITION_CLASS;
        data = countryHover(p);
      }
      return (
        <path
          key={c.id || `x${i}`}
          d={c.d}
          strokeWidth={0.4}
          className={cn("transition-[fill] duration-150", className, p && "cursor-pointer")}
          onMouseMove={(e) => setHover({ data, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setHover(null)}
        />
      );
    });
  }, [points]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card p-2">
      <svg
        viewBox={VIEWBOX}
        className="h-auto w-full"
        role="img"
        aria-label="Carte des régimes économiques par pays"
        onMouseLeave={() => setHover(null)}
      >
        <g transform={`scale(1, ${Y_STRETCH})`}>{paths}</g>
      </svg>

      {hover && (
        <CountryTooltip data={hover.data} asOfLabel={asOfLabel} x={hover.x} y={hover.y} />
      )}
    </div>
  );
}
