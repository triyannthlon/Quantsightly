"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { QuadrantModelRow } from "@/lib/coredata/four-quadrants-service";
import { QuadrantsScatter } from "./quadrants-scatter";
import { ZoomableSection } from "@/components/custom/model-shell/zoomable-section";
import {
  regimeFromLatest,
  fmtPctN,
  fmtRatio,
  fmtMultiple,
  COUNTRY_REGION,
  type PerfMode,
  type QuadrantRegion,
} from "./helpers";
import { availabilityMessage, availabilityLabel, type AvailabilityReason } from "./availability-message";

const fmtTurnover = (v: number | null): string => (v === null ? "—" : `${Math.round(v * 100)} %/an`);
const fmtMonth = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(iso));

// Colonne numérique triable. `get` = valeur de tri (null → toujours en bas) ;
// `better` = sens « meilleur d'abord » appliqué au 1ᵉʳ clic.
interface NumCol {
  key: string;
  label: string;
  tip: string;
  get: (r: QuadrantModelRow) => number | null;
  fmt: (r: QuadrantModelRow) => string;
  better: "asc" | "desc";
}

const ecartInflation = (r: QuadrantModelRow): number | null =>
  r.metrics?.nominal.annualized != null && r.inflationAnnualized != null
    ? r.metrics.nominal.annualized - r.inflationAnnualized
    : null;

const TURNOVER_COL: NumCol = {
  key: "turnover",
  label: "Rotation",
  tip: "Rotation annualisée du portefeuille (turnover unidirectionnel : ½·Σ|écart de poids|, hors constitution initiale).",
  get: (r) => r.turnover,
  fmt: (r) => fmtTurnover(r.turnover),
  better: "asc",
};

/** Colonnes métriques selon le mode d'analyse (mêmes conventions que Browne). */
function columnsFor(mode: PerfMode): NumCol[] {
  if (mode === "nominal") {
    return [
      { key: "n-cagr", label: "Rendement nominal", tip: "Rendement nominal annualisé (CAGR).", get: (r) => r.metrics?.nominal.annualized ?? null, fmt: (r) => fmtPctN(r.metrics?.nominal.annualized ?? null), better: "desc" },
      { key: "n-vol", label: "Volatilité nominale", tip: "Volatilité annualisée nominale.", get: (r) => r.metrics?.nominal.volatility ?? null, fmt: (r) => fmtPctN(r.metrics?.nominal.volatility ?? null), better: "asc" },
      { key: "n-mdd", label: "Max drawdown nominal", tip: "Pire perte nominale entre un sommet et un point bas.", get: (r) => r.metrics?.nominal.maxDrawdown ?? null, fmt: (r) => fmtPctN(r.metrics?.nominal.maxDrawdown ?? null), better: "desc" },
      { key: "n-sharpe", label: "Sharpe nominal", tip: "Excédent du rendement nominal sur le cash, rapporté à la volatilité.", get: (r) => r.metrics?.nominal.sharpe ?? null, fmt: (r) => fmtRatio(r.metrics?.nominal.sharpe ?? null), better: "desc" },
    ];
  }
  if (mode === "nominal_vs_inflation") {
    return [
      { key: "nvi-nom", label: "Perf. nominale", tip: "Performance nominale annualisée.", get: (r) => r.metrics?.nominal.annualized ?? null, fmt: (r) => fmtPctN(r.metrics?.nominal.annualized ?? null), better: "desc" },
      { key: "nvi-infl", label: "Inflation", tip: "Inflation locale annualisée sur la fenêtre.", get: (r) => r.inflationAnnualized, fmt: (r) => fmtPctN(r.inflationAnnualized), better: "asc" },
      { key: "nvi-real", label: "Perf. réelle", tip: "Performance réelle annualisée (corrigée de l’inflation).", get: (r) => r.metrics?.real?.annualized ?? null, fmt: (r) => fmtPctN(r.metrics?.real?.annualized ?? null), better: "desc" },
      { key: "nvi-ecart", label: "Écart vs inflation", tip: "Écart annualisé, en points, entre performance nominale et inflation.", get: ecartInflation, fmt: (r) => { const e = ecartInflation(r); return e === null ? "—" : `${e > 0 ? "+" : "−"}${Math.abs(e).toFixed(1)} pts`; }, better: "desc" },
      { key: "nvi-mult", label: "Multiple réel", tip: "Gain de pouvoir d’achat cumulé (multiple réel) sur la fenêtre.", get: (r) => r.realMultiple, fmt: (r) => fmtMultiple(r.realMultiple), better: "desc" },
    ];
  }
  // Réel (défaut)
  return [
    { key: "r-cagr", label: "Rendement réel", tip: "Rendement réel annualisé (corrigé de l’inflation locale).", get: (r) => r.metrics?.real?.annualized ?? null, fmt: (r) => fmtPctN(r.metrics?.real?.annualized ?? null), better: "desc" },
    { key: "r-vol", label: "Volatilité réelle", tip: "Volatilité annualisée de la série réelle.", get: (r) => r.metrics?.real?.volatility ?? null, fmt: (r) => fmtPctN(r.metrics?.real?.volatility ?? null), better: "asc" },
    { key: "r-mdd", label: "Max drawdown réel", tip: "Pire perte réelle entre un sommet et un point bas.", get: (r) => r.metrics?.real?.maxDrawdown ?? null, fmt: (r) => fmtPctN(r.metrics?.real?.maxDrawdown ?? null), better: "desc" },
    { key: "r-sharpe", label: "Sharpe réel", tip: "Excédent du rendement réel sur le cash réel, rapporté à la volatilité réelle.", get: (r) => r.metrics?.real?.sharpe ?? null, fmt: (r) => fmtRatio(r.metrics?.real?.sharpe ?? null), better: "desc" },
  ];
}

