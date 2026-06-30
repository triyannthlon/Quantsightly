"use client";

import { useMemo, useState } from "react";
import { Grid2x2, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuadrantMap, cellOf, type QuadrantPoint } from "./quadrant-map";
import { WorldMap } from "./world-map";

type View = "map" | "quadrants";

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
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

const COUNTERS: { key: "TR" | "BR" | "TL" | "BL" | "transition"; dot: string; label: string }[] = [
  { key: "TR", dot: "bg-amber-500", label: "Boom inflationniste" },
  { key: "BR", dot: "bg-emerald-500", label: "Boom déflationniste" },
  { key: "TL", dot: "bg-rose-500", label: "Contraction inflationniste" },
  { key: "BL", dot: "bg-blue-500", label: "Contraction déflationniste" },
  { key: "transition", dot: "bg-muted-foreground", label: "Transition" },
];

export function QuadrantsView({
  points,
  asOfLabel,
}: {
  points: QuadrantPoint[];
  asOfLabel: string | null;
}) {
  const [view, setView] = useState<View>("quadrants");

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          <Tab
            active={view === "quadrants"}
            icon={Grid2x2}
            label="Vue Quadrant"
            onClick={() => setView("quadrants")}
          />
          <Tab active={view === "map"} icon={Map} label="Vue carte" onClick={() => setView("map")} />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {COUNTERS.map((r) => (
            <span key={r.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className={cn("size-2.5 rounded-full", r.dot)} />
              {r.label}
              <span className="font-semibold tabular-nums text-foreground">{counts[r.key]}</span>
            </span>
          ))}
        </div>
      </div>

      {view === "map" ? (
        <WorldMap points={points} asOfLabel={asOfLabel} />
      ) : (
        <QuadrantMap points={points} asOfLabel={asOfLabel} />
      )}
    </div>
  );
}
