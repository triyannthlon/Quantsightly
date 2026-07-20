"use client";

import { useMemo, useState } from "react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { cn } from "@/lib/utils";
import type { BrowneComparisonRow } from "@/lib/coredata/browne-service";
import type { RobustnessBadge } from "@/lib/coredata/browne";
import {
  ROBUSTNESS_HEX,
  REGION_LABEL,
  COUNTRY_REGION,
  type GeoRegion,
  type BrowneDisplayMode,
} from "./helpers";

type XMode = "vol" | "dd";

interface Point {
  iso: string;
  name: string;
  x: number; // abscisse tracée (selon le mode)
  y: number; // ordonnée tracée (selon le mode)
  score: number;
  badge: RobustnessBadge;
  color: string;
  region: GeoRegion;
  // Champs pour l'infobulle (selon le mode).
  ret?: number; // rendement annualisé (nominal/réel)
  vol?: number; // volatilité
  dd?: number; // max drawdown signé
  nominal?: number; // perf nominale annualisée
  inflation?: number; // inflation annualisée
  real?: number | null; // perf réelle annualisée
  ecart?: number; // écart annuel vs inflation (pts)
  multiple?: number | null; // multiple réel
}

const BADGE_ORDER: RobustnessBadge[] = ["Très robuste", "Robuste", "Moyen", "Fragile", "Très fragile"];

// Marges du cadre de tracé (px) : place pour les libellés d'axes + titres.
const PAD = { left: 54, right: 16, top: 12, bottom: 42 };
const HEIGHT = 400;

/** `n` graduations réparties uniformément entre min et max. */
function axisTicks(min: number, max: number, n = 5): number[] {
  if (max <= min) return [min];
  return Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));
}

/** Médiane d'un tableau déjà trié. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Lecture synthétique rendement/risque par rapport aux médianes du groupe. */
function profilePhrase(
  x: number,
  y: number,
  medX: number,
  medY: number,
  bandX: number,
  bandY: number,
): string {
  if (Math.abs(y - medY) <= bandY && Math.abs(x - medX) <= bandX) return "Profil équilibré";
  const ret = y >= medY ? "Rendement élevé" : "Rendement modéré";
  const risk = x >= medX ? "risque élevé" : "risque faible";
  return `${ret}, ${risk}`;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border/50 bg-background/40 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "cursor-pointer rounded px-2.5 py-1 font-medium transition-all",
            value === o.value
              ? "bg-slate-700/70 text-white shadow-sm ring-1 ring-slate-500/50"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TipRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-right whitespace-nowrap text-muted-foreground">{label} :</span>
      <span className="text-right tabular-nums">{value}</span>
    </>
  );
}

