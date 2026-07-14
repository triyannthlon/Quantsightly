"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { REGIME, type RegimeKey } from "./regime-palette";
import type { Region } from "./world-map";
import type { HistoryMatrixData } from "./history";

// Décodage des 2 chars/mois (voir history.ts) : croissance + inflation → régime.
function regimeKey(growth: string, inflation: string): RegimeKey | null {
  if (growth === "." || inflation === ".") return null;
  if (growth === "A" && inflation === "A") return "TR"; // Boom inflationniste
  if (growth === "A" && inflation === "D") return "BR"; // Boom déflationniste
  if (growth === "D" && inflation === "A") return "TL"; // Contraction inflationniste
  if (growth === "D" && inflation === "D") return "BL"; // Contraction déflationniste
  return "transition";
}
const SIG_LABEL: Record<string, string> = {
  A: "en accélération",
  D: "en décélération",
  N: "neutre",
};

// Filtre région (mêmes clés que la Carte) → nom du groupe de la matrice.
const REGION_GROUP: Record<Region, string> = {
  monde: "",
  amerique: "Amérique",
  europe: "Europe",
  asie: "Asie-Pacifique",
};

// Géométrie (px).
const CELL = 20; // pas d'une colonne (mois)
const DOT = 16; // diamètre pastille
const ROW_H = 26; // hauteur d'une ligne pays
const LABEL_W = 58; // largeur colonne de gauche (drapeau + ISO), collante
const GUTTER = 10; // marge gauche/droite pour ne pas couper les pastilles aux bords

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(iso));

