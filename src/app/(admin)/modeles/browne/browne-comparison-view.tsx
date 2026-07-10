"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BrowneComparisonRow } from "@/lib/coredata/browne-service";
import {
  fmtPct,
  fmtRatio,
  fmtPts,
  fmtMultiple,
  ROBUSTNESS_TONE,
  COUNTRY_REGION,
  type BrowneDisplayMode,
  type BrowneRegion,
} from "./helpers";
import { BrowneScatter } from "./browne-scatter";

// Colonne numérique triable. `get` = valeur de tri (null = toujours en bas) ;
// `better` = sens « meilleur d'abord » appliqué au 1ᵉʳ clic sur la colonne.
interface NumCol {
  key: string;
  label: string;
  tip: string;
  get: (r: BrowneComparisonRow) => number | null;
  fmt: (r: BrowneComparisonRow) => string;
  better: "asc" | "desc";
}

// Colonne robustesse : toujours présente (rendu spécial score + badge).
const SCORE_COL: NumCol = {
  key: "score",
  label: "Robustesse",
  tip: "Score de robustesse Browne (0–100), calculé sur la courbe réelle.",
  get: (r) => (r.robustness.available ? r.robustness.score : null),
  fmt: (r) => (r.robustness.available ? String(r.robustness.score) : "—"),
  better: "desc",
};

const ecartInflation = (r: BrowneComparisonRow): number | null =>
  r.nominal?.annualized != null && r.inflationAnnualized != null
    ? r.nominal.annualized - r.inflationAnnualized
    : null;

/** Colonnes métriques selon le mode d'analyse. */
function columnsFor(mode: BrowneDisplayMode): NumCol[] {
  if (mode === "nominal") {
    return [
      { key: "n-cagr", label: "Rendement nominal", tip: "Rendement nominal annualisé (CAGR, sans correction d’inflation).", get: (r) => r.nominal?.annualized ?? null, fmt: (r) => fmtPct(r.nominal?.annualized), better: "desc" },
      { key: "n-vol", label: "Volatilité nominale", tip: "Volatilité annualisée nominale.", get: (r) => r.nominal?.volatility ?? null, fmt: (r) => fmtPct(r.nominal?.volatility), better: "asc" },
      { key: "n-mdd", label: "Max drawdown nominal", tip: "Pire perte nominale entre un sommet et un point bas.", get: (r) => r.nominal?.maxDrawdown ?? null, fmt: (r) => fmtPct(r.nominal?.maxDrawdown), better: "desc" },
      { key: "n-sharpe", label: "Sharpe nominal", tip: "Excédent du rendement nominal sur le cash, rapporté à la volatilité nominale.", get: (r) => r.nominal?.sharpe ?? null, fmt: (r) => fmtRatio(r.nominal?.sharpe), better: "desc" },
    ];
  }
  if (mode === "nominal_vs_inflation") {
    return [
      { key: "nvi-nom", label: "Perf. nominale", tip: "Performance nominale annualisée.", get: (r) => r.nominal?.annualized ?? null, fmt: (r) => fmtPct(r.nominal?.annualized), better: "desc" },
      { key: "nvi-infl", label: "Inflation", tip: "Inflation locale annualisée sur la période.", get: (r) => r.inflationAnnualized, fmt: (r) => fmtPct(r.inflationAnnualized), better: "asc" },
      { key: "nvi-real", label: "Perf. réelle", tip: "Performance réelle annualisée (corrigée de l’inflation).", get: (r) => r.real?.annualized ?? null, fmt: (r) => fmtPct(r.real?.annualized), better: "desc" },
      { key: "nvi-ecart", label: "Écart vs inflation", tip: "Écart annualisé, en points, entre performance nominale et inflation.", get: ecartInflation, fmt: (r) => fmtPts(ecartInflation(r)), better: "desc" },
      { key: "nvi-mult", label: "Multiple réel", tip: "Gain de pouvoir d’achat cumulé (multiple réel).", get: (r) => r.realMultiple, fmt: (r) => fmtMultiple(r.realMultiple), better: "desc" },
    ];
  }
  // Réel (défaut)
  return [
    { key: "r-cagr", label: "Rendement réel", tip: "Rendement réel annualisé (corrigé de l’inflation locale).", get: (r) => r.real?.annualized ?? null, fmt: (r) => fmtPct(r.real?.annualized), better: "desc" },
    { key: "r-vol", label: "Volatilité réelle", tip: "Volatilité annualisée de la série réelle.", get: (r) => r.real?.volatility ?? null, fmt: (r) => fmtPct(r.real?.volatility), better: "asc" },
    { key: "r-mdd", label: "Max drawdown réel", tip: "Pire perte réelle entre un sommet et un point bas.", get: (r) => r.real?.maxDrawdown ?? null, fmt: (r) => fmtPct(r.real?.maxDrawdown), better: "desc" },
    { key: "r-sharpe", label: "Sharpe réel", tip: "Excédent du rendement réel sur le cash réel, rapporté à la volatilité réelle.", get: (r) => r.real?.sharpe ?? null, fmt: (r) => fmtRatio(r.real?.sharpe), better: "desc" },
  ];
}