export function BrowneScatter({
  rows,
  onPick,
  displayMode,
  height = HEIGHT,
}: {
  rows: BrowneComparisonRow[];
  onPick: (iso: string) => void;
  displayMode: BrowneDisplayMode;
  /** Hauteur du cadre de tracé (px ou CSS) — agrandie dans le dialogue de zoom. */
  height?: number | string;
}) {
  // Drawdown par défaut : plus pédagogique et fidèle à l'objectif du modèle Browne.
  const [xMode, setXMode] = useState<XMode>("dd");
  const [hover, setHover] = useState<{ p: Point; x: number; y: number } | null>(null);

  const isNvi = displayMode === "nominal_vs_inflation";
  const basis: "nominal" | "real" = displayMode === "nominal" ? "nominal" : "real";
  const retWord = basis === "nominal" ? "nominal" : "réel";
  const volWord = basis === "nominal" ? "nominale" : "réelle";

  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    for (const r of rows) {
      if (!r.robustness.available) continue;
      const rob = r.robustness;
      const common = {
        iso: r.countryCode,
        name: r.countryFr ?? r.countryCode,
        score: rob.score,
        badge: rob.badge,
        color: ROBUSTNESS_HEX[rob.badge],
        region: COUNTRY_REGION[r.countryCode] ?? ("amerique" as GeoRegion),
      };
      if (isNvi) {
        const infl = r.inflationAnnualized;
        const nom = r.nominal?.annualized;
        if (infl == null || nom == null) continue;
        out.push({
          ...common,
          x: infl,
          y: nom - infl,
          nominal: nom,
          inflation: infl,
          real: r.real?.annualized ?? null,
          ecart: nom - infl,
          multiple: r.realMultiple,
        });
      } else {
        const m = basis === "nominal" ? r.nominal : r.real;
        if (m?.annualized == null || m?.volatility == null || m?.maxDrawdown == null) continue;
        out.push({
          ...common,
          x: xMode === "vol" ? m.volatility : Math.abs(m.maxDrawdown),
          y: m.annualized,
          ret: m.annualized,
          vol: m.volatility,
          dd: m.maxDrawdown,
        });
      }
    }
    return out;
  }, [rows, isNvi, basis, xMode]);

  const dropped = rows.length - points.length;

  const xLabel = isNvi
    ? "Inflation annualisée →"
    : xMode === "vol"
      ? `Volatilité ${volWord} (risque) →`
      : `Drawdown ${retWord} (ampleur, risque) →`;
  const yLabel = isNvi ? "Écart annuel vs inflation ↑" : `Rendement ${retWord} ↑`;
  const fmtX = (v: number) => (!isNvi && xMode === "dd" ? `−${v.toFixed(0)} %` : `${v.toFixed(0)} %`);
  const fmtY = (v: number) => `${v.toFixed(0)} %`;

  const usedBadges = BADGE_ORDER.filter((b) => points.some((p) => p.badge === b));

  // Domaines (arrondis avec 1 pt de marge).
  const { xMin, xMax, yMin, yMax, xTicks, yTicks, medX, medY } = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xMin = Math.floor(Math.min(...xs) - 1);
    const xMax = Math.ceil(Math.max(...xs) + 1);
    const yMin = Math.floor(Math.min(...ys) - 1);
    const yMax = Math.ceil(Math.max(...ys) + 1);
    return {
      xMin,
      xMax,
      yMin,
      yMax,
      xTicks: axisTicks(xMin, xMax),
      yTicks: axisTicks(yMin, yMax),
      medX: median([...xs].sort((a, b) => a - b)),
      medY: median([...ys].sort((a, b) => a - b)),
    };
  }, [points]);

  if (!points.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Aucun pays à afficher.</div>;
  }

  const px = (v: number) => ((v - xMin) / (xMax - xMin)) * 100; // gauche %
  const py = (v: number) => (1 - (v - yMin) / (yMax - yMin)) * 100; // haut %
  const bandX = (xMax - xMin) * 0.12; // bande centrale « équilibré »
  const bandY = (yMax - yMin) * 0.12;

  return (
    <div>
      {/* Bascule axe X (uniquement pour le graphe risque/rendement) */}
      {!isNvi && (
        <div className="mb-2 flex items-center justify-end gap-1.5 text-xs">
          <span className="text-muted-foreground">Axe X</span>
          <Segmented
            value={xMode}
            onChange={setXMode}
            options={[
              { value: "vol", label: "Volatilité" },
              { value: "dd", label: "Drawdown" },
            ]}
          />
        </div>
      )}

      {/* Cadre de tracé (overlay HTML — mêmes pastilles que la carte des régimes) */}
      <div className="relative w-full" style={{ height }}>
        {/* Titre axe Y (vertical, non miroir via writing-mode) */}
        <div
          className="pointer-events-none absolute flex items-center justify-center text-[11px] text-muted-foreground"
          style={{
            left: 0,
            top: PAD.top,
            bottom: PAD.bottom,
            width: 14,
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
          }}
        >
          {yLabel}
        </div>

        {/* Libellés axe Y */}
        <div className="absolute" style={{ left: 16, width: PAD.left - 20, top: PAD.top, bottom: PAD.bottom }}>
          {yTicks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[11px] whitespace-nowrap tabular-nums text-muted-foreground"
              style={{ top: `${py(t)}%` }}
            >
              {fmtY(t)}
            </span>
          ))}
        </div>

        {/* Zone de données (axes X/Y dessinés = bords bas + gauche) */}
        <div
          className="absolute border-b-[1.5px] border-l-[1.5px] border-foreground/20"
          style={{ left: PAD.left, right: PAD.right, top: PAD.top, bottom: PAD.bottom }}
        >
          {/* Halo de lecture : bande haute en NvI (plus haut = meilleure protection),
              coin haut-gauche en risque/rendement (rendement élevé + faible risque). */}
          {isNvi ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-emerald-500/10 to-transparent" />
          ) : (
            <>
              <div className="pointer-events-none absolute top-0 left-0 h-2/5 w-2/5 bg-gradient-to-br from-emerald-500/12 to-transparent" />
              <span className="pointer-events-none absolute top-1 left-1.5 text-[10px] font-medium tracking-wide text-emerald-500/70">
                Zone optimale
              </span>
            </>
          )}

          {/* Grille */}
          {xTicks.map((t) => (
            <span
              key={`gx${t}`}
              className="absolute top-0 bottom-0 border-l border-border/30"
              style={{ left: `${px(t)}%` }}
            />
          ))}
          {yTicks.map((t) => (
            <span
              key={`gy${t}`}
              className="absolute right-0 left-0 border-t border-border/30"
              style={{ top: `${py(t)}%` }}
            />
          ))}

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
              {fmtX(t)}
            </span>
          ))}
        </div>

        {/* Titre axe X */}
        <div
          className="absolute text-[11px] text-muted-foreground"
          style={{ left: PAD.left, right: PAD.right, bottom: 4, textAlign: "center" }}
        >
          {xLabel}
        </div>
      </div>

      {/* Tooltip flottant — même format que la carte des régimes (colonne « : » alignée) */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 min-w-44 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: hover.p.color }} />
            {hover.p.name}
          </p>
          {!isNvi && (
            <p className="text-[11px] text-muted-foreground">
              {profilePhrase(hover.p.x, hover.p.y, medX, medY, bandX, bandY)}
            </p>
          )}
          <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <TipRow
              label="Robustesse"
              value={
                <>
                  <span className="font-semibold" style={{ color: hover.p.color }}>
                    {hover.p.score}
                  </span>{" "}
                  · {hover.p.badge}
                </>
              }
            />
            {isNvi ? (
              <>
                <TipRow label="Perf. nominale" value={`${hover.p.nominal!.toFixed(1)} %`} />
                <TipRow label="Inflation" value={`${hover.p.inflation!.toFixed(1)} %`} />
                <TipRow
                  label="Perf. réelle"
                  value={hover.p.real != null ? `${hover.p.real.toFixed(1)} %` : "—"}
                />
                <TipRow
                  label="Écart vs inflation"
                  value={`${hover.p.ecart! > 0 ? "+" : ""}${hover.p.ecart!.toFixed(1)} pts`}
                />
                <TipRow
                  label="Multiple réel"
                  value={hover.p.multiple != null ? `${hover.p.multiple.toFixed(1)}×` : "—"}
                />
              </>
            ) : (
              <>
                <TipRow label={`Rendement ${retWord}`} value={`${hover.p.ret!.toFixed(1)} %`} />
                <TipRow label={`Volatilité ${volWord}`} value={`${hover.p.vol!.toFixed(1)} %`} />
                <TipRow label={`Max drawdown ${retWord}`} value={`${hover.p.dd!.toFixed(1)} %`} />
                <TipRow label="Région" value={REGION_LABEL[hover.p.region]} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Légende des paliers + repère */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-[13px] text-muted-foreground">
        {usedBadges.map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: ROBUSTNESS_HEX[b] }} />
            {b}
          </span>
        ))}
        <span className="ml-auto text-xs">
          Bord = robustesse ·{" "}
          {isNvi ? "plus haut = meilleure protection du pouvoir d’achat" : "idéal en haut à gauche"}.
        </span>
      </div>
      {isNvi && (
        <p className="mt-1 px-1 text-[11px] leading-relaxed text-muted-foreground">
          <span className="text-foreground/70">Lecture :</span> haut-gauche = pouvoir d’achat élevé,
          inflation faible · haut-droite = forte résistance à l’inflation · bas-droite = inflation
          élevée, protection insuffisante · bas-gauche = inflation faible, faible surperformance.
        </p>
      )}
      {dropped > 0 && (
        <p className="px-1 text-[11px] text-muted-foreground">
          {dropped} pays non affiché{dropped > 1 ? "s" : ""} (métrique indisponible).
        </p>
      )}
    </div>
  );
}
