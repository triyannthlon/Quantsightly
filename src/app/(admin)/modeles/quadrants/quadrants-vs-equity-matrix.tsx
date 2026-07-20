"use client";

import { useMemo, useState } from "react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import type { QuadrantModelRow } from "@/lib/coredata/four-quadrants-service";
import { quadrantsVsEquity, VERDICT_HEX, VERDICT_ORDER, type QuadrantsVerdict } from "./helpers";

interface Point {
  iso: string;
  name: string;
  x: number; // réduction drawdown (pts) — droite = meilleure protection
  y: number; // écart de rendement (pts) — haut = 4Q fait mieux
  verdict: QuadrantsVerdict;
  color: string;
  qReal: number | null;
  actReal: number | null;
  ecartVol: number | null;
  volQ: number | null;
  volActions: number | null;
  ddQ: number | null;
  ddActions: number | null;
  sharpeQ: number | null;
  sharpeActions: number | null;
}

const PAD = { left: 54, right: 16, top: 12, bottom: 42 };
const HEIGHT = 420;

function axisTicks(min: number, max: number, n = 5): number[] {
  if (max <= min) return [min];
  return Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));
}

const fmtSigned = (v: number, unit = "") => `${v > 0 ? "+" : ""}${v.toFixed(0)}${unit}`;
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} %`);
const pts = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)} pts`);
const ratio = (v: number | null) => (v == null ? "—" : v.toFixed(2));

function TipRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-right whitespace-nowrap text-muted-foreground">{label} :</span>
      <span className="text-right tabular-nums">{value}</span>
    </>
  );
}