export function QuadrantsComparisonView({
  rows,
  loading,
  onPick,
  displayMode,
  region,
}: {
  rows: QuadrantModelRow[] | null;
  loading: boolean;
  onPick: (iso: string) => void;
  displayMode: PerfMode;
  region: QuadrantRegion;
}) {
  const numCols = useMemo(() => columnsFor(displayMode), [displayMode]);
  const allCols = useMemo(() => [...numCols, TURNOVER_COL], [numCols]);
  const [sortKey, setSortKey] = useState(numCols[0].key);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  // Pays affichables (régime disponible) + filtre région, CÔTÉ CLIENT.
  const filtered = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => r.latest)
        .filter((r) => region === "monde" || COUNTRY_REGION[r.countryCode] === region),
    [rows, region],
  );

  const sorted = useMemo(() => {
    const col = allCols.find((c) => c.key === sortKey) ?? allCols[0];
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
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
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
  if (!filtered.length) {
    return <Card className="p-10 text-center text-sm text-muted-foreground">Aucune donnée de comparaison disponible.</Card>;
  }

  const scatterTitle =
    displayMode === "nominal_vs_inflation"
      ? "Pouvoir d’achat vs inflation"
      : `Risque / rendement ${displayMode === "nominal" ? "nominal" : "réel"}`;

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("space-y-4", loading && "opacity-60 transition-opacity")}>
        {/* Nuage risque-rendement */}
        <section id="positionnement" className="scroll-mt-[var(--model-header-offset,96px)]">
          <Card className="gap-0 p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <h3 className="text-sm font-semibold">{scatterTitle}</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="cursor-help text-muted-foreground/60 hover:text-foreground">
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-72">
                  {displayMode === "nominal_vs_inflation"
                    ? "Chaque pays positionné par son inflation (horizontal) et son écart de performance vs inflation (vertical). Couleur = régime courant."
                    : "Chaque pays positionné par son risque (horizontal) et son rendement annualisé (vertical), selon le mode. Couleur = régime courant. Cliquez un point pour ouvrir sa vue pays."}
                </TooltipContent>
              </Tooltip>
              <ZoomableSection className="ml-auto" title={scatterTitle}>
                {(close) => (
                  <QuadrantsScatter
                    rows={filtered}
                    onPick={(iso) => {
                      onPick(iso);
                      close();
                    }}
                    displayMode={displayMode}
                    height="72vh"
                  />
                )}
              </ZoomableSection>
            </div>
            <QuadrantsScatter rows={filtered} onPick={onPick} displayMode={displayMode} />
          </Card>
        </section>

        {/* Tableau */}
        <section id="tableau" className="scroll-mt-[var(--model-header-offset,96px)]">
          <Card className="gap-0 overflow-hidden p-0">
            <div className="border-b p-4">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold">Comparaison des pays</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="cursor-help text-muted-foreground/60 hover:text-foreground">
                      <Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-72">
                    Tous les pays sous les mêmes paramètres (stratégie, zone neutre, fenêtre). Le régime
                    reflète le dernier état du modèle ; les métriques suivent la fenêtre. Un historique
                    trop court affiche « — » (jamais 0).
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
                    <th className="px-3 py-2 text-left font-medium">Régime</th>
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
                            dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
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
                    const regime = regimeFromLatest(r.latest!);
                    // Raison précise d'indisponibilité (métriques KO), sinon CPI absent
                    // en mode réel/NvI (métriques OK mais série réelle manquante).
                    const unavailReason: AvailabilityReason | null =
                      r.metricsStatus !== "OK"
                        ? (r.availability.reason ?? "insufficient_history")
                        : displayMode !== "nominal" && !r.metrics?.real
                          ? "cpi_unavailable"
                          : null;
                    const windowTitle = r.effectivePeriod
                      ? `Fenêtre : ${fmtMonth(r.effectivePeriod.start)} → ${fmtMonth(r.effectivePeriod.end)} (${r.effectivePeriod.months} mois)`
                      : "Historique insuffisant sur la fenêtre";
                    return (
                      <tr
                        key={r.countryCode}
                        onClick={() => onPick(r.countryCode)}
                        className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5" title={windowTitle}>
                          <div className="flex items-center gap-2">
                            <CountryFlag code={r.countryCode} countryName={r.countryFr ?? r.countryCode} size={18} />
                            <span className="font-medium">{r.countryFr ?? r.countryCode}</span>
                            {unavailReason && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help rounded border border-amber-500/40 px-1 text-[10px] leading-tight text-amber-600 dark:text-amber-400">
                                    {availabilityLabel(unavailReason)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-64">
                                  {availabilityMessage(unavailReason, r.availability.firstInvalidMonth)}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "inline-block min-w-[172px] rounded-md border px-2 py-0.5 text-center text-[11px] font-medium whitespace-nowrap",
                              regime.style.ring,
                              regime.style.ringBg,
                              regime.style.text,
                            )}
                          >
                            {regime.label}
                          </span>
                        </td>
                        {allCols.map((c) => (
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
        </section>
      </div>
    </TooltipProvider>
  );
}
