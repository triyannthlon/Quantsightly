"use client";

import { useMemo, useState } from "react";
import { Grid2x2, Map, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuadrantMap, cellOf, type QuadrantPoint } from "./quadrant-map";
import { WorldMap, REGION_LABELS, type Region } from "./world-map";
import { HistoryMatrix } from "./history-matrix";
import { REGIME, REGIME_ORDER } from "./regime-palette";
import type { HistoryMatrixData } from "./history";

type View = "map" | "quadrants" | "history";

function Tab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Grid2x2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative -mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4", active ? "text-primary" : "opacity-70")} />
      {label}
    </button>
  );
}

const COUNTERS = REGIME_ORDER.map((key) => ({
  key,
  dot: REGIME[key].dot,
  label: REGIME[key].label,
}));

export function QuadrantsView({
  points,
  asOfLabel,
  history,
}: {
  points: QuadrantPoint[];
  asOfLabel: string | null;
  history: HistoryMatrixData;
}) {
  const [view, setView] = useState<View>("quadrants");
  const [region, setRegion] = useState<Region>("monde");

  const counts = useMemo(() => {
    const c: Record<string, number> = { TR: 0, BR: 0, TL: 0, BL: 0, transition: 0 };
    for (const p of points) {
      const cell = cellOf(p);
      c[cell === "TR" || cell === "BR" || cell === "TL" || cell === "BL" ? cell : "transition"]++;
    }
    return c;
  }, [points]);

  return (
    <div className="space-y-4">
      {/* Onglets — navigation principale de la page (sticky au scroll) */}
      <div className="sticky top-0 z-20 -mx-6 bg-background/85 px-6 backdrop-blur-sm">
        <nav className="flex flex-wrap gap-1 border-b border-border/60">
          <Tab
            active={view === "quadrants"}
            icon={Grid2x2}
            label="Quadrant"
            onClick={() => setView("quadrants")}
          />
          <Tab active={view === "map"} icon={Map} label="Carte" onClick={() => setView("map")} />
          <Tab
            active={view === "history"}
            icon={History}
            label="Historique"
            onClick={() => setView("history")}
          />
        </nav>
      </div>

      {/* Compteurs de régimes (légende globale) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {COUNTERS.map((r) => (
          <span key={r.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("size-2.5 rounded-full", r.dot)} />
            {r.label}
            <span className="font-semibold tabular-nums text-foreground">{counts[r.key]}</span>
          </span>
        ))}
      </div>

      {(view === "map" || view === "history") && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Région :</span>
          {REGION_LABELS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRegion(r.key)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                region === r.key
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {view === "map" ? (
        <WorldMap points={points} asOfLabel={asOfLabel} region={region} />
      ) : view === "history" ? (
        <HistoryMatrix data={history} region={region} />
      ) : (
        <QuadrantMap points={points} asOfLabel={asOfLabel} />
      )}

      {/* Barre de répartition globale (proportion de chaque régime, tous pays). */}
      {view === "map" && points.length > 0 && (
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Répartition des régimes · {points.length} pays couverts
          </div>
          <div className="flex h-7 w-full overflow-hidden rounded-lg border">
            {REGIME_ORDER.filter((k) => counts[k] > 0).map((k) => {
              const pct = (counts[k] / points.length) * 100;
              return (
                <div
                  key={k}
                  className={cn("flex items-center justify-center", REGIME[k].dot)}
                  style={{ width: `${pct}%` }}
                  title={`${REGIME[k].label} · ${counts[k]} (${Math.round(pct)} %)`}
                >
                  {pct >= 8 && (
                    <span className="text-[11px] font-bold tabular-nums text-black/65">
                      {Math.round(pct)} %
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
