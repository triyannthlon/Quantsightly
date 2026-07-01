"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WORLD_COUNTRIES } from "./world-geo";
import { REGIME, REGIME_ORDER, type RegimeKey } from "./regime-palette";
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

// ─── Filtres régionaux (zoom/recentrage de la carte) ────────────────────────
// Projection équirectangulaire (x = lon, y = −lat), puis étirement vertical par
// Y_STRETCH. On garde TOUS les viewBox au même ratio (AR) que la vue Monde pour
// que la hauteur du SVG ne change pas d'une région à l'autre (pas de saut).
export type Region = "monde" | "amerique" | "europe" | "asie";

export const REGION_LABELS: { key: Region; label: string }[] = [
  { key: "monde", label: "Monde" },
  { key: "amerique", label: "Amérique" },
  { key: "europe", label: "Europe" },
  { key: "asie", label: "Asie-Pacifique" },
];

type ViewBox = [number, number, number, number];
const MONDE_VB: ViewBox = [-180, -110, 360, 200];
const AR = MONDE_VB[2] / MONDE_VB[3]; // 1.8

// Bounding-box géographique (lon/lat) → viewBox étendu au ratio AR (centré).
function fitViewBox(lonMin: number, lonMax: number, latMin: number, latMax: number): ViewBox {
  let x = lonMin;
  let w = lonMax - lonMin;
  let y = -latMax * Y_STRETCH;
  let h = (latMax - latMin) * Y_STRETCH;
  if (w / h < AR) {
    const nw = h * AR;
    x -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / AR;
    y -= (nh - h) / 2;
    h = nh;
  }
  return [x, y, w, h];
}

const REGION_VB: Record<Region, ViewBox> = {
  monde: MONDE_VB,
  amerique: fitViewBox(-168, -32, -56, 72),
  europe: fitViewBox(-26, 46, 34, 71),
  asie: fitViewBox(60, 155, -44, 55), // Asie-Pacifique : inclut l'Australie (sud) et le Japon
};

const TWEEN_MS = 400;
// easeInOutCubic
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Centre du plus grand sous-tracé d'un `d` SVG (le plus de points = la masse
// continentale principale, pour ignorer les îles type Alaska/Hawaï). Coords en
// repère carte (x = lon, y = -lat, AVANT l'étirement Y_STRETCH).
function centroidOf(d: string | undefined): { cx: number; cy: number } | null {
  if (!d) return null;
  let best: number[] | null = null;
  for (const sub of d.split("M")) {
    if (!sub.trim()) continue;
    const nums = sub.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 6) continue;
    if (!best || nums.length > best.length) best = nums.map(Number);
  }
  if (!best) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 0; i + 1 < best.length; i += 2) {
    sx += best[i];
    sy += best[i + 1];
    n++;
  }
  return n ? { cx: sx / n, cy: sy / n } : null;
}

// Pays ayant une donnée de régime mais SANS tracé dans Natural Earth 110m
// (cités-États trop petites) → posés en points. Repère carte : cx = longitude,
// cy = -latitude.
const POINT_COUNTRIES: Record<string, { cx: number; cy: number }> = {
  HK: { cx: 114.2, cy: -22.3 },
  SG: { cx: 103.8, cy: -1.35 },
};

// Aplats PLEINS : fond ET contour de la MÊME couleur (opaque) par pays. Deux
// effets recherchés : (1) des pays de même régime partageant une frontière
// fusionnent en un seul bloc (aucune frontière interne visible, puisque tout est
// de la même couleur) ; (2) un rendu doux, sans contours vifs agressifs, qui
// masque aussi la basse résolution des tracés. Survol = léger éclaircissement.
// Couleurs de régime (carte = aplats pleins) centralisées dans `regime-palette`.
// Pays sans données : land discret mais visible (le token --muted est ici plus
// sombre que --card → invisible). foreground à faible opacité marche en thème
// clair comme sombre. Pas de contour → landmass uniforme sans frontières.
const NODATA_CLASS = "fill-foreground/10";

// Nb max de chips pays affichés par régime dans la liste ; au-delà → « +N ».
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