export function QuadrantsVsEquityMatrix({
  rows,
  onPick,
}: {
  rows: QuadrantModelRow[];
  onPick: (iso: string) => void;
}) {
  const [hover, setHover] = useState<{ p: Point; x: number; y: number } | null>(null);

  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    for (const r of rows) {
      const v = quadrantsVsEquity(r);
      if (v.verdict == null || v.drawdownReduction == null || v.ecartReturn == null) continue;
      out.push({
        iso: r.countryCode,
        name: r.countryFr ?? r.countryCode,
        x: v.drawdownReduction,
        y: v.ecartReturn,
        verdict: v.verdict,
        color: VERDICT_HEX[v.verdict],
        qReal: r.metrics?.real?.annualized ?? null,
        actReal: r.equityReal?.annualized ?? null,
        ecartVol: v.ecartVol,
        volQ: r.metrics?.real?.volatility ?? null,
        volActions: r.equityReal?.volatility ?? null,
        ddQ: r.metrics?.real?.maxDrawdown ?? null,
        ddActions: r.equityReal?.maxDrawdown ?? null,
        sharpeQ: r.metrics?.real?.sharpe ?? null,
        sharpeActions: r.equityReal?.sharpe ?? null,
      });
    }
    return out;
  }, [rows]);

  const usedVerdicts = VERDICT_ORDER.filter((vd) => points.some((p) => p.verdict === vd));

  // Domaines : on inclut toujours 0 sur les deux axes → lignes de référence visibles.
  const { xMin, xMax, yMin, yMax, xTicks, yTicks } = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xMin = Math.min(0, Math.floor(Math.min(...xs) - 2));
    const xMax = Math.ceil(Math.max(...xs) + 2);
    const yMin = Math.floor(Math.min(0, Math.min(...ys)) - 1);
    const yMax = Math.ceil(Math.max(0, Math.max(...ys)) + 1);
    return { xMin, xMax, yMin, yMax, xTicks: axisTicks(xMin, xMax), yTicks: axisTicks(yMin, yMax) };
  }, [points]);

  if (!points.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Aucun pays à afficher.</div>;
  }

  const px = (v: number) => ((v - xMin) / (xMax - xMin)) * 100;
  const py = (v: number) => (1 - (v - yMin) / (yMax - yMin)) * 100;

  return (
    <div>
      <div className="relative w-full" style={{ height: HEIGHT }}>
        {/* Titre axe Y */}
        <div
          className="pointer-events-none absolute flex items-center justify-center text-[11px] text-muted-foreground"
          style={{ left: 0, top: PAD.top, bottom: PAD.bottom, width: 14, writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Écart de rendement ↑
        </div>

        {/* Libellés axe Y */}
        <div className="absolute" style={{ left: 16, width: PAD.left - 20, top: PAD.top, bottom: PAD.bottom }}>
          {yTicks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[11px] whitespace-nowrap tabular-nums text-muted-foreground"
              style={{ top: `${py(t)}%` }}
            >
              {fmtSigned(t)}
            </span>
          ))}
        </div>

        {/* Zone de données */}
        <div className="absolute border-b-[1.5px] border-l-[1.5px] border-foreground/20" style={{ left: PAD.left, right: PAD.right, top: PAD.top, bottom: PAD.bottom }}>
          {/* Halo « meilleur » : haut-droite (4Q fait mieux + protège mieux) */}
          <div className="pointer-events-none absolute top-0 right-0 h-2/5 w-2/5 bg-gradient-to-bl from-emerald-500/10 to-transparent" />

          {/* Grille */}
          {xTicks.map((t) => (
            <span key={`gx${t}`} className="absolute top-0 bottom-0 border-l border-border/30" style={{ left: `${px(t)}%` }} />
          ))}
          {yTicks.map((t) => (
            <span key={`gy${t}`} className="absolute right-0 left-0 border-t border-border/30" style={{ top: `${py(t)}%` }} />
          ))}

          {/* Lignes de référence à 0 (rendement égal / protection nulle) */}
          {yMin < 0 && yMax > 0 && (
            <span className="absolute right-0 left-0 border-t border-dashed border-foreground/25" style={{ top: `${py(0)}%` }} />
          )}
          {xMin < 0 && xMax > 0 && (
            <span className="absolute top-0 bottom-0 border-l border-dashed border-foreground/25" style={{ left: `${px(0)}%` }} />
          )}

          {/* Pastilles pays */}
          {points.map((p) => (
            <button
              key={p.iso}
              type="button"
              onClick={() => onPick(p.iso)}
              onMouseMove={(e) => setHover({ p, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-1 rounded-full bg-background/90 px-1.5 py-0.5 shadow-sm transition-transform hover:z-20 hover:scale-110"
              style={{ left: `${px(p.x)}%`, top: `${py(p.y)}%`, border: `1.5px solid ${p.color}` }}
            >
              <CountryFlag code={p.iso} countryName={p.name} size={14} />
              <span className="text-[10px] font-semibold tabular-nums">{p.iso}</span>
            </button>
          ))}
        </div>

        {/* Libellés axe X */}
        <div className="absolute" style={{ left: PAD.left, right: PAD.right, bottom: PAD.bottom - 18, height: 14 }}>
          {xTicks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 text-[11px] whitespace-nowrap tabular-nums text-muted-foreground"
              style={{ left: `${px(t)}%` }}
            >
              {fmtSigned(t)}
            </span>
          ))}
        </div>

        {/* Titre axe X */}
        <div className="absolute text-[11px] text-muted-foreground" style={{ left: PAD.left, right: PAD.right, bottom: 4, textAlign: "center" }}>
          Réduction du drawdown (protection) → (pts)
        </div>
      </div>

      {/* Tooltip */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 min-w-52 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: hover.p.color }} />
            {hover.p.name}
          </p>
          <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <TipRow label="4 Quadrants réel" value={pct(hover.p.qReal)} />
            <TipRow label="Actions réelles" value={pct(hover.p.actReal)} />
            <TipRow label="Écart rendement" value={pts(hover.p.y)} />
            <TipRow label="Vol 4Q" value={pct(hover.p.volQ)} />
            <TipRow label="Vol Actions" value={pct(hover.p.volActions)} />
            <TipRow label="Écart volatilité" value={pts(hover.p.ecartVol)} />
            <TipRow label="Max DD 4Q" value={pct(hover.p.ddQ)} />
            <TipRow label="Max DD Actions" value={pct(hover.p.ddActions)} />
            <TipRow label="Réduction drawdown" value={pts(hover.p.x)} />
            <TipRow label="Sharpe 4Q" value={ratio(hover.p.sharpeQ)} />
            <TipRow label="Sharpe Actions" value={ratio(hover.p.sharpeActions)} />
            <span className="text-right whitespace-nowrap text-muted-foreground">Profil :</span>
            <span className="text-right font-semibold" style={{ color: hover.p.color }}>
              {hover.p.verdict}
            </span>
          </div>
        </div>
      )}

      {/* Légende des profils + repère */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-[13px] text-muted-foreground">
        {usedVerdicts.map((vd) => (
          <span key={vd} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: VERDICT_HEX[vd] }} />
            {vd}
          </span>
        ))}
        <span className="ml-auto text-xs">Meilleur = haut-droite (mieux ET protège plus).</span>
      </div>
    </div>
  );
}
