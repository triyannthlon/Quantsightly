"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BrowneComparisonRow } from "@/lib/coredata/browne-service";
import { fmtPct, fmtRatio, fmtMonths, ROBUSTNESS_TONE } from "./helpers";

// Colonnes numériques triables. `get` = valeur de tri (null = toujours en bas) ;
// `better` = sens « meilleur d'abord » appliqué au 1ᵉʳ clic sur la colonne.
type ColKey = "score" | "cagr" | "vol" | "mdd" | "uw" | "sharpe";

interface NumCol {
  key: ColKey;
  label: string;
  tip: string;
  get: (r: BrowneComparisonRow) => number | null;
  fmt: (r: BrowneComparisonRow) => string;
  better: "asc" | "desc";
}

const scoreOf = (r: BrowneComparisonRow) => (r.robustness.available ? r.robustness.score : null);

const COLS: NumCol[] = [
  {
    key: "score",
    label: "Robustesse",
    tip: "Score de robustesse Browne (0–100), calculé sur la courbe réelle.",
    get: scoreOf,
    fmt: (r) => (r.robustness.available ? String(r.robustness.score) : "—"),
    better: "desc",
  },
  {
    key: "cagr",
    label: "Rendement réel",
    tip: "Rendement réel annualisé (CAGR corrigé de l’inflation locale).",
    get: (r) => r.real?.annualized ?? null,
    fmt: (r) => fmtPct(r.real?.annualized),
    better: "desc",
  },
  {
    key: "vol",
    label: "Volatilité réelle",
    tip: "Volatilité annualisée de la série réelle.",
    get: (r) => r.real?.volatility ?? null,
    fmt: (r) => fmtPct(r.real?.volatility),
    better: "asc",
  },
  {
    key: "mdd",
    label: "Max drawdown réel",
    tip: "Pire perte réelle entre un sommet et un point bas.",
    get: (r) => r.real?.maxDrawdown ?? null,
    fmt: (r) => fmtPct(r.real?.maxDrawdown),
    better: "desc", // moins négatif = meilleur
  },
  {
    key: "uw",
    label: "Durée sous l’eau",
    tip: "Plus longue durée passée sous le dernier sommet (en mois).",
    get: (r) => r.real?.maxUnderwaterMonths ?? null,
    fmt: (r) => fmtMonths(r.real?.maxUnderwaterMonths),
    better: "asc",
  },
  {
    key: "sharpe",
    label: "Sharpe réel",
    tip: "Rendement réel annualisé rapporté à la volatilité réelle.",
    get: (r) => r.real?.sharpe ?? null,
    fmt: (r) => fmtRatio(r.real?.sharpe),
    better: "desc",
  },
];

function sortRows(rows: BrowneComparisonRow[], key: ColKey, dir: "asc" | "desc"): BrowneComparisonRow[] {
  const col = COLS.find((c) => c.key === key)!;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = col.get(a);
    const vb = col.get(b);
    if (va === null && vb === null) return a.countryFr?.localeCompare(b.countryFr ?? "", "fr") ?? 0;
    if (va === null) return 1; // nulls toujours en bas
    if (vb === null) return -1;
    return (va - vb) * sign;
  });
}

export function BrowneComparisonView({
  rows,
  loading,
  onPick,
}: {
  rows: BrowneComparisonRow[] | null;
  loading: boolean;
  onPick: (iso: string) => void;
}) {
  const [sortKey, setSortKey] = useState<ColKey>("score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => (rows ? sortRows(rows, sortKey, dir) : []), [rows, sortKey, dir]);

  function toggle(key: ColKey) {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir(COLS.find((c) => c.key === key)!.better);
    }
  }

  if (!rows && loading) {
    return (
      <Card className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Calcul de la comparaison…
      </Card>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Aucune donnée de comparaison disponible.
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Card className={cn("gap-0 overflow-hidden p-0", loading && "opacity-60 transition-opacity")}>
        <div className="border-b p-4">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">Comparaison des pays</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="cursor-pointer text-muted-foreground/60 hover:text-foreground">
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-72">
                Tous les pays sous les mêmes paramètres (période et rééquilibrage). Métriques et
                score calculés sur la série réelle. La qualité des données est indiquée séparément.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rows.length} pays · cliquez une colonne pour trier, une ligne pour ouvrir la vue pays.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Pays</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className="ml-auto inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(sortKey === c.key && "text-foreground")}>{c.label}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-56">
                          {c.tip}
                        </TooltipContent>
                      </Tooltip>
                      {sortKey === c.key ? (
                        dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const rob = r.robustness;
                return (
                  <tr
                    key={r.countryCode}
                    onClick={() => onPick(r.countryCode)}
                    className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <CountryFlag
                          code={r.countryCode}
                          countryName={r.countryFr ?? r.countryCode}
                          size={18}
                        />
                        <span className="font-medium">{r.countryFr ?? r.countryCode}</span>
                        {rob.available && rob.shortHistory && (
                          <span className="rounded border border-amber-500/40 px-1 text-[10px] leading-tight text-amber-600 dark:text-amber-400">
                            court
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Robustesse : score + badge coloré */}
                    <td className="px-3 py-2.5 text-right">
                      {rob.available ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="tabular-nums font-semibold">{rob.score}</span>
                          <span
                            className={cn(
                              "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                              ROBUSTNESS_TONE[rob.badge],
                            )}
                          >
                            {rob.badge}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {rob.reason === "missing_cpi" ? "pas de CPI" : "histo. court"}
                        </span>
                      )}
                    </td>

                    {/* Métriques réelles */}
                    {COLS.slice(1).map((c) => (
                      <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">
                        {c.fmt(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </TooltipProvider>
  );
}