export function WorldMap({
  points,
  asOfLabel,
  region,
}: {
  points: QuadrantPoint[];
  asOfLabel: string | null;
  region: Region;
}) {
  const [hover, setHover] = useState<{ data: CountryHover; x: number; y: number } | null>(null);

  // viewBox animé (tween rAF) au changement de région.
  const [vb, setVb] = useState<ViewBox>(REGION_VB.monde);
  const vbRef = useRef<ViewBox>(vb);
  useEffect(() => {
    vbRef.current = vb;
  }, [vb]);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = vbRef.current;
    const to = REGION_VB[region];
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / TWEEN_MS);
      const e = ease(k);
      setVb([0, 1, 2, 3].map((i) => from[i] + (to[i] - from[i]) * e) as unknown as ViewBox);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [region]);

  // Tracés memoïsés (indépendants du survol) → seule l'infobulle se redessine.
  const paths = useMemo(() => {
    const byId = new Map(points.map((p) => [p.countryCode, p]));
    return WORLD_COUNTRIES.map((c, i) => {
      const p = c.id ? byId.get(c.id) : undefined;
      let className = NODATA_CLASS;
      let data: CountryHover = { ...NODATA_HOVER, name: c.name };
      if (p) {
        const cell = cellOf(p);
        className = REGIME[isQuadrant(cell) ? cell : "transition"].area;
        data = countryHover(p);
      }
      return (
        <path
          key={c.id || `x${i}`}
          d={c.d}
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
          className={cn(
            "transition-[filter] duration-150",
            className,
            p && "cursor-pointer hover:brightness-125",
          )}
          onMouseMove={(e) => setHover({ data, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setHover(null)}
        />
      );
    });
  }, [points]);

  // Position de chaque pays avec donnée : centroïde du tracé, ou coordonnée
  // « point » (HK/SG, sans géométrie). `isPoint` distingue les deux.
  const placed = useMemo(() => {
    const geoById = new Map(
      WORLD_COUNTRIES.filter((c) => c.id).map((c) => [c.id, c.d] as const),
    );
    return points
      .map((p) => {
        const geo = centroidOf(geoById.get(p.countryCode));
        if (geo) return { p, c: geo, isPoint: false };
        const pt = POINT_COUNTRIES[p.countryCode];
        if (pt) return { p, c: pt, isPoint: true };
        return null;
      })
      .filter(
        (e): e is { p: QuadrantPoint; c: { cx: number; cy: number }; isPoint: boolean } =>
          e !== null,
      );
  }, [points]);

  const project = (c: { cx: number; cy: number }) => ({
    left: ((c.cx - vb[0]) / vb[2]) * 100,
    top: ((c.cy * Y_STRETCH - vb[1]) / vb[3]) * 100,
  });
  const inFrame = (left: number, top: number) =>
    left >= -4 && left <= 104 && top >= -4 && top <= 104;

  // Badges (drapeau + ISO) des pays tracés — seulement en zoom.
  const badges =
    region === "monde"
      ? null
      : placed
          .filter((e) => !e.isPoint)
          .map(({ p, c }) => {
            const { left, top } = project(c);
            if (!inFrame(left, top)) return null;
            return (
              <div
                key={p.countryCode}
                className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border bg-background/90 px-1.5 py-0.5 shadow-sm"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <CountryFlag code={p.countryCode} countryName={p.name} size={14} />
                <span className="text-[10px] font-semibold tabular-nums">{p.countryCode}</span>
              </div>
            );
          });

  // Marqueurs des pays-points (HK/SG) : TOUJOURS visibles (un point coloré au
  // niveau Monde, le badge complet en zoom). Interactifs → même tooltip.
  const pointMarkers = placed
    .filter((e) => e.isPoint)
    .map(({ p, c }) => {
      const { left, top } = project(c);
      if (!inFrame(left, top)) return null;
      const cell = cellOf(p);
      const key: RegimeKey = isQuadrant(cell) ? cell : "transition";
      return (
        <div
          key={p.countryCode}
          className="pointer-events-auto absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
          style={{ left: `${left}%`, top: `${top}%` }}
          onMouseMove={(e) => setHover({ data: countryHover(p), x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setHover(null)}
        >
          {region === "monde" ? (
            <span className={cn("block size-2.5 rounded-full ring-1 ring-background", REGIME[key].dot)} />
          ) : (
            <span className="flex items-center gap-1 rounded-full border bg-background/90 px-1.5 py-0.5 shadow-sm">
              <span className={cn("size-2 rounded-full", REGIME[key].dot)} />
              <CountryFlag code={p.countryCode} countryName={p.name} size={14} />
              <span className="text-[10px] font-semibold tabular-nums">{p.countryCode}</span>
            </span>
          )}
        </div>
      );
    });

  // Pays dans le cadre courant, groupés par régime. On borne sur le viewBox de
  // la région CIBLE (pas le vb animé) → liste stable, sans scintillement pendant
  // le tween. Spécifique à la carte : réagit au zoom géographique.
  const framedGroups = useMemo(() => {
    const rvb = REGION_VB[region];
    const g: Record<RegimeKey, QuadrantPoint[]> = { TR: [], BR: [], TL: [], BL: [], transition: [] };
    for (const { p, c } of placed) {
      const left = ((c.cx - rvb[0]) / rvb[2]) * 100;
      const top = ((c.cy * Y_STRETCH - rvb[1]) / rvb[3]) * 100;
      if (left < -2 || left > 102 || top < -2 || top > 102) continue;
      const cell = cellOf(p);
      const key: RegimeKey = isQuadrant(cell) ? cell : "transition";
      g[key].push(p);
    }
    for (const k of Object.keys(g) as RegimeKey[]) {
      g[k].sort((a, b) => a.countryCode.localeCompare(b.countryCode));
    }
    return g;
  }, [placed, region]);

  const framedTotal = REGIME_ORDER.reduce((s, k) => s + framedGroups[k].length, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Carte des régimes par pays
        </div>
        <div className="relative overflow-hidden rounded-lg">
          <svg
            viewBox={vb.map((n) => n.toFixed(2)).join(" ")}
            className="h-auto w-full"
            role="img"
            aria-label="Carte des régimes économiques par pays"
            onMouseLeave={() => setHover(null)}
          >
            <g transform={`scale(1, ${Y_STRETCH})`}>{paths}</g>
          </svg>

          {badges && <div className="pointer-events-none absolute inset-0">{badges}</div>}
          {pointMarkers.length > 0 && (
            <div className="pointer-events-none absolute inset-0">{pointMarkers}</div>
          )}
        </div>
      </div>

      {/* Pays couverts dans le cadre : une ligne compacte par régime. */}
      <div className="rounded-xl border bg-card p-3">
        <div className="mb-4 text-xs font-medium text-muted-foreground">
          Pays couverts par régime
          {framedTotal > 0 && <span className="text-muted-foreground/70"> · {framedTotal}</span>}
        </div>
        {framedTotal === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun pays couvert dans cette zone.</p>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="space-y-2">
              {REGIME_ORDER.filter((k) => framedGroups[k].length > 0).map((k) => {
                const list = framedGroups[k];
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
                                className="inline-flex items-center gap-1 text-[11px] text-background"
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

      {hover && (
        <CountryTooltip data={hover.data} asOfLabel={asOfLabel} x={hover.x} y={hover.y} />
      )}
    </div>
  );
}