export function BrowneComparisonView({
  rows,
  loading,
  onPick,
  displayMode,
  region,
}: {
  rows: BrowneComparisonRow[] | null;
  loading: boolean;
  onPick: (iso: string) => void;
  displayMode: BrowneDisplayMode;
  region: BrowneRegion;
}) {
  const numCols = useMemo(() => columnsFor(displayMode), [displayMode]);
  const allCols = useMemo(() => [SCORE_COL, ...numCols], [numCols]);
  const [sortKey, setSortKey] = useState("score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  // Le mode a changé et la colonne triée n'existe plus → retour au score.
  useEffect(() => {
    if (!allCols.some((c) => c.key === sortKey)) {
      setSortKey("score");
      setDir("desc");
    }
  }, [allCols, sortKey]);

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => region === "monde" || COUNTRY_REGION[r.countryCode] === region),
    [rows, region],
  );

  const sorted = useMemo(() => {
    const col = allCols.find((c) => c.key === sortKey) ?? SCORE_COL;
    const sign = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (va === null && vb === null) return (a.countryFr ?? "").localeCompare(b.countryFr ?? "", "fr");
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va - vb) * sign;
    });
  }, [filtered, allCols, sortKey, dir]);

  function toggle(key: string) {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir(allCols.find((c) => c.key === key)!.better);
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
      <div className={cn("space-y-4", loading && "opacity-60 transition-opacity")}>
        {/* Nuage risque-rendement */}
        <Card className="gap-0 p-4">
          <div className="mb-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold">
                {displayMode === "nominal_vs_inflation"
                  ? "Pouvoir d’achat vs inflation"
                  : `Risque / rendement ${displayMode === "nominal" ? "nominal" : "réel"}`}
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="cursor-pointer text-muted-foreground/60 hover:text-foreground">
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-72">
                  {displayMode === "nominal_vs_inflation"
                    ? "Ce graphique montre quels portefeuilles Browne ont le mieux battu l’inflation locale sur la période."
                    : "Chaque pays positionné par son risque (horizontal) et son rendement annualisé (vertical), selon le mode d’analyse. Couleur = score de robustesse. Cliquez un point pour ouvrir sa vue pays."}
                </TooltipContent>
              </Tooltip>
            </div>
            {displayMode === "nominal_vs_inflation" && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ce graphique montre quels portefeuilles Browne ont le mieux battu l’inflation locale
                sur la période.
              </p>
            )}
          </div>
          <BrowneScatter rows={filtered} onPick={onPick} displayMode={displayMode} />
        </Card>

        {/* Tableau */}
        <Card className="gap-0 overflow-hidden p-0">
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
                  Tous les pays sous les mêmes paramètres (période et rééquilibrage). Les colonnes
                  suivent le mode d’analyse. La qualité des données est indiquée séparément.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sorted.length} pays · triez les colonnes ou cliquez sur un pays pour ouvrir sa vue détaillée.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Pays</th>
                  {allCols.map((c) => (
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
                          <CountryFlag code={r.countryCode} countryName={r.countryFr ?? r.countryCode} size={18} />
                          <span className="font-medium">{r.countryFr ?? r.countryCode}</span>
                          {rob.available && rob.shortHistory && (
                            <span className="rounded border border-amber-500/40 px-1 text-[10px] leading-tight text-amber-600 dark:text-amber-400">
                              court
                            </span>
                          )}
                        </div>
                      </td>

                      {allCols.map((c) =>
                        c.key === "score" ? (
                          <td key={c.key} className="px-3 py-2.5 text-right">
                            {rob.available ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="tabular-nums font-semibold">{rob.score}</span>
                                <span
                                  className={cn(
                                    "inline-block w-24 shrink-0 rounded-md border px-1.5 py-0.5 text-center text-[11px] font-medium",
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
                        ) : (
                          <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">
                            {c.fmt(r)}
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}
