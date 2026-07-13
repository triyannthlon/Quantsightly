"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/CountryFlag";
import type { WorldCountry } from "./world-geo-50m";

// Étirement vertical des tracés (l'équirectangulaire rend la carte plate/large).
const Y_STRETCH = 1.25;

// ─── Régions (zoom/recentrage) ───────────────────────────────────────────────
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
  asie: fitViewBox(60, 155, -44, 55),
};

const TWEEN_MS = 400;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Centre du plus grand sous-tracé d'un `d` SVG (masse continentale principale). */
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

// Pays sans tracé (cités-États) → posés en points. cx = longitude, cy = -latitude.
const POINT_COUNTRIES: Record<string, { cx: number; cy: number }> = {
  HK: { cx: 114.2, cy: -22.3 },
  SG: { cx: 103.8, cy: -1.35 },
};

// Pays sans données : land discret mais visible.
const NODATA_CLASS = "fill-foreground/10";

/** Un pays coloré sur la carte. `fillClass` et `dotClass` sont des classes Tailwind LITTÉRALES. */
export interface GeoItem {
  code: string;
  name: string;
  /** Aplat carte, ex. `"fill-[#e9af4b] stroke-[#e9af4b]"`. */
  fillClass: string;
  /** Pastille (point HK/SG au niveau Monde), ex. `"bg-[#e9af4b]"`. */
  dotClass: string;
}

export interface GeoHover {
  code: string | null; // null = pays sans donnée
  name: string;
  x: number;
  y: number;
}

/**
 * Carte choroplèthe générique (projection équirectangulaire, zoom régional animé,
 * badges drapeau+ISO, marqueurs points HK/SG, survol). Le remplissage, l'infobulle
 * et le contenu sous la carte sont fournis par l'appelant → réutilisable Régimes /
 * Browne.
 */
export function GeoChoropleth({
  items,
  region,
  title,
  renderTooltip,
  renderBelow,
}: {
  items: GeoItem[];
  region: Region;
  title: string;
  renderTooltip: (hover: GeoHover) => ReactNode;
  renderBelow?: (framedCodes: string[]) => ReactNode;
}) {
  const [hover, setHover] = useState<GeoHover | null>(null);

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

  const [worldCountries, setWorldCountries] = useState<WorldCountry[]>([]);
  useEffect(() => {
    let alive = true;
    void import("./world-geo-50m").then((m) => {
      if (alive) setWorldCountries(m.WORLD_COUNTRIES);
    });
    return () => {
      alive = false;
    };
  }, []);

  const itemByCode = useMemo(() => new Map(items.map((it) => [it.code, it])), [items]);

  const paths = useMemo(() => {
    return worldCountries.map((c, i) => {
      const it = c.id ? itemByCode.get(c.id) : undefined;
      const name = it?.name ?? c.name;
      return (
        <path
          key={c.id || `x${i}`}
          d={c.d}
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
          className={cn(
            "transition-[filter] duration-150",
            it ? it.fillClass : NODATA_CLASS,
            it && "cursor-pointer hover:brightness-125",
          )}
          onMouseMove={(e) =>
            setHover({ code: it?.code ?? null, name, x: e.clientX, y: e.clientY })
          }
          onMouseLeave={() => setHover(null)}
        />
      );
    });
  }, [itemByCode, worldCountries]);

  const placed = useMemo(() => {
    const geoById = new Map(worldCountries.filter((c) => c.id).map((c) => [c.id, c.d] as const));
    return items
      .map((it) => {
        const geo = centroidOf(geoById.get(it.code));
        if (geo) return { it, c: geo, isPoint: false };
        const pt = POINT_COUNTRIES[it.code];
        if (pt) return { it, c: pt, isPoint: true };
        return null;
      })
      .filter((e): e is { it: GeoItem; c: { cx: number; cy: number }; isPoint: boolean } => e !== null);
  }, [items, worldCountries]);

  const project = (c: { cx: number; cy: number }) => ({
    left: ((c.cx - vb[0]) / vb[2]) * 100,
    top: ((c.cy * Y_STRETCH - vb[1]) / vb[3]) * 100,
  });
  const inFrame = (left: number, top: number) => left >= -4 && left <= 104 && top >= -4 && top <= 104;

  const badges = placed
    .filter((e) => !e.isPoint)
    .map(({ it, c }) => {
      const { left, top } = project(c);
      if (!inFrame(left, top)) return null;
      return (
        <div
          key={it.code}
          className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border bg-background/90 px-1.5 py-0.5 shadow-sm"
          style={{ left: `${left}%`, top: `${top}%` }}
        >
          <CountryFlag code={it.code} countryName={it.name} size={14} />
          <span className="text-[10px] font-semibold tabular-nums">{it.code}</span>
        </div>
      );
    });

  const pointMarkers = placed
    .filter((e) => e.isPoint)
    .map(({ it, c }) => {
      const { left, top } = project(c);
      if (!inFrame(left, top)) return null;
      return (
        <div
          key={it.code}
          className="pointer-events-auto absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
          style={{ left: `${left}%`, top: `${top}%` }}
          onMouseMove={(e) => setHover({ code: it.code, name: it.name, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setHover(null)}
        >
          {region === "monde" ? (
            <span className={cn("block size-2.5 rounded-full ring-1 ring-background", it.dotClass)} />
          ) : (
            <span className="flex items-center gap-1 rounded-full border bg-background/90 px-1.5 py-0.5 shadow-sm">
              <span className={cn("size-2 rounded-full", it.dotClass)} />
              <CountryFlag code={it.code} countryName={it.name} size={14} />
              <span className="text-[10px] font-semibold tabular-nums">{it.code}</span>
            </span>
          )}
        </div>
      );
    });

  // Codes pays dans le cadre courant (viewBox CIBLE → liste stable pendant le tween).
  const framedCodes = useMemo(() => {
    const rvb = REGION_VB[region];
    const out: string[] = [];
    for (const { it, c } of placed) {
      const left = ((c.cx - rvb[0]) / rvb[2]) * 100;
      const top = ((c.cy * Y_STRETCH - rvb[1]) / rvb[3]) * 100;
      if (left < -2 || left > 102 || top < -2 || top > 102) continue;
      out.push(it.code);
    }
    return out;
  }, [placed, region]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
        <div className="relative overflow-hidden rounded-lg">
          {worldCountries.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              Chargement de la carte…
            </div>
          )}
          <svg
            viewBox={vb.map((n) => n.toFixed(2)).join(" ")}
            className="h-auto w-full"
            role="img"
            aria-label={title}
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

      {renderBelow?.(framedCodes)}

      {hover && renderTooltip(hover)}
    </div>
  );
}