export function HistoryMatrix({ data, region }: { data: HistoryMatrixData; region: Region }) {
  const { months } = data;
  const groups =
    region === "monde" ? data.groups : data.groups.filter((g) => g.region === REGION_GROUP[region]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0 });
  const [tip, setTip] = useState<{
    name: string;
    month: string;
    key: RegimeKey;
    growth: string;
    inflation: string;
    signal: string;
    colX: number;
    x: number;
    y: number;
  } | null>(null);
  const [viewW, setViewW] = useState(0);

  // Au montage : cadrer sur le présent (extrême droite).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // Largeur visible (pour centrer les séparateurs de région dans le cadre).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    if (e.key === "ArrowLeft") {
      el.scrollLeft -= CELL * 6;
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      el.scrollLeft += CELL * 6;
      e.preventDefault();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft };
    setTip(null);
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = scrollRef.current;
    if (el) el.scrollLeft = drag.current.startLeft - (e.clientX - drag.current.startX);
  };
  // Aligne le bord gauche du cadre sur un début de colonne (mois) : après un
  // glissement libre, la matrice « clique » proprement sur la grille mensuelle.
  const snapToColumn = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const aligned = GUTTER + Math.round((el.scrollLeft - GUTTER) / CELL) * CELL;
    el.scrollTo({ left: Math.max(0, Math.min(aligned, max)), behavior: "smooth" });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasDragging = drag.current.active;
    drag.current.active = false;
    scrollRef.current?.releasePointerCapture?.(e.pointerId);
    if (wasDragging) snapToColumn();
  };

  const januaries = months
    .map((m, i) => ({ i, m }))
    .filter(({ m }) => m.slice(5, 7) === "01");

  const totalW = LABEL_W + GUTTER * 2 + months.length * CELL;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Historique mensuel des régimes — {monthLabel(months[0])} →{" "}
          {monthLabel(months[months.length - 1])}
        </span>
        <span className="text-[11px] text-muted-foreground/70">
          Glisser ou ←/→ pour parcourir
        </span>
      </div>

      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="cursor-grab select-none overflow-x-auto overscroll-x-contain pb-2 outline-none active:cursor-grabbing [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-2"
      >
        <div className="relative" style={{ width: totalW }}>
          {tip && (
            <div
              className="pointer-events-none absolute inset-y-0 z-[5] w-0.5 -translate-x-1/2 bg-foreground/50"
              style={{ left: tip.colX }}
            />
          )}
          {/* En-tête : repères d'années (labels pays collants à DROITE) */}
          <div className="mb-1 flex" style={{ height: 14 }}>
            <div
              className="relative"
              style={{ width: months.length * CELL + GUTTER * 2, height: 14 }}
            >
              {januaries.map(({ i, m }) => (
                <span
                  key={i}
                  className="absolute top-0 -translate-x-1/2 text-[11px] font-bold tabular-nums text-muted-foreground"
                  style={{ left: GUTTER + i * CELL + CELL / 2 }}
                >
                  {m.slice(0, 4)}
                </span>
              ))}
            </div>
            <div className="sticky right-0 z-30 bg-card" style={{ width: LABEL_W, height: 14 }} />
          </div>

          {/* Groupes de régions */}
          {groups.map((g) => (
            <div key={g.region} className="mb-1.5">
              <div
                className="sticky left-0 z-20 mb-1 mt-2 flex items-center gap-2"
                style={{ width: viewW }}
              >
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  {g.region}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              {g.rows.map((row) => (
                <div key={row.code} className="flex items-center" style={{ height: ROW_H }}>
                  <div
                    className="relative"
                    style={{ width: months.length * CELL + GUTTER * 2, height: ROW_H }}
                    onMouseMove={(e) => {
                      if (drag.current.active) return;
                      const x = e.clientX - e.currentTarget.getBoundingClientRect().left - GUTTER;
                      const i = Math.floor(x / CELL);
                      if (i < 0 || i >= months.length) {
                        setTip(null);
                        return;
                      }
                      const g = row.cells[2 * i];
                      const inf = row.cells[2 * i + 1];
                      const key = regimeKey(g, inf);
                      if (!key) {
                        setTip(null);
                        return;
                      }
                      setTip({
                        name: row.name,
                        month: monthLabel(months[i]),
                        key,
                        growth: SIG_LABEL[g],
                        inflation: SIG_LABEL[inf],
                        signal: g !== "N" && inf !== "N" ? "confirmé" : "en zone neutre",
                        colX: GUTTER + i * CELL + CELL / 2,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseLeave={() => setTip(null)}
                  >
                    {months.map((_, i) => {
                      const key = regimeKey(row.cells[2 * i], row.cells[2 * i + 1]);
                      if (!key) return null;
                      return (
                        <span
                          key={i}
                          className={cn("absolute rounded-full", REGIME[key].dot)}
                          style={{
                            left: GUTTER + i * CELL + (CELL - DOT) / 2,
                            top: (ROW_H - DOT) / 2,
                            width: DOT,
                            height: DOT,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div
                    className="sticky right-0 z-10 flex h-full items-center gap-1 bg-card pl-3"
                    style={{ width: LABEL_W }}
                    title={row.name}
                  >
                    <span className="pointer-events-none absolute right-full top-0 h-full w-6 bg-gradient-to-l from-card to-transparent" />
                    <CountryFlag code={row.code} countryName={row.name} size={14} />
                    <span className="text-[10px] font-medium tabular-nums">{row.code}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 min-w-40 rounded-lg border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md"
          style={{ left: tip.x + 14, top: tip.y + 14 }}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={cn("size-2.5 rounded-full", REGIME[tip.key].dot)} />
            {tip.name}
          </p>
          <div className="mt-1 text-[11px]">
            <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5">
              <span className="whitespace-nowrap text-right text-muted-foreground">Régime :</span>
              <span>{REGIME[tip.key].label}</span>
              <span className="whitespace-nowrap text-right text-muted-foreground">Croissance :</span>
              <span>{tip.growth}</span>
              <span className="whitespace-nowrap text-right text-muted-foreground">Inflation :</span>
              <span>{tip.inflation}</span>
              <span className="whitespace-nowrap text-right text-muted-foreground">Signal :</span>
              <span>{tip.signal}</span>
            </div>
            <p className="mt-1 border-t pt-1 text-muted-foreground">{tip.month}</p>
          </div>
        </div>
      )}
    </div>
  );
}
