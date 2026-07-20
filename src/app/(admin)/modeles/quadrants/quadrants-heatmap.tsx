"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { QuadrantModelRow } from "@/lib/coredata/four-quadrants-service";

type Mode = "inflation" | "equity";

const SUBTEXT: Record<Mode, string> = {
  inflation: "Pourcentage de périodes où le 4 Quadrants a gagné du pouvoir d’achat.",
  equity: "Pourcentage de périodes où le 4 Quadrants a fait mieux que les actions locales.",
};
const DETAIL: Record<Mode, string> = {
  inflation:
    "Une période correspond à un horizon glissant de 1 an, 3 ans, 5 ans, 10 ans ou 20 ans. Par exemple, 100 % sur 5 ans signifie que le 4 Quadrants a été positif en réel sur toutes les périodes de 5 ans observées.",
  equity:
    "Une période correspond à un horizon glissant. Par exemple, 67 % sur 5 ans signifie que le 4 Quadrants a surperformé les actions locales dans 67 % des périodes de 5 ans observées.",
};

const HORIZON_LABELS = ["1 an", "3 ans", "5 ans", "10 ans", "20 ans"];
const SORT_COL = 2; // tri par la colonne 5 ans

/** Classe de cellule selon la valeur (0–100). */
function cellClass(v: number | null): string {
  if (v == null) return "text-muted-foreground/40";
  if (v >= 80) return "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300";
  if (v >= 60) return "bg-cyan-500/25 text-cyan-700 dark:text-cyan-300";
  if (v >= 40) return "bg-amber-500/25 text-amber-700 dark:text-amber-300";
  if (v >= 20) return "bg-orange-500/25 text-orange-700 dark:text-orange-300";
  return "bg-red-500/25 text-red-700 dark:text-red-300";
}

const LEGEND = [
  { label: "80–100 %", cls: "bg-emerald-500/25" },
  { label: "60–79 %", cls: "bg-cyan-500/25" },
  { label: "40–59 %", cls: "bg-amber-500/25" },
  { label: "20–39 %", cls: "bg-orange-500/25" },
  { label: "0–19 %", cls: "bg-red-500/25" },
];

interface Row {
  iso: string;
  name: string;
  values: (number | null)[]; // % par horizon (0–100)
}

export function QuadrantsHeatmap({
  rows,
  onPick,
}: {
  rows: QuadrantModelRow[];
  onPick: (iso: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("inflation");

  const data = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const r of rows) {
      if (!r.heatmap) continue;
      const src = mode === "inflation" ? r.heatmap.beatsInflation : r.heatmap.beatsEquity;
      out.push({
        iso: r.countryCode,
        name: r.countryFr ?? r.countryCode,
        values: src.map((v) => (v == null ? null : v * 100)),
      });
    }
    out.sort((a, b) => (b.values[SORT_COL] ?? -1) - (a.values[SORT_COL] ?? -1));
    return out;
  }, [rows, mode]);

  if (!data.length) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Aucune donnée de régularité.</div>;
  }

  return (
    <div>
      {/* Mesure + explication pédagogique */}
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Mesure</span>
        <div className="inline-flex items-center rounded-md border border-border/50 bg-background/40 p-0.5">
          {(["inflation", "equity"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "cursor-pointer rounded px-2.5 py-1 font-medium transition-all",
                mode === m
                  ? "bg-slate-700/70 text-white shadow-sm ring-1 ring-slate-500/50"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {m === "inflation" ? "Bat l’inflation" : "Bat les actions"}
            </button>
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help text-muted-foreground/60 hover:text-foreground">
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-72">
            {DETAIL[mode]}
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Taux de réussite</span> — {SUBTEXT[mode]}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Pays</th>
              {HORIZON_LABELS.map((h) => (
                <th key={h} className="px-3 py-2 text-center font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr
                key={r.iso}
                onClick={() => onPick(r.iso)}
                className="cursor-pointer transition-colors hover:bg-muted/30"
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <CountryFlag code={r.iso} countryName={r.name} size={16} />
                    <span className="font-medium">{r.name}</span>
                  </div>
                </td>
                {r.values.map((v, i) => (
                  <td key={i} className="px-1 py-1">
                    <div
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                        cellClass(v),
                      )}
                    >
                      {v == null ? "—" : `${Math.round(v)} %`}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Légende des couleurs */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-3 rounded", l.cls)} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
